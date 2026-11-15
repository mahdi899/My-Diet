<?php

namespace App\Modules\Money\Application;

use App\Modules\Money\Domain\SubscriptionPlans;
use App\Shared\Domain\Amount;
use App\Shared\Domain\LegacyCrypto as Crypto;
use App\Shared\Domain\Problem;

final class MoneyService
{
    public function __construct(private MoneyStore $store, private PaymentGateways $gateways, private MoneySettings $settings) {}

    public function catalog(): array
    {
        $plans = [];
        foreach (SubscriptionPlans::ALL as $plan) {
            $plan['priceToman'] = $this->store->planPrice($plan['id']);
            $plans[] = $plan;
        }

        return [...$this->store->catalog(), 'plans' => $plans];
    }

    public function gateways(): array
    {
        return $this->gateways->listing();
    }

    public function subscription(string $user): array
    {
        $subscription = $this->store->subscription($user);
        if ($subscription !== null) {
            $subscription['includedChanges'] = $this->store->admission($user, null)['includedChanges'];
        }

        return ['subscription' => $subscription];
    }

    public function orders(string $user): array
    {
        return array_map(fn ($row) => ['id' => $row['id'], 'serviceCode' => $row['service_code'], 'title' => $row['title_fa'], 'priceToman' => Amount::safe($row['price_toman']), 'status' => $row['status'], 'createdAt' => Crypto::iso($row['created_at'])], $this->store->orders($user));
    }

    private function checkoutResult(array $row): array
    {
        return ['paymentId' => $row['id'], 'status' => $row['status'], 'gateway' => $row['gateway'], 'redirectUrl' => $row['redirect_url'], 'amountToman' => Amount::safe($row['amount_toman']), 'orderId' => $row['order_id'], 'requestId' => $row['request_id']];
    }

    public function checkoutStatus(string $user, string $id): array
    {
        $row = $this->store->checkout($id);
        if (! $row || $row['user_id'] !== $user) {
            throw new Problem(404, 'not_found', 'پرداخت پیدا نشد');
        }

        return $this->checkoutResult($row);
    }

