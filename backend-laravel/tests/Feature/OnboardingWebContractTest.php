<?php

namespace Tests\Feature;

use App\Shared\Domain\LegacyCrypto as Crypto;
use Tests\MySqlTestCase;

final class OnboardingWebContractTest extends MySqlTestCase
{
    private function leadId(): string
    {
        $id = Crypto::uuid();
        $id[14] = '4';

        return $id;
    }

    public function test_web_submission_is_encrypted_idempotent_and_claimed_only_by_its_verified_phone(): void
    {
        $owner = $this->actor();
        $phone = $this->db->table('users')->where('id', $owner['id'])->value('phone_e164');
        $id = $this->leadId();
        $journey = Crypto::uuid();
        $body = ['id' => $id, 'phone' => $phone, 'goal' => 'weight_loss', 'answers' => [['key' => 'name', 'question' => 'نام', 'answer' => 'نام محرمانهٔ وب']]];
        $this->postJson('/v1/onboarding/submissions', $body)->assertCreated()->assertJsonPath('saved', true);
        $this->postJson('/v1/onboarding/submissions', $body)->assertCreated();
        $stored = $this->db->table('demo_lead_submissions')->where('id', $id)->first();
        self::assertSame($phone, Crypto::decrypt($stored->phone_encrypted, config('identity.field_key')));
        self::assertStringNotContainsString('نام محرمانهٔ وب', $stored->answers_encrypted);
        self::assertSame(1, $this->db->table('demo_lead_submissions')->where('id', $id)->count());
        $this->postJson('/v1/onboarding/submissions', [...$body, 'phone' => '+989111111111'])->assertStatus(409);
        $this->actor();
        $this->postJson('/v1/onboarding/submissions/'.$id.'/verify', ['journeyId' => $journey])->assertNotFound();
        $this->withToken($owner['token']);
        $this->postJson('/v1/onboarding/submissions/'.$id.'/verify', ['journeyId' => $journey])->assertCreated()->assertExactJson(['verified' => true]);
        $this->postJson('/v1/onboarding/submissions/'.$id.'/verify', [])->assertStatus(400);
        $this->call('POST', '/v1/onboarding/submissions/'.$id.'/verify', [], [], [], ['CONTENT_TYPE' => 'application/json', 'HTTP_AUTHORIZATION' => 'Bearer '.$owner['token']], '{}')->assertCreated();
        self::assertSame($owner['id'], $this->db->table('onboarding_analytics_journeys')->where('journey_id', $journey)->value('user_id'));
        $this->getJson('/v1/me/onboarding')->assertOk()->assertJsonPath('status', 'needs_gaps')->assertJsonPath('draft.answers.name', 'نام محرمانهٔ وب');
        $case = json_decode(file_get_contents(__DIR__.'/../Fixtures/node-onboarding.json'), true)['canonical'][0];
        $this->putJson('/v1/me/onboarding/draft', ['patch' => $case['answers']])->assertOk();
        $this->postJson('/v1/me/onboarding/submit', ['consent' => true])->assertCreated()->assertJsonPath('profile.source', 'demo');
        $this->getJson('/v1/me/onboarding')->assertOk()->assertJsonPath('nextStep', 'enter_app');
        self::assertSame($owner['id'], $this->db->table('demo_lead_submissions')->where('id', $id)->value('claimed_user_id'));
        $this->getJson('/v1/admin/onboarding/profiles')->assertForbidden();
    }

    public function test_website_signup_keeps_the_campaign_link_on_the_admin_user(): void
    {
        $owner = $this->actor();
        $phone = $this->db->table('users')->where('id', $owner['id'])->value('phone_e164');
        $this->db->table('demo_campaign_links')->insert(['id' => Crypto::uuid(), 'name' => 'بهار', 'slug' => 'spring-drive', 'source' => 'telegram']);
        $id = $this->leadId();
        $this->postJson('/v1/onboarding/submissions', ['id' => $id, 'phone' => $phone, 'goal' => 'weight_loss', 'campaign' => 'spring-drive', 'answers' => [['key' => 'name', 'question' => 'نام', 'answer' => 'زهره']]])->assertCreated();
        self::assertSame('spring-drive', $this->db->table('demo_lead_submissions')->where('id', $id)->value('campaign_slug'));
        $this->call('POST', '/v1/onboarding/submissions/'.$id.'/verify', [], [], [], ['CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT' => 'application/json', 'HTTP_AUTHORIZATION' => 'Bearer '.$owner['token']], '{}')->assertCreated();
        self::assertSame('spring-drive', $this->db->table('users')->where('id', $owner['id'])->value('signup_channel'));
        $this->actor('admin');
        $this->getJson('/v1/admin/users/'.$owner['id'])->assertOk()
            ->assertJsonPath('registration.label', 'آنبوردینگ وب')
            ->assertJsonPath('registration.link', 'بهار')
            ->assertJsonPath('registration.source', 'تلگرام');
    }

