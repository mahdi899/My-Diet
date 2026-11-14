<?php

namespace Tests;

use App\Modules\Ai\Application\AiCatalog;
use App\Modules\Ai\Infrastructure\FixedAiCatalog;
use App\Modules\Coach\Application\CoachModel;
use App\Modules\Coach\Infrastructure\FixedCoachModel;
use App\Modules\Plans\Application\DraftProvider;
use App\Modules\Plans\Infrastructure\LocalDraftProvider;
use App\Modules\Realtime\Application\PushSender;
use App\Modules\Realtime\Infrastructure\RecordingPush;
use App\Shared\Domain\LegacyCrypto;
use Illuminate\Database\ConnectionInterface;

abstract class MySqlTestCase extends TestCase
{
    protected ?ConnectionInterface $db = null;

    protected function setUp(): void
    {
        parent::setUp();
        $this->app->bind(DraftProvider::class, LocalDraftProvider::class);
        $this->app->bind(CoachModel::class, FixedCoachModel::class);
        $this->app->singleton(AiCatalog::class, FixedAiCatalog::class);
        $this->app->singleton(PushSender::class, RecordingPush::class);
        if (! getenv('MYSQL_TEST_URL')) {
            $this->markTestSkipped('Requires the disposable MySQL test environment.');
        }
        config(['database.default' => 'mysql', 'database.connections.mysql.url' => getenv('MYSQL_TEST_URL'),
            'identity.environment' => 'development', 'identity.fixed_otp' => '123456', 'identity.sms_provider' => 'console']);
        $this->db = app(ConnectionInterface::class);
        $this->db->beginTransaction();
    }

    protected function tearDown(): void
    {
        if ($this->db !== null && $this->db->transactionLevel() > 0) {
            $this->db->rollBack();
        }
        parent::tearDown();
    }

    protected function actor(string $role = 'user'): array
    {
        $id = LegacyCrypto::uuid();
        $session = LegacyCrypto::uuid();
        $phone = '+989'.str_pad((string) random_int(0, 999999999), 9, '0', STR_PAD_LEFT);
        $this->db->table('users')->insert(['id' => $id, 'phone_e164' => $phone, 'role' => $role, 'status' => 'active']);
        $this->db->table('wallets')->insert(['user_id' => $id]);
        $this->db->statement('insert into sessions(id,user_id,created_at,absolute_expires_at) values(?,?,current_timestamp(6),date_add(current_timestamp(6),interval 30 day))', [$session, $id]);
        $token = LegacyCrypto::sign(['sub' => $id, 'sid' => $session, 'role' => $role, 'iat' => time(), 'exp' => time() + 600], config('identity.jwt_secret'));
        $this->withToken($token);

        return ['id' => $id, 'token' => $token, 'sessionId' => $session];
    }

    protected function planFixture(string $userId, bool $published = false): array
    {
        $ids = array_combine(['submission', 'order', 'request', 'version', 'day', 'meal', 'mealUid', 'option', 'item'], array_map(fn () => LegacyCrypto::uuid(), range(1, 9)));
        $this->db->table('questionnaire_submissions')->insert(['id' => $ids['submission'], 'user_id' => $userId, 'schema_version' => 1, 'answers' => '{}', 'risk_flags' => '[]']);
        $this->db->table('orders')->insert(['id' => $ids['order'], 'user_id' => $userId, 'service_code' => 'new_plan', 'price_toman' => 100, 'cash_toman' => 100, 'promo_toman' => 0, 'status' => 'paid', 'idempotency_key' => LegacyCrypto::uuid()]);
        $this->db->table('plan_requests')->insert(['id' => $ids['request'], 'user_id' => $userId, 'order_id' => $ids['order'], 'kind' => 'new_plan', 'status' => $published ? 'published' : 'in_review', 'submission_id' => $ids['submission'], 'price_toman' => 100]);
        $this->db->table('plan_versions')->insert(['id' => $ids['version'], 'request_id' => $ids['request'], 'version_number' => 1, 'status' => 'draft']);
        $this->db->table('plan_days')->insert(['id' => $ids['day'], 'plan_version_id' => $ids['version'], 'day_index' => 0, 'civil_date' => '2026-11-14']);
        $this->db->table('plan_meals')->insert(['id' => $ids['meal'], 'plan_day_id' => $ids['day'], 'meal_uid' => $ids['mealUid'], 'position' => 0, 'meal_type' => 'lunch', 'title' => 'عدسی', 'calories' => 300]);
        $this->db->table('plan_meal_options')->insert(['meal_id' => $ids['meal'], 'option_uid' => $ids['option'], 'kind' => 'primary', 'document' => json_encode(['optionId' => $ids['option'], 'kind' => 'primary', 'title' => 'عدسی', 'calories' => 300, 'approved' => false, 'portion' => ['quantity' => 1, 'unit' => 'serving', 'basis' => 'as_served'], 'ingredients' => [], 'instructions' => 'نوش جان', 'preparationMinutes' => 20], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR)]);
        $this->db->table('plan_meal_items')->insert(['id' => $ids['item'], 'meal_id' => $ids['meal'], 'position' => 0, 'name' => 'عدس', 'quantity' => '80.25', 'unit' => 'g']);
        $this->db->table('plan_version_context')->insert(['version_id' => $ids['version'], 'questionnaire_schema_version' => 1, 'questionnaire_snapshot' => '{}']);
        if ($published) {
            $this->db->table('plan_versions')->where('id', $ids['version'])->update(['status' => 'published', 'published_at' => '2026-11-14 00:00:00']);
        }

        return $ids;
    }
}
