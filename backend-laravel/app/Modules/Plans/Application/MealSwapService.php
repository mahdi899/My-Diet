<?php

declare(strict_types=1);

namespace App\Modules\Plans\Application;

use App\Modules\Coach\Application\PreferenceService;
use App\Modules\Food\Application\FoodStore;
use App\Shared\Domain\LegacyCrypto;
use App\Shared\Domain\Problem;
use Illuminate\Database\ConnectionInterface;

/**
 * Ranks catalogue foods that can replace one planned meal.
 * Filters allergens, diet style, meal slot, cost and calorie distance.
 */
final class MealSwapService
{
    private const MAX_RESULTS = 5;

    private const MACRO_TOLERANCE = 0.20;

    public function __construct(
        private ConnectionInterface $db,
        private PreferenceService $preferences,
        private FoodStore $foods,
    ) {}

    public function alternatives(string $userId, string $mealId, string $reason = 'variety', bool $budgetOk = false): array
    {
        $meal = $this->loadMeal($userId, $mealId);
        $profile = $this->loadProfile($userId);
        if ($meal === null) {
            throw new Problem(404, 'meal_not_found', 'وعده غذایی پیدا نشد');
        }
        if ($profile === null) {
            throw new Problem(422, 'no_profile', 'پروفایل تغذیه‌ای کاربر یافت نشد');
        }

        $dislikes = $this->db->table('coach_preferences')
            ->where('user_id', $userId)->where('pref_key', 'food_dislike')->where('active', 1)
            ->pluck('value')->map(fn ($name) => mb_strtolower((string) $name, 'UTF-8'))->all();
        $notes = $this->db->table('coach_preferences')
            ->where('user_id', $userId)->where('pref_key', 'specialist_note')->where('active', 1)
            ->pluck('value')->all();
        $used = $this->weeklyTitles($userId);
        $scored = $this->score($this->candidates($meal, $profile, $reason, $budgetOk, $dislikes, $notes), $meal, $reason, $used);

        return [
            'meal' => ['id' => $meal['id'], 'type' => $meal['meal_type'], 'title' => $meal['title'], 'kcal' => $meal['kcal']],
            'alternatives' => array_slice($scored, 0, self::MAX_RESULTS),
            'tooFewResults' => count($scored) < 3,
        ];
    }

    public function apply(string $userId, string $mealId, string $foodSlug, string $reason): array
    {
        $meal = $this->loadMeal($userId, $mealId);
        if ($meal === null) {
            throw new Problem(404, 'meal_not_found', 'وعده غذایی پیدا نشد');
        }
        $food = $this->foods->get($foodSlug);
        if ($food === null || empty($food['active'])) {
            throw new Problem(404, 'food_not_found', 'غذای انتخاب‌شده در کاتالوگ نیست');
        }
        $profile = $this->loadProfile($userId) ?? [];
        if ($this->blockedByAllergen($food, $profile['allergens'] ?? [])) {
            throw new Problem(422, 'allergen_blocked', 'این غذا با حساسیت ثبت‌شده سازگار نیست');
        }
        $notes = $this->db->table('coach_preferences')
            ->where('user_id', $userId)->where('pref_key', 'specialist_note')->where('active', 1)->pluck('value')->all();
        $avoid = $this->db->table('coach_preferences')
            ->where('user_id', $userId)->where('pref_key', 'food_dislike')->where('active', 1)->pluck('value')->all();
        if (! (new CatalogConstraints())->allows($food, $profile, $avoid, $notes, false)) {
            throw new Problem(422, 'food_blocked', 'این غذا با ترجیح، دستور متخصص یا وضعیت تأیید تغذیه سازگار نیست');
        }

        $this->db->transaction(function () use ($meal, $food, $userId, $reason, $foodSlug): void {
            // Published plan rows are protected by a database trigger.
            if ($meal['status'] === 'draft') {
                $this->db->table('plan_meals')->where('id', $meal['id'])->update([
                    'title' => $food['nameFa'],
                    'calories' => (int) $food['kcal'],
                ]);
            }
            $this->db->table('meal_swap_logs')->insert([
                'id' => LegacyCrypto::uuid(),
                'user_id' => $userId,
                'meal_id' => $meal['id'],
                'old_title' => $meal['title'],
                'new_food_slug' => $foodSlug,
                'new_title' => $food['nameFa'],
                'new_kcal' => (int) $food['kcal'],
                'reason' => $reason,
                'created_at' => $this->db->raw('current_timestamp(6)'),
            ]);
            $this->preferences->onMealSwapped($userId, $meal['title'], $food['nameFa'], $reason);
        });

        return [
            'success' => true,
            'newMeal' => ['id' => $meal['id'], 'title' => $food['nameFa'], 'kcal' => (int) $food['kcal'], 'type' => $meal['meal_type']],
        ];
    }

    private function loadMeal(string $userId, string $mealId): ?array
    {
        $row = $this->db->selectOne(
            'SELECT m.id, m.meal_type, m.title, m.calories AS kcal, v.status
             FROM plan_meals m
             JOIN plan_days d ON d.id = m.plan_day_id
             JOIN plan_versions v ON v.id = d.plan_version_id
             JOIN plan_requests r ON r.id = v.request_id
             WHERE r.user_id = ? AND (m.id = ? OR m.meal_uid = ?)',
            [$userId, $mealId, $mealId]
        );

        return $row === null ? null : [
            'id' => $row->id,
            'meal_type' => $row->meal_type,
            'title' => $row->title,
            'kcal' => (int) $row->kcal,
            'status' => $row->status,
        ];
    }

