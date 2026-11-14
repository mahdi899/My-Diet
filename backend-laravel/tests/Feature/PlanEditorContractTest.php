<?php

namespace Tests\Feature;

use App\Modules\Plans\Domain\CivilDates;
use App\Shared\Domain\LegacyCrypto as Crypto;
use Tests\MySqlTestCase;

final class PlanEditorContractTest extends MySqlTestCase
{
    private function draftBody(): array
    {
        return json_decode(file_get_contents(__DIR__.'/../Fixtures/node-plans.json'), true)[4]['input'];
    }

    private function specialist(string $request, bool $verified = true): array
    {
        $actor = $this->actor('specialist');
        $this->db->table('specialist_profiles')->insert(['user_id' => $actor['id'], 'display_name' => 'متخصص آزمایش', 'verification_status' => $verified ? 'verified' : 'pending']);
        $this->db->table('plan_requests')->where('id', $request)->update(['assigned_specialist_id' => $actor['id']]);

        return $actor;
    }

    public function test_doctor_can_edit_publish_correct_and_republish_without_changing_the_prior_version(): void
    {
        $user = $this->actor();
        $ids = $this->planFixture($user['id']);
        $doctor = $this->specialist($ids['request']);
        $url = '/v1/specialist/requests/'.$ids['request'];
        $this->getJson($url)->assertOk()->assertJsonPath('version.lockVersion', 1)->assertJsonPath('profile', null);
        self::assertSame(1, $this->db->table('health_access_logs')->where('request_id', $ids['request'])->count());
        $this->putJson($url.'/draft', $this->draftBody())->assertStatus(400);
        $this->putJson($url.'/draft', $this->draftBody(), ['If-Match' => '1'])->assertOk()->assertExactJson(['lockVersion' => 2]);
        $this->putJson($url.'/draft', $this->draftBody(), ['If-Match' => '1'])->assertStatus(409)->assertJsonPath('code', 'lock_conflict');
        $this->postJson($url.'/publish', [], ['If-Match' => '1'])->assertStatus(409);
        $published = $this->postJson($url.'/publish', [], ['If-Match' => '2'])->assertCreated()->assertJsonPath('status', 'published')->json('versionId');
        self::assertSame($ids['version'], $published);
        self::assertSame($published, $this->db->table('active_plan_versions')->where('user_id', $user['id'])->value('version_id'));
        self::assertSame(21, $this->db->table('plan_meal_options as o')->join('plan_meals as m', 'm.id', '=', 'o.meal_id')->join('plan_days as d', 'd.id', '=', 'm.plan_day_id')->where('d.plan_version_id', $published)->where('o.approved_by', $doctor['id'])->count());
        $this->withToken($user['token']);
        $this->getJson('/v1/me/plan')->assertOk()->assertJsonCount(7, 'days')->assertJsonPath('versionId', $published);
        $this->withToken($doctor['token']);
        $this->getJson('/v1/specialist/patients/'.$user['id'].'/plan-versions')->assertOk()->assertJsonCount(1);
        $this->postJson($url.'/corrections')->assertCreated()->assertExactJson(['status' => 'in_review']);
        $draft = $this->db->table('plan_versions')->where('request_id', $ids['request'])->where('status', 'draft')->first();
        self::assertSame(2, $draft->version_number);
        $this->postJson($url.'/publish', [], ['If-Match' => '1'])->assertStatus(409)->assertJsonPath('code', 'options_required');
        self::assertSame('published', $this->db->table('plan_versions')->where('id', $published)->value('status'));
        $this->putJson($url.'/draft', $this->draftBody(), ['If-Match' => '1'])->assertOk();
        $this->postJson($url.'/publish', [], ['If-Match' => '2'])->assertCreated()->assertJsonPath('versionId', $draft->id);
        self::assertSame('superseded', $this->db->table('plan_versions')->where('id', $published)->value('status'));
        self::assertSame($draft->id, $this->db->table('active_plan_versions')->where('user_id', $user['id'])->value('version_id'));
        self::assertSame(2, $this->db->table('outbox_events')->where(['aggregate_id' => $user['id'], 'topic' => 'shopping.invalidate'])->count());
        $this->actor('admin');
        $this->getJson('/v1/admin/plan-versions/'.$published)->assertStatus(400)->assertJsonPath('code', 'reason_required');
        $this->getJson('/v1/admin/plan-versions/'.$published.'?reason='.urlencode('بررسی بالینی'))->assertOk()->assertJsonPath('status', 'superseded')->assertJsonCount(7, 'days');
    }

