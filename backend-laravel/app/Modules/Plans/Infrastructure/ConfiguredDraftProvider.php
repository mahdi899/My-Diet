<?php

namespace App\Modules\Plans\Infrastructure;

use App\Modules\Ai\Infrastructure\ModelPools;
use App\Modules\Food\Application\FoodStore;
use App\Modules\Onboarding\Application\OnboardingStore;
use App\Modules\Onboarding\Domain\EnergyEngine;
use App\Modules\Plans\Application\DraftProvider;
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
        $slots = EnergyEngine::slots((int) $profile['target_kcal'], $profile['meals_per_day']);
        $foods = array_filter($this->foods->all(), fn ($f) => $f['active'] && $f['kcal'] > 0 && $f['ingredients'] !== [] &&
            ! array_intersect($profile['allergens'], $f['allergens']) &&
            ($profile['diet_style'] !== 'vegan' || in_array('vegan', $f['tags'], true)) &&
            ($profile['diet_style'] !== 'vegetarian' || ! array_intersect(['meat', 'poultry', 'fish'], $f['tags'])) &&
            ($profile['track'] !== 'pregnancy' || ! in_array('raw', $f['tags'], true)) &&
            $f['costTier'] <= ($profile['budget'] === 'low' ? 2 : 3));
        $offered = [];
        foreach ($slots as $slot) {
            $list = array_values(array_filter($foods, fn ($f) => in_array($slot['mealType'], $f['mealTypes'], true)));
            usort($list, fn ($a, $b) => abs($a['kcal'] - $slot['kcal']) <=> abs($b['kcal'] - $slot['kcal']));
            if (count($list) < 2) {
                throw new Problem(409, 'catalog_too_small', 'غذای مناسب کافی نیست');
            }
            $offered[$slot['mealType']] = array_column(array_slice($list, 0, 40), null, 'slug');
        }
        $safe = array_intersect_key($profile, array_flip(['track', 'sex', 'age', 'allergens', 'conditions', 'diet_style', 'target_kcal', 'protein_g', 'carbs_g', 'fat_g']));
        $prompt = $this->db->table('ai_prompt_templates')->where(['key' => 'plan_draft', 'status' => 'active'])->orderByDesc('version')->first();
        $schema = '{"days":[{"day":1,"meals":[{"mealType":"breakfast","primary":[{"slug":"catalog_slug","servings":1}],"alternative":[{"slug":"different_slug","servings":1}],"note":""}]}]}';
        $values = ['profile' => json_encode($safe), 'catalog' => json_encode($offered, JSON_UNESCAPED_UNICODE), 'days' => '[1,2,3,4,5,6,7]', 'schema' => $schema, 'untrusted' => '', 'repair' => '', 'used' => ''];
        $template = $prompt->user_template ?? "{{profile}}\n{{catalog}}\n{{days}}\n{{schema}}";
        foreach ($values as $key => $value) {
            $template = str_replace('{{'.$key.'}}', $value, $template);
        }
        $result = $this->pools->run('plan_draft', [
            ['role' => 'system', 'content' => $prompt->system_prompt ?? 'Return JSON for all 7 numbered days, every required slot, primary and a different alternative. Select ONLY offered catalogue slugs. Portions: 0.5,0.75,1,1.25,1.5,2. This is a draft for specialist approval.'],
            ['role' => 'user', 'content' => $template]], $requestId, $user, true,
            fn ($text) => $this->assemble($text, $slots, $offered, (int) $profile['target_kcal']));

        return $result['value'];
    }

    private function assemble(string $text, array $slots, array $offered, int $target): array
    {
        $value = json_decode(trim(preg_replace('/^\\s*```(?:json)?\\s*|\\s*```\\s*$/i', '', $text)), true);
        if (! is_array($value['days'] ?? null) || count($value['days']) !== 7) {
            throw new \InvalidArgumentException('seven_days_required');
        }
        $days = [];
        foreach ($value['days'] as $index => $day) {
            if (($day['day'] ?? null) !== $index + 1 || count($day['meals'] ?? []) !== count($slots)) {
                throw new \InvalidArgumentException('day_slots_invalid');
            }
            $meals = [];
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
                        $names[] = $food['nameFa'];
                        foreach ($food['ingredients'] as $i) {
                            $ingredients[] = ['name' => $i['name'], 'quantity' => round($i['quantity'] * $servings, 2), 'unit' => $i['unit'], 'basis' => 'raw', 'category' => $i['category'] ?? 'other'];
                        }
                    }
                    if (abs($calories - $slot['kcal']) > $slot['kcal'] * 0.2 || count($ingredients) > 30) {
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
            $days[] = ['meals' => $meals];
        }

        return $days;
    }
}
