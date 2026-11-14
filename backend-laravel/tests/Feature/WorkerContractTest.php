<?php

namespace Tests\Feature;

use App\Modules\Plans\Application\DraftProvider;
use App\Modules\Worker\Application\JobWorker;
use App\Modules\Worker\Application\WorkerStore;
use App\Shared\Domain\LegacyCrypto as Crypto;
use Tests\MySqlTestCase;

final class CountingDraft implements DraftProvider
{
    public int $calls = 0;

    public function name(): string
    {
        return 'test-adapter';
    }

    public function callsExternalNetwork(): bool
    {
        return false;
    }

    public function draft(string $requestId): array
    {
        $this->calls++;

        return array_map(fn () => ['meals' => [[
            'mealType' => 'lunch', 'title' => 'پیش‌نویس آزمایش', 'calories' => 300, 'notes' => '', 'suggestedTime' => '13:00',
            'items' => [['name' => 'عدس', 'quantity' => 80, 'unit' => 'g']],
        ]]], range(0, 6));
    }
}

final class WorkerContractTest extends MySqlTestCase
{
    public function test_stale_worker_cannot_complete_or_fail_a_reclaimed_lease(): void
    {
        $id = Crypto::uuid();
        $this->db->table('worker_jobs')->insert(['id' => $id, 'topic' => 'shopping.invalidate', 'aggregate_id' => Crypto::uuid(), 'payload' => '{}']);
        $store = $this->app->make(WorkerStore::class);
        $first = $store->claim()[0];
        $this->db->table('worker_jobs')->where('id', $id)->update(['lease_until' => '2000-01-01 00:00:00']);
        $second = $store->claim()[0];
        self::assertNotSame($first->lease_token, $second->lease_token);
        $store->succeed($id, $first->lease_token);
        self::assertSame('leased', $this->db->table('worker_jobs')->where('id', $id)->value('status'));
        $store->fail($id, 'stale', 1, 3, $first->lease_token);
        self::assertSame('leased', $this->db->table('worker_jobs')->where('id', $id)->value('status'));
        $store->succeed($id, $second->lease_token);
        self::assertSame('succeeded', $this->db->table('worker_jobs')->where('id', $id)->value('status'));
    }

    public function test_paid_order_reaches_a_published_plan_through_the_worker(): void
    {
        $provider = new CountingDraft;
        $this->app->instance(DraftProvider::class, $provider);
        $user = $this->actor();
        $doctor = $this->actor('specialist');
        $this->db->table('specialist_profiles')->insert(['user_id' => $doctor['id'], 'display_name' => 'متخصص تولید', 'verification_status' => 'verified']);
        $submission = Crypto::uuid();
        $order = Crypto::uuid();
        $request = Crypto::uuid();
        $this->db->table('questionnaire_submissions')->insert(['id' => $submission, 'user_id' => $user['id'], 'schema_version' => 1, 'answers' => '{}', 'risk_flags' => '[]']);
        $this->db->table('orders')->insert(['id' => $order, 'user_id' => $user['id'], 'service_code' => 'new_plan', 'price_toman' => 100, 'cash_toman' => 100, 'promo_toman' => 0, 'status' => 'paid', 'idempotency_key' => Crypto::uuid()]);
        $this->db->table('plan_requests')->insert(['id' => $request, 'user_id' => $user['id'], 'order_id' => $order, 'kind' => 'new_plan', 'status' => 'queued', 'submission_id' => $submission, 'assigned_specialist_id' => $doctor['id'], 'price_toman' => 100]);
        $this->db->table('outbox_events')->insert(['id' => Crypto::uuid(), 'topic' => 'plan.generate', 'aggregate_id' => $request, 'payload' => json_encode(['requestId' => $request])]);
        $store = $this->app->make(WorkerStore::class);
        self::assertSame(1, $store->relay());
        self::assertNotNull($this->db->table('outbox_events')->where('aggregate_id', $request)->value('dispatched_at'));
        $worker = $this->app->make(JobWorker::class);
        self::assertSame(1, $worker->drain());
        self::assertSame(1, $provider->calls);
        self::assertSame('in_review', $this->db->table('plan_requests')->where('id', $request)->value('status'));
        self::assertSame(1, $this->db->table('plan_versions')->where('request_id', $request)->count());
        self::assertSame('test-adapter', $this->db->table('ai_generations')->where('request_id', $request)->value('provider'));
        self::assertSame(7, $this->db->table('plan_days as d')->join('plan_versions as v', 'v.id', '=', 'd.plan_version_id')->where('v.request_id', $request)->count());
        self::assertSame(0, $worker->drain());
        self::assertSame(1, $provider->calls);
        $this->withToken($doctor['token']);
        $body = json_decode(file_get_contents(__DIR__.'/../Fixtures/node-plans.json'), true)[4]['input'];
        $url = '/v1/specialist/requests/'.$request;
        $this->putJson($url.'/draft', $body, ['If-Match' => '1'])->assertOk()->assertExactJson(['lockVersion' => 2]);
        $published = $this->postJson($url.'/publish', [], ['If-Match' => '2'])->assertCreated()->json('versionId');
        $this->postJson($url.'/regenerate', [], ['If-Match' => '2'])->assertStatus(409)->assertJsonPath('code', 'not_ready');
        $this->withToken($user['token']);
        $this->getJson('/v1/me/plan')->assertOk()->assertJsonPath('versionId', $published)->assertJsonCount(7, 'days');
        $this->artisan('sabzine:work', ['--once' => true])->assertExitCode(1);
    }

