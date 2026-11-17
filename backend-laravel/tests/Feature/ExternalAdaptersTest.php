<?php

namespace Tests\Feature;

use App\Modules\Ai\Infrastructure\ConfiguredAiCatalog;
use App\Modules\Ai\Infrastructure\ModelPools;
use App\Modules\Ai\Infrastructure\ProviderClient;
use App\Modules\Coach\Application\CoachModel;
use App\Modules\Coach\Infrastructure\ConfiguredCoachModel;
use App\Modules\Coach\Infrastructure\MySqlCoach;
use App\Modules\Identity\Application\IdentitySettings;
use App\Modules\Onboarding\Application\OnboardingStore;
use App\Modules\Onboarding\Domain\EnergyEngine;
use App\Modules\Plans\Application\DraftProvider;
use App\Modules\Plans\Infrastructure\ConfiguredDraftProvider;
use App\Modules\Realtime\Infrastructure\FcmPush;
use App\Modules\Worker\Application\JobWorker;
use App\Modules\Worker\Application\WorkerStore;
use App\Shared\Domain\LegacyCrypto as Crypto;
use App\Shared\Domain\Problem;
use Illuminate\Http\Client\Factory;
use Illuminate\Support\Facades\Http;
use Tests\MySqlTestCase;

final class ExternalAdaptersTest extends MySqlTestCase
{
    public function test_production_rejects_private_ai_endpoints_before_sending_any_request(): void
    {
        config(['ai.http' => true, 'ai.allow_private' => true]);
        Http::preventStrayRequests();
        Http::fake();
        $settings = new IdentitySettings('production', 'test-jwt', 'test-otp', 'test-field-key');
        try {
            (new ProviderClient($settings))->complete(['base_url' => 'https://127.0.0.1/v1', 'api_key_encrypted' => 'unused'], 'wire', []);
            self::fail('Private production endpoints must be rejected.');
        } catch (Problem $error) {
            self::assertSame('endpoint_invalid', $error->problemCode);
        }
        Http::assertNothingSent();
    }

    private function pool(string $code = 'nutrition_coach'): array
    {
        config(['ai.http' => true, 'ai.allow_private' => true]);
        $provider = Crypto::uuid();
        $pool = Crypto::uuid();
        $member = Crypto::uuid();
        $this->db->table('ai_providers')->insert(['id' => $provider, 'name' => 'HTTP test '.$provider, 'kind' => 'openai_compatible', 'base_url' => 'https://provider.example/v1', 'api_key_encrypted' => Crypto::encrypt('adapter-test-secret', config('identity.field_key'))]);
        $this->db->table('ai_pools')->where('code', $code)->delete();
        $this->db->table('ai_pools')->insert(['id' => $pool, 'code' => $code, 'title' => 'HTTP test', 'strategy' => 'priority', 'max_tokens' => 1000, 'max_attempts' => 2]);
        $this->db->table('ai_pool_members')->insert(['id' => $member, 'pool_id' => $pool, 'provider_id' => $provider, 'model' => 'real-wire-model', 'price_in_micros_per_m' => 1000, 'price_out_micros_per_m' => 2000]);

        return compact('provider', 'pool', 'member');
    }

    public function test_real_provider_uses_configured_endpoint_key_and_model_and_accounts_for_usage(): void
    {
        $ids = $this->pool();
        Http::preventStrayRequests();
        Http::fake(['provider.example/v1/models' => Http::response(['data' => [['id' => 'remote-model', 'name' => 'Remote model']]]),
            'provider.example/v1/chat/completions' => Http::response(['choices' => [['message' => ['content' => 'پاسخ مدل از HTTP']]], 'usage' => ['prompt_tokens' => 10, 'completion_tokens' => 20, 'cost' => 0.000123]])]);
        $provider = (array) $this->db->table('ai_providers')->where('id', $ids['provider'])->first();
        $catalog = $this->app->make(ConfiguredAiCatalog::class);
        self::assertSame('remote-model', $catalog->models($provider)[0]['id']);
        $result = $this->app->make(ModelPools::class)->run('nutrition_coach', [['role' => 'user', 'content' => 'سلام']]);
        self::assertSame('پاسخ مدل از HTTP', $result['text']);
        self::assertSame(123, $result['costMicros']);
        self::assertSame(123, (int) $this->db->table('ai_usage_ledger')->where('member_id', $ids['member'])->sum('cost_micros'));
        self::assertSame(0, $this->db->table('ai_call_reservations')->where('state', 'reserved')->count());
        Http::assertSent(fn ($req) => str_ends_with($req->url(), '/chat/completions') && $req->hasHeader('Authorization', 'Bearer adapter-test-secret') && $req['model'] === 'real-wire-model');
        self::assertSame(1, (int) $this->db->table('ai_pool_health')->where('member_id', $ids['member'])->value('total_ok'));
    }

