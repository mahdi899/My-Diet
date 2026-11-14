<?php

namespace Tests\Feature;

use App\Shared\Domain\LegacyCrypto as Crypto;
use Tests\MySqlTestCase;

final class PlanChangeContractTest extends MySqlTestCase
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

    public function test_change_request_keeps_one_open_item_and_respects_assignment(): void
    {
        $user = $this->actor();
        $plan = $this->planFixture($user['id'], true);
        $specialist = $this->actor('specialist');
        $this->db->table('specialist_profiles')->insert(['user_id' => $specialist['id'], 'display_name' => 'متخصص تغییر']);
        $this->db->table('plan_requests')->where('id', $plan['request'])->update(['assigned_specialist_id' => $specialist['id'], 'week_start' => '2026-11-14', 'effective_from' => '2026-11-14']);
        $this->db->table('active_plan_versions')->insert(['user_id' => $user['id'], 'version_id' => $plan['version']]);
        $this->withToken($user['token']);
        $this->getJson('/v1/me/plan-change-reasons')->assertOk()->assertJsonFragment(['id' => 'schedule']);
        $command = Crypto::uuid();
        $body = ['commandId' => $command, 'versionId' => $plan['version'], 'reasonIds' => ['schedule'], 'explanation' => 'زمان ناهار دیر است', 'targets' => [['dayIndex' => 0, 'mealUid' => $plan['mealUid']]]];
        $created = $this->postJson('/v1/me/plan-changes', $body)->assertOk()->assertJsonPath('duplicate', false)->assertJsonPath('status', 'awaiting_review')->json();
        $this->postJson('/v1/me/plan-changes', $body)->assertOk()->assertJsonPath('duplicate', true)->assertJsonPath('id', $created['id']);
        $this->postJson('/v1/me/plan-changes', [...$body, 'commandId' => Crypto::uuid()])->assertStatus(409)->assertJsonPath('code', 'open_request');
        self::assertSame($plan['version'], $this->db->table('active_plan_versions')->where('user_id', $user['id'])->value('version_id'));
        $this->withToken($specialist['token']);
        $this->getJson('/v1/specialist/plan-changes')->assertOk()->assertJsonPath('0.id', $created['id'])->assertJsonPath('0.userId', $user['id']);
        $this->postJson('/v1/specialist/plan-changes/'.$created['id'].'/review')->assertOk()->assertJsonPath('status', 'under_review');
        $this->postJson('/v1/specialist/plan-changes/'.$created['id'].'/clarifications', ['prompt' => 'کدام روز؟'])->assertOk()->assertJsonPath('substate', 'awaiting_clarification');
        $this->withToken($user['token']);
        $this->postJson('/v1/me/plan-changes/'.$created['id'].'/replies', ['body' => 'شنبه'])->assertOk()->assertJsonPath('status', 'awaiting_review')->assertJsonPath('question.status', 'answered');
        $this->withToken($specialist['token']);
        $this->postJson('/v1/specialist/plan-changes/'.$created['id'].'/reject', ['explanation' => 'برنامه فعلی مناسب است'])->assertOk()->assertJsonPath('status', 'rejected');
        self::assertSame($plan['version'], $this->db->table('active_plan_versions')->where('user_id', $user['id'])->value('version_id'));
        $other = $this->actor('specialist');
        $this->db->table('specialist_profiles')->insert(['user_id' => $other['id'], 'display_name' => 'متخصص دیگر', 'active' => true]);
        $this->getJson('/v1/specialist/plan-changes/'.$created['id'])->assertNotFound();
        self::assertNotSame($other['id'], $specialist['id']);
    }
}
