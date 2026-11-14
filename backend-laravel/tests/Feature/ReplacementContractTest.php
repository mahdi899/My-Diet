<?php

namespace Tests\Feature;

use App\Modules\Ai\Infrastructure\FixedAiCatalog;
use App\Shared\Domain\LegacyCrypto as Crypto;
use Tests\MySqlTestCase;

final class ReplacementContractTest extends MySqlTestCase
{
    public function test_admin_coach_ai_and_metrics_cover_the_remaining_contracts(): void
    {
        $admin = $this->actor('admin');
        $user = $this->actor('user');
        $this->withToken($admin['token']);
        $specialist = $this->postJson('/v1/admin/specialists', ['phone' => '09120000000', 'displayName' => 'دکتر آزمایش'])->assertCreated()->json('id');
        $this->patchJson('/v1/admin/specialists/'.$specialist, ['capacity' => 12, 'active' => true])->assertOk()->assertJsonPath('ok', true);
        $this->postJson('/v1/admin/specialists/'.$specialist.'/verification', ['status' => 'verified'])->assertCreated();
        $this->postJson('/v1/admin/specialists/'.$specialist.'/members', ['userId' => $user['id']])->assertCreated()->assertJsonPath('ok', true);
        $this->getJson('/v1/admin/specialists/'.$specialist.'/members')->assertOk()->assertJsonPath('0.id', $user['id']);
        $this->putJson('/v1/admin/prices', ['serviceCode' => 'new_plan', 'amountToman' => 250000])->assertOk()->assertJsonPath('amountToman', 250000);
        $this->putJson('/v1/admin/reward', ['amountToman' => 10000])->assertOk();
        $reference = Crypto::uuid();
        $this->postJson('/v1/admin/wallet-adjustments', ['userId' => $user['id'], 'amountToman' => 500, 'direction' => 'credit', 'reason' => 'اصلاح آزمایش', 'referenceId' => $reference])->assertCreated()->assertJsonPath('cashToman', 500);
        $this->postJson('/v1/admin/wallet-adjustments', ['userId' => $user['id'], 'amountToman' => 500, 'direction' => 'credit', 'reason' => 'اصلاح آزمایش', 'referenceId' => $reference])->assertCreated()->assertJsonPath('cashToman', 500);
        $this->postJson('/v1/admin/wallet-adjustments', ['userId' => $user['id'], 'amountToman' => 900, 'direction' => 'debit', 'reason' => 'برداشت زیاد', 'referenceId' => Crypto::uuid()])->assertStatus(402);
        self::assertSame(1, $this->db->table('wallet_ledger')->where(['user_id' => $user['id'], 'reference_id' => $reference])->count());
        $dead = Crypto::uuid();
        $this->db->table('outbox_events')->insert(['id' => $dead, 'topic' => 'plan.generate', 'aggregate_id' => Crypto::uuid(), 'payload' => '{}', 'attempts' => 10]);
        $this->getJson('/v1/admin/outbox/dead')->assertOk()->assertJsonPath('events.0.id', $dead);
        $this->postJson('/v1/admin/outbox/'.$dead.'/retry')->assertCreated()->assertJsonPath('attempts', 0);
        $this->postJson('/v1/admin/maintenance')->assertCreated()->assertJsonStructure(['expiredPayments', 'ledgerMismatches']);
        $this->getJson('/v1/admin/users/'.$user['id'])->assertOk()->assertJsonPath('phone', $this->db->table('users')->where('id', $user['id'])->value('phone_e164'));
        $provider = $this->postJson('/v1/admin/ai/providers', ['name' => 'آزمایش', 'kind' => 'openai_compatible', 'baseUrl' => 'https://example.com/v1', 'apiKey' => 'secret-key'])->assertCreated()->json();
        self::assertTrue($provider['hasKey']);
        self::assertFalse(app(FixedAiCatalog::class)->callsExternalNetwork());
        $this->postJson('/v1/admin/ai/providers/'.$provider['id'].'/test', ['model' => 'test'])->assertCreated()->assertJsonPath('ok', true)->assertJsonPath('answer', 'ok');
        $this->getJson('/v1/admin/ai/providers/'.$provider['id'].'/models')->assertOk()->assertJsonPath('suggested.0', FixedAiCatalog::SUGGESTED[0]);
        $pool = Crypto::uuid();
        $this->db->table('ai_pools')->insert(['id' => $pool, 'code' => 'draft_pool', 'title' => 'پیش‌نویس', 'strategy' => 'priority']);
        $members = $this->putJson('/v1/admin/ai/pools/draft_pool/members', ['members' => [['providerId' => $provider['id'], 'model' => 'test-model', 'weight' => 1]]])->assertOk()->json('items');
        $draftPool = array_values(array_filter($members, fn ($item) => $item['code'] === 'draft_pool'))[0];
        self::assertSame('test-model', $draftPool['members'][0]['model']);
        $this->postJson('/v1/admin/ai/pools/draft_pool/test')->assertCreated()->assertJsonPath('ok', true)->assertJsonPath('answer', 'ok');
        $this->putJson('/v1/admin/ai/budget', ['killSwitch' => true, 'perUserDailyDrafts' => 2])->assertOk()->assertJsonPath('killSwitch', true);
        $this->putJson('/v1/admin/ai/budget', ['killSwitch' => false])->assertOk()->assertJsonPath('killSwitch', false);
        $system = str_repeat('سیستم ', 40);
        $prompt = $this->postJson('/v1/admin/ai/prompts/coach_system', ['systemPrompt' => $system, 'userTemplate' => ''])->assertCreated()->json();
        $this->postJson('/v1/admin/ai/prompts/coach_system/'.$prompt['version'].'/activate')->assertCreated()->assertJsonPath('ok', true);
        $link = $this->postJson('/v1/admin/campaign-links', ['name' => 'بهار', 'slug' => 'spring-drive', 'source' => 'telegram'])->assertCreated()->json();
        $this->get('/go/spring-drive')->assertRedirect('/onboarding/?utm_source=telegram&utm_medium=campaign&utm_campaign=spring-drive');
        self::assertSame(1, (int) $this->db->table('demo_campaign_links')->where('id', $link['id'])->value('opens'));
        $this->getJson('/v1/admin/web-analytics?days=3')->assertStatus(400);
        $this->getJson('/v1/admin/web-analytics/live')->assertStatus(503)->assertJsonPath('code', 'analytics_unavailable');
        $this->get('/metrics')->assertOk()->assertSee('sabzine_outbox_undispatched', false);
        $this->withToken($user['token']);
        $this->postJson('/v1/me/coach/messages', ['clientMessageId' => Crypto::uuid(), 'kind' => 'text', 'text' => 'سلام'])->assertOk();
        self::assertSame('پاسخ آزمایشی', $this->db->table('coach_messages')->where('user_id', $user['id'])->where('role', 'assistant')->value('fallback_text'));
        $this->postJson('/v1/me/coach/actions', ['clientMessageId' => Crypto::uuid(), 'action' => 'log_water'])->assertOk()->assertJsonPath('today.waterMl', 250);
        $this->postJson('/v1/me/coach/day-brief')->assertOk()->assertJsonPath('created', true);
        self::assertMatchesRegularExpression('/^\d{4}-\d{2}-\d{2}$/', (string) $this->getJson('/v1/me/coach/thread')->json('thread.dayBriefDate'));
        $this->withToken($admin['token']);
        $this->postJson('/v1/admin/users/'.$user['id'].'/status', ['status' => 'suspended'])->assertCreated()->assertJsonPath('status', 'suspended');
        $this->getJson('/v1/public/config')->assertOk()->assertJsonStructure(['minAppVersion', 'download']);
        $this->getJson('/v1/public/daily-message?date=2026-11-14')->assertOk()->assertJsonPath('body', null);
    }