    public function test_http_failure_is_not_reported_as_success_and_disabled_or_over_budget_calls_do_not_send(): void
    {
        $ids = $this->pool();
        Http::preventStrayRequests();
        Http::fake(['*' => Http::response(['error' => ['message' => 'bad credentials']], 401)]);
        $provider = (array) $this->db->table('ai_providers')->where('id', $ids['provider'])->first();
        self::assertFalse($this->app->make(ConfiguredAiCatalog::class)->complete('wire', $provider)['ok']);
        Http::fake();
        $this->db->table('ai_controls')->where('id', 1)->update(['daily_cost_cap_micros' => 1]);
        try {
            $this->app->make(ModelPools::class)->run('nutrition_coach', [['role' => 'user', 'content' => 'hello']]);
            self::fail('Budget must reject');
        } catch (Problem $e) {
            self::assertSame('ai_budget_exceeded', $e->problemCode);
        }
        Http::assertNothingSent();
        config(['ai.http' => false]);
        try {
            $this->app->make(ProviderClient::class)->complete($provider, 'wire', []);
            self::fail('Disabled provider must reject');
        } catch (Problem $e) {
            self::assertSame('ai_disabled', $e->problemCode);
        }
        Http::assertNothingSent();
    }

    public function test_coach_http_failures_keep_usage_and_retries_do_not_increment_water_twice(): void
    {
        $this->pool();
        $user = $this->actor();
        $this->app->bind(CoachModel::class, ConfiguredCoachModel::class);
        Http::preventStrayRequests();
        Http::fake(['*' => Http::response(['choices' => [['message' => ['content' => 'پاسخ واقعی آداپتر']]], 'usage' => ['prompt_tokens' => 2, 'completion_tokens' => 3]])]);
        $coach = $this->app->make(MySqlCoach::class);
        $command = Crypto::uuid();
        $coach->action($user['id'], $command, 'log_water');
        $coach->action($user['id'], $command, 'log_water');
        self::assertSame(250, $coach->today($user['id'])['waterMl']);
        Http::assertNothingSent();
        Http::swap(new Factory);
        Http::preventStrayRequests();
        Http::fake(['*' => Http::response(['malformed' => 'paid upstream reply'], 200)]);
        try {
            $coach->accept($user['id'], Crypto::uuid(), 'سلام دوباره');
            self::fail('Malformed provider output must fail');
        } catch (Problem $error) {
            self::assertSame('outcome_unknown', $error->problemCode);
        }
        self::assertSame(1, $this->db->table('ai_usage_ledger')->where('outcome', 'outcome_unknown')->count());
    }

    public function test_fcm_signs_oauth_assertion_sends_http_and_does_not_acknowledge_provider_failure(): void
    {
        $key = openssl_pkey_new(['config' => __DIR__.'/../Fixtures/openssl.cnf', 'private_key_bits' => 2048, 'private_key_type' => OPENSSL_KEYTYPE_RSA]);
        self::assertNotFalse($key);
        openssl_pkey_export($key, $private, null, ['config' => __DIR__.'/../Fixtures/openssl.cnf']);
        $public = openssl_pkey_get_details($key)['key'];
        $account = ['projectId' => 'sabzine-test', 'clientEmail' => 'worker@sabzine-test.iam.gserviceaccount.com', 'privateKey' => $private];
        $sealed = json_encode(['encrypted' => Crypto::encrypt(json_encode($account), config('identity.field_key'))]);
        $this->db->table('app_settings')->updateOrInsert(['key' => 'firebase_admin'], ['value' => $sealed]);
        Http::preventStrayRequests();
        Http::fake(['oauth2.googleapis.com/token' => Http::response(['access_token' => 'oauth-test-access', 'expires_in' => 3600]),
            'fcm.googleapis.com/*' => Http::sequence()->push(['name' => 'projects/sabzine-test/messages/123'])->push(['error' => ['message' => 'unavailable']], 503)]);
        $push = $this->app->make(FcmPush::class);
        $push->send('device-token-test', 'plan_ready');
        Http::assertSent(function ($r) use ($public): bool {
            if (! str_contains($r->url(), 'oauth2.googleapis.com')) {
                return false;
            }
            [$head,$claims,$signature] = explode('.', $r['assertion']);
            $payload = json_decode(Crypto::decode64($claims), true);

            return openssl_verify($head.'.'.$claims, Crypto::decode64($signature), $public, OPENSSL_ALGO_SHA256) === 1 && $payload['scope'] === 'https://www.googleapis.com/auth/firebase.messaging';
        });
        Http::assertSent(fn ($r) => str_contains($r->url(), 'fcm.googleapis.com') && $r->hasHeader('Authorization', 'Bearer oauth-test-access') && $r['message']['token'] === 'device-token-test');
        $this->expectException(Problem::class);
        $push->send('device-token-test', 'plan_ready');
    }

