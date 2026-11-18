<?php

namespace App\Modules\Plans\Infrastructure;

use App\Modules\Ai\Infrastructure\ModelPools;
use App\Modules\Food\Application\FoodStore;
use App\Modules\Onboarding\Application\OnboardingStore;
use App\Modules\Onboarding\Domain\EnergyEngine;
use App\Modules\Plans\Application\CatalogConstraints;
use App\Modules\Plans\Application\DraftProvider;
use App\Modules\Plans\Domain\CivilDates;
use App\Shared\Domain\LegacyCrypto as Crypto;
use App\Shared\Domain\Problem;
use Illuminate\Database\ConnectionInterface;

final class ConfiguredDraftProvider implements DraftProvider
{
    public function __construct(private ModelPools $pools, private ConnectionInterface $db, private OnboardingStore $profiles, private FoodStore $foods) {}

    public function name(): string
    {
        return 'pool';
    }

    public function callsExternalNetwork(): bool
    {
        return true;
    }

    public function draft(string $requestId): array
    {
        $user = $this->db->table('plan_requests')->where('id', $requestId)->value('user_id');
        $profile = $user ? $this->profiles->profile($user) : null;
        if (! $profile || $profile['safety_tier'] !== 'ai_ok' || in_array('other', $profile['allergens'], true)) {
            throw new Problem(409, 'profile_requires_review', 'پرونده باید توسط متخصص بررسی شود');
        }
        $this->enforceSafetyGates($profile);
        $slots = EnergyEngine::slots((int) $profile['target_kcal'], $profile['meals_per_day']);
        $learned = $this->learned($user);
        $gate = new CatalogConstraints;
        $foods = array_filter($this->foods->all(), fn ($f) => $f['active'] && $f['kcal'] > 0 && $f['ingredients'] !== [] &&
            ! array_intersect($profile['allergens'], $f['allergens']) &&
            ($profile['diet_style'] !== 'vegan' || in_array('vegan', $f['tags'], true)) &&
            ($profile['diet_style'] !== 'vegetarian' || ! array_intersect(['meat', 'poultry', 'fish'], $f['tags'])) &&
            ($profile['track'] !== 'pregnancy' || ! in_array('raw', $f['tags'], true)) &&
            $gate->allows($f, $profile, $learned['avoid'], $learned['specialistNotes'], true));

        $selector = new FoodSelectionEngine($profile, $learned);
        try {
            $offeredForPrompt = $selector->selectForSlots($foods, $slots);
        } catch (\RuntimeException $e) {
            throw new Problem(409, $e->getMessage(), 'غذای مناسب کافی نیست');
        }
        // `offered` = ALL eligible foods keyed by mealType+slug, for server-side validation.
        // `offeredForPrompt` = top-N per slot, sent to AI.
        $offered = [];
        foreach ($slots as $slot) {
            $list = array_values(array_filter($foods, fn ($f) => in_array($slot['mealType'], $f['mealTypes'], true)));
            $offered[$slot['mealType']] = array_column($list, null, 'slug');
        }
        // Build compact catalog for the AI prompt (slugs + name + kcal only).
        $catalogPrompt = [];
        foreach ($offeredForPrompt as $mealType => $list) {
            $rows = [];
            foreach ($list as $food) {
                $rows[] = sprintf(
                    '%s | %s | %d kcal | P%.0f C%.0f F%.0f g',
                    $food['slug'],
                    $food['nameFa'],
                    (int) $food['kcal'],
                    (float) ($food['proteinG'] ?? 0),
                    (float) ($food['carbsG'] ?? 0),
                    (float) ($food['fatG'] ?? 0)
                );
            }
            $catalogPrompt[$mealType] = implode("\n", $rows);
        }
        $safe = array_intersect_key($profile, array_flip(['track', 'sex', 'age', 'allergens', 'conditions', 'diet_style', 'target_kcal', 'protein_g', 'carbs_g', 'fat_g']));
        $safe['learned'] = $learned;
        $prompt = $this->db->table('ai_prompt_templates')->where(['key' => 'plan_draft', 'status' => 'active'])->orderByDesc('version')->first();
        $schema = '{"days":[{"day":1,"meals":[{"mealType":"breakfast","primary":[{"slug":"catalog_slug","servings":1}],"alternative":[{"slug":"different_slug","servings":1}],"note":""}]}]}';
        // Use compact text catalog for prompt, full JSON for validation
        $catalogText = '';
        foreach ($catalogPrompt as $mealType => $lines) {
            $catalogText .= strtoupper($mealType).":\n{$lines}\n\n";
        }
        $values = ['profile' => json_encode($safe, JSON_UNESCAPED_UNICODE), 'catalog' => trim($catalogText), 'days' => '[1,2,3,4,5,6,7]', 'schema' => $schema, 'untrusted' => '', 'repair' => '', 'used' => '', 'season' => $this->currentSeason()];
        $template = $prompt->user_template ?? "{{profile}}\n{{catalog}}\n{{days}}\n{{schema}}";
        foreach ($values as $key => $value) {
            $template = str_replace('{{'.$key.'}}', $value, $template);
        }
        $bounds = $this->constraints($slots, (int) $profile['target_kcal']);
        $messages = [
            ['role' => 'system', 'content' => ($prompt->system_prompt ?? 'Return JSON for all 7 numbered days, every required slot, primary and a different alternative. Select ONLY offered catalogue slugs. Portions: 0.5,0.75,1,1.25,1.5,2. This is a draft for specialist approval.')."\n".$bounds],
            ['role' => 'user', 'content' => $template."\n\n".$bounds],
        ];
        $validate = function ($text) use ($slots, $offered, $profile) {
            try {
                return $this->assemble($text, $slots, $offered, $profile);
            } catch (\InvalidArgumentException $error) {
                if (getenv('DRAFT_DEBUG') === '1') {
                    file_put_contents(storage_path('logs/draft-error.txt'), $error->getMessage());
                }
                throw $error;
            }
        };
        try {
            $result = $this->pools->run('plan_draft', $messages, $requestId, $user, true, $validate);
        } catch (Problem $error) {
            if ($error->problemCode !== 'invalid_plan') {
                throw $error;
            }

            // Log the validation failure for analysis
            if (getenv('DRAFT_DEBUG') === '1') {
                file_put_contents(
                    storage_path('logs/draft-validation-fail.txt'),
                    date('Y-m-d H:i:s')." | Request: {$requestId} | Error: {$error->messageFa}\n",
                    FILE_APPEND
                );
            }

            // Only retry if the error is potentially fixable by better instructions
            $retryableErrors = ['seven_days_required', 'meal_energy_invalid', 'daily_energy_invalid', 'alternative_same', 'unknown_food_or_portion'];
            $errorCode = $error->messageFa;

            if (! $this->isRetryable($errorCode, $retryableErrors)) {
                throw $error;
            }

            $messages[1]['content'] .= "\n\n".$this->buildRepairGuidance($errorCode, $slots, (int) $profile['target_kcal']);

            try {
                $result = $this->pools->run('plan_draft', $messages, $requestId, $user, true, $validate);
            } catch (Problem $repairError) {
                if ($repairError->problemCode === 'pool_empty') {
                    throw $error; // Return original error
                }
                throw $repairError;
            }
        }

        return $result['value'];
    }

