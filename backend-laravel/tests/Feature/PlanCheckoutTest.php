<?php

namespace Tests\Feature;

use App\Modules\Money\Application\MoneySettings;
use App\Modules\Money\Application\PaymentGateways;
use App\Shared\Domain\LegacyCrypto;
use Illuminate\Support\Facades\Http;
use Tests\MySqlTestCase;

final class PlanCheckoutTest extends MySqlTestCase
{
    private function prepareCheckout(): array
    {
        config(['payments.default' => 'sandbox', 'payments.enabled' => 'sandbox']);
        app()->forgetInstance(PaymentGateways::class);
        $user = $this->actor();
        $answers = json_decode(file_get_contents(__DIR__.'/../Fixtures/node-questionnaire.json'), true)[0]['input'];
        $this->postJson('/v1/me/questionnaire/submissions', $answers)->assertCreated();
        $services = $this->getJson('/v1/catalog')->assertOk()->json('services');
        $price = array_values(array_filter($services, fn ($row) => $row['code'] === 'new_plan'))[0]['priceToman'];

        return [$user, ['serviceCode' => 'new_plan', 'expectedPriceToman' => $price]];
    }

    public function test_direct_payment_activates_once_without_changing_wallet_and_restores_subscription(): void
    {
        [$user, $body] = $this->prepareCheckout();
        $this->db->table('users')->where('id', $user['id'])->update(['status' => 'pending']);
        $this->getJson('/v1/me/subscription')->assertOk()->assertJsonPath('subscription', null);
        $payment = $this->postJson('/v1/me/checkouts', $body, ['Idempotency-Key' => 'checkout-test-1'])->assertCreated()->assertJsonPath('status', 'pending')->json();
        $this->postJson('/v1/me/checkouts', $body, ['Idempotency-Key' => 'checkout-test-1'])->assertCreated()->assertExactJson($payment);
        $this->postJson('/v1/me/checkouts', $body, ['Idempotency-Key' => 'checkout-test-2'])->assertCreated()->assertExactJson($payment);
        self::assertSame(0, $this->db->table('orders')->where('user_id', $user['id'])->count());
        $result = $this->postJson('/v1/me/checkouts/'.$payment['paymentId'].'/sandbox', ['success' => true])->assertOk()->assertJsonPath('status', 'paid')->json();
        $this->postJson('/v1/me/checkouts/'.$payment['paymentId'].'/sandbox', ['success' => true])->assertOk()->assertExactJson($result);
        self::assertSame(1, $this->db->table('orders')->where('user_id', $user['id'])->count());
        self::assertSame(1, $this->db->table('outbox_events')->where('aggregate_id', $result['requestId'])->count());
        self::assertSame('active', $this->db->table('users')->where('id', $user['id'])->value('status'));
        $this->getJson('/v1/me/wallet')->assertOk()->assertExactJson(['cashToman' => 0, 'promoToman' => 0]);
        self::assertSame(0, $this->db->table('wallet_ledger')->where('user_id', $user['id'])->count());
        $this->getJson('/v1/me/subscription')->assertOk()->assertJsonPath('subscription.status', 'active')->assertJsonPath('subscription.serviceCode', 'new_plan');
        $this->getJson('/v1/me/orders')->assertOk()->assertJsonCount(1)->assertJsonPath('0.priceToman', $body['expectedPriceToman']);
        $this->postJson('/v1/me/orders/'.$result['orderId'].'/cancel')->assertStatus(409)->assertJsonPath('code', 'direct_refund_required');
        $this->actor();
        $this->getJson('/v1/me/checkouts/'.$payment['paymentId'])->assertNotFound();
        $this->postJson('/v1/me/checkouts/'.$payment['paymentId'].'/sandbox', ['success' => true])->assertNotFound();
        $this->getJson('/v1/me/subscription')->assertOk()->assertJsonPath('subscription', null);
        $this->getJson('/v1/me/orders')->assertOk()->assertJsonCount(0);
    }

    public function test_failed_payment_never_activates_access_and_new_attempt_can_succeed(): void
    {
        [$user, $body] = $this->prepareCheckout();
        $payment = $this->postJson('/v1/me/checkouts', $body, ['Idempotency-Key' => 'checkout-failed-1'])->assertCreated()->json();
        $this->postJson('/v1/me/checkouts/'.$payment['paymentId'].'/sandbox', ['success' => false])->assertOk()->assertJsonPath('status', 'failed');
        $this->postJson('/v1/me/checkouts/'.$payment['paymentId'].'/sandbox', ['success' => true])->assertStatus(409);
        $this->getJson('/v1/me/subscription')->assertOk()->assertJsonPath('subscription', null);
        self::assertSame(0, $this->db->table('orders')->where('user_id', $user['id'])->count());
        $next = $this->postJson('/v1/me/checkouts', $body, ['Idempotency-Key' => 'checkout-failed-2'])->assertCreated()->json();
        self::assertNotSame($payment['paymentId'], $next['paymentId']);
        $this->postJson('/v1/me/checkouts/'.$next['paymentId'].'/sandbox', ['success' => true])->assertOk()->assertJsonPath('status', 'paid');
    }

