<?php

namespace Tests\Feature;

use App\Modules\Onboarding\Domain\EnergyEngine;
use App\Modules\Plans\Infrastructure\FoodSelectionEngine;
use App\Modules\Plans\Infrastructure\PlanGenerationMetrics;
use Illuminate\Database\ConnectionInterface;
use Tests\TestCase;

class PlanGenerationOptimizationTest extends TestCase
{
    /**
     * Test food selection for different catalog sizes.
     */
    public function test_food_selection_scales_appropriately(): void
    {
        $profile = [
            'track' => 'weight_loss',
            'target_kcal' => 1800,
            'meals_per_day' => 3,
            'budget' => 'medium',
            'protein_g' => 135,
        ];

        $learned = [
            'avoid' => ['گوشت قرمز'],
            'prefer' => ['سالاد', 'ماهی'],
        ];

        $slots = EnergyEngine::slots(1800, 3);

        // Simulate different catalog sizes
        $catalogs = [50, 100, 500, 1000];
        $results = [];

        foreach ($catalogs as $size) {
            $foods = $this->generateMockFoods($size);

            $selector = new FoodSelectionEngine($profile, $learned);
            $offered = $selector->selectForSlots($foods, $slots);

            $totalSelected = array_sum(array_map('count', $offered));
            $results[$size] = $totalSelected;
        }

        // Verify selection is reasonable and not linear with catalog size
        $this->assertLessThan(100, $results[50]);
        $this->assertLessThan(150, $results[100]);
        $this->assertLessThan(200, $results[500]);
        $this->assertLessThan(250, $results[1000]);

        // Larger catalogs should still send more, but sub-linearly
        $this->assertGreaterThan($results[50], $results[1000]);

        echo "\n📊 Food Selection Scaling:\n";
        foreach ($results as $catalog => $selected) {
            echo "  Catalog: {$catalog} → Selected: {$selected}\n";
        }
    }

    /**
     * Test cost estimation.
     */
    public function test_cost_estimation_for_different_scales(): void
    {
        $metrics = new PlanGenerationMetrics($this->createMock(ConnectionInterface::class));

        $scenarios = [
            ['catalog' => 100, 'meals' => 3],
            ['catalog' => 1000, 'meals' => 3],
            ['catalog' => 10000, 'meals' => 3],
            ['catalog' => 1000, 'meals' => 4],
        ];

        echo "\n💰 Cost Estimation:\n";
        foreach ($scenarios as $scenario) {
            $estimate = $metrics->estimateCostForCatalog($scenario['catalog'], $scenario['meals']);
            self::assertSame($scenario['catalog'], $estimate['catalog_size']);
            self::assertLessThanOrEqual(50 * $scenario['meals'], $estimate['foods_sent_to_ai']);
            self::assertGreaterThan(0, $estimate['estimated_input_tokens']);
            self::assertSame($scenario['meals'] * 7 * 2 * 200, $estimate['estimated_output_tokens']);
            self::assertGreaterThan(0, $estimate['estimated_cost_usd']);
        }

    }

    /**
     * Test smart selection prioritizes better foods.
     */
    public function test_selection_prioritizes_quality(): void
    {
        $profile = [
            'track' => 'weight_loss',
            'target_kcal' => 1800,
            'meals_per_day' => 3,
            'budget' => 'low',
            'protein_g' => 135,
        ];

        $learned = [
            'avoid' => [],
            'prefer' => ['سینه مرغ'],
        ];

        $slots = [
            ['mealType' => 'lunch', 'kcal' => 600, 'suggestedTime' => '13:00'],
        ];

        $foods = [
            // Perfect match: high protein, low cost, preferred, close calories
            [
                'slug' => 'grilled-chicken-breast',
                'nameFa' => 'سینه مرغ گریل شده',
                'kcal' => 580,
                'proteinG' => 45,
                'carbsG' => 5,
                'fatG' => 8,
                'fiberG' => 0,
                'mealTypes' => ['lunch'],
                'costTier' => 2,
                'prepMinutes' => 20,
                'ingredients' => [['name' => 'سینه مرغ', 'quantity' => 200, 'unit' => 'g']],
            ],
            // Poor match: low protein, high cost, not preferred
            [
                'slug' => 'pasta-carbonara',
                'nameFa' => 'پاستا کربونارا',
                'kcal' => 600,
                'proteinG' => 15,
                'carbsG' => 70,
                'fatG' => 25,
                'fiberG' => 2,
                'mealTypes' => ['lunch'],
                'costTier' => 4,
                'prepMinutes' => 45,
                'ingredients' => [['name' => 'پاستا', 'quantity' => 100, 'unit' => 'g']],
            ],
        ];

        $selector = new FoodSelectionEngine($profile, $learned);
        $offered = $selector->selectForSlots($foods, $slots);

        // The high-quality chicken should be first
        $lunchOptions = array_values($offered['lunch']);
        $this->assertEquals('grilled-chicken-breast', $lunchOptions[0]['slug']);

        echo "\n✅ Selection Quality Test: High-quality food prioritized\n";
    }

    /**
     * Generate mock foods for testing.
     */
    private function generateMockFoods(int $count): array
    {
        $foods = [];
        $mealTypes = ['breakfast', 'lunch', 'dinner', 'snack'];
        $names = ['سالاد', 'مرغ', 'ماهی', 'برنج', 'نان', 'پنیر', 'تخم مرغ', 'سبزیجات', 'میوه', 'ماست'];

        for ($i = 0; $i < $count; $i++) {
            $kcal = 100 + ($i * 37) % 701;
            $foods[] = [
                'slug' => 'mock-food-'.$i,
                'nameFa' => $names[$i % count($names)].' '.$i,
                'kcal' => $kcal,
                'proteinG' => 5 + ($i * 7) % 36,
                'carbsG' => 10 + ($i * 11) % 71,
                'fatG' => 2 + ($i * 3) % 29,
                'fiberG' => $i % 11,
                'mealTypes' => [$mealTypes[$i % count($mealTypes)]],
                'costTier' => 1 + $i % 4,
                'prepMinutes' => 5 + ($i * 13) % 56,
                'ingredients' => [['name' => 'مواد', 'quantity' => 100, 'unit' => 'g']],
            ];
        }

        return $foods;
    }
}
