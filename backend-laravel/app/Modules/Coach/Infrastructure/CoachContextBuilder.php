<?php

namespace App\Modules\Coach\Infrastructure;

use App\Modules\Plans\Domain\CivilDates;
use Illuminate\Database\ConnectionInterface;

/**
 * Builds personalized context for the AI coach based on user's current state.
 * Only injects relevant information to minimize token usage.
 */
final class CoachContextBuilder
{
    public function __construct(private ConnectionInterface $db) {}

    /**
     * Build context for a chat message.
     * Dynamically includes: profile summary, today plan, preferences, progress.
     *
     * @param  string  $messageText  User message text for relevance detection
     * @return array{profile: array, todayPlan: ?array, preferences: array, progress: ?array}
     */
    public function buildForChat(string $userId, string $messageText): array
    {
        $lower = mb_strtolower($messageText, 'UTF-8');

        return [
            'profile' => $this->profileSummary($userId),
            'todayPlan' => $this->needsPlan($lower) ? $this->todayPlan($userId) : null,
            'preferences' => $this->needsPreferences($lower) ? $this->userPreferences($userId) : [],
            'progress' => $this->needsProgress($lower) ? $this->progressSummary($userId) : null,
        ];
    }

    /**
     * Build context for meal swap request.
     */
    public function buildForSwap(string $userId, string $mealId): array
    {
        return [
            'profile' => $this->profileSummary($userId),
            'meal' => $this->mealDetails($mealId),
            'preferences' => $this->userPreferences($userId),
            'weekPlan' => $this->weekMeals($userId),
        ];
    }

    /**
     * Build context for photo analysis.
     */
    public function buildForVision(string $userId): array
    {
        return [
            'profile' => $this->profileSummary($userId),
            'todayPlan' => $this->todayPlan($userId),
            'recentLogs' => $this->recentMealLogs($userId, 3),
        ];
    }

    // ── Private helpers ──────────────────────────────────────────────────────

    private function profileSummary(string $userId): array
    {
        $user = $this->db->table('users')->where('id', $userId)->first(['display_name']);
        $name = $user->display_name ?? 'کاربر';
        $profile = $this->db->selectOne(
            'SELECT track, goal, sex, age, height_cm, weight_kg, target_weight_kg, target_kcal,
                    protein_g, carbs_g, fat_g, diet_style, meals_per_day, allergens, safety_tier
             FROM nutrition_profiles WHERE user_id = ?',
            [$userId]
        );

        if (! $profile) {
            return ['name' => $name, 'hasProfile' => false];
        }

        return [
            'hasProfile' => true,
            'name' => $name,
            'goal' => $profile->goal ?: $profile->track,
            'sex' => $profile->sex,
            'age' => $profile->age,
            'currentWeight' => round((float) $profile->weight_kg, 1),
            'targetWeight' => round($profile->target_weight_kg ?? 0, 1),
            'targetKcal' => (int) $profile->target_kcal,
            'protein' => (int) $profile->protein_g,
            'carbs' => (int) $profile->carbs_g,
            'fat' => (int) $profile->fat_g,
            'dietStyle' => $profile->diet_style,
            'mealsPerDay' => (int) $profile->meals_per_day,
            'allergens' => json_decode($profile->allergens ?? '[]', true),
            'safetyTier' => $profile->safety_tier,
        ];
    }

    private function todayPlan(string $userId): ?array
    {
        $today = CivilDates::today();
        $meals = $this->db->select(
            'SELECT m.id, m.meal_type, m.meal_uid, m.title, m.calories
             FROM active_plan_versions a
             JOIN plan_versions v ON v.id = a.version_id
             JOIN plan_days d ON d.plan_version_id = v.id AND d.civil_date = ?
             JOIN plan_meals m ON m.plan_day_id = d.id
             WHERE a.user_id = ?
             ORDER BY m.position',
            [$today, $userId]
        );

        if (empty($meals)) {
            return null;
        }

        return [
            'date' => $today,
            'meals' => array_map(fn ($m) => [
                'id' => $m->id,
                'type' => $m->meal_type,
                'title' => $m->title,
                'kcal' => (int) $m->calories,
            ], $meals),
        ];
    }