    public function test_publication_rejects_unverified_doctors_open_questions_old_weeks_and_changed_active_bases(): void
    {
        $user = $this->actor();
        $ids = $this->planFixture($user['id']);
        $doctor = $this->specialist($ids['request'], false);
        $url = '/v1/specialist/requests/'.$ids['request'];
        $this->putJson($url.'/draft', $this->draftBody(), ['If-Match' => '1'])->assertOk();
        $this->postJson($url.'/publish', [], ['If-Match' => '2'])->assertForbidden()->assertJsonPath('code', 'not_verified');
        $this->db->table('specialist_profiles')->where('user_id', $doctor['id'])->update(['verification_status' => 'verified']);
        $question = $this->postJson($url.'/questions', ['prompt' => 'پرسش ضروری', 'required' => true])->assertCreated()->json('id');
        $this->postJson($url.'/publish', [], ['If-Match' => '2'])->assertStatus(409)->assertJsonPath('code', 'info_required');
        $this->postJson('/v1/specialist/info-questions/'.$question.'/withdraw', ['reason' => 'رفع نیاز'])->assertCreated();
        $this->db->table('plan_requests')->where('id', $ids['request'])->update(['week_start' => '2020-01-04']);
        $this->postJson($url.'/publish', [], ['If-Match' => '2'])->assertStatus(409)->assertJsonPath('code', 'week_closed');
        $this->db->table('plan_requests')->where('id', $ids['request'])->update(['week_start' => CivilDates::saturday(CivilDates::today())]);
        $other = $this->planFixture($user['id'], true);
        $this->db->table('active_plan_versions')->insert(['user_id' => $user['id'], 'version_id' => $other['version']]);
        $this->postJson($url.'/publish', [], ['If-Match' => '2'])->assertStatus(409)->assertJsonPath('code', 'lock_conflict');
        self::assertSame('draft', $this->db->table('plan_versions')->where('id', $ids['version'])->value('status'));
        self::assertSame($other['version'], $this->db->table('active_plan_versions')->where('user_id', $user['id'])->value('version_id'));
        self::assertSame(0, $this->db->table('request_events')->where(['request_id' => $ids['request'], 'kind' => 'published'])->count());
    }

    public function test_staff_clinical_access_and_option_approval_are_scoped_and_audited(): void
    {
        $user = $this->actor();
        $ids = $this->planFixture($user['id']);
        $doctor = $this->specialist($ids['request']);
        $url = '/v1/specialist/requests/'.$ids['request'];
        $this->specialist(Crypto::uuid());
        $this->getJson($url)->assertNotFound();
        $this->putJson($url.'/draft', $this->draftBody(), ['If-Match' => '1'])->assertNotFound();
        $this->getJson('/v1/specialist/patients/'.$user['id'].'/plan-versions')->assertNotFound();
        $admin = $this->actor('admin');
        $this->getJson($url)->assertStatus(400);
        $this->getJson($url.'?reason='.urlencode('کنترل درمان'))->assertOk();
        $this->putJson($url.'/draft', $this->draftBody(), ['If-Match' => '1'])->assertForbidden();
        $body = $this->draftBody();
        foreach ($body['days'] as &$day) {
            foreach ($day['meals'] as &$meal) {
                foreach ($meal['options'] as &$option) {
                    $option['approved'] = false;
                }
            }
        }
        $this->putJson($url.'/draft', $body, ['If-Match' => '1'])->assertOk();
        $this->postJson($url.'/publish', [], ['If-Match' => '2'])->assertForbidden();
        self::assertSame(1, $this->db->table('health_access_logs')->where('actor_id', $admin['id'])->count());
    }

    public function test_doctor_receives_the_nutrition_profile_and_ai_review_with_preserved_json_shapes(): void
    {
        $user = $this->actor();
        $case = json_decode(file_get_contents(__DIR__.'/../Fixtures/node-onboarding.json'), true)['canonical'][6];
        $this->putJson('/v1/me/onboarding/draft', ['track' => $case['track'], 'patch' => $case['answers']])->assertOk();
        $profile = $this->postJson('/v1/me/onboarding/submit', ['consent' => true])->assertCreated()->json('profile');
        $ids = $this->planFixture($user['id']);
        $this->specialist($ids['request']);
        $generation = Crypto::uuid();
        $this->db->table('ai_generations')->insert(['id' => $generation, 'request_id' => $ids['request'], 'provider' => 'test-provider', 'status' => 'drafted', 'cost_micros' => 123, 'tokens' => 456,
            'warnings' => '["test-warning"]', 'attempt_chain' => '[{"provider":"test-provider","model":"test-model","status":"completed","code":"legacy-code"}]',
            'ai_notes' => '{"warnings":["validator-warning"],"critic":{},"dayTotals":[]}']);
        $result = $this->getJson('/v1/specialist/requests/'.$ids['request'])->assertOk()->assertJsonPath('profile.allergens.0', 'dairy')
            ->assertJsonPath('profile.energy.targetKcal', $profile['targetKcal'])->assertJsonPath('aiReview.generationId', $generation)
            ->assertJsonPath('aiReview.costMicros', 123)->assertJsonPath('aiReview.attempts.0.outcome', 'completed')->assertJsonPath('aiReview.attempts.0.errorCode', 'legacy-code');
        self::assertStringContainsString('"critic":{}', $result->getContent());
        self::assertArrayNotHasKey('name', $result->json('profile'));
        self::assertArrayNotHasKey('healthDetails', $result->json('profile'));
    }
}
