<?php

namespace Tests\Feature;

use App\Modules\Money\Application\PaymentGateways;
use App\Shared\Domain\LegacyCrypto as Crypto;
use Illuminate\Support\Facades\Http;
use Tests\MySqlTestCase;

final class MoneyContractTest extends MySqlTestCase
{
    private function questionnaire(): void
    {
        $answers = json_decode(file_get_contents(__DIR__.'/../Fixtures/node-questionnaire.json'), true)[0]['input'];
        $this->postJson('/v1/me/questionnaire/submissions', $answers)->assertCreated();
    }

    public function test_topup_credit_replay_order_debit_idempotency_and_refund(): void
    {
        config(['payments.default' => 'sandbox', 'payments.enabled' => 'sandbox,idpay']);
        $user = $this->actor();
        $catalog = $this->getJson('/v1/catalog')->assertOk()->json();
        $price = array_values(array_filter($catalog['services'], fn ($service) => $service['code'] === 'new_plan'))[0]['priceToman'];
        $this->getJson('/v1/me/wallet')->assertOk()->assertExactJson(['cashToman' => 0, 'promoToman' => 0]);
        $this->postJson('/v1/me/topups', ['packageCode' => 'p50', 'gateway' => 'idpay'])->assertStatus(503);
        $payment = $this->postJson('/v1/me/topups', ['packageCode' => 'p50'])->assertCreated()->json();
        $this->postJson('/v1/payments/sandbox/complete', ['paymentId' => $payment['paymentId']])->assertCreated()->assertJsonPath('cashToman', $payment['amountToman']);
        $this->postJson('/v1/payments/sandbox/complete', ['paymentId' => $payment['paymentId']])->assertCreated()->assertJsonPath('cashToman', $payment['amountToman']);
        self::assertSame(1, $this->db->table('wallet_ledger')->where('reference_id', $payment['paymentId'])->count());
        $this->getJson('/v1/me/topups/'.$payment['paymentId'])->assertOk()->assertJsonPath('status', 'credited');
        $this->db->table('wallets')->where('user_id', $user['id'])->update(['cash_toman' => 10000000, 'promo_toman' => 100]);
        $this->questionnaire();
        $body = ['serviceCode' => 'new_plan', 'expectedPriceToman' => $price];
        $order = $this->postJson('/v1/me/orders', $body, ['Idempotency-Key' => 'test-order-1'])->assertCreated()->json();
        self::assertSame(100, $order['promoToman']);
        $this->postJson('/v1/me/orders', $body, ['Idempotency-Key' => 'test-order-1'])->assertCreated()->assertExactJson($order);
        $this->postJson('/v1/me/orders', [...$body, 'expectedPriceToman' => $price + 1], ['Idempotency-Key' => 'test-order-1'])->assertStatus(422);
        $this->postJson('/v1/me/orders', $body, ['Idempotency-Key' => 'test-order-2'])->assertStatus(409)->assertJsonPath('code', 'request_in_progress');
        $this->getJson('/v1/me/orders/'.$order['orderId'])->assertOk()->assertJsonPath('status', 'paid');
        self::assertSame(1, $this->db->table('outbox_events')->where('aggregate_id', $order['requestId'])->count());
        self::assertSame(1, $this->db->table('conversations')->where('request_id', $order['requestId'])->count());
        $this->postJson('/v1/me/requests/'.$order['requestId'].'/cancel')->assertCreated()->assertExactJson(['cashToman' => 10000000, 'promoToman' => 100]);
        $this->postJson('/v1/me/orders/'.$order['orderId'].'/cancel')->assertStatus(409);
        $this->getJson('/v1/me/wallet/ledger')->assertOk()->assertJsonCount(5);
        $this->actor();
        $this->getJson('/v1/me/orders/'.$order['orderId'])->assertNotFound();
        $this->getJson('/v1/me/topups/'.$payment['paymentId'])->assertNotFound();
    }

    public function test_order_failures_roll_back_idempotency_and_wallet_changes(): void
    {
        $user = $this->actor();
        $catalog = $this->getJson('/v1/catalog')->assertOk()->json('services');
        $price = array_values(array_filter($catalog, fn ($row) => $row['code'] === 'new_plan'))[0]['priceToman'];
        $body = ['serviceCode' => 'new_plan', 'expectedPriceToman' => $price];
        $this->postJson('/v1/me/orders', $body, ['Idempotency-Key' => 'test-errors-1'])->assertStatus(409)->assertJsonPath('code', 'questionnaire_required');
        $this->questionnaire();
        $this->postJson('/v1/me/orders', $body, ['Idempotency-Key' => 'test-errors-1'])->assertStatus(409)->assertJsonPath('code', 'insufficient_balance');
        self::assertSame(0, $this->db->table('idempotency_records')->where('user_id', $user['id'])->count());
        $this->postJson('/v1/me/orders', [...$body, 'expectedPriceToman' => $price + 1], ['Idempotency-Key' => 'test-errors-1'])->assertStatus(409)->assertJsonPath('code', 'price_changed');
        $this->getJson('/v1/me/wallet')->assertOk()->assertJsonPath('cashToman', 0);
    }