    private function userPreferences(string $userId): array
    {
        $prefs = $this->db->table('coach_preferences')
            ->where('user_id', $userId)
            ->where('active', true)
            ->orderByDesc('strength')
            ->limit(20)
            ->get(['pref_key', 'value', 'strength']);

        $grouped = [];
        foreach ($prefs as $p) {
            $grouped[$p->pref_key][] = ['value' => $p->value, 'strength' => (int) $p->strength];
        }

        return $grouped;
    }

    private function progressSummary(string $userId): ?array
    {
        $weights = $this->db->table('weight_entries')
            ->where('user_id', $userId)
            ->orderByDesc('civil_date')
            ->limit(7)
            ->get(['civil_date', 'kilograms']);

        if ($weights->isEmpty()) {
            return null;
        }

        $latest = $weights->first();
        $oldest = $weights->last();
        $change = $weights->count() > 1 ? round($latest->kilograms - $oldest->kilograms, 1) : 0;

        return [
            'latestWeight' => round((float) $latest->kilograms, 1),
            'latestDate' => $latest->civil_date,
            'weeklyChange' => $change,
            'trend' => $change < -0.3 ? 'decreasing' : ($change > 0.3 ? 'increasing' : 'stable'),
        ];
    }

    private function mealDetails(string $mealId): ?array
    {
        $meal = $this->db->selectOne(
            'SELECT m.meal_type, m.title, m.calories, d.civil_date
             FROM plan_meals m
             JOIN plan_days d ON d.id = m.plan_day_id
             WHERE m.id = ?',
            [$mealId]
        );

        return $meal ? [
            'type' => $meal->meal_type,
            'title' => $meal->title,
            'kcal' => (int) $meal->calories,
            'date' => $meal->civil_date,
        ] : null;
    }

    private function weekMeals(string $userId): array
    {
        $meals = $this->db->select(
            'SELECT m.title, d.civil_date
             FROM active_plan_versions a
             JOIN plan_versions v ON v.id = a.version_id
             JOIN plan_days d ON d.plan_version_id = v.id
             JOIN plan_meals m ON m.plan_day_id = d.id
             WHERE a.user_id = ?
             ORDER BY d.civil_date, m.position',
            [$userId]
        );

        return array_map(fn ($m) => $m->title, $meals);
    }

    private function recentMealLogs(string $userId, int $limit): array
    {
        $logs = $this->db->select(
            'SELECT l.scheduled_date, m.meal_type, m.title, m.calories
             FROM meal_logs l
             JOIN plan_meals m ON m.id = l.plan_meal_id
             WHERE l.user_id = ? AND l.eaten = 1
             ORDER BY l.scheduled_date DESC
             LIMIT ?',
            [$userId, $limit]
        );

        return array_map(fn ($l) => [
            'date' => $l->scheduled_date,
            'type' => $l->meal_type,
            'food' => $l->title,
            'kcal' => (int) $l->calories,
        ], $logs);
    }

    private function needsPlan(string $lower): bool
    {
        $keywords = ['ناهار', 'صبحانه', 'شام', 'میان‌وعده', 'برنامه', 'امروز', 'فردا', 'غذا'];
        foreach ($keywords as $kw) {
            if (str_contains($lower, $kw)) {
                return true;
            }
        }

        return false;
    }

    private function needsPreferences(string $lower): bool
    {
        $keywords = ['تعویض', 'جایگزین', 'دوست ندارم', 'نمی‌خوام', 'عوض کن'];
        foreach ($keywords as $kw) {
            if (str_contains($lower, $kw)) {
                return true;
            }
        }

        return false;
    }

    private function needsProgress(string $lower): bool
    {
        $keywords = ['وزن', 'پیشرفت', 'کاهش', 'افزایش', 'چقدر', 'کیلو', 'موفق'];
        foreach ($keywords as $kw) {
            if (str_contains($lower, $kw)) {
                return true;
            }
        }

        return false;
    }
}