    public function test_analytics_report_counts_goals_sources_and_daily_rows(): void
    {
        $admin = $this->actor('admin');
        $website = Crypto::uuid();
        $visit = Crypto::uuid();
        $event = Crypto::uuid();
        config(['analytics.url' => getenv('MYSQL_TEST_URL'), 'analytics.website_id' => $website]);
        $this->db->table('website_event')->insert(['event_id' => $event, 'website_id' => $website, 'session_id' => Crypto::uuid(), 'visit_id' => $visit, 'event_type' => 2, 'event_name' => 'goal_selected', 'url_path' => '/onboarding/goals', 'utm_source' => 'telegram', 'utm_campaign' => 'spring', 'created_at' => now()]);
        $this->db->table('event_data')->insert(['website_event_id' => $event, 'data_key' => 'goal', 'string_value' => 'weight_loss']);
        $page = Crypto::uuid();
        $this->db->table('website_event')->insert(['event_id' => $page, 'website_id' => $website, 'session_id' => Crypto::uuid(), 'visit_id' => $visit, 'event_type' => 1, 'event_name' => 'pageview', 'url_path' => '/onboarding', 'utm_source' => 'telegram', 'utm_campaign' => 'spring', 'created_at' => now()]);
        $report = $this->getJson('/v1/admin/web-analytics?days=7')->assertOk()->json();
        self::assertSame('weight_loss', $report['goals'][0]['goal']);
        self::assertSame(1, $report['goals'][0]['clicks']);
        self::assertSame('telegram', $report['sources'][0]['source']);
        self::assertNotEmpty($report['daily']);
    }

