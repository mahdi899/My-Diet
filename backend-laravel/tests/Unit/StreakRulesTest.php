<?php

namespace Tests\Unit;

use App\Modules\Rewards\Domain\StreakRules;
use PHPUnit\Framework\TestCase;

final class StreakRulesTest extends TestCase
{
    public function test_a_missed_day_resets_the_count_and_login_does_not_qualify(): void
    {
        $rules = ['consecutiveDays' => 3, 'milestones' => [], 'startsOn' => '2026-11-14', 'endsOn' => null, 'effectiveOn' => '2026-11-14', 'repeat' => 'cycle'];
        $projected = StreakRules::project($rules, '2026-11-14', '2026-11-16', ['2026-11-14' => true, '2026-11-16' => true], [], []);
        self::assertSame(['qualified', 'missed', 'qualified'], array_column($projected['days'], 'state'));
        self::assertSame(1, $projected['consecutive']);
        self::assertFalse(StreakRules::recorded(false, null));
        self::assertFalse(StreakRules::recorded(true, 'skipped'));
        self::assertTrue(StreakRules::recorded(true, null));
    }
}
