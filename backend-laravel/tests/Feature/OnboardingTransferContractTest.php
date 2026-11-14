<?php

namespace Tests\Feature;

use App\Shared\Domain\LegacyCrypto as Crypto;
use Illuminate\Support\Facades\Http;
use Tests\MySqlTestCase;

final class OnboardingTransferContractTest extends MySqlTestCase
{
    private function lead(string $user, bool $verified = true): string
    {
        $id = Crypto::uuid();
        $phone = $this->db->table('users')->where('id', $user)->value('phone_e164');
        $this->db->table('demo_lead_submissions')->insert(['id' => $id, 'phone_hash' => hash_hmac('sha256', $phone, config('identity.field_key')),
            'phone_encrypted' => Crypto::encrypt($phone, config('identity.field_key')), 'goal' => 'weight_loss', 'answers_encrypted' => Crypto::encrypt('[]', config('identity.field_key')), 'phone_verified' => $verified]);

        return $id;
    }

    public function test_transfers_require_verified_ownership_and_bank_confirmation_has_exact_amount_and_replay_protection(): void
    {
        Http::preventStrayRequests();
        $user = $this->actor();
        $lead = $this->lead($user['id'], false);
        $body = ['plan' => 'weekly', 'submissionId' => $lead];
        $this->postJson('/v1/me/onboarding-transfers', $body)->assertForbidden();
        $this->db->table('demo_lead_submissions')->where('id', $lead)->update(['phone_verified' => true]);
        $order = $this->postJson('/v1/me/onboarding-transfers', $body)->assertCreated()->assertJsonPath('gateway_started', false)->json();
        self::assertGreaterThan(1290000, $order['amount_toman']);
        self::assertLessThanOrEqual(1300000, $order['amount_toman']);
        $this->postJson('/v1/me/onboarding-transfers', $body)->assertCreated()->assertExactJson($order);
        $second = $this->postJson('/v1/me/onboarding-transfers', [...$body, 'plan' => 'monthly'])->assertCreated()->json();
        $this->actor();
        $this->getJson('/v1/me/onboarding-transfers/'.$order['id'])->assertNotFound();
        $this->postJson('/v1/me/onboarding-transfers', $body)->assertForbidden();
        $this->actor('admin');
        $this->postJson('/v1/admin/onboarding-transfers/'.$order['id'].'/confirm', ['reference' => 'BANK-1234', 'amountToman' => $order['amount_toman'] + 1])->assertStatus(409);
        $this->postJson('/v1/admin/onboarding-transfers/'.$order['id'].'/confirm', ['reference' => 'BANK-1234', 'amountToman' => $order['amount_toman']])->assertCreated()->assertExactJson(['confirmed' => true, 'smsStatus' => 'failed']);
        $this->postJson('/v1/admin/onboarding-transfers/'.$order['id'].'/confirm', ['reference' => 'BANK-1234', 'amountToman' => $order['amount_toman']])->assertStatus(409);
        $this->postJson('/v1/admin/onboarding-transfers/'.$second['id'].'/confirm', ['reference' => 'BANK-1234', 'amountToman' => $second['amount_toman']])->assertStatus(409);
        config(['identity.sms_username' => 'test-only', 'identity.sms_key' => 'test-only', 'identity.sms_from' => '5000']);
        Http::fake(['https://rest.payamak-panel.com/*' => Http::response([], 503)]);
        $this->postJson('/v1/admin/onboarding-transfers/'.$second['id'].'/confirm', ['reference' => 'BANK-5678', 'amountToman' => $second['amount_toman']])->assertCreated()->assertExactJson(['confirmed' => true, 'smsStatus' => 'failed']);
        $this->postJson('/v1/admin/onboarding-transfers/'.$second['id'].'/confirm', ['reference' => 'BANK-5678', 'amountToman' => $second['amount_toman']])->assertStatus(409);
        Http::assertSentCount(1);
        $rows = $this->getJson('/v1/admin/onboarding-transfers')->assertOk()->json();
        self::assertCount(12, $rows[0]);
        self::assertSame(1, $this->db->table('audit_logs')->where('action', 'onboarding_transfer_confirmed')->where('target_id', $order['id'])->count());
        $this->withToken($user['token']);
        $this->getJson('/v1/me/onboarding-transfers/'.$order['id'])->assertOk()->assertJsonMissing(['confirmed_at' => null]);
        $this->postJson('/v1/me/onboarding-transfers/'.$order['id'].'/zibal')->assertStatus(409);
        $this->postJson('/v1/me/onboarding-transfers', $body)->assertCreated()->assertJsonPath('id', $order['id']);
        self::assertSame(0, $this->db->table('wallet_ledger')->where('user_id', $user['id'])->count());
    }

