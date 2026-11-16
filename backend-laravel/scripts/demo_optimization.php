<?php

/**
 * Standalone simulation without Laravel dependencies
 * Demonstrates the improvement in food selection
 */

echo "🧪 Plan Generation Optimization Demo\n";
echo "====================================\n\n";

// Simulate food selection limits
function selectLimit(int $available, string $mealType): int {
    if ($mealType === 'snack') {
        return min($available, 20);
    }
    
    if ($available < 10) return $available;
    if ($available < 30) return min($available, 25);
    if ($available < 100) return 35;
    
    return 50; // Maximum for very large catalogs
}

echo "📊 Food Selection Scaling:\n";
echo "--------------------------\n";
echo "Shows how many foods are sent to AI based on catalog size\n\n";

$catalogSizes = [50, 100, 500, 1000, 5000, 10000];
$mealTypes = ['breakfast', 'lunch', 'snack', 'dinner'];

foreach ($catalogSizes as $size) {
    $foodsPerType = (int) ($size / 4); // Assume even distribution
    $totalSelected = 0;
    
    foreach ($mealTypes as $type) {
        $selected = selectLimit($foodsPerType, $type);
        $totalSelected += $selected;
    }
    
    // Calculate token estimate (average 250 chars per minimal food → ~70 tokens)
    $estimatedTokens = $totalSelected * 70;
    $estimatedChars = $totalSelected * 250;
    
    echo sprintf(
        "  Catalog: %6d → Selected: %3d foods → ~%6d tokens\n",
        $size,
        $totalSelected,
        $estimatedTokens
    );
}

echo "\n💰 Cost Analysis:\n";
echo "-----------------\n";
echo "Comparison: OLD (send all foods) vs NEW (smart selection)\n";
echo "Pricing: \$3/M input tokens, \$15/M output tokens\n\n";

function estimateCost(int $inputTokens, int $outputTokens): float {
    $costInput = ($inputTokens / 1_000_000) * 3;
    $costOutput = ($outputTokens / 1_000_000) * 15;
    return $costInput + $costOutput;
}

$outputTokens = 2800; // Fixed: 7 days × meals × options

$scenarios = [
    ['catalog' => 100, 'name' => 'Small catalog'],
    ['catalog' => 1000, 'name' => 'Medium catalog'],
    ['catalog' => 10000, 'name' => 'Large catalog'],
];

foreach ($scenarios as $scenario) {
    $catalogSize = $scenario['catalog'];
    
    // OLD: Send ALL foods with full data (avg 500 chars = ~140 tokens each)
    $oldFoodTokens = $catalogSize * 140;
    $oldInputTokens = $oldFoodTokens + 1000; // + system prompt
    $oldCost = estimateCost($oldInputTokens, $outputTokens);
    
    // NEW: Smart selection (~100-140 foods with minimal data, 70 tokens each)
    $foodsPerType = (int) ($catalogSize / 4);
    $selectedPerType = array_map(fn($type) => selectLimit($foodsPerType, $type), $mealTypes);
    $totalSelected = array_sum($selectedPerType);
    $newFoodTokens = $totalSelected * 70;
    $newInputTokens = $newFoodTokens + 1000;
    $newCost = estimateCost($newInputTokens, $outputTokens);
    
    $savings = round((1 - $newCost / $oldCost) * 100, 1);
    $savingsAmount = round($oldCost - $newCost, 4);
    
    echo "{$scenario['name']} ({$catalogSize} foods):\n";
    echo sprintf("  OLD: %6d tokens → \$%.4f\n", $oldInputTokens, $oldCost);
    echo sprintf("  NEW: %6d tokens → \$%.4f\n", $newInputTokens, $newCost);
    echo sprintf("  💰 Savings: \$%.4f per plan (-%s%%)\n\n", $savingsAmount, $savings);
}

echo "📈 Extrapolation for 1000 plans/month:\n";
echo "---------------------------------------\n";

foreach ($scenarios as $scenario) {
    $catalogSize = $scenario['catalog'];
    
    $oldFoodTokens = $catalogSize * 140;
    $oldInputTokens = $oldFoodTokens + 1000;
    $oldCost = estimateCost($oldInputTokens, $outputTokens);
    
    $foodsPerType = (int) ($catalogSize / 4);
    $selectedPerType = array_map(fn($type) => selectLimit($foodsPerType, $type), $mealTypes);
    $totalSelected = array_sum($selectedPerType);
    $newFoodTokens = $totalSelected * 70;
    $newInputTokens = $newFoodTokens + 1000;
    $newCost = estimateCost($newInputTokens, $outputTokens);
    
    $monthlySavings = round(($oldCost - $newCost) * 1000, 2);
    
    echo sprintf(
        "  %s: Save \$%s/month\n",
        $scenario['name'],
        number_format($monthlySavings, 2)
    );
}

echo "\n✅ Key Improvements:\n";
echo "--------------------\n";
echo "1. ✅ Smart Selection: Only relevant foods sent to AI\n";
echo "2. ✅ Quality Scoring: Better foods prioritized (protein, budget, preferences)\n";
echo "3. ✅ Minimal Data: Only essential fields sent (no images, recipes)\n";
echo "4. ✅ Scalable: Works efficiently with 10,000+ food database\n";
echo "5. ✅ Cost Control: Dramatic reduction in token usage\n";

echo "\n📋 Validation Improvements:\n";
echo "---------------------------\n";
echo "• Energy tolerance: 45% → 30% (tighter control)\n";
echo "• Slot tolerance: 20% → 15% (more precise)\n";
echo "• Smart retry: Only retry fixable errors\n";
echo "• Backend safety gates: Critical conditions blocked before AI\n";

echo "\n🎯 Expected Results:\n";
echo "--------------------\n";
echo "• Higher success rate (fewer invalid_plan errors)\n";
echo "• Lower cost per successful plan\n";
echo "• Better quality plans (nutrition, variety, budget)\n";
echo "• Reduced wasted retry attempts\n";

echo "\n✅ Demo completed!\n";
