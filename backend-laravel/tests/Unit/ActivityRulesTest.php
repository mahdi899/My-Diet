<?php

namespace Tests\Unit;

use App\Modules\Shopping\Domain\IngredientAggregation;
use App\Modules\Tracking\Domain\ActivityRules;
use App\Shared\Domain\Problem;
use PHPUnit\Framework\TestCase;

final class ActivityRulesTest extends TestCase
{
    public function test_unknown_or_incompatible_calories_stay_null_and_compatible_units_scale(): void
    {
        $portion = ['quantity' => 200, 'unit' => 'g', 'basis' => 'raw'];
        self::assertNull(ActivityRules::proportionalCalories(null, $portion, ['quantity' => 100, 'unit' => 'g', 'basis' => 'raw']));
        self::assertNull(ActivityRules::proportionalCalories(400, $portion, ['quantity' => 100, 'unit' => 'g', 'basis' => 'cooked']));
        self::assertNull(ActivityRules::proportionalCalories(400, ['quantity' => 1, 'unit' => 'serving', 'basis' => 'raw'], ['quantity' => 1, 'unit' => 'serving']));
        self::assertSame(200.0, ActivityRules::proportionalCalories(400, $portion, ['quantity' => 0.1, 'unit' => 'kg', 'basis' => 'raw']));
        self::assertSame(0, ActivityRules::streak([], '2026-11-14'));
        self::assertSame(2, ActivityRules::streak(['2026-11-07', '2026-11-14'], '2026-11-14'));
        self::assertSame('نگار ا.', ActivityRules::reviewerName('نگار الفبایی'));
    }

    public function test_persian_ingredients_merge_and_ambiguous_items_stay_separate(): void
    {
        $items = IngredientAggregation::aggregate([
            ['name' => 'برنج', 'quantity' => 200, 'unit' => 'گرم', 'basis' => 'raw', 'category' => 'grain', 'source' => 'a'],
            ['name' => 'برنج', 'quantity' => 1, 'unit' => 'کیلوگرم', 'basis' => 'raw', 'category' => 'grain', 'source' => 'b'],
            ['name' => 'نمك', 'quantity' => 1, 'unit' => 'کمی', 'basis' => 'unknown', 'source' => 'c'],
            ['name' => 'نمک', 'quantity' => 1, 'unit' => 'کمی', 'basis' => 'unknown', 'source' => 'd'],
        ]);
        self::assertCount(3, $items);
        self::assertSame(1200.0, $items[0]['quantity']);
        self::assertSame('g', $items[0]['unit']);
        self::assertFalse($items[0]['incomplete']);
        self::assertTrue($items[1]['incomplete']);
        self::assertTrue($items[2]['incomplete']);
        self::assertNotSame($items[1]['key'], $items[2]['key']);
    }

    public function test_consumption_input_rejects_a_quantity_that_does_not_match_its_state(): void
    {
        $this->expectException(Problem::class);
        ActivityRules::activity(['commandId' => '11111111-1111-4111-8111-111111111111', 'versionId' => '11111111-1111-4111-8111-111111111111', 'mealUid' => '11111111-1111-4111-8111-111111111111', 'optionId' => '11111111-1111-4111-8111-111111111111', 'date' => '2026-11-14', 'expectedRevision' => 0, 'state' => 'less']);
    }
}