    public function test_configured_draft_is_grounded_in_catalogue_and_rejects_invented_foods(): void
    {
        $this->pool('plan_draft');
        $user = $this->actor();
        $case = json_decode(file_get_contents(__DIR__.'/../Fixtures/node-onboarding.json'), true)['canonical'][6];
        $this->putJson('/v1/me/onboarding/draft', ['track' => $case['track'], 'patch' => $case['answers']])->assertOk();
        $this->postJson('/v1/me/onboarding/submit', ['consent' => true])->assertCreated();
        $profile = $this->app->make(OnboardingStore::class)->profile($user['id']);
        $plan = $this->planFixture($user['id']);
        $this->db->table('nutrition_profiles')->where('user_id', $user['id'])->update(['allergens' => '[]', 'diet_style' => 'omnivore', 'safety_tier' => 'ai_ok']);
        $slots = EnergyEngine::slots((int) $profile['target_kcal'], $profile['meals_per_day']);
        $meals = [];
        foreach ($slots as $i => $slot) {
            foreach (['a', 'b'] as $suffix) {
                $slug = 'wire_food_'.$i.'_'.$suffix;
                $this->db->table('food_catalog')->insert(['id' => Crypto::uuid(), 'slug' => $slug, 'name_fa' => $slug, 'category' => 'main',
                    'meal_types' => json_encode([$slot['mealType']]), 'serving_label' => 'وعده', 'kcal' => $slot['kcal'],
                    'allergens' => '[]', 'tags' => '[]', 'regions' => '[]', 'seasons' => '[]',
                    'ingredients' => '[{"name":"عدس","quantity":80,"unit":"g","category":"other"}]']);
            }
            $meals[] = ['mealType' => $slot['mealType'], 'primary' => [['slug' => 'wire_food_'.$i.'_a', 'servings' => 1]], 'alternative' => [['slug' => 'wire_food_'.$i.'_b', 'servings' => 1]], 'note' => ''];
        }
        $days = array_map(fn ($n) => ['day' => $n, 'meals' => $meals], range(1, 7));
        Http::preventStrayRequests();
        Http::fake(['*' => Http::response(['choices' => [['message' => ['content' => json_encode(['days' => $days])]]], 'usage' => ['prompt_tokens' => 10, 'completion_tokens' => 20]])]);
        $result = $this->app->make(ConfiguredDraftProvider::class)->draft($plan['request']);
        self::assertCount(7, $result);
        self::assertCount(count($slots), $result[0]['meals']);
        self::assertSame($slots[0]['kcal'], $result[0]['meals'][0]['calories']);
        self::assertCount(2, $result[0]['meals'][0]['options']);
        self::assertFalse($result[0]['meals'][0]['options'][0]['approved']);
        Http::assertSent(fn ($r) => ! str_contains(json_encode($r->data()), $user['id']) && str_contains(json_encode($r->data()), 'wire_food_0_a'));
        $this->app->bind(DraftProvider::class, ConfiguredDraftProvider::class);
        $this->db->table('plan_version_context')->where('version_id', $plan['version'])->delete();
        $this->db->table('plan_meal_items')->where('meal_id', $plan['meal'])->delete();
        $this->db->table('plan_meal_options')->where('meal_id', $plan['meal'])->delete();
        $this->db->table('plan_meals')->where('id', $plan['meal'])->delete();
        $this->db->table('plan_days')->where('id', $plan['day'])->delete();
        $this->db->table('plan_versions')->where('id', $plan['version'])->delete();
        $this->db->table('plan_requests')->where('id', $plan['request'])->update(['status' => 'queued']);
        $this->db->table('outbox_events')->insert(['id' => Crypto::uuid(), 'topic' => 'plan.generate', 'aggregate_id' => $plan['request'], 'payload' => json_encode(['requestId' => $plan['request']])]);
        $this->app->make(WorkerStore::class)->relay();
        self::assertSame(1, $this->app->make(JobWorker::class)->drain());
        self::assertSame('in_review', $this->db->table('plan_requests')->where('id', $plan['request'])->value('status'));
        self::assertSame('pool', $this->db->table('ai_generations')->where('request_id', $plan['request'])->value('provider'));
        $days[0]['meals'][0]['primary'][0]['slug'] = 'invented_food';
        Http::swap(new Factory);
        Http::preventStrayRequests();
        Http::fake(['*' => Http::response(['choices' => [['message' => ['content' => json_encode(['days' => $days])]]], 'usage' => ['prompt_tokens' => 1, 'completion_tokens' => 1]])]);
        try {
            $this->app->make(ConfiguredDraftProvider::class)->draft($plan['request']);
            self::fail('Unknown foods must be rejected');
        } catch (Problem $e) {
            self::assertSame('invalid_plan', $e->problemCode);
        }
        self::assertSame(1, $this->db->table('ai_usage_ledger')->where('request_id', $plan['request'])->where('outcome', 'invalid_plan')->count());
    }
}
