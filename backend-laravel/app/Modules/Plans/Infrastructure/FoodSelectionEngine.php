<?php

namespace App\Modules\Plans\Infrastructure;

/**
 * Smart food selection for meal planning.
 * Prioritizes variety, nutrition, budget, and user preferences over simple calorie matching.
 */
final class FoodSelectionEngine
{
    public function __construct(private array $profile, private array $learned) {}

    /**
     * Select foods for AI consideration, optimized for quality and token efficiency.
     *
     * @param  array  $foods  Pre-filtered foods (allergens, diet style, safety already applied)
     * @param  array  $slots  Energy slots from EnergyEngine
     * @return array Minimal food data grouped by meal type
     */
    public function selectForSlots(array $foods, array $slots): array
    {
        $offered = [];
        $usedRecently = $this->recentFoodSlugs();

        foreach ($slots as $slot) {
            $candidates = array_values(array_filter(
                $foods,
                fn ($f) => in_array($slot['mealType'], $f['mealTypes'], true)
            ));

            if (count($candidates) < 2) {
                throw new \RuntimeException('catalog_too_small');
            }

            // Score each food
            foreach ($candidates as &$food) {
                $food['_score'] = $this->score($food, $slot, $usedRecently);
            }

            // Sort by score descending
            usort($candidates, fn ($a, $b) => $b['_score'] <=> $a['_score']);

            // Take top candidates: enough for variety but not wasteful
            $limit = $this->selectLimit(count($candidates), $slot['mealType']);
            $selected = array_slice($candidates, 0, $limit);
            if (in_array($slot['mealType'], ['lunch', 'dinner'], true)) {
                $nonRice = array_slice(array_values(array_filter($candidates, fn ($food) => ! self::containsRice($food))), 0, min(8, $limit));
                $selected = array_slice(array_column([...$nonRice, ...$selected], null, 'slug'), 0, $limit, true);
            }

            // Strip to essential fields only
            $offered[$slot['mealType']] = array_column(
                array_map([$this, 'minimal'], $selected),
                null,
                'slug'
            );
        }

        return $offered;
    }

    public static function containsRice(array $food): bool
    {
        return array_any($food['ingredients'] ?? [], fn ($ingredient) => str_contains($ingredient['name'], 'برنج'));
    }

    /**
     * Calculate food suitability score for a slot.
     */
    private function score(array $food, array $slot, array $usedRecently): float
    {
        $score = 100.0;

        // 1. Calorie proximity (still important, but not the only factor)
        $calorieDeviation = abs($food['kcal'] - $slot['kcal']) / $slot['kcal'];
        $score -= $calorieDeviation * 30;

        // 2. Protein match (especially for weight loss and gain)
        if (in_array($this->profile['track'], ['weight_loss', 'weight_gain'])) {
            $targetProteinRatio = $this->profile['track'] === 'weight_loss' ? 0.25 : 0.20;
            $foodProteinRatio = ($food['proteinG'] * 4) / max(1, $food['kcal']);
            $proteinScore = 1 - abs($foodProteinRatio - $targetProteinRatio) / $targetProteinRatio;
            $score += $proteinScore * 15;
        }

        // 3. Fiber bonus (especially for pregnancy)
        if ($this->profile['track'] === 'pregnancy' && ($food['fiberG'] ?? 0) > 3) {
            $score += min(10, ($food['fiberG'] ?? 0) * 1.5);
        }

        // 4. Budget match
        $userBudget = $this->profile['budget'] ?? 'medium';
        $foodCost = (int) ($food['costTier'] ?? 3);
        if ($userBudget === 'low' && $foodCost <= 2) {
            $score += $foodCost === 1 ? 15 : 5;
        } elseif ($userBudget === 'medium' && $foodCost > 2) {
            $score -= 10;
        } elseif ($userBudget === 'low' && $foodCost > 2) {
            $score -= 15;
        }

        // 5. Preference bonus
        foreach ($this->learned['prefer'] ?? [] as $liked) {
            if ($this->nameMatches($food['nameFa'], $liked)) {
                $score += 12;
                break;
            }
        }

        // 6. Variety: penalize recently used foods
        if (in_array($food['slug'], $usedRecently, true)) {
            $score -= 20;
        }

        // 7. Preparation time penalty for busy users
        $minutes = (int) ($food['prepMinutes'] ?? 30) + (int) ($food['cookMinutes'] ?? 0);
        if ($minutes > 45) {
            $score -= 5;
        }
        if (in_array('fast_meals', $this->learned['patterns'] ?? [], true) && $minutes <= 20) {
            $score += 10;
        }

        // 8. Seasonal and regional bonus (mild)
        $currentSeason = $this->currentSeason();
        if (in_array($currentSeason, $food['seasons'] ?? [], true)) {
            $score += 3;
        }

        return max(0, $score);
    }

    /**
     * Determine how many foods to send for a meal type.
     * Balance between variety and token efficiency.
     */
    private function selectLimit(int $available, string $mealType): int
    {
        // Snacks need less variety
        if ($mealType === 'snack') {
            return min($available, 20);
        }

        // Main meals need more options
        if ($available < 10) {
            return $available;
        }

        if ($available < 30) {
            return min($available, 25);
        }

        if ($available < 100) {
            return 35;
        }

        // For very large catalogs (1000+), still send a reasonable subset
        return 50;
    }

    /**
     * Strip food to only essential fields for AI prompt.
     * Ingredients are NOT sent to AI — the server validates slugs and portions from its own catalogue.
     */
    private function minimal(array $food): array
    {
        return [
            'slug' => $food['slug'],
            'nameFa' => $food['nameFa'],
            'kcal' => $food['kcal'],
            'proteinG' => $food['proteinG'],
            'carbsG' => $food['carbsG'],
            'fatG' => $food['fatG'],
            'fiberG' => $food['fiberG'] ?? 0,
            'ingredients' => $food['ingredients'] ?? [],
        ];
    }

    /**
     * Get slugs of foods used in the current active plan.
     */
    private function recentFoodSlugs(): array
    {
        // This would query the database for the user's current published plan
        // For now, return empty (to be implemented with dependency injection)
        return [];
    }

    /**
     * Check if food name matches a preference string.
     */
    private function nameMatches(string $foodName, string $preference): bool
    {
        $food = mb_strtolower($foodName, 'UTF-8');
        $pref = mb_strtolower(trim($preference), 'UTF-8');

        if ($pref === '' || mb_strlen($pref) < 2) {
            return false;
        }

        return $food === $pref ||
               mb_stripos($food, $pref) !== false ||
               mb_stripos($pref, $food) !== false;
    }

    /**
     * Get current season for seasonal food bonus.
     */
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
}