    public function startCheckout(string $user, string $key, string $service, int $expected, ?string $parent, ?string $gatewayName, ?string $planId = null): array
    {
        if (! in_array($service, ['new_plan', 'ai_revision', 'specialist_revision'], true) || ($service === 'new_plan') !== ($parent === null)) {
            throw new Problem(400, 'validation', 'پلن انتخابی معتبر نیست');
        }
        $plan = $planId === null ? null : (SubscriptionPlans::ALL[$planId] ?? throw new Problem(400, 'validation', 'پلن انتخابی معتبر نیست'));
        if ($plan !== null && $service !== 'new_plan') {
            throw new Problem(400, 'validation', 'پلن انتخابی معتبر نیست');
        }
        $hash = hash('sha256', json_encode([$service, $expected, $parent, $planId], JSON_THROW_ON_ERROR));

        return $this->store->transaction(function () use ($user, $key, $service, $expected, $parent, $gatewayName, $hash, $plan): array {
            $this->store->wallet($user, true);
            $prior = $this->store->priorCheckout($user, $key) ?? $this->store->pendingCheckout($user);
            if ($prior !== null) {
                if ($prior['request_hash'] !== $hash) {
                    throw new Problem(409, 'payment_in_progress', 'ابتدا پرداخت قبلی را تکمیل کن');
                }

                return $this->checkoutResult($prior);
            }
            if ($this->store->priorOrder($user, $key) !== null) {
                return ['status' => 'paid', ...$this->place($user, $key, $service, $expected, $parent)];
            }
            $context = $this->store->admission($user, $parent);
            if ($context['open']) {
                throw new Problem(409, 'request_in_progress', 'یک درخواست باز دارید');
            }
            if (! $context['submission']) {
                throw new Problem(409, 'questionnaire_required', 'اول پرسشنامه را کامل کن');
            }
            if (! $context['consented']) {
                throw new Problem(409, 'consent_required', 'برای ادامه باید با پردازش اطلاعات سلامت موافقت کنی');
            }
            if ($parent !== null && ! $context['parentPublished']) {
                throw new Problem(404, 'not_found', 'برنامهٔ فعلی پیدا نشد');
            }
            if ($service !== 'new_plan' && $context['includedChanges']) {
                return ['status' => 'paid', ...$this->place($user, $key, $service, $expected, $parent)];
            }
            $amount = $plan === null ? $this->store->price($service) : $this->store->planPrice($plan['id']);
            if ($amount <= 0 || $amount !== $expected) {
                throw new Problem(409, 'price_changed', 'تعرفه تغییر کرده است؛ پلن‌ها را دوباره دریافت کن');
            }
            $name = $gatewayName ?? $this->settings->defaultGateway;
            $gateway = $this->gateways->info($name) ?? throw new Problem(400, 'unknown_gateway', 'درگاه پرداخت شناخته نشد');
            $origin = rtrim($this->settings->publicApiUrl ?? '', '/');
            if (($gateway['network'] && ! $gateway['hosted']) || ($gateway['hosted'] && $origin === '')) {
                throw new Problem(503, 'payment_unavailable', 'درگاه پرداخت در دسترس نیست');
            }
            $row = ['id' => Crypto::uuid(), 'user_id' => $user, 'service_code' => $service, 'submission_id' => $context['submission'], 'parent_request_id' => $parent, 'amount_toman' => $amount, 'amount_rial' => Amount::safe((string) ($amount * 10)), 'idempotency_key' => $key, 'request_hash' => $hash, 'gateway' => $name, 'status' => 'pending', 'redirect_url' => null, 'order_id' => null, 'request_id' => null];
            $row['plan_code'] = $plan['id'] ?? null;
            $row['duration_days'] = $plan['days'] ?? null;
            if ($gateway['hosted']) {
                try {
                    $started = $this->gateways->start($name, $row['amount_rial'], $origin.'/v1/payments/checkout/callback/'.$name.'?paymentId='.$row['id']);
                    $row['authority'] = $started['authority'];
                    $row['redirect_url'] = $started['redirectUrl'];
                } catch (\Throwable) {
                    throw new Problem(502, 'payment_unavailable', 'اتصال به درگاه پرداخت برقرار نشد؛ کمی بعد دوباره تلاش کن');
                }
            }
            $this->store->createCheckout($row);

            return $this->checkoutResult($row);
        });
    }

    public function completeCheckout(string $id, string $gateway, ?string $reference = null): array
    {
        $initial = $this->store->checkout($id) ?? throw new Problem(404, 'not_found', 'پرداخت پیدا نشد');
        if (! $this->gateways->info($gateway)) {
            throw new Problem(404, 'not_found', 'درگاه پیدا نشد');
        }

        return $this->store->transaction(function () use ($id, $gateway, $reference, $initial): array {
            $this->store->wallet($initial['user_id'], true);
            $row = $this->store->checkout($id, true);
            if ($row['gateway'] !== $gateway) {
                throw new Problem(404, 'not_found', 'پرداخت پیدا نشد');
            }
            if ($row['status'] === 'paid') {
                return $this->checkoutResult($row);
            }
            if ($row['status'] !== 'pending') {
                throw new Problem(409, 'payment_closed', 'این پرداخت بسته شده است');
            }
            $order = Crypto::uuid();
            $request = Crypto::uuid();
            $this->store->createOrder(['id' => $order, 'user_id' => $row['user_id'], 'service_code' => $row['service_code'], 'price_toman' => $row['amount_toman'], 'cash_toman' => $row['amount_toman'], 'promo_toman' => 0, 'status' => 'paid', 'idempotency_key' => 'checkout-'.$row['id']],
                ['id' => $request, 'user_id' => $row['user_id'], 'order_id' => $order, 'kind' => $row['service_code'], 'status' => $row['service_code'] === 'specialist_revision' ? 'in_review' : 'queued', 'submission_id' => $row['submission_id'], 'assigned_specialist_id' => $this->store->assignSpecialist(), 'parent_request_id' => $row['parent_request_id'], 'price_toman' => $row['amount_toman']]);
            if ($row['service_code'] === 'specialist_revision') {
                $this->store->copyPublishedDraft($row['parent_request_id'], $request);
            }
            if ($row['duration_days'] !== null) {
                $this->store->activateSubscription($row['user_id'], $row['service_code'], (int) $row['duration_days']);
            }
            $changes = ['status' => 'paid', 'order_id' => $order, 'request_id' => $request, 'ref_id' => $reference, 'paid_at' => gmdate('Y-m-d H:i:s')];
            $this->store->updateCheckout($id, $changes);

            return $this->checkoutResult([...$row, ...$changes]);
        });
    }