    public function test_expired_lease_is_claimed_once_and_maintenance_uses_the_same_thresholds(): void
    {
        $user = $this->actor();
        $submission = Crypto::uuid();
        $order = Crypto::uuid();
        $request = Crypto::uuid();
        $this->db->table('questionnaire_submissions')->insert(['id' => $submission, 'user_id' => $user['id'], 'schema_version' => 1, 'answers' => '{}', 'risk_flags' => '[]']);
        $this->db->table('orders')->insert(['id' => $order, 'user_id' => $user['id'], 'service_code' => 'new_plan', 'price_toman' => 100, 'cash_toman' => 100, 'promo_toman' => 0, 'status' => 'paid', 'idempotency_key' => Crypto::uuid()]);
        $this->db->table('plan_requests')->insert(['id' => $request, 'user_id' => $user['id'], 'order_id' => $order, 'kind' => 'new_plan', 'status' => 'queued', 'submission_id' => $submission, 'price_toman' => 100]);
        $job = Crypto::uuid();
        $this->db->table('worker_jobs')->insert(['id' => $job, 'topic' => 'plan.generate', 'aggregate_id' => $request, 'payload' => json_encode(['requestId' => $request]), 'status' => 'leased', 'attempts' => 1, 'lease_until' => '2000-01-01 00:00:00']);
        $old = Crypto::uuid();
        $fresh = Crypto::uuid();
        $this->db->table('payments')->insert([
            ['id' => $old, 'user_id' => $user['id'], 'package_code' => 'p50', 'amount_toman' => 200000, 'amount_rial' => 2000000, 'status' => 'pending', 'gateway' => 'sandbox'],
            ['id' => $fresh, 'user_id' => $user['id'], 'package_code' => 'p50', 'amount_toman' => 200000, 'amount_rial' => 2000000, 'status' => 'pending', 'gateway' => 'sandbox'],
        ]);
        $this->db->table('payments')->where('id', $old)->update(['created_at' => '2000-01-01 00:00:00']);
        $this->db->table('otp_challenges')->insert(['id' => Crypto::uuid(), 'phone_e164' => '+989000000000', 'code_hmac' => str_repeat('a', 64), 'ip' => '127.0.0.1', 'expires_at' => '2000-01-01 00:00:00', 'created_at' => '2000-01-01 00:00:00']);
        $store = $this->app->make(WorkerStore::class);
        self::assertSame(1, $this->app->make(JobWorker::class)->drain());
        self::assertSame('succeeded', $this->db->table('worker_jobs')->where('id', $job)->value('status'));
        self::assertSame(1, $this->db->table('plan_versions')->where('request_id', $request)->count());
        $summary = $store->maintenance();
        self::assertSame(1, $summary['expiredPayments']);
        self::assertSame('failed', $this->db->table('payments')->where('id', $old)->value('status'));
        self::assertSame('pending', $this->db->table('payments')->where('id', $fresh)->value('status'));
        self::assertSame(1, $summary['purgedOtpChallenges']);
        $snapshot = tempnam(sys_get_temp_dir(), 'queue');
        file_put_contents($snapshot, json_encode(['jobs' => [
            ['id' => Crypto::uuid(), 'topic' => 'wallet.credit', 'state' => 'created', 'data' => []],
            ['id' => Crypto::uuid(), 'topic' => 'push.send', 'state' => 'created', 'aggregateId' => $user['id'], 'data' => ['userId' => $user['id']]],
        ]]));
        $drained = $store->drainSnapshot(json_decode(file_get_contents($snapshot), true)['jobs']);
        self::assertSame(1, $drained['inserted']);
        self::assertSame(1, $drained['skipped']);
        self::assertSame(0, $this->db->table('wallet_ledger')->where('user_id', $user['id'])->count());
    }
}