    private function currentSeason(): string
    {
        $month = (int) date('n');
        if ($month >= 3 && $month <= 5) {
            return 'spring';
        }
        if ($month >= 6 && $month <= 8) {
            return 'summer';
        }
        if ($month >= 9 && $month <= 11) {
            return 'autumn';
        }

        return 'winter';
    }

    private function isRetryable(string $errorMessage, array $retryablePatterns): bool
    {
        foreach ($retryablePatterns as $pattern) {
            if (str_contains($errorMessage, $pattern)) {
                return true;
            }
        }

        return false;
    }

    /** @param  list<array{mealType: string, kcal: int}>  $slots */
    private function constraints(array $slots, int $target): string
    {
        $lowDay = (int) floor($target * 0.85);
        $highDay = (int) ceil($target * 1.15);
        $lines = [
            'قیدهای قطعی: دقیقاً ۷ روز با day از ۱ تا ۷ و همهٔ وعده‌های هر روز. JSON را ناقص رها نکن.',
            "جمع کالری primary هر روز باید بین {$lowDay} و {$highDay} باشد.",
        ];
        foreach ($slots as $slot) {
            $kcal = (int) $slot['kcal'];
            $low = (int) floor($kcal * 0.65);
            $high = (int) ceil($kcal * 1.35);
            $lines[] = sprintf('%s هدف %d؛ primary و alternative هر کدام جداگانه بین %d و %d کیلوکالری.', $slot['mealType'], $kcal, $low, $high);
        }
        $lines[] = 'servings فقط 0.5، 0.75، 1، 1.25، 1.5 یا 2. اگر یک غذا به بازه نمی‌رسد، دو یا سه غذا از همان وعده را جمع کن. alternative باید slug متفاوت داشته باشد.';

        return implode("\n", $lines);
    }