    public function test_zibal_start_and_callback_verify_amount_and_confirm_once_with_sms_failure_isolated(): void
    {
        config(['payments.zibal_merchant' => 'test-only-merchant', 'identity.sms_username' => 'test-only', 'identity.sms_key' => 'test-only', 'identity.sms_from' => '5000']);
        $user = $this->actor();
        $lead = $this->lead($user['id']);
        $order = $this->postJson('/v1/me/onboarding-transfers', ['plan' => 'monthly', 'submissionId' => $lead])->assertCreated()->json();
        Http::fake(['https://gateway.zibal.ir/v1/request' => Http::response(['result' => 100, 'trackId' => 123456789]),
            'https://gateway.zibal.ir/v1/verify' => Http::sequence()->push(['result' => 100, 'status' => 1, 'amount' => 1])->push(['result' => 201, 'status' => 1, 'amount' => $order['amount_toman'] * 10]),
            'https://rest.payamak-panel.com/*' => Http::response(['RetStatus' => 1, 'Value' => '12345678901'])]);
        $start = '/v1/me/onboarding-transfers/'.$order['id'].'/zibal';
        $this->postJson($start)->assertCreated()->assertExactJson(['url' => 'https://gateway.zibal.ir/start/123456789']);
        $this->postJson($start)->assertCreated();
        Http::assertSentCount(1);
        Http::assertSent(fn ($r) => $r['amount'] === $order['amount_toman'] * 10 && $r['merchant'] === 'test-only-merchant' && $r['orderId'] === $order['id']);
        $return = '/v1/me/onboarding-transfers/zibal/return?trackId=123456789';
        $this->get($return.'&success=0')->assertStatus(303)->assertHeader('Location', '/onboarding/payment?order='.$order['id'].'&gateway=cancelled');
        $this->get($return.'&success=1')->assertStatus(303)->assertHeader('Location', '/onboarding/payment?order='.$order['id'].'&gateway=pending');
        self::assertNull($this->db->table('onboarding_transfers')->where('id', $order['id'])->value('confirmed_at'));
        $this->get($return.'&success=1')->assertStatus(303)->assertHeader('Location', '/onboarding/payment?order='.$order['id']);
        $this->get($return.'&success=1')->assertStatus(303);
        Http::assertSentCount(4);
        self::assertSame('sent', $this->db->table('onboarding_transfers')->where('id', $order['id'])->value('sms_status'));
        self::assertSame(1, $this->db->table('audit_logs')->where('action', 'onboarding_zibal_confirmed')->where('target_id', $order['id'])->count());
        $this->get('/v1/me/onboarding-transfers/zibal/return?trackId=invalid')->assertStatus(303)->assertHeader('Location', '/onboarding/payment');
    }

    public function test_gateway_rejection_transport_failure_and_expired_orders_preserve_payment_state(): void
    {
        config(['payments.zibal_merchant' => 'test-only-merchant']);
        $user = $this->actor();
        $order = $this->postJson('/v1/me/onboarding-transfers', ['plan' => 'quarterly', 'submissionId' => $this->lead($user['id'])])->assertCreated()->json();
        $start = '/v1/me/onboarding-transfers/'.$order['id'].'/zibal';
        Http::fake(['https://gateway.zibal.ir/*' => Http::sequence()->push(['result' => 102])->pushStatus(503)]);
        $this->postJson($start)->assertStatus(502)->assertJsonPath('code', 'gateway_rejected');
        $this->postJson($start)->assertStatus(503)->assertJsonPath('code', 'unavailable');
        self::assertNull($this->db->table('onboarding_transfers')->where('id', $order['id'])->value('zibal_track_id'));
        $this->db->table('onboarding_transfers')->where('id', $order['id'])->update(['expires_at' => '2020-01-01 00:00:00']);
        $this->postJson($start)->assertStatus(409);
        Http::assertSentCount(2);
    }
}
