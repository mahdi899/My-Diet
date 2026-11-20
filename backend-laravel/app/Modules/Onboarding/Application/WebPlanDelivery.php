<?php

namespace App\Modules\Onboarding\Application;

use App\Modules\Money\Application\MoneyStore;
use App\Modules\Money\Domain\SubscriptionPlans;
use App\Shared\Domain\LegacyCrypto as Crypto;
use App\Shared\Domain\Problem;
use Illuminate\Database\ConnectionInterface;

final class WebPlanDelivery
{
    public function __construct(private ConnectionInterface $db, private MoneyStore $money) {}

    public function pending(string $user): bool
    {
        return $this->db->table('onboarding_transfers as t')->leftJoin('plan_checkouts as c', 'c.id', '=', 't.id')
            ->where('t.user_id', $user)->whereNotNull('t.confirmed_at')->whereNull('c.id')->exists();
    }

    public function sync(string $user, ?string $id = null): void
    {
        if (! $this->pending($user)) {
            return;
        }
        $this->db->transaction(function () use ($user, $id): void {
            $this->money->wallet($user, true);
            $profile = $this->db->table('nutrition_profiles')->where('user_id', $user)->whereNotNull('consented_at')->first(['submission_id', 'source']);
            if ($profile === null || $this->money->pendingCheckout($user) !== null || $this->money->admission($user, null)['open']) {
                return;
            }
            $transfer = $this->db->table('onboarding_transfers as t')->leftJoin('plan_checkouts as c', 'c.id', '=', 't.id')
                ->join('demo_lead_submissions as l', 'l.id', '=', 't.submission_id')
                ->where('t.user_id', $user)->where('l.claimed_user_id', $user)->whereNotNull('t.confirmed_at')->whereNull('c.id')
                ->when($id !== null, fn ($query) => $query->where('t.id', $id))
                ->orderBy('t.confirmed_at')->orderBy('t.id')->first(['t.*', 'l.canonical_submission_id']);
            if ($transfer === null || ! isset(SubscriptionPlans::ALL[$transfer->plan])) {
                return;
            }
            if ($transfer->canonical_submission_id !== $profile->submission_id) {
                $singleLegacyLead = $profile->source === 'demo' && $transfer->canonical_submission_id === null
                    && $this->db->table('demo_lead_submissions')->where('claimed_user_id', $user)->count() === 1;
                if (! $singleLegacyLead) {
                    return;
                }
            }
            if ($this->db->table('orders')->where(['user_id' => $user, 'status' => 'paid', 'service_code' => 'new_plan'])->where('created_at', '>=', $transfer->confirmed_at)->exists()) {
                return;
            }
            $order = Crypto::uuid();
            $request = Crypto::uuid();
            $key = 'web-'.$transfer->id;
            $amount = (int) $transfer->amount_toman;
            $days = SubscriptionPlans::ALL[$transfer->plan]['days'];
            $this->money->createOrder(['id' => $order, 'user_id' => $user, 'service_code' => 'new_plan', 'price_toman' => $amount, 'cash_toman' => $amount, 'promo_toman' => 0, 'status' => 'paid', 'idempotency_key' => $key],
                ['id' => $request, 'user_id' => $user, 'order_id' => $order, 'kind' => 'new_plan', 'status' => 'queued', 'submission_id' => $profile->submission_id, 'assigned_specialist_id' => $this->money->assignSpecialist($profile->submission_id), 'price_toman' => $amount]);
            $this->money->createCheckout([
                'id' => $transfer->id, 'user_id' => $user, 'service_code' => 'new_plan', 'plan_code' => $transfer->plan, 'duration_days' => $days,
                'submission_id' => $profile->submission_id, 'amount_toman' => $amount, 'amount_rial' => $amount * 10,
                'idempotency_key' => $key, 'request_hash' => hash('sha256', $key), 'gateway' => $transfer->zibal_track_id === null ? 'web_transfer' : 'web_zibal',
                'status' => 'paid', 'order_id' => $order, 'request_id' => $request, 'ref_id' => $transfer->bank_reference, 'paid_at' => $transfer->confirmed_at,
            ]);
            $this->money->activateSubscription($user, 'new_plan', $days);
        }, 3);
    }

    public function retry(string $id): array
    {
        $user = $this->db->table('onboarding_transfers')->where('id', $id)->whereNotNull('confirmed_at')->value('user_id');
        if ($user === null) {
            throw new Problem(404, 'not_found', 'پرداخت تأییدشده پیدا نشد');
        }
        $this->sync($user, $id);
        $checkout = $this->money->checkout($id);

        return ['linked' => $checkout !== null, 'requestId' => $checkout['request_id'] ?? null];
    }

    public function linkSubmission(string $user, string $submission, ?string $leadId): void
    {
        $lead = $this->db->table('demo_lead_submissions')->where('claimed_user_id', $user)->orderByDesc('claimed_at')->orderByDesc('id')
            ->when($leadId !== null, fn ($query) => $query->where('id', $leadId))->value('id');
        if ($lead !== null) {
            $this->db->table('demo_lead_submissions')->where('id', $lead)->whereNull('canonical_submission_id')->update(['canonical_submission_id' => $submission]);
        }
    }
}