    public function test_admin_profiles_facts_audit_filters_and_materialized_funnel_work_on_mysql(): void
    {
        $case = json_decode(file_get_contents(__DIR__.'/../Fixtures/node-onboarding.json'), true)['canonical'][0];
        $owners = [];
        foreach (range(0, 1) as $index) {
            $owner = $this->actor();
            $owners[] = $owner;
            $this->db->table('users')->where('id', $owner['id'])->update(['display_name' => 'کاربر %_'.$index]);
            $this->putJson('/v1/me/onboarding/draft', ['track' => $case['track'], 'patch' => $case['answers']])->assertOk();
            $this->postJson('/v1/me/onboarding/submit', ['consent' => true])->assertCreated();
            $this->db->table('nutrition_profiles')->where('user_id', $owner['id'])->update(['created_at' => '2020-06-01 20:00:00.000000', 'updated_at' => '2026-11-14 10:00:00.12345'.$index]);
        }
        $admin = $this->actor('admin');
        $this->getJson('/v1/admin/onboarding/profiles?track=wrong')->assertStatus(400);
        $first = $this->getJson('/v1/admin/onboarding/profiles?limit=1&q='.urlencode('%_'))->assertOk()->assertJsonCount(1, 'items')->json();
        $next = $this->getJson('/v1/admin/onboarding/profiles?limit=1&q='.urlencode('%_').'&cursor='.urlencode($first['nextCursor']))->assertOk()->assertJsonCount(1, 'items')->json();
        self::assertNotSame($first['items'][0]['userId'], $next['items'][0]['userId']);
        self::assertNull($next['nextCursor']);
        $user = $owners[0]['id'];
        $detail = $this->getJson('/v1/admin/onboarding/profiles/'.$user)->assertOk()->assertJsonCount(count($case['facts']), 'facts')->assertJsonCount(1, 'history')->json();
        self::assertSame($case['validated']['answers']['dislikes'], $detail['submission']['answers']['dislikes']);
        self::assertSame(1, $this->db->table('audit_logs')->where(['actor_id' => $admin['id'], 'action' => 'onboarding_profile_viewed', 'target_id' => $user])->count());
        $this->getJson('/v1/admin/onboarding/funnel')->assertOk()->assertJsonPath('stages.profiles', 2)->assertJsonCount(0, 'daily');
        $this->postJson('/v1/admin/onboarding/funnel/refresh')->assertCreated()->assertExactJson(['ok' => true]);
        $this->getJson('/v1/admin/onboarding/funnel')->assertOk()->assertJsonPath('daily.0.day', '2020-06-02')->assertJsonPath('daily.0.profiles', 2)->assertJsonPath('daily.0.doctor_only', 0);
        $this->postJson('/v1/admin/onboarding/funnel/refresh')->assertCreated();
        self::assertSame(1, $this->db->table('onboarding_daily_cache')->count());
    }

    public function test_web_questionnaire_configuration_and_counter_keep_original_contracts(): void
    {
        $this->actor('admin');
        $document = ['title' => 'سؤال‌های وب', 'questions' => [['id' => 1, 'q' => 'عنوان اصلی', 'type' => 'discarded'], ['id' => 101, 'q' => 'سؤال انتخابی', 'type' => 'choice', 'options' => ['اول', 'دوم']]]];
        $this->putJson('/v1/admin/onboarding-questionnaire/weight_loss', $document)->assertOk()->assertJsonMissingPath('questions.0.type');
        $this->getJson('/v1/public/onboarding-questionnaire')->assertOk()->assertJsonPath('weight_loss.questions.1.options.0', 'اول');
        $this->putJson('/v1/admin/onboarding-questionnaire/weight_loss', [...$document, 'questions' => [['id' => 101, 'q' => 'عنوان', 'type' => 'choice', 'options' => ['فقط یکی']]]])->assertStatus(400);
        $this->putJson('/v1/admin/onboarding-questionnaire/weight_loss', [...$document, 'title' => '<script>'])->assertStatus(400)->assertJsonPath('code', 'unsafe_content');
        $this->db->table('app_settings')->where('key', 'demo.community_join_counter')->delete();
        $this->postJson('/v1/public/onboarding/community-join')->assertCreated()->assertExactJson(['count' => 1621]);
        $this->postJson('/v1/public/onboarding/community-join')->assertCreated()->assertExactJson(['count' => 1622]);
        self::assertSame(2, $this->db->table('app_settings')->where('key', 'demo.community_join_counter')->value('version'));
        $this->postJson('/v1/onboarding/submissions', ['id' => Crypto::uuid(), 'phone' => '09120000000', 'goal' => 'detox', 'answers' => [['question' => 'نام', 'answer' => 'تست']]])->assertStatus(400);
        $this->postJson('/v1/onboarding/submissions', ['id' => $this->leadId(), 'phone' => '09120000000', 'goal' => 'detox', 'answers' => [['question' => 'نام', 'answer' => 'تست', 'codes' => [null]]]])->assertStatus(400);
    }
}
