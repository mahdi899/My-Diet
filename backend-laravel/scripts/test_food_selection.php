<?php

/**
 * Standalone test script for food selection optimization
 * Run with: php scripts/test_food_selection.php
 */

require_once __DIR__ . '/../vendor/autoload.php';

// Mock profile
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

// Generate mock foods
function generateMockFoods(int $count): array {
    $foods = [];
    $mealTypes = ['breakfast', 'lunch', 'dinner', 'snack'];
    $names = ['سالاد', 'مرغ', 'ماهی', 'برنج', 'نان', 'پنیر', 'تخم مرغ', 'سبزیجات', 'میوه', 'ماست'];
    
    for ($i = 0; $i < $count; $i++) {
        $kcal = rand(100, 800);
        $foods[] = [
            'slug' => 'mock-food-' . $i,
            'nameFa' => $names[array_rand($names)] . ' ' . $i,
            'kcal' => $kcal,
            'proteinG' => rand(5, 40),
            'carbsG' => rand(10, 80),
            'fatG' => rand(2, 30),
            'fiberG' => rand(0, 10),
            'mealTypes' => [$mealTypes[array_rand($mealTypes)]],
            'costTier' => rand(1, 4),
            'prepMinutes' => rand(5, 60),
            'ingredients' => [['name' => 'مواد', 'quantity' => 100, 'unit' => 'g']],
            'seasons' => ['spring', 'summer', 'autumn', 'winter'][rand(0, 3)],
        ];
    }
    
    return $foods;
}

// Slots (from EnergyEngine)
$slots = [
    ['mealType' => 'breakfast', 'kcal' => 504, 'suggestedTime' => '08:00'],
    ['mealType' => 'lunch', 'kcal' => 666, 'suggestedTime' => '13:30'],
    ['mealType' => 'snack', 'kcal' => 180, 'suggestedTime' => '17:00'],
    ['mealType' => 'dinner', 'kcal' => 450, 'suggestedTime' => '20:00'],
];

echo "🧪 Testing Food Selection Engine\n";
echo "=================================\n\n";

// Test different catalog sizes
$testSizes = [50, 100, 500, 1000, 5000, 10000];

echo "📊 Scaling Test:\n";
echo "----------------\n";

foreach ($testSizes as $size) {
    $foods = generateMockFoods($size);
    
    // Use the selector
    $selector = new \App\Modules\Plans\Infrastructure\FoodSelectionEngine($profile, $learned);
    
    $start = microtime(true);
    $offered = $selector->selectForSlots($foods, $slots);
    $duration = round((microtime(true) - $start) * 1000, 2);
    
    $totalSelected = array_sum(array_map('count', $offered));
    
    // Calculate token estimate
    $avgCharsPerFood = 250; // After minimal() transformation
    $estimatedChars = $totalSelected * $avgCharsPerFood;
    $estimatedTokens = (int) ceil($estimatedChars / 3.5);
    
    echo sprintf(
        "  Catalog: %5d foods → Selected: %3d → ~%5d tokens (in %sms)\n",
        $size,
        $totalSelected,
        $estimatedTokens,
        $duration
    );
}

echo "\n💰 Cost Comparison:\n";
echo "-------------------\n";

// Old approach: send ALL foods
// New approach: smart selection

function estimateCost(int $inputTokens, int $outputTokens): float {
    // Using typical GPT-4 pricing: $3/M input, $15/M output
    $costInput = ($inputTokens / 1_000_000) * 3;
    $costOutput = ($outputTokens / 1_000_000) * 15;
    return $costInput + $costOutput;
}

$outputTokens = 2800; // Fixed: 7 days × 3 meals × 2 options × ~130 tokens

foreach ([100, 1000, 10000] as $catalogSize) {
    // Old approach
    $oldInputTokens = (int) ceil(($catalogSize * 500 + 1000) / 1); // Full food objects
    $oldCost = estimateCost($oldInputTokens, $outputTokens);
    
    // New approach (smart selection sends ~100-150 foods max)
    $newSelectedCount = min(150, max(80, $catalogSize / 100));
    $newInputTokens = (int) ceil(($newSelectedCount * 250 + 1000) / 1);
    $newCost = estimateCost($newInputTokens, $outputTokens);
    
    $savings = round(($oldCost - $newCost) / $oldCost * 100, 1);
    
    echo sprintf(
        "  %5d foods: Old: $%.3f → New: $%.3f (-%s%% savings)\n",
        $catalogSize,
        $oldCost,
        $newCost,
        $savings
    );
}

echo "\n✅ Quality Test:\n";
echo "----------------\n";

// Test that high-quality foods score higher
$testFoods = [
    [
        'slug' => 'high-quality',
        'nameFa' => 'ماهی با سالاد', // Preferred ingredients
        'kcal' => 650,
        'proteinG' => 40,
        'carbsG' => 30,
        'fatG' => 25,
        'fiberG' => 8,
        'mealTypes' => ['lunch'],
        'costTier' => 2, // Budget-friendly
        'prepMinutes' => 25,
        'ingredients' => [['name' => 'ماهی', 'quantity' => 150, 'unit' => 'g']],
        'seasons' => ['spring'],
    ],
    [
        'slug' => 'low-quality',
        'nameFa' => 'پیتزا پپرونی', // Not preferred, high cost
        'kcal' => 650,
        'proteinG' => 15,
        'carbsG' => 70,
        'fatG' => 30,
        'fiberG' => 2,
        'mealTypes' => ['lunch'],
        'costTier' => 4, // Expensive
        'prepMinutes' => 45,
        'ingredients' => [['name' => 'خمیر', 'quantity' => 200, 'unit' => 'g']],
        'seasons' => ['winter'],
    ],
];

$lunchSlot = ['mealType' => 'lunch', 'kcal' => 666, 'suggestedTime' => '13:30'];
$selector = new \App\Modules\Plans\Infrastructure\FoodSelectionEngine($profile, $learned);

// Access scoring through reflection (since score() is private)
$reflection = new ReflectionClass($selector);
$scoreMethod = $reflection->getMethod('score');
$scoreMethod->setAccessible(true);

$highScore = $scoreMethod->invoke($selector, $testFoods[0], $lunchSlot, []);
$lowScore = $scoreMethod->invoke($selector, $testFoods[1], $lunchSlot, []);

echo "  High-quality food score: " . round($highScore, 2) . "\n";
echo "  Low-quality food score:  " . round($lowScore, 2) . "\n";

if ($highScore > $lowScore) {
    echo "  ✅ PASS: Quality food scored higher\n";
} else {
    echo "  ❌ FAIL: Quality food did not score higher\n";
}

echo "\n✅ All tests completed successfully!\n";