    public function test_catalog_price_questionnaire_and_pending_payment_are_validated_before_payment(): void
    {
        config(['payments.default' => 'sandbox', 'payments.enabled' => 'sandbox']);
        $user = $this->actor();
        $body = ['serviceCode' => 'new_plan', 'expectedPriceToman' => 1];
        $this->postJson('/v1/me/checkouts', $body, ['Idempotency-Key' => 'checkout-required'])->assertStatus(409)->assertJsonPath('code', 'questionnaire_required');
        self::assertSame(0, $this->db->table('plan_checkouts')->where('user_id', $user['id'])->count());
        [$user, $body] = $this->prepareCheckout();
        $this->postJson('/v1/me/checkouts', [...$body, 'expectedPriceToman' => $body['expectedPriceToman'] + 1], ['Idempotency-Key' => 'checkout-price-1'])->assertStatus(409)->assertJsonPath('code', 'price_changed');
        $this->postJson('/v1/me/checkouts', $body, ['Idempotency-Key' => 'checkout-price-1'])->assertCreated();
        $this->postJson('/v1/me/checkouts', [...$body, 'expectedPriceToman' => 1], ['Idempotency-Key' => 'checkout-price-1'])->assertStatus(409)->assertJsonPath('code', 'payment_in_progress');
        $this->postJson('/v1/me/orders', $body, ['Idempotency-Key' => 'checkout-legacy-1'])->assertStatus(409)->assertJsonPath('code', 'payment_in_progress');
    }

    public function test_hosted_checkout_uses_exact_price_and_verified_callback_before_activation(): void
    {
        [$user, $body] = $this->prepareCheckout();
        config(['payments.default' => 'zarinpal', 'payments.enabled' => 'zarinpal', 'payments.zarinpal_merchant' => 'fixture-merchant', 'payments.zarinpal_base_url' => 'https://gateway.test', 'payments.public_api_url' => 'https://api.test']);
        app()->forgetInstance(PaymentGateways::class);
        app()->forgetInstance(MoneySettings::class);
        $authority = 'A'.str_repeat('3', 35);
        Http::fake(['*/request.json' => Http::response(['data' => ['code' => 100, 'authority' => $authority]]), '*/verify.json' => Http::response(['data' => ['code' => 100, 'ref_id' => 123]])]);
        $payment = $this->postJson('/v1/me/checkouts', $body, ['Idempotency-Key' => 'checkout-hosted-1'])->assertCreated()->json();
        Http::assertSent(fn ($request) => str_contains($request->url(), '/request.json') && $request['amount'] === $body['expectedPriceToman'] * 10 && str_contains($request['callback_url'], '/checkout/callback/'));
        $this->postJson('/v1/me/checkouts/'.$payment['paymentId'].'/sandbox', ['success' => true])->assertNotFound();
        $callback = '/v1/payments/checkout/callback/zarinpal?paymentId='.$payment['paymentId'].'&Status=OK&Authority=';
        $this->get($callback.'forged')->assertNotFound();
        $this->getJson('/v1/me/subscription')->assertOk()->assertJsonPath('subscription', null);
        $this->get($callback.$authority)->assertOk()->assertSee('پلن شما فعال شد');
        $this->get($callback.$authority)->assertOk();
        Http::assertSent(fn ($request) => str_contains($request->url(), '/verify.json') && $request['amount'] === $body['expectedPriceToman'] * 10);
        self::assertSame(1, $this->db->table('orders')->where('user_id', $user['id'])->count());
        $this->getJson('/v1/me/checkouts/'.$payment['paymentId'])->assertOk()->assertJsonPath('status', 'paid');
        $this->getJson('/v1/me/wallet')->assertOk()->assertJsonPath('cashToman', 0);
    }

    public function test_administrator_granted_subscription_exposes_expiry_and_expired_status(): void
    {
        [$user] = $this->prepareCheckout();
        $this->db->table('user_service_access')->insert(['user_id' => $user['id'], 'service_code' => 'new_plan', 'ends_at' => '2099-01-01 00:00:00']);
        $this->getJson('/v1/me/subscription')->assertOk()->assertJsonPath('subscription.status', 'active')->assertJsonPath('subscription.endsAt', '2099-01-01T00:00:00.000Z');
        $this->db->table('user_service_access')->where('user_id', $user['id'])->update(['ends_at' => '2000-01-01 00:00:00']);
        $this->getJson('/v1/me/subscription')->assertOk()->assertJsonPath('subscription.status', 'expired');
    }