    public function checkoutCallback(string $gateway, string $id, ?string $authority, ?string $status): string
    {
        $row = $this->store->checkout($id);
        if (! ($this->gateways->info($gateway)['hosted'] ?? false) || ! $row || $row['gateway'] !== $gateway || ! $row['authority'] || $row['authority'] !== $authority) {
            throw new Problem(404, 'not_found', 'پرداخت پیدا نشد');
        }
        if ($row['status'] !== 'pending') {
            return $row['status'];
        }
        if ($status !== 'OK') {
            return $this->failCheckout($id);
        }
        try {
            $verified = $this->gateways->verify($gateway, Amount::safe($row['amount_rial']), $authority);
        } catch (\Throwable) {
            return 'pending';
        }
        if (! $verified['ok']) {
            return $this->failCheckout($id);
        }
        $this->completeCheckout($id, $gateway, $verified['refId']);

        return 'paid';
    }

    public function failCheckout(string $id): string
    {
        return $this->store->transaction(function () use ($id): string {
            $row = $this->store->checkout($id, true) ?? throw new Problem(404, 'not_found', 'پرداخت پیدا نشد');
            if ($row['status'] === 'pending') {
                $this->store->updateCheckout($id, ['status' => 'failed']);

                return 'failed';
            }

            return $row['status'];
        });
    }

    public function wallet(string $user): array
    {
        $row = $this->store->wallet($user) ?? throw new Problem(404, 'not_found', 'کیف پول پیدا نشد');

        return ['cashToman' => Amount::safe($row['cash_toman']), 'promoToman' => Amount::safe($row['promo_toman'])];
    }

    public function ledger(string $user): array
    {
        return array_map(fn ($row) => ['id' => $row['id'], 'bucket' => $row['bucket'], 'amountToman' => Amount::safe($row['amount_toman']), 'kind' => $row['kind'], 'referenceId' => $row['reference_id'], 'createdAt' => Crypto::iso($row['created_at'])], $this->store->ledger($user));
    }

    public function order(string $user, string $id): array
    {
        $row = $this->store->order($id);
        if (! $row || $row['user_id'] !== $user) {
            throw new Problem(404, 'not_found', 'سفارش پیدا نشد');
        }

        return ['id' => $row['id'], 'serviceCode' => $row['service_code'], 'priceToman' => Amount::safe($row['price_toman']), 'cashToman' => Amount::safe($row['cash_toman']), 'promoToman' => Amount::safe($row['promo_toman']), 'status' => $row['status'], 'createdAt' => Crypto::iso($row['created_at'])];
    }

    public function payment(string $user, string $id): array
    {
        $row = $this->store->payment($id);
        if (! $row || $row['user_id'] !== $user) {
            throw new Problem(404, 'not_found', 'پرداخت پیدا نشد');
        }

        return ['id' => $row['id'], 'packageCode' => $row['package_code'], 'amountToman' => Amount::safe($row['amount_toman']), 'amountRial' => Amount::safe($row['amount_rial']), 'status' => $row['status'], 'gateway' => $row['gateway'], 'createdAt' => Crypto::iso($row['created_at'])];
    }

