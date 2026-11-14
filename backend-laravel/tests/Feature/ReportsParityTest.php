<?php

namespace Tests\Feature;

use App\Modules\Reports\Infrastructure\MySqlReports;
use App\Shared\Domain\LegacyCrypto as Crypto;
use Tests\MySqlTestCase;

final class ReportsParityTest extends MySqlTestCase
{
    public function test_retention_counts_unique_first_order_users_and_actual_returns_in_each_window(): void
    {
        $user = $this->actor();
        $plan = $this->planFixture($user['id']);
        $this->db->table('orders')->where('id', $plan['order'])->update(['created_at' => '2026-01-01 21:00:00']);
        $next = $this->planFixture($user['id']);
        $this->db->table('orders')->where('id', $next['order'])->update(['created_at' => '2026-01-05 12:00:00']);
        $this->db->table('sessions')->where('user_id', $user['id'])->update(['created_at' => '2026-01-04 12:00:00', 'absolute_expires_at' => '2026-02-03 12:00:00', 'last_seen_at' => null]);
        $reports = $this->app->make(MySqlReports::class);
        foreach (['activity', 'purchase'] as $event) {
            $row = $reports->retention('2026-01-02', '2026-02-05', $event)['rows'][0];
            self::assertSame(1, $row['size']);
            self::assertSame('2026-01-02', $row['id']);
            self::assertSame(['state' => 'measured', 'count' => 1, 'denominator' => 1, 'percent' => 100], $row['cells']['week1']);
            self::assertSame(1, $row['cells']['week4']['count']);
        }
        self::assertSame(['state' => 'not_yet_measurable'], $reports->retention('2026-01-02', '2026-01-03', 'activity')['rows'][0]['cells']['week1']);
        self::assertSame(0, $reports->retention('2026-01-02', '2026-02-05', 'tracking')['rows'][0]['cells']['week1']['count']);
    }

    public function test_sla_and_board_return_real_response_times_and_expected_contracts(): void
    {
        $user = $this->actor();
        $plan = $this->planFixture($user['id']);
        $doctor = $this->actor('specialist');
        $this->db->table('specialist_profiles')->insert(['user_id' => $doctor['id'], 'display_name' => 'متخصص پاسخ']);
        $this->db->table('plan_requests')->where('id', $plan['request'])->update(['assigned_specialist_id' => $doctor['id'], 'created_at' => '2026-01-01 10:00:00']);
        $this->db->table('request_events')->insert(['id' => Crypto::uuid(), 'request_id' => $plan['request'], 'kind' => 'draft_edited', 'created_at' => '2026-01-01 10:30:00', 'detail' => '{}']);
        $reports = $this->app->make(MySqlReports::class);
        self::assertSame(30, $reports->sla($doctor['id'])['medianResponseMinutes']);
        self::assertSame(0, $reports->sla($doctor['id'])['overdue']);
        self::assertArrayHasKey('requestsByStatus', $reports->adminSla());
        self::assertSame('elapsed_minutes', $reports->specialists('workload')['timing']);
        self::assertArrayHasKey('distribution', $reports->specialists('rating')['rows'][0]);
    }
}
