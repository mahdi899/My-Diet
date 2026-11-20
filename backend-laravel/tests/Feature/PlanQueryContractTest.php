<?php

namespace Tests\Feature;

use App\Shared\Domain\LegacyCrypto as Crypto;
use Tests\MySqlTestCase;

final class PlanQueryContractTest extends MySqlTestCase
{
    public function test_user_sees_dated_published_plan_and_cannot_see_another_users_request(): void
    {
        $user = $this->actor();
        self::assertSame('', $this->getJson('/v1/me/plan')->assertOk()->getContent());
        $plan = $this->planFixture($user['id'], true);
        $this->db->table('plan_requests')->where('id', $plan['request'])->update(['week_start' => '2026-11-14', 'effective_from' => '2026-11-14']);
        $this->getJson('/v1/me/plan/day/2026-11-14')->assertOk()->assertJsonPath('versionId', $plan['version'])->assertJsonPath('meals.0.plannedCalories', 300)->assertJsonPath('meals.0.selectedOptionId', $plan['option']);
        $this->getJson('/v1/me/plan')->assertOk()->assertJsonPath('versionId', $plan['version'])->assertJsonCount(7, 'days');
        $this->db->table('plan_versions')->where('id', $plan['version'])->update(['status' => 'superseded']);
        $this->getJson('/v1/me/plan/day/2026-11-13')->assertOk()->assertJsonPath('versionId', null);
        $this->getJson('/v1/me/requests')->assertOk()->assertJsonCount(1);
        $this->getJson('/v1/me/request')->assertOk()->assertJsonPath('id', $plan['request'])->assertJsonPath('version', null);
        $this->getJson('/v1/me/requests/'.$plan['request'])->assertOk()->assertJsonPath('priceToman', 100);
        $this->getJson('/v1/me/plan/week?weekStart=2026-11-14')->assertOk()->assertJsonCount(7, 'days');
        $this->getJson('/v1/me/plan/week?weekStart=2026-11-15')->assertStatus(400);
        $this->getJson('/v1/me/plan/day/2026-02-30')->assertStatus(400);
        $this->getJson('/v1/me/info-questions?status=bad')->assertStatus(400);
        $this->actor();
        $this->getJson('/v1/me/requests/'.$plan['request'])->assertNotFound();
    }

    public function test_failed_ai_draft_does_not_claim_the_preview_is_ready(): void
    {
        $user = $this->actor();
        $plan = $this->planFixture($user['id']);
        $this->db->table('ai_generations')->insert([
            'id' => Crypto::uuid(),
            'request_id' => $plan['request'],
            'provider' => 'pool',
            'status' => 'failed',
            'skipped_reason' => 'provider_error',
        ]);

        $this->getJson('/v1/me/request')->assertOk()
            ->assertJsonPath('status', 'in_review')
            ->assertJsonPath('holdReason', 'ساخت خودکار برنامه ناموفق بود. متخصص تغذیه خودش برنامه را می‌نویسد.');
    }

    public function test_specialist_queue_is_scoped_to_assignment_and_bucket(): void
    {
        $user = $this->actor();
        $plan = $this->planFixture($user['id']);
        $specialist = $this->actor('specialist');
        $this->db->table('specialist_profiles')->insert(['user_id' => $specialist['id'], 'display_name' => 'متخصص آزمایشی']);
        $this->db->table('plan_requests')->where('id', $plan['request'])->update(['assigned_specialist_id' => $specialist['id']]);
        $this->getJson('/v1/specialist/queue?bucket=awaiting_review')->assertOk()->assertJsonCount(1)->assertJsonPath('0.id', $plan['request']);
        $this->getJson('/v1/specialist/requests?bucket=generating')->assertOk()->assertExactJson([]);
        $this->getJson('/v1/specialist/queue?bucket=bad')->assertStatus(400);
        $this->actor('admin');
        $this->getJson('/v1/specialist/queue')->assertOk()->assertExactJson([]);
    }

    public function test_customer_retries_empty_failed_plan_once_without_buying_or_answering_again(): void
    {
        $user = $this->actor();
        $plan = $this->planFixture($user['id']);
        $this->db->table('plan_meal_items')->where('meal_id', $plan['meal'])->delete();
        $this->db->table('plan_meal_options')->where('meal_id', $plan['meal'])->delete();
        $this->db->table('plan_meals')->where('id', $plan['meal'])->delete();
        $this->db->table('ai_generations')->insert([
            'id' => Crypto::uuid(), 'request_id' => $plan['request'], 'provider' => 'pool',
            'status' => 'failed', 'skipped_reason' => 'provider_error',
        ]);

        for ($i = 0; $i < 2; $i++) {
            $this->postJson('/v1/me/plan/recover')->assertOk()
                ->assertJsonPath('id', $plan['request'])->assertJsonPath('status', 'generating');
        }

        self::assertSame(1, $this->db->table('orders')->where('user_id', $user['id'])->count());
        self::assertSame(1, $this->db->table('plan_requests')->where('user_id', $user['id'])->count());
        self::assertSame($plan['submission'], $this->db->table('plan_requests')->where('id', $plan['request'])->value('submission_id'));
        self::assertSame('{}', $this->db->table('questionnaire_submissions')->where('id', $plan['submission'])->value('answers'));
        $events = $this->db->table('outbox_events')->where('topic', 'plan.generate')->where('aggregate_id', $plan['request'])->get();
        self::assertCount(1, $events);
        self::assertSame(['requestId' => $plan['request'], 'regenerate' => true], json_decode($events[0]->payload, true));
    }

    public function test_recovery_preserves_existing_draft_and_published_meals(): void
    {
        foreach ([false, true] as $published) {
            $user = $this->actor();
            $plan = $this->planFixture($user['id'], $published);
            $this->db->table('ai_generations')->insert([
                'id' => Crypto::uuid(), 'request_id' => $plan['request'], 'provider' => 'pool',
                'status' => 'failed', 'skipped_reason' => 'invalid_draft',
            ]);
            $this->postJson('/v1/me/plan/recover')->assertOk()->assertJsonPath('id', $plan['request']);
            self::assertSame(0, $this->db->table('outbox_events')->where('aggregate_id', $plan['request'])->count());
            self::assertSame('عدسی', $this->db->table('plan_meals')->where('id', $plan['meal'])->value('title'));
        }
    }

    public function test_recovery_without_a_purchase_never_creates_a_request_or_exposes_another_user(): void
    {
        $owner = $this->actor();
        $plan = $this->planFixture($owner['id']);
        $this->actor();
        self::assertSame('', $this->postJson('/v1/me/plan/recover')->assertOk()->getContent());
        self::assertSame('in_review', $this->db->table('plan_requests')->where('id', $plan['request'])->value('status'));
        self::assertSame(0, $this->db->table('outbox_events')->where('aggregate_id', $plan['request'])->count());
    }
}
