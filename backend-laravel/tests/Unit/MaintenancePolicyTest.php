<?php

namespace Tests\Unit;

use App\Modules\Worker\Domain\MaintenancePolicy;
use PHPUnit\Framework\TestCase;

final class MaintenancePolicyTest extends TestCase
{
    public function test_thresholds_match_the_node_maintenance_policy(): void
    {
        self::assertTrue(MaintenancePolicy::shouldExpirePendingPayment(30 * 60 * 1000));
        self::assertFalse(MaintenancePolicy::shouldExpirePendingPayment(30 * 60 * 1000 - 1));
        self::assertTrue(MaintenancePolicy::shouldInquirePendingPayment(15 * 60 * 1000));
        self::assertFalse(MaintenancePolicy::shouldInquirePendingPayment(30 * 60 * 1000));
        self::assertTrue(MaintenancePolicy::shouldRequeueGenerating(15 * 60 * 1000));
        self::assertTrue(MaintenancePolicy::shouldPurgeChallenge(7 * 24 * 60 * 60 * 1000));
        self::assertFalse(MaintenancePolicy::shouldClearAiRaw(30 * 24 * 60 * 60 * 1000 - 1));
    }
}