    private function loadProfile(string $userId): ?array
    {
        $row = $this->db->selectOne(
            'SELECT track, allergens, diet_style, budget, safety_tier FROM nutrition_profiles WHERE user_id = ?',
            [$userId]
        );
        if ($row === null) {
            return null;
        }

        return [
            'track' => $row->track,
            'allergens' => json_decode($row->allergens ?? '[]', true) ?: [],
            'diet_style' => $row->diet_style ?? 'regular',
            'budget' => $row->budget ?? 'medium',
            'safety_tier' => $row->safety_tier ?? 'ai_ok',
        ];
    }

    private function weeklyTitles(string $userId): array
    {
        $rows = $this->db->select(
            'SELECT m.title FROM active_plan_versions a
             JOIN plan_days d ON d.plan_version_id = a.version_id
             JOIN plan_meals m ON m.plan_day_id = d.id
             WHERE a.user_id = ?',
            [$userId]
        );

        return array_map(fn ($row) => mb_strtolower($row->title, 'UTF-8'), $rows);
    }

    private function candidates(array $meal, array $profile, string $reason, bool $budgetOk, array $dislikes, array $notes): array
    {
        $budgetMap = ['low' => 1, 'medium' => 2, 'high' => 3];
        $budget = $budgetMap[$profile['budget']] ?? 2;
        $lo = $meal['kcal'] * (1 - self::MACRO_TOLERANCE);
        $hi = $meal['kcal'] * (1 + self::MACRO_TOLERANCE);

        $gate = new CatalogConstraints();

        return array_values(array_filter($this->foods->all(), function (array $food) use ($meal, $profile, $reason, $budgetOk, $budget, $lo, $hi, $dislikes, $notes, $gate): bool {
            if (empty($food['active']) || (int) $food['kcal'] <= 0) {
                return false;
            }
            if (! in_array($meal['meal_type'], $food['mealTypes'] ?? [], true)) {
                return false;
            }
            if ((int) $food['kcal'] < $lo || (int) $food['kcal'] > $hi) {
                return false;
            }
            if ($this->blockedByAllergen($food, $profile['allergens'])) {
                return false;
            }
            $tags = $food['tags'] ?? [];
            if ($profile['diet_style'] === 'vegan' && ! in_array('vegan', $tags, true)) {
                return false;
            }
            if ($profile['diet_style'] === 'vegetarian' && array_intersect(['meat', 'poultry', 'fish'], $tags)) {
                return false;
            }
            $tier = (int) ($food['costTier'] ?? 2);
            if ($reason === 'budget' && $tier > $budget) {
                return false;
            }
            if (! $budgetOk && $reason !== 'budget' && abs($tier - $budget) > 1) {
                return false;
            }
            if ($reason === 'time' && (int) ($food['prepMinutes'] ?? 99) > 20) {
                return false;
            }
            if (! $gate->allows($food, $profile, $dislikes, $notes, false)) {
                return false;
            }
            if (mb_strtolower((string) $food['nameFa'], 'UTF-8') === mb_strtolower($meal['title'], 'UTF-8')) {
                return false;
            }

            return true;
        }));
    }

    private function blockedByDislike(string $name, array $dislikes): bool
    {
        $name = mb_strtolower($name, 'UTF-8');
        foreach ($dislikes as $dislike) {
            if ($dislike !== '' && ($name === $dislike || str_contains($name, $dislike) || str_contains($dislike, $name))) {
                return true;
            }
        }

        return false;
    }

    private function blockedByAllergen(array $food, array $allergens): bool
    {
        return $allergens !== [] && array_intersect($allergens, $food['allergens'] ?? []) !== [];
    }

    private function score(array $foods, array $meal, string $reason, array $usedTitles): array
    {
        $ranked = [];
        foreach ($foods as $food) {
            $score = max(0, 30 - (abs((int) $food['kcal'] - $meal['kcal']) / max(1, $meal['kcal'])) * 100);
            if (! in_array(mb_strtolower((string) $food['nameFa'], 'UTF-8'), $usedTitles, true)) {
                $score += 20;
            }
            if ($reason === 'budget' && (int) ($food['costTier'] ?? 3) === 1) {
                $score += 15;
            }
            if ($reason === 'time' && (int) ($food['prepMinutes'] ?? 99) <= 15) {
                $score += 15;
            }
            if ((float) ($food['fiberG'] ?? 0) >= 5) {
                $score += 5;
            }
            $ranked[] = [
                'slug' => $food['slug'],
                'name' => $food['nameFa'],
                'kcal' => (int) $food['kcal'],
                'protein' => round((float) ($food['proteinG'] ?? 0), 1),
                'carbs' => round((float) ($food['carbsG'] ?? 0), 1),
                'fat' => round((float) ($food['fatG'] ?? 0), 1),
                'costTier' => (int) ($food['costTier'] ?? 2),
                'prepMinutes' => (int) ($food['prepMinutes'] ?? 0),
                'score' => round($score, 1),
            ];
        }
        usort($ranked, fn ($a, $b) => $b['score'] <=> $a['score']);

        return $ranked;
    }
}
