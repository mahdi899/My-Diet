<?php

namespace App\Modules\Money\Application;

interface MoneyStore
{
    public function catalog(): array;

    public function checkout(string $id, bool $lock = false): ?array;

    public function priorCheckout(string $user, string $key): ?array;

    public function pendingCheckout(string $user): ?array;

    public function createCheckout(array $checkout): void;

    public function updateCheckout(string $id, array $changes): void;

    public function activateSubscription(string $user, string $service, int $days): void;

    public function subscription(string $user): ?array;

    public function orders(string $user): array;

    public function wallet(string $user, bool $lock = false): ?array;

    public function ledger(string $user): array;

    public function order(string $id, bool $lock = false): ?array;

    public function payment(string $id, bool $lock = false): ?array;

    public function package(string $code): ?array;

    public function createPayment(array $payment): void;

    public function paymentAuthority(string $id, string $authority): void;

    public function failPayment(string $id, string $reason): void;

    public function creditPayment(string $id, ?string $reference): void;

    public function changeWallet(string $user, int $cash, int $promo): void;

    public function appendLedger(string $user, string $bucket, int $amount, string $kind, string $reference): void;

    public function priorOrder(string $user, string $key): ?array;

    public function beginOrder(string $user, string $key, string $hash): void;

    public function finishOrder(string $user, string $key, array $response): void;

    public function admission(string $user, ?string $parent): array;

    public function price(string $service): int;

    public function planPrice(string $plan): int;

    public function assignSpecialist(?string $submissionId = null): ?string;

    public function createOrder(array $order, array $request): void;

    public function copyPublishedDraft(string $parent, string $request): void;

    public function cancellation(string $order): ?array;

    public function requestOrder(string $user, string $request): ?string;

    public function refund(string $order, string $request): void;

    public function audit(string $actor, string $order, array $detail): void;

    public function transaction(\Closure $work): mixed;
}