    public function test_specialist_revision_copies_draft_and_included_changes_remain_free(): void
    {
        $user = $this->actor();
        $plan = $this->planFixture($user['id'], true);
        $this->db->table('active_plan_versions')->insert(['user_id' => $user['id'], 'version_id' => $plan['version']]);
        $this->db->table('payments')->insert(['id' => Crypto::uuid(), 'user_id' => $user['id'], 'package_code' => 'p50', 'amount_toman' => 200000, 'amount_rial' => 2000000, 'status' => 'credited', 'gateway' => 'sandbox']);
        $order = $this->postJson('/v1/me/orders', ['serviceCode' => 'specialist_revision', 'expectedPriceToman' => 999, 'parentRequestId' => $plan['request']], ['Idempotency-Key' => 'test-revision-1'])->assertCreated()->assertJsonPath('priceToman', 0)->json();
        $version = $this->db->table('plan_versions')->where('request_id', $order['requestId'])->first();
        self::assertSame('draft', $version->status);
        self::assertSame(1, $this->db->table('plan_days')->where('plan_version_id', $version->id)->count());
        $context = $this->db->table('plan_version_context')->where('version_id', $version->id)->first();
        self::assertSame($plan['version'], $context->replaces_version_id);
        $this->postJson('/v1/me/orders/'.$order['orderId'].'/cancel')->assertCreated();
    }

    public function test_hosted_callback_requires_authority_server_verification_exact_amount_and_handles_failures(): void
    {
        config(['payments.default' => 'zarinpal', 'payments.enabled' => 'zarinpal', 'payments.zarinpal_merchant' => 'fixture-merchant', 'payments.zarinpal_base_url' => 'https://gateway.test', 'payments.public_api_url' => 'https://api.test']);
        app()->forgetInstance(PaymentGateways::class);
        $this->actor();
        $authority = 'A'.str_repeat('1', 35);
        Http::fake(['*/request.json' => Http::response(['data' => ['code' => 100, 'authority' => $authority]]), '*/verify.json' => Http::response(['data' => ['code' => 100, 'ref_id' => 'ref-test']])]);
        $payment = $this->postJson('/v1/me/topups', ['packageCode' => 'p50'])->assertCreated()->json();
        $callback = '/v1/payments/callback/zarinpal?paymentId='.$payment['paymentId'].'&Status=OK&Authority=';
        $this->get($callback.'wrong')->assertNotFound();
        $this->get($callback.$authority)->assertOk()->assertSee('پرداخت موفق بود');
        $this->get($callback.$authority)->assertOk();
        $this->getJson('/v1/me/wallet')->assertOk()->assertJsonPath('cashToman', $payment['amountToman']);
        self::assertSame(1, $this->db->table('wallet_ledger')->where('reference_id', $payment['paymentId'])->count());
        Http::assertSent(fn ($request) => str_ends_with($request->url(), '/verify.json') && $request['amount'] === $payment['amountRial'] && $request['authority'] === $authority);
        Http::fake(['*/request.json' => Http::response('not-json', 502)]);
        $this->postJson('/v1/me/topups', ['packageCode' => 'p50'])->assertStatus(502)->assertJsonPath('code', 'payment_unavailable');
        self::assertSame(1, $this->db->table('payments')->where('status', 'failed')->count());
    }

    public function test_hosted_transport_failure_stays_pending_and_declined_verification_cannot_credit_wallet(): void
    {
        config(['payments.default' => 'zarinpal', 'payments.enabled' => 'zarinpal', 'payments.zarinpal_merchant' => 'fixture-merchant', 'payments.zarinpal_base_url' => 'https://gateway.test', 'payments.public_api_url' => 'https://api.test']);
        app()->forgetInstance(PaymentGateways::class);
        $this->actor();
        $authority = 'A'.str_repeat('2', 35);
        Http::fake(['*/request.json' => Http::response(['data' => ['code' => 100, 'authority' => $authority]]), '*/verify.json' => Http::sequence()->pushFailedConnection()->push(['errors' => ['code' => -54]])]);
        $payment = $this->postJson('/v1/me/topups', ['packageCode' => 'p50'])->assertCreated()->json();
        $callback = '/v1/payments/callback/zarinpal?paymentId='.$payment['paymentId'].'&Status=OK&Authority='.$authority;
        $this->get($callback)->assertOk()->assertSee('در حال بررسی پرداخت');
        $this->getJson('/v1/me/topups/'.$payment['paymentId'])->assertOk()->assertJsonPath('status', 'pending');
        $this->get($callback)->assertOk()->assertSee('پرداخت انجام نشد');
        $this->getJson('/v1/me/wallet')->assertOk()->assertJsonPath('cashToman', 0);
        $this->getJson('/v1/me/topups/'.$payment['paymentId'])->assertOk()->assertJsonPath('status', 'failed');
    }

    public function test_refunds_require_no_doctor_intervention_and_compensation_requires_recorded_permanent_failure(): void
    {
        $user = $this->actor();
        $plan = $this->planFixture($user['id']);
        $this->db->table('request_events')->insert(['id' => Crypto::uuid(), 'request_id' => $plan['request'], 'actor_id' => $user['id'], 'kind' => 'draft_edited']);
        $this->postJson('/v1/me/orders/'.$plan['order'].'/cancel')->assertStatus(409)->assertJsonPath('code', 'refund_not_allowed');
        $this->db->table('plan_requests')->where('id', $plan['request'])->update(['status' => 'queued']);
        $this->actor('admin');
        $this->postJson('/v1/admin/orders/'.$plan['order'].'/compensate')->assertStatus(409)->assertJsonPath('code', 'not_failed');
        $this->db->table('ai_execution_claims')->insert(['request_id' => $plan['request'], 'status' => 'failed', 'error_code' => 'dependency_outage']);
        $this->postJson('/v1/admin/orders/'.$plan['order'].'/compensate')->assertCreated()->assertJsonPath('cashToman', 100);
        $this->postJson('/v1/admin/orders/'.$plan['order'].'/compensate')->assertCreated()->assertJsonPath('cashToman', 100);
        self::assertSame(1, $this->db->table('audit_logs')->where('target_id', $plan['order'])->where('action', 'order_compensated')->count());
        self::assertSame(1, $this->db->table('wallet_ledger')->where('reference_id', $plan['order'])->count());
    }
}
