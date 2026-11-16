<?php

namespace Tests\Feature;

use App\Modules\Coach\Application\CoachQuotaService;
use App\Shared\Domain\LegacyCrypto;
use App\Shared\Domain\Problem;
use Tests\MySqlTestCase;

final class CoachQuotaTest extends MySqlTestCase
{
    public function test_provisioned_user_has_weekly_limits(): void
    {
        ['id' => $userId] = $this->actor();
        $service = app(CoachQuotaService::class);
        $service->provision($userId, 'weekly');
        $state = $service->state($userId);

        self::assertTrue($state['hasQuota']);
        self::assertSame(8, $state['dailyLimit']);
        self::assertSame(8, $state['dailyRemaining']);
        self::assertSame(120, $state['periodRemaining']);
        self::assertSame(8, $state['visionRemaining']);
    }

    public function test_monthly_and_quarterly_plans_use_their_own_limits(): void
    {
        ['id' => $monthly] = $this->actor();
        ['id' => $quarterly] = $this->actor();
        $service = app(CoachQuotaService::class);
        $service->provision($monthly, 'monthly');
        $service->provision($quarterly, 'quarterly');

        self::assertSame(12, $service->state($monthly)['dailyLimit']);
        self::assertSame(240, $service->state($monthly)['periodLimit']);
        self::assertSame(20, $service->state($monthly)['visionLimit']);
        self::assertSame(20, $service->state($quarterly)['dailyLimit']);
        self::assertSame(450, $service->state($quarterly)['periodLimit']);
        self::assertSame(40, $service->state($quarterly)['visionLimit']);
    }

    public function test_consume_chat_decrements_daily_and_period(): void
    {
        ['id' => $userId] = $this->actor();
        $service = app(CoachQuotaService::class);
        $service->provision($userId, 'weekly');
        $service->consumeChat($userId);
        $state = $service->state($userId);

        self::assertSame(7, $state['dailyRemaining']);
        self::assertSame(119, $state['periodRemaining']);
    }

    public function test_require_chat_throws_when_daily_and_period_are_full(): void
    {
        ['id' => $userId] = $this->actor();
        $today = \App\Modules\Plans\Domain\CivilDates::today();
        $this->db->table('coach_quotas')->insert([
            'user_id' => $userId,
            'plan_code' => 'weekly',
            'daily_msg_limit' => 2,
            'period_msg_limit' => 20,
            'vision_limit' => 2,
            'daily_msg_used' => 2,
            'period_msg_used' => 2,
            'vision_used' => 0,
            'reset_daily_at' => $today,
            'period_start' => $today,
        ]);

        try {
            app(CoachQuotaService::class)->requireChat($userId);
            self::fail('quota should block the message');
        } catch (Problem $error) {
            self::assertSame(429, $error->status);
            self::assertSame('quota_exceeded', $error->problemCode);
        }
    }

    public function test_addon_credit_is_spent_after_plan_quota_is_full(): void
    {
        ['id' => $userId] = $this->actor();
        $today = \App\Modules\Plans\Domain\CivilDates::today();
        $this->db->table('coach_quotas')->insert([
            'user_id' => $userId,
            'plan_code' => 'weekly',
            'daily_msg_limit' => 2,
            'period_msg_limit' => 20,
            'vision_limit' => 2,
            'daily_msg_used' => 2,
            'period_msg_used' => 2,
            'vision_used' => 0,
            'reset_daily_at' => $today,
            'period_start' => $today,
        ]);
        $this->db->table('coach_addon_credits')->insert([
            'id' => LegacyCrypto::uuid(),
            'user_id' => $userId,
            'credits_total' => 10,
            'credits_remaining' => 10,
            'pack_code' => 'pack_30',
            'expires_at' => date('Y-m-d H:i:s', strtotime('+30 days')),
        ]);
        $service = app(CoachQuotaService::class);
        $service->requireChat($userId);
        $service->consumeChat($userId);

        self::assertSame(9, $service->state($userId)['addonCredits']);
    }

    public function test_vision_quota_is_separate_from_chat(): void
    {
        ['id' => $userId] = $this->actor();
        $today = \App\Modules\Plans\Domain\CivilDates::today();
        $this->db->table('coach_quotas')->insert([
            'user_id' => $userId,
            'plan_code' => 'weekly',
            'daily_msg_limit' => 8,
            'period_msg_limit' => 120,
            'vision_limit' => 2,
            'daily_msg_used' => 0,
            'period_msg_used' => 0,
            'vision_used' => 2,
            'reset_daily_at' => $today,
            'period_start' => $today,
        ]);
        $service = app(CoachQuotaService::class);
        $service->requireChat($userId);

        try {
            $service->requireVision($userId);
            self::fail('vision quota should block the photo');
        } catch (Problem $error) {
            self::assertSame(429, $error->status);
            self::assertSame('vision_quota_exceeded', $error->problemCode);
        }
    }
}
