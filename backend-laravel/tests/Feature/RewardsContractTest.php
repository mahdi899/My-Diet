<?php

namespace Tests\Feature;

use App\Shared\Domain\LegacyCrypto as Crypto;
use Tests\MySqlTestCase;

final class RewardsContractTest extends MySqlTestCase
{
    protected function setUp(): void
    {
        putenv('SABZINE_NOW=2026-11-14T08:00:00Z');
        parent::setUp();
    }

    protected function tearDown(): void
    {
        putenv('SABZINE_NOW');
        parent::tearDown();
    }

    public function test_campaign_reward_is_issued_once_for_a_qualified_day_and_not_for_reading(): void
    {
        $user = $this->actor();
        $plan = $this->planFixture($user['id']);
        $this->db->table('plan_requests')->where('id', $plan['request'])->update(['week_start' => '2026-11-14', 'effective_from' => '2026-11-14', 'status' => 'published']);
        $this->db->table('plan_versions')->where('id', $plan['version'])->update(['status' => 'published', 'published_at' => '2026-11-14 00:00:00']);
        $this->db->table('active_plan_versions')->insert(['user_id' => $user['id'], 'version_id' => $plan['version']]);
        $admin = $this->actor('admin');
        $this->postJson('/v1/admin/streak-campaigns', ['consecutiveDays' => 1, 'milestones' => [['day' => 1, 'amountToman' => 1000]], 'startsOn' => '2026-11-14', 'effectiveOn' => '2026-11-14', 'endsOn' => null, 'repeat' => 'none'])->assertOk()->assertJsonPath('consecutiveDays', 1)->assertJsonPath('repeat', 'none');
        $this->withToken($user['token']);
        $this->getJson('/v1/me/streak')->assertOk()->assertJsonPath('wallet', 0)->assertJsonPath('claimState', 'idle')->assertJsonPath('days.0.state', 'pending');
        self::assertSame(0, $this->db->table('streak_grants')->where('user_id', $user['id'])->count());
        $this->postJson('/v1/me/meal-logs', ['mealUid' => $plan['mealUid'], 'eaten' => true])->assertOk();
        $this->getJson('/v1/me/streak')->assertOk()->assertJsonPath('consecutive', 1)->assertJsonPath('wallet', 0)->assertJsonPath('days.0.state', 'qualified');
        self::assertSame(0, $this->db->table('wallet_ledger')->where(['user_id' => $user['id'], 'kind' => 'campaign_reward'])->count());
        $command = Crypto::uuid();
        $this->postJson('/v1/me/streak/claim', ['commandId' => $command])->assertOk()->assertJsonPath('claimState', 'confirmed')->assertJsonPath('wallet', 1000)->assertJsonPath('grants.0.amountToman', 1000);
        $this->postJson('/v1/me/streak/claim', ['commandId' => $command])->assertOk()->assertJsonPath('retried', true)->assertJsonPath('wallet', 1000);
        $this->postJson('/v1/me/streak/claim', ['commandId' => Crypto::uuid()])->assertOk()->assertJsonPath('claimState', 'duplicate')->assertJsonPath('wallet', 1000);
        self::assertSame(1, $this->db->table('wallet_ledger')->where(['user_id' => $user['id'], 'kind' => 'campaign_reward'])->count());
        self::assertSame(1000, (int) $this->db->table('wallets')->where('user_id', $user['id'])->value('promo_toman'));
        $this->withToken($admin['token']);
        $campaigns = $this->getJson('/v1/admin/streak-campaigns')->assertOk()->json();
        self::assertTrue(array_any($campaigns, fn (array $row): bool => $row['consecutiveDays'] === 1 && $row['repeat'] === 'none'));
    }

    public function test_anomaly_holds_the_campaign_reward(): void
    {
        $user = $this->actor();
        $plan = $this->planFixture($user['id']);
        $this->db->table('plan_requests')->where('id', $plan['request'])->update(['week_start' => '2026-11-14', 'effective_from' => '2026-11-14']);
        $this->db->table('plan_versions')->where('id', $plan['version'])->update(['status' => 'published', 'published_at' => '2026-11-14 00:00:00']);
        $this->db->table('active_plan_versions')->insert(['user_id' => $user['id'], 'version_id' => $plan['version']]);
        $this->postJson('/v1/me/meal-logs', ['mealUid' => $plan['mealUid'], 'eaten' => true])->assertOk();
        $this->db->table('meal_log_anomalies')->insert(['id' => Crypto::uuid(), 'user_id' => $user['id'], 'scheduled_date' => '2026-11-14', 'kind' => 'late_bulk_log']);
        $this->actor('admin');
        $this->postJson('/v1/admin/streak-campaigns', ['consecutiveDays' => 1, 'milestones' => [['day' => 1, 'amountToman' => 500]], 'startsOn' => '2026-11-14', 'effectiveOn' => '2026-11-14', 'repeat' => 'cycle'])->assertOk();
        $this->withToken($user['token']);
        $this->postJson('/v1/me/streak/claim', ['commandId' => Crypto::uuid()])->assertOk()->assertJsonPath('claimState', 'held')->assertJsonPath('wallet', 0)->assertJsonPath('grants', []);
        self::assertSame('held', $this->db->table('streak_grants')->where('user_id', $user['id'])->value('status'));
    }
}
