<?php

namespace Tests\Feature;

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
}