    public function topup(string $user, string $packageCode, ?string $gatewayName): array
    {
        $name = $gatewayName ?? $this->settings->defaultGateway;
        $gateway = $this->gateways->info($name) ?? throw new Problem(400, 'unknown_gateway', 'درگاه پرداخت شناخته نشد');
        $origin = rtrim($this->settings->publicApiUrl ?? '', '/');
        if (($gateway['network'] && ! $gateway['hosted']) || ($gateway['hosted'] && $origin === '')) {
            throw new Problem(503, 'payment_unavailable', 'درگاه پرداخت در دسترس نیست');
        }
        $package = $this->store->package($packageCode) ?? throw new Problem(404, 'not_found', 'بستهٔ شارژ پیدا نشد');
        $amount = Amount::safe($package['amount_toman']);
        $rial = Amount::safe((string) ($amount * 10));
        $id = Crypto::uuid();
        $this->store->createPayment(['id' => $id, 'user_id' => $user, 'package_code' => $packageCode, 'amount_toman' => $amount, 'amount_rial' => $rial, 'status' => 'pending', 'gateway' => $name]);
        $base = ['paymentId' => $id, 'amountToman' => $amount, 'amountRial' => $rial, 'status' => 'pending', 'gateway' => $name];
        if (! $gateway['hosted']) {
            return [...$base, 'redirectUrl' => null];
        }
        try {
            $started = $this->gateways->start($name, $rial, $origin.'/v1/payments/callback/'.$name.'?paymentId='.$id);
            $this->store->paymentAuthority($id, $started['authority']);

            return [...$base, 'redirectUrl' => $started['redirectUrl']];
        } catch (\Throwable) {
            $this->store->failPayment($id, 'gateway_start_failed');
            throw new Problem(502, 'payment_unavailable', 'اتصال به درگاه پرداخت برقرار نشد؛ کمی بعد دوباره تلاش کن');
        }
    }

    public function sandbox(string $id): array
    {
        if (! $this->gateways->info('sandbox')) {
            throw new Problem(404, 'not_found', 'یافت نشد');
        }

        return $this->credit($id, 'sandbox', null);
    }

    public function hosted(string $gateway, string $id, ?string $authority, ?string $status): string
    {
        if (! ($this->gateways->info($gateway)['hosted'] ?? false)) {
            throw new Problem(503, 'payment_unavailable', 'درگاه پرداخت در دسترس نیست');
        }
        $payment = $this->store->payment($id);
        if (! $payment || $payment['gateway'] !== $gateway || ! $payment['authority'] || $payment['authority'] !== $authority) {
            throw new Problem(404, 'not_found', 'پرداخت پیدا نشد');
        }
        if ($payment['status'] === 'credited') {
            return 'credited';
        }
        if ($payment['status'] !== 'pending') {
            return 'failed';
        }
        if ($status !== 'OK') {
            $this->store->failPayment($id, 'user_cancelled');

            return 'failed';
        }
        try {
            $verified = $this->gateways->verify($gateway, Amount::safe($payment['amount_rial']), $authority);
        } catch (\Throwable) {
            return 'pending';
        }
        if (! $verified['ok']) {
            $this->store->failPayment($id, 'verify_'.$verified['code']);

            return 'failed';
        }
        $this->credit($id, $gateway, $verified['refId']);

        return 'credited';
    }