    public function test_mysql_performance_indexes_are_used_by_explain(): void
    {
        $food = Crypto::uuid();
        $this->db->table('food_catalog')->insert(['id' => $food, 'slug' => 'index-lentil-'.$food, 'name_fa' => 'عدس شاخص', 'category' => 'main', 'meal_types' => '["iftar"]', 'serving_label' => 'کاسه', 'kcal' => 180, 'ingredients' => '[]', 'allergens' => '["sesame"]', 'tags' => '["fiber"]']);
        $plans = [
            'food_catalog_allergens' => "explain select id from food_catalog where 'sesame' member of (allergens->'$')",
            'food_catalog_meals' => "explain select id from food_catalog where 'iftar' member of (meal_types->'$')",
            'food_catalog_tags' => "explain select id from food_catalog where 'fiber' member of (tags->'$')",
            'food_catalog_search' => "explain select id from food_catalog where match(name_fa_search) against ('عدس' in natural language mode)",
            'nutrition_profiles_allergens' => "explain select user_id from nutrition_profiles where 'gluten' member of (allergens->'$')",
            'nutrition_profiles_conditions' => "explain select user_id from nutrition_profiles where 'thyroid' member of (conditions->'$')",
            'nutrition_profiles_flags' => "explain select user_id from nutrition_profiles where 'low_bmi' member of (risk_flags->'$')",
        ];
        $user = Crypto::uuid();
        $this->db->table('users')->insert(['id' => $user, 'phone_e164' => '+989'.random_int(100000000, 999999999), 'role' => 'user', 'status' => 'active']);
        $this->db->table('meal_log_history')->insert(['log_id' => Crypto::uuid(), 'user_id' => $user, 'current' => json_encode(['scheduled_date' => '2026-11-14'], JSON_THROW_ON_ERROR)]);
        $plans['meal_history_owner_date'] = null;
        $history = $this->db->select('explain select id from meal_log_history where user_id=? and scheduled_date_key=?', [$user, '2026-11-14']);
        $seen = ['meal_history_owner_date' => $history[0]->key ?? null];
        foreach ($plans as $name => $sql) {
            if ($sql === null) {
                continue;
            }
            $seen[$name] = $this->db->select($sql)[0]->key ?? null;
        }
        foreach ($seen as $name => $key) {
            self::assertSame($name, $key, json_encode($seen));
        }
    }

    public function test_backup_rehearsal_refuses_a_non_disposable_database_name(): void
    {
        $this->artisan('sabzine:rehearse-backup', ['--url' => 'mysql://root@127.0.0.1/sabzine'])->assertFailed();
        $this->artisan('sabzine:import-analytics', ['--url' => 'mysql://root@127.0.0.1/sabzine'])->assertFailed();
    }

    public function test_media_manifest_records_checksums_without_deleting_the_source(): void
    {
        $dir = sys_get_temp_dir().DIRECTORY_SEPARATOR.'sabzine-media-'.bin2hex(random_bytes(4));
        mkdir($dir);
        $file = $dir.DIRECTORY_SEPARATOR.'photo.bin';
        file_put_contents($file, 'abc');
        $manifest = $dir.DIRECTORY_SEPARATOR.'manifest.txt';
        try {
            $this->artisan('sabzine:import-media', ['source' => $dir, '--manifest' => $manifest])->assertOk();
            self::assertFileExists($file);
            self::assertStringContainsString(hash_file('sha256', $file), (string) file_get_contents($manifest));
        } finally {
            if (is_file($manifest)) {
                unlink($manifest);
            }
            if (is_file($file)) {
                unlink($file);
            }
            if (is_dir($dir)) {
                rmdir($dir);
            }
        }
    }
}