    public function test_included_revision_is_free_and_retries_return_the_same_order(): void
    {
        [$user] = $this->prepareCheckout();
        $plan = $this->planFixture($user['id'], true);
        $body = ['serviceCode' => 'ai_revision', 'expectedPriceToman' => 150000, 'parentRequestId' => $plan['request']];
        $result = $this->postJson('/v1/me/checkouts', $body, ['Idempotency-Key' => 'included-revision'])->assertCreated()->assertJsonPath('status', 'paid')->assertJsonPath('priceToman', 0)->json();
        $this->postJson('/v1/me/checkouts', $body, ['Idempotency-Key' => 'included-revision'])->assertCreated()->assertExactJson($result);
        self::assertSame(0, $this->db->table('plan_checkouts')->where('user_id', $user['id'])->count());
        $this->getJson('/v1/me/wallet')->assertOk()->assertJsonPath('cashToman', 0);
    }

    public function test_new_purchase_after_expired_access_activates_the_new_plan(): void
    {
        [$user, $body] = $this->prepareCheckout();
        $this->db->table('user_service_access')->insert(['user_id' => $user['id'], 'service_code' => 'new_plan', 'ends_at' => '2000-01-01 00:00:00', 'updated_at' => '2000-01-01 00:00:00']);
        $payment = $this->postJson('/v1/me/checkouts', $body, ['Idempotency-Key' => 'renew-expired-plan'])->assertCreated()->json();
        $this->postJson('/v1/me/checkouts/'.$payment['paymentId'].'/sandbox', ['success' => true])->assertOk();
        $this->getJson('/v1/me/subscription')->assertOk()->assertJsonPath('subscription.status', 'active')->assertJsonPath('subscription.endsAt', null);
    }

    public function test_site_plans_have_matching_prices_and_activate_the_purchased_duration(): void
    {
        foreach ([['weekly', 'شروع', 15, 1290000], ['monthly', 'همراه', 30, 1990000], ['quarterly', 'VIP', 90, 8990000]] as [$code, $title, $days, $price]) {
            [$user] = $this->prepareCheckout();
            $plans = $this->getJson('/v1/catalog')->assertOk()->json('plans');
            $plan = array_values(array_filter($plans, fn ($row) => $row['id'] === $code))[0];
            self::assertSame($price, $plan['priceToman']);
            self::assertSame($days, $plan['days']);
            $body = ['serviceCode' => 'new_plan', 'planId' => $code, 'expectedPriceToman' => $price];
            $this->postJson('/v1/me/checkouts', [...$body, 'expectedPriceToman' => 1], ['Idempotency-Key' => 'tier-'.$code])->assertStatus(409)->assertJsonPath('code', 'price_changed');
            $payment = $this->postJson('/v1/me/checkouts', $body, ['Idempotency-Key' => 'tier-'.$code])->assertCreated()->json();
            $this->postJson('/v1/me/checkouts/'.$payment['paymentId'].'/sandbox', ['success' => true])->assertOk();
            $subscription = $this->getJson('/v1/me/subscription')->assertOk()->assertJsonPath('subscription.status', 'active')->assertJsonPath('subscription.title', $title)->assertJsonPath('subscription.includedChanges', $code !== 'weekly')->json('subscription');
            $seconds = (new \DateTimeImmutable($subscription['endsAt']))->getTimestamp() - time();
            self::assertEqualsWithDelta($days * 86400, $seconds, 10);
            $this->getJson('/v1/me/orders')->assertOk()->assertJsonPath('0.title', $title)->assertJsonPath('0.priceToman', $price);
            $this->getJson('/v1/me/wallet')->assertOk()->assertJsonPath('cashToman', 0);
            if ($code === 'monthly') {
                foreach (range(1, 2) as $index) {
                    $this->db->table('orders')->insert(['id' => LegacyCrypto::uuid(), 'user_id' => $user['id'], 'service_code' => 'ai_revision', 'price_toman' => 0, 'cash_toman' => 0, 'promo_toman' => 0, 'status' => 'paid', 'idempotency_key' => 'revision-'.$index]);
                }
                $this->getJson('/v1/me/subscription')->assertOk()->assertJsonPath('subscription.includedChanges', false);
            }
            $this->db->table('user_service_access')->where('user_id', $user['id'])->update(['ends_at' => '2000-01-01 00:00:00']);
            $this->getJson('/v1/me/subscription')->assertOk()->assertJsonPath('subscription.status', 'expired')->assertJsonPath('subscription.includedChanges', false);
        }
    }
}