    private function credit(string $id, string $gateway, ?string $reference): array
    {
        $initial = $this->store->payment($id) ?? throw new Problem(404, 'not_found', 'پرداخت پیدا نشد');

        return $this->store->transaction(function () use ($id, $gateway, $reference, $initial): array {
            $this->store->wallet($initial['user_id'], true);
            $payment = $this->store->payment($id, true);
            if (! $payment || $payment['gateway'] !== $gateway) {
                throw new Problem(404, 'not_found', 'پرداخت پیدا نشد');
            }
            if ($payment['status'] === 'credited') {
                return $this->wallet($payment['user_id']);
            }
            if ($payment['status'] !== 'pending') {
                throw new Problem(409, 'payment_closed', 'این پرداخت بسته شده است');
            }
            $amount = Amount::safe($payment['amount_toman']);
            $this->store->changeWallet($payment['user_id'], $amount, 0);
            $this->store->appendLedger($payment['user_id'], 'cash', $amount, 'topup', $id);
            $this->store->creditPayment($id, $reference);

            return $this->wallet($payment['user_id']);
        });
    }

    public function place(string $user, string $key, string $serviceInput, int $expected, ?string $parent): array
    {
        $service = ['new_plan' => 'new_plan', 'new-plan' => 'new_plan', 'ai_revision' => 'ai_revision', 'ai-change' => 'ai_revision', 'specialist_revision' => 'specialist_revision', 'expert-change' => 'specialist_revision'][$serviceInput] ?? null;
        if ($service === null) {
            throw new Problem(400, 'validation', 'خدمت شناخته نشد');
        }
        if ($service === 'new_plan' && $parent !== null) {
            throw new Problem(400, 'validation', 'برنامهٔ جدید درخواست والد ندارد');
        }
        if ($service !== 'new_plan' && $parent === null) {
            throw new Problem(400, 'validation', 'اصلاح برنامه به برنامهٔ فعلی نیاز دارد');
        }
        $hash = hash('sha256', json_encode(['serviceCode' => $service, 'expectedPriceToman' => $expected, 'parentRequestId' => $parent], JSON_THROW_ON_ERROR));

        return $this->store->transaction(function () use ($user, $key, $service, $expected, $parent, $hash): array {
            $this->store->wallet($user, true);
            $prior = $this->store->priorOrder($user, $key);
            if ($prior) {
                if ($prior['request_hash'] !== $hash) {
                    throw new Problem(422, 'idempotency_conflict', 'این کلید قبلاً برای درخواست دیگری استفاده شده است');
                }

                return $prior['response'] ?? throw new Problem(409, 'idempotency_pending', 'درخواست قبلی هنوز تمام نشده است');
            }
            $this->store->beginOrder($user, $key, $hash);
            if ($this->store->pendingCheckout($user) !== null) {
                throw new Problem(409, 'payment_in_progress', 'ابتدا پرداخت قبلی را تکمیل کن');
            }
            $context = $this->store->admission($user, $parent);
            if ($context['open']) {
                throw new Problem(409, 'request_in_progress', 'یک درخواست باز دارید');
            }
            if (! $context['submission']) {
                throw new Problem(409, 'questionnaire_required', 'اول پرسشنامه را کامل کن');
            }
            if (! $context['consented']) {
                throw new Problem(409, 'consent_required', 'برای ادامه باید با پردازش اطلاعات سلامت موافقت کنی');
            }
            if ($parent !== null && ! $context['parentPublished']) {
                throw new Problem(404, 'not_found', 'برنامهٔ فعلی پیدا نشد');
            }
            $covered = $service !== 'new_plan' && $context['includedChanges'];
            $price = $covered ? 0 : $this->store->price($service);
            if (! $covered && $expected !== $price) {
                throw new Problem(409, 'price_changed', 'قیمت تغییر کرده است');
            }
            $wallet = $this->wallet($user);
            $promo = $covered ? 0 : min($wallet['promoToman'], $price);
            $cash = $price - $promo;
            if ($wallet['cashToman'] < $cash) {
                throw new Problem(409, 'insufficient_balance', 'موجودی کیف پول کافی نیست');
            }
            $order = Crypto::uuid();
            $request = Crypto::uuid();
            $this->store->changeWallet($user, -$cash, -$promo);
            foreach (['cash' => $cash, 'promo' => $promo] as $bucket => $amount) {
                if ($amount > 0) {
                    $this->store->appendLedger($user, $bucket, -$amount, 'order_debit', $order);
                }
            }
            $specialist = $this->store->assignSpecialist();
            $this->store->createOrder(['id' => $order, 'user_id' => $user, 'service_code' => $service, 'price_toman' => $price, 'cash_toman' => $cash, 'promo_toman' => $promo, 'status' => 'paid', 'idempotency_key' => $key],
                ['id' => $request, 'user_id' => $user, 'order_id' => $order, 'kind' => $service, 'status' => $service === 'specialist_revision' ? 'in_review' : 'queued', 'submission_id' => $context['submission'], 'assigned_specialist_id' => $specialist, 'parent_request_id' => $parent, 'price_toman' => $price]);
            if ($service === 'specialist_revision' && $parent !== null) {
                $this->store->copyPublishedDraft($parent, $request);
            }
            $result = ['orderId' => $order, 'requestId' => $request, 'priceToman' => $price, 'cashToman' => $cash, 'promoToman' => $promo, 'wallet' => $this->wallet($user)];
            $this->store->finishOrder($user, $key, $result);

            return $result;
        });
    }