    private function buildRepairGuidance(string $error, array $slots, int $target): string
    {
        $bounds = $this->constraints($slots, $target);
        if (str_contains($error, 'seven_days_required')) {
            return "خروجی قبلی هفت روز کامل نبود.\n{$bounds}";
        }
        if (str_contains($error, 'meal_energy_invalid')) {
            return "خروجی قبلی کالری وعده را خارج از بازهٔ ۳۵٪ گذاشت.\n{$bounds}";
        }

        if (str_contains($error, 'daily_energy_invalid')) {
            return "خروجی قبلی جمع روز را خارج از بازهٔ ۱۵٪ هدف گذاشت.\n{$bounds}";
        }

        if (str_contains($error, 'alternative_same')) {
            return '⚠️ CRITICAL: Alternative must be DIFFERENT food than primary. Alternative should have similar calories but completely different title and slug.';
        }

        if (str_contains($error, 'unknown_food_or_portion')) {
            return '⚠️ CRITICAL: You used a food slug that is NOT in the catalogue. ONLY use slugs from the provided catalogue. Portions must be exactly one of: 0.5, 0.75, 1.0, 1.25, 1.5, 2.0';
        }

        return "⚠️ Previous JSON failed validation: {$error}. Use only offered slugs, valid servings (0.5, 0.75, 1.0, 1.25, 1.5, 2.0), and ensure energy targets are met within tolerance.";
    }

    private function snapPortion(array $items, array $foods, int $target): array
    {
        if (count($items) !== 1) {
            return $items;
        }
        $food = $foods[$items[0]['slug'] ?? ''] ?? null;
        if ($food === null) {
            return $items;
        }
        $best = (float) ($items[0]['servings'] ?? 1);
        $bestDiff = abs($food['kcal'] * $best - $target);
        foreach ([0.5, 0.75, 1.0, 1.25, 1.5, 2.0] as $servings) {
            $diff = abs($food['kcal'] * $servings - $target);
            if ($diff < $bestDiff) {
                $best = $servings;
                $bestDiff = $diff;
            }
        }
        $items[0]['servings'] = $best;

        return $items;
    }

    private function energyTolerance(array $slot, array $offered): float
    {
        foreach ($offered as $food) {
            foreach ([0.5, 0.75, 1.0, 1.25, 1.5, 2.0] as $servings) {
                if (abs($food['kcal'] * $servings - $slot['kcal']) <= $slot['kcal'] * 0.15) {
                    return 0.15;
                }
            }
        }

        // Reduced from 0.45 to 0.30 for tighter control
        return 0.30;
    }

    /**
     * Additional safety gates beyond AI capability checks.
     * These are hard backend rules that cannot be overridden by AI.
     */
    private function enforceSafetyGates(array $profile): void
    {
        $track = $profile['track'] ?? '';
        $conditions = $profile['conditions'] ?? [];

        // Pregnancy and breastfeeding require specialist approval
        if ($track === 'pregnancy') {
            $stage = $profile['life_stage'] ?? '';
            if ($stage === 'pregnant' || $stage === 'breastfeeding') {
                throw new Problem(409, 'specialist_approval_required',
                    'برنامه بارداری و شیردهی نیاز به تأیید متخصص دارد');
            }
        }

        // Critical medical conditions require specialist
        $criticalConditions = ['diabetes', 'kidney', 'heart', 'thyroid', 'pcos'];
        if (array_intersect($criticalConditions, $conditions)) {
            throw new Problem(409, 'medical_review_required',
                'وضعیت پزشکی شما نیاز به بررسی متخصص دارد');
        }
    }

    private function learned(string $user): array
    {
        $prefs = $this->db->table('coach_preferences')
            ->where('user_id', $user)->where('active', 1)
            ->whereIn('pref_key', ['food_dislike', 'food_like', 'pattern', 'specialist_note'])
            ->orderByDesc('strength')->limit(12)->get(['pref_key', 'value']);
        $swaps = $this->db->table('meal_swap_logs')->where('user_id', $user)->orderByDesc('created_at')->limit(8)->get(['old_title', 'reason']);

        $weekStart = $this->db->table('plan_requests')->where('user_id', $user)->where('status', 'published')->orderByDesc('week_start')->value('week_start');
        $logs = 0;
        $weights = 0;
        if (is_string($weekStart) && $weekStart !== '') {
            $end = CivilDates::add(substr($weekStart, 0, 10), 6);
            $logs = $this->db->table('meal_logs')->where('user_id', $user)->whereBetween('scheduled_date', [substr($weekStart, 0, 10), $end])->count();
            $weights = $this->db->table('weight_entries')->where('user_id', $user)->whereBetween('civil_date', [substr($weekStart, 0, 10), $end])->count();
        }

        return [
            'avoid' => $prefs->where('pref_key', 'food_dislike')->pluck('value')->values()->all(),
            'prefer' => $prefs->where('pref_key', 'food_like')->pluck('value')->values()->all(),
            'patterns' => $prefs->where('pref_key', 'pattern')->pluck('value')->values()->all(),
            'specialistNotes' => $prefs->where('pref_key', 'specialist_note')->pluck('value')->values()->all(),
            'recentSwapReasons' => $swaps->map(fn ($row) => $row->reason.':'.$row->old_title)->all(),
            'intakeRecords' => $logs,
            'weightRecords' => $weights,
            'missingData' => array_values(array_filter([$logs === 0 ? 'intake' : null, $weights === 0 ? 'weight' : null])),
        ];
    }

