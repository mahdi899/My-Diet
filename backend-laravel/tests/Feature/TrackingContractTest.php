<?php

namespace Tests\Feature;

use App\Modules\Plans\Domain\CivilDates;
use App\Shared\Domain\LegacyCrypto as Crypto;
use Tests\MySqlTestCase;

final class TrackingContractTest extends MySqlTestCase
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

    public function test_consumption_selection_history_and_shopping_follow_the_published_option(): void
    {
        $user = $this->actor();
        $plan = $this->approved($user['id']);
        $this->getJson('/v1/me/dashboard')->assertOk()->assertJsonPath('plan.requestId', $plan['request'])->assertJsonPath('streak', 0)->assertJsonPath('wallet.promoToman', 0);
        self::assertSame(0, $this->db->table('weekly_rewards')->where('user_id', $user['id'])->count());
        $this->getJson('/v1/me/substitution-reasons')->assertOk()->assertJsonFragment(['id' => 'preference']);
        $command = $this->activity($plan, 'as_planned');
        $recorded = $this->postJson('/v1/me/meal-consumption', $command)->assertOk()->assertJsonPath('consumedCalories', 300)->assertJsonPath('revision', 1)->json();
        $firstLoggedAt = $this->db->table('plan_first_meal_logs')->where('request_id', $plan['request'])->value('logged_at');
        self::assertNotNull($firstLoggedAt);
        $this->postJson('/v1/me/meal-consumption', $command)->assertOk()->assertJsonPath('revision', 1);
        $this->postJson('/v1/me/meal-consumption', [...$command, 'state' => 'skipped'])->assertStatus(409)->assertJsonPath('code', 'idempotency_conflict');
        $this->postJson('/v1/me/meal-selections', $this->selection($plan))->assertStatus(409)->assertJsonPath('code', 'consumption_exists');
        $correction = $this->activity($plan, 'less', ['expectedRevision' => 1, 'actual' => ['quantity' => 0.5, 'unit' => 'serving', 'basis' => 'as_served']]);
        $this->postJson('/v1/me/meal-consumption', $correction)->assertOk()->assertJsonPath('consumedCalories', 150)->assertJsonPath('revision', 2);
        self::assertSame($firstLoggedAt, $this->db->table('plan_first_meal_logs')->where('request_id', $plan['request'])->value('logged_at'));
        $this->postJson('/v1/me/meal-consumption', $this->activity($plan, 'less', ['expectedRevision' => 2, 'actual' => ['quantity' => 2, 'unit' => 'serving', 'basis' => 'as_served']]))->assertStatus(400);
        $this->postJson('/v1/me/meal-consumption', $this->activity($plan, 'less', ['expectedRevision' => 2, 'actual' => ['quantity' => 100, 'unit' => 'g', 'basis' => 'cooked']]))->assertOk()->assertJsonPath('consumedCalories', null);
        $this->getJson('/v1/me/meal-activity/2026-11-14/history')->assertOk()->assertJsonCount(3, 'consumption');
        $this->getJson('/v1/me/meal-activity/2026-02-30')->assertStatus(400);
        $this->postJson('/v1/me/weights', ['kilograms' => 20])->assertStatus(400);
        $this->postJson('/v1/me/weights', ['kilograms' => 70.5])->assertOk()->assertJsonPath('date', '2026-11-14');
        $this->getJson('/v1/me/weights')->assertOk()->assertJsonPath('0.kilograms', 70.5);
        $this->getJson('/v1/me/specialist')->assertOk();
        self::assertSame('null', $this->getJson('/v1/me/specialist')->getContent());
        $this->getJson('/v1/public/reviews')->assertOk()->assertExactJson([]);
        $this->postJson('/v1/me/meal-logs', ['mealUid' => $plan['mealUid'], 'eaten' => false])->assertStatus(409)->assertJsonPath('code', 'structured_activity_required');
        $list = $this->getJson('/v1/me/shopping-list?weekStart=2026-11-14')->assertOk()->assertJsonPath('incomplete', true)->json();
        self::assertEquals(1200, $list['items'][0]['quantity']);
        self::assertCount(2, $list['items']);
        $share = $this->getJson('/v1/me/shopping-list/share?weekStart=2026-11-14')->assertOk()->json();
        self::assertSame(['revision', 'text', 'incomplete'], array_keys($share));
        self::assertStringContainsString('برنج', $share['text']);
        self::assertStringNotContainsString('healthDetails', $share['text']);
        $updated = $this->patchJson('/v1/me/shopping-list/items/'.$list['items'][0]['key'], ['weekStart' => '2026-11-14', 'expectedRevision' => $list['revision'], 'alreadyHave' => false, 'purchased' => true])->assertOk()->json();
        self::assertTrue($updated['items'][0]['purchased']);
        self::assertGreaterThan($list['revision'], $updated['revision']);
        $this->patchJson('/v1/me/shopping-list/items/'.$list['items'][0]['key'], ['weekStart' => '2026-11-14', 'expectedRevision' => $list['revision'], 'alreadyHave' => true, 'purchased' => false])->assertStatus(409)->assertJsonPath('code', 'lock_conflict');
        $this->getJson('/v1/me/shopping-list?weekStart=2026-11-15')->assertStatus(400);
        self::assertSame($recorded['revision'], 1);
    }

    public function test_weekly_reward_is_credited_once_from_completed_meals_and_can_be_acknowledged(): void
    {
        putenv('SABZINE_NOW=2026-11-20T08:00:00Z');
        $user = $this->actor();
        $plan = $this->planFixture($user['id']);
        $this->db->table('plan_days')->where('id', $plan['day'])->update(['civil_date' => '2026-11-20']);
        $this->db->table('plan_requests')->where('id', $plan['request'])->update(['week_start' => '2026-11-14', 'effective_from' => '2026-11-20']);
        $this->db->table('plan_meal_options')->where('meal_id', $plan['meal'])->update(['approved_by' => $user['id'], 'approved_at' => '2026-11-14 00:00:00']);
        $this->db->table('plan_versions')->where('id', $plan['version'])->update(['status' => 'published', 'published_at' => '2026-11-14 00:00:00']);
        $this->postJson('/v1/me/meal-consumption', $this->activity($plan, 'as_planned', ['date' => '2026-11-20']))->assertOk()->assertJsonPath('reward.amountToman', 200000);
        $this->postJson('/v1/me/meal-logs', ['mealUid' => $plan['mealUid'], 'eaten' => true])->assertStatus(409);
        self::assertSame(200000, (int) $this->db->table('wallets')->where('user_id', $user['id'])->value('promo_toman'));
        self::assertSame(1, $this->db->table('wallet_ledger')->where(['user_id' => $user['id'], 'kind' => 'weekly_reward'])->count());
        $reward = $this->getJson('/v1/me/rewards/pending')->assertOk()->assertJsonCount(1)->json()[0];
        $this->call('POST', '/v1/me/rewards/'.$reward['id'].'/acknowledge', [], [], [], ['CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT' => 'application/json', 'HTTP_AUTHORIZATION' => 'Bearer '.$user['token']], '{}')->assertOk()->assertJsonPath('amountToman', 200000);
        $this->getJson('/v1/me/rewards/pending')->assertOk()->assertExactJson([]);
        $this->postJson('/v1/me/reviews', ['requestId' => $plan['request'], 'weekStart' => '2026-11-14', 'rating' => 5, 'body' => 'خوب'])->assertOk()->assertJsonPath('status', 'pending');
        $this->postJson('/v1/me/reviews', ['requestId' => $plan['request'], 'weekStart' => '2026-11-14', 'rating' => 4, 'body' => 'دوباره'])->assertStatus(409)->assertJsonPath('code', 'already_reviewed');
        self::assertSame('2026-11-20', CivilDates::today());
    }

    private function approved(string $user): array
    {
        $plan = $this->planFixture($user);
        $this->db->table('plan_requests')->where('id', $plan['request'])->update(['week_start' => '2026-11-14', 'effective_from' => '2026-11-14']);
        $this->db->table('plan_meal_options')->where('meal_id', $plan['meal'])->update(['approved_by' => $user, 'approved_at' => '2026-11-14 00:00:00', 'document' => json_encode(['optionId' => $plan['option'], 'kind' => 'primary', 'title' => 'عدسی', 'calories' => 300, 'portion' => ['quantity' => 1, 'unit' => 'serving', 'basis' => 'as_served'], 'ingredients' => [['name' => 'برنج', 'quantity' => 200, 'unit' => 'گرم', 'basis' => 'raw', 'category' => 'grain'], ['name' => 'برنج', 'quantity' => 1, 'unit' => 'کیلوگرم', 'basis' => 'raw', 'category' => 'grain'], ['name' => 'نمک', 'quantity' => null, 'unit' => null, 'basis' => 'unknown', 'category' => 'other']], 'instructions' => 'نوش جان', 'preparationMinutes' => 20], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR)]);
        $this->db->table('plan_versions')->where('id', $plan['version'])->update(['status' => 'published', 'published_at' => '2026-11-14 00:00:00']);

        return $plan;
    }

    private function activity(array $plan, string $state, array $extra = []): array
    {
        return ['commandId' => Crypto::uuid(), 'versionId' => $plan['version'], 'mealUid' => $plan['mealUid'], 'optionId' => $plan['option'], 'date' => '2026-11-14', 'expectedRevision' => 0, 'state' => $state, ...$extra];
    }

    private function selection(array $plan): array
    {
        return ['commandId' => Crypto::uuid(), 'versionId' => $plan['version'], 'mealUid' => $plan['mealUid'], 'optionId' => $plan['option'], 'date' => '2026-11-14', 'expectedRevision' => 0, 'reasonId' => 'preference'];
    }
}