    public function cancelRequest(string $user, string $request): array
    {
        return $this->cancel($user, $this->store->requestOrder($user, $request) ?? throw new Problem(404, 'not_found', 'درخواست پیدا نشد'));
    }

    public function cancel(string $actor, string $id, bool $compensate = false): array
    {
        $initial = $this->store->order($id);
        if (! $initial || (! $compensate && $initial['user_id'] !== $actor)) {
            throw new Problem(404, 'not_found', 'سفارش پیدا نشد');
        }
        if ($initial['direct_payment'] ?? false) {
            throw new Problem(409, 'direct_refund_required', 'برای لغو و بازگشت مبلغ پرداخت مستقیم با پشتیبانی تماس بگیر');
        }

        return $this->store->transaction(function () use ($actor, $id, $compensate, $initial): array {
            $user = $initial['user_id'];
            $this->store->wallet($user, true);
            $order = $this->store->order($id, true);
            if ($compensate && $order['status'] === 'refunded') {
                return $this->wallet($user);
            }
            if ($order['status'] !== 'paid') {
                throw new Problem(409, 'refund_not_allowed', 'این سفارش قابل بازگشت نیست');
            }
            $context = $this->store->cancellation($id);
            if (! $context || ! in_array($context['status'], $compensate ? ['queued', 'generating'] : ['queued', 'generating', 'in_review'], true)) {
                throw new Problem(409, 'refund_not_allowed', $compensate ? 'فقط شکست دائمی پیش از بررسی متخصص قابل جبران است' : 'این سفارش دیگر قابل بازگشت نیست');
            }
            if ($compensate && ! $context['failed']) {
                throw new Problem(409, 'not_failed', 'شکست دائمی خدمت ثبت نشده است');
            }
            if (! $compensate && ($context['edited'] || $context['asked'])) {
                throw new Problem(409, 'refund_not_allowed', 'پس از دخالت متخصص، مبلغ برنمی‌گردد');
            }
            $cash = Amount::safe($order['cash_toman']);
            $promo = Amount::safe($order['promo_toman']);
            foreach (['cash' => $cash, 'promo' => $promo] as $bucket => $amount) {
                if ($amount > 0) {
                    $this->store->appendLedger($user, $bucket, $amount, 'refund', $id);
                }
            }
            $this->store->changeWallet($user, $cash, $promo);
            $this->store->refund($id, $context['id']);
            if ($compensate) {
                $this->store->audit($actor, $id, ['cashToman' => $cash, 'promoToman' => $promo]);
            }

            return $this->wallet($user);
        });
    }
}