    private function assemble(string $text, array $slots, array $offered, array $profile): array
    {
        $value = json_decode(trim(preg_replace('/^\\s*```(?:json)?\\s*|\\s*```\\s*$/i', '', $text)), true);
        if (getenv('DRAFT_DEBUG') === '1') {
            file_put_contents(storage_path('logs/draft-last.txt'), $text);
        }
        if (! is_array($value['days'] ?? null) || count($value['days']) !== 7) {
            throw new \InvalidArgumentException('seven_days_required');
        }
        $target = (int) $profile['target_kcal'];
        $gate = new CatalogConstraints;
        $bestFiber = 0.0;
        foreach ($slots as $slot) {
            $top = 0.0;
            foreach ($offered[$slot['mealType']] ?? [] as $food) {
                $top = max($top, (float) ($food['fiberG'] ?? 0) * 2);
            }
            $bestFiber += $top;
        }
        $days = [];
        foreach ($value['days'] as $index => $day) {
            if (($day['day'] ?? null) !== $index + 1 || count($day['meals'] ?? []) !== count($slots)) {
                throw new \InvalidArgumentException('day_slots_invalid');
            }
            $meals = [];
            $dayFiber = 0.0;
            foreach ($slots as $slot) {
                $found = array_values(array_filter($day['meals'], fn ($m) => ($m['mealType'] ?? null) === $slot['mealType']));
                if (count($found) !== 1) {
                    throw new \InvalidArgumentException('slot_missing');
                }
                $options = [];
                foreach (['primary' => 'primary', 'alternative' => 'ai_alternative'] as $key => $kind) {
                    $items = $found[0][$key] ?? null;
                    if (! is_array($items) || count($items) < 1 || count($items) > 6) {
                        throw new \InvalidArgumentException('invalid_items');
                    }
                    $items = $this->snapPortion($items, $offered[$slot['mealType']] ?? [], $slot['kcal']);
                    $ingredients = [];
                    $names = [];
                    $calories = 0;
                    foreach ($items as $item) {
                        $food = $offered[$slot['mealType']][$item['slug'] ?? ''] ?? null;
                        $servings = $item['servings'] ?? null;
                        if (! $food || ! is_numeric($servings) || ! in_array((float) $servings, [0.5, 0.75, 1.0, 1.25, 1.5, 2.0], true)) {
                            throw new \InvalidArgumentException('unknown_food_or_portion');
                        }
                        $calories += $food['kcal'] * $servings;
                        if ($key === 'primary') {
                            $dayFiber += (float) ($food['fiberG'] ?? 0) * (float) $servings;
                        }
                        $names[] = $food['nameFa'];
                        foreach ($food['ingredients'] as $i) {
                            $ingredients[] = ['name' => $i['name'], 'quantity' => round($i['quantity'] * $servings, 2), 'unit' => $i['unit'], 'basis' => 'raw', 'category' => $i['category'] ?? 'other'];
                        }
                    }
                    if (abs($calories - $slot['kcal']) > $slot['kcal'] * 0.35 || count($ingredients) > 30) {
                        throw new \InvalidArgumentException('meal_energy_invalid');
                    }
                    $options[] = ['optionId' => Crypto::uuid(), 'kind' => $kind, 'title' => mb_substr(implode(' + ', $names), 0, 200), 'calories' => (int) round($calories),
                        'portion' => ['quantity' => 1, 'unit' => 'serving', 'basis' => 'as_served'], 'ingredients' => $ingredients,
                        'instructions' => mb_substr((string) ($found[0]['note'] ?? ''), 0, 4000), 'preparationMinutes' => 0, 'approved' => false];
                }
                if ($options[0]['title'] === $options[1]['title']) {
                    throw new \InvalidArgumentException('alternative_same');
                }
                $meals[] = ['mealType' => $slot['mealType'], 'suggestedTime' => $slot['suggestedTime'], 'title' => $options[0]['title'], 'calories' => $options[0]['calories'], 'notes' => '',
                    'items' => array_map(fn ($i) => array_intersect_key($i, array_flip(['name', 'quantity', 'unit'])), $options[0]['ingredients']), 'options' => $options];
            }
            if (abs(array_sum(array_column($meals, 'calories')) - $target) > $target * 0.15) {
                throw new \InvalidArgumentException('daily_energy_invalid');
            }
            if ($gate->fiberShort((string) ($profile['track'] ?? ''), $dayFiber, $bestFiber)) {
                throw new \InvalidArgumentException('micronutrient_short');
            }
            $days[] = ['meals' => $meals];
        }

        return $days;
    }
}
