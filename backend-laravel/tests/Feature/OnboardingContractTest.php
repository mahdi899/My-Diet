<?php

namespace Tests\Feature;

use App\Shared\Domain\LegacyCrypto as Crypto;
use Tests\MySqlTestCase;

final class OnboardingContractTest extends MySqlTestCase
{
    public function test_all_tracks_save_encrypted_drafts_and_finish_with_node_compatible_profiles(): void
    {
        $vectors = json_decode(file_get_contents(__DIR__.'/../Fixtures/node-onboarding.json'), true);
        $this->getJson('/v1/public/onboarding-spec')->assertOk()->assertJsonPath('version', 2);
        foreach ($vectors['canonical'] as $case) {
            $user = $this->actor();
            $this->getJson('/v1/me/onboarding')->assertOk()->assertJsonPath('status', 'none');
            $saved = $this->putJson('/v1/me/onboarding/draft', ['track' => $case['track'], 'patch' => $case['answers'], 'progress' => 75, 'stepKey' => 'review'])
                ->assertOk()->json('version');
            $this->putJson('/v1/me/onboarding/draft', ['patch' => ['name' => 'نباید ثبت شود'], 'baseVersion' => $saved + 1])
                ->assertStatus(409)->assertJsonPath('code', 'draft_conflict');
            $this->getJson('/v1/me/onboarding')->assertOk()->assertJsonPath('status', 'in_progress')->assertJsonPath('draft.answers.name', $case['answers']['name']);
            $this->postJson('/v1/me/onboarding/submit', ['consent' => false])->assertStatus(422)->assertJsonPath('code', 'consent_required');
            $created = $this->postJson('/v1/me/onboarding/submit', ['consent' => true])->assertCreated()->assertJsonPath('profile.consented', true)->json();
            $profile = $case['profile'];
            foreach (['bmrKcal', 'tdeeKcal', 'targetKcal', 'proteinG', 'carbsG', 'fatG'] as $key) {
                self::assertSame($profile['energy'][$key], $created['profile'][$key]);
            }
            self::assertEquals($profile['bmi'], $created['profile']['bmi']);
            self::assertSame($profile['safety']['tier'], $created['profile']['safetyTier']);
            $this->getJson('/v1/me/onboarding')->assertOk()->assertJsonPath('nextStep', 'enter_app')->assertJsonPath('profile.track', $case['track']);
            self::assertFalse($this->db->table('onboarding_drafts')->where('user_id', $user['id'])->exists());
            self::assertSame(1, $this->db->table('nutrition_profile_history')->where('user_id', $user['id'])->count());
            self::assertSame(count($case['facts']), $this->db->table('onboarding_answer_facts')->where('submission_id', $created['submissionId'])->count());
            $stored = json_decode($this->db->table('questionnaire_submissions')->where('id', $created['submissionId'])->value('answers'), true);
            self::assertStringStartsWith('enc1:', $stored['dislikes']);
            self::assertSame($case['validated']['answers']['dislikes'], Crypto::decrypt($stored['dislikes'], config('identity.field_key')));
        }
    }

    public function test_only_the_assigned_specialist_can_read_member_onboarding_answers(): void
    {
        $user = $this->actor();
        $case = json_decode(file_get_contents(__DIR__.'/../Fixtures/node-onboarding.json'), true)['canonical'][0];
        $this->putJson('/v1/me/onboarding/draft', ['track' => $case['track'], 'patch' => $case['answers']])->assertOk();
        $this->postJson('/v1/me/onboarding/submit', ['consent' => true])->assertCreated();

        $path = '/v1/specialist/members/'.$user['id'];
        $this->actor('specialist');
        $this->getJson($path)->assertNotFound();

        $doctor = $this->actor('specialist');
        $this->db->table('specialist_profiles')->insert(['user_id' => $doctor['id'], 'display_name' => 'پزشک آزمایش']);
        $this->db->table('specialist_members')->insert(['user_id' => $user['id'], 'specialist_id' => $doctor['id']]);
        $this->getJson($path)->assertOk()->assertJsonFragment([
            'question' => 'اسم شما چیست؟', 'answer' => $case['answers']['name'],
        ]);
    }

    public function test_incomplete_inputs_legacy_profile_backfill_and_consent_are_authorized(): void
    {
        $user = $this->actor();
        $this->postJson('/v1/me/onboarding/consent')->assertStatus(409);
        $this->putJson('/v1/me/onboarding/draft', ['track' => 'unknown', 'patch' => []])->assertStatus(400);
        $this->putJson('/v1/me/onboarding/draft', ['track' => 'weight_loss', 'patch' => ['name' => 'نام آزمایشی']])->assertOk();
        $this->postJson('/v1/me/onboarding/submit', ['consent' => true])->assertStatus(422)->assertJsonPath('code', 'onboarding_incomplete');
        self::assertSame(0, $this->db->table('questionnaire_submissions')->where('user_id', $user['id'])->count());
        $case = json_decode(file_get_contents(__DIR__.'/../Fixtures/node-onboarding.json'), true)['canonical'][0];
        $this->postJson('/v1/me/questionnaire/submissions', $case['submission'])->assertCreated();
        $this->getJson('/v1/me/onboarding')->assertOk()->assertJsonPath('status', 'complete')->assertJsonPath('nextStep', 'consent');
        $this->postJson('/v1/me/onboarding/consent')->assertCreated()->assertExactJson(['ok' => true]);
        $this->getJson('/v1/me/onboarding')->assertOk()->assertJsonPath('nextStep', 'enter_app');
        $this->getJson('/v1/me/onboarding')->assertOk();
        self::assertSame(1, $this->db->table('nutrition_profile_history')->where('user_id', $user['id'])->count());
        $this->actor('admin');
        $this->getJson('/v1/me/onboarding')->assertForbidden();
    }
}
