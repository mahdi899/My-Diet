<?php

namespace App\Modules\Onboarding\Application;

use App\Modules\Identity\Application\IdentitySettings;
use App\Modules\Money\Application\MoneyStore;
use App\Modules\Money\Domain\SubscriptionPlans;
use App\Shared\Domain\LegacyCrypto as Crypto;
use App\Shared\Domain\Problem;

final class TransferService
{
    public function __construct(private TransferStore $store, private TransferGateway $gateway, private PurchaseConfirmation $confirmation, private IdentitySettings $settings, private MoneyStore $prices, private WebPlanDelivery $delivery) {}

    public function create(string $user, string $plan, string $submission): array
    {
        if (! isset(SubscriptionPlans::ALL[$plan])) {
            throw new Problem(400, 'validation', 'پلن معتبر نیست');
        }
        $price = $this->prices->planPrice($plan);
        if ($price <= 0) {
            throw new Problem(400, 'validation', 'پلن معتبر نیست');
        }

        return $this->store->transaction(function () use ($user, $plan, $submission, $price): array {
            $phone = $this->store->lockUser($user);
            if (! $phone) {
                throw new Problem(401, 'unauthorized', 'نشست معتبر نیست');
            }
            if (! $this->store->verified($submission, hash_hmac('sha256', $phone, $this->settings->fieldKey))) {
                throw new Problem(403, 'forbidden', 'ابتدا شماره را تأیید کنید');
            }
            $existing = $this->store->reusable($user, $submission, $plan);
            if ($existing) {
                return $existing;
            }
            for ($attempt = 0; $attempt < 25; $attempt++) {
                $row = $this->store->insert(Crypto::uuid(), $user, $submission, $plan, $price + random_int(1, 10000));
                if ($row) {
                    return $row;
                }
            }
            throw new Problem(503, 'unavailable', 'ساخت مبلغ یکتا ممکن نشد. دوباره تلاش کنید.');
        });
    }

    public function status(string $user, string $id): array
    {
        return $this->store->status($id, $user) ?? throw new Problem(404, 'not_found', 'درخواست پرداخت پیدا نشد');
    }

    public function start(string $user, string $id): array
    {
        return $this->store->transaction(function () use ($user, $id): array {
            $row = $this->store->payment($id, $user);
            if (! $row || $row['confirmed'] || (! $row['active'] && ! $row['trackId'])) {
                throw new Problem(409, 'conflict', 'سفارش قابل پرداخت نیست');
            }
            $track = $row['trackId'];
            if (! $track) {
                $track = $this->gateway->start($row['amountToman'] * 10, $id);
                $this->store->attach($id, $track);
            }

            return ['url' => $this->gateway->redirectUrl($track)];
        });
    }

    public function callback(string $track, string $success): string
    {
        $url = '/onboarding/payment';
        if (! preg_match('/^[0-9]{1,20}$/D', $track)) {
            return $url;
        }
        $row = $this->store->byTrack($track);
        if (! $row) {
            return $url;
        }
        $url .= '?order='.$row['id'];
        if ($row['confirmed']) {
            return $url;
        }
        if ($success !== '1') {
            return $url.'&gateway=cancelled';
        }
        try {
            if (! $this->gateway->verify($track, $row['amountToman'] * 10)) {
                return $url.'&gateway=pending';
            }
            $updated = $this->store->transaction(function () use ($row, $track): ?array {
                $reference = 'zibal-'.$track;
                $this->store->lockReference($reference);
                if ($this->store->referenceUsed($reference, $row['id'])) {
                    throw new Problem(409, 'conflict', 'این تراکنش قبلاً ثبت شده است');
                }
                $confirmed = $this->store->confirm($row['id'], $reference);
                if ($confirmed) {
                    $this->store->audit(null, 'onboarding_zibal_confirmed', $row['id'], ['trackId' => $track, 'amountToman' => $row['amountToman']]);
                }

                return $confirmed;
            });
            if ($updated) {
                $this->deliver($updated['userId'], $row['id']);
                $this->sendConfirmation($row['id'], $updated['phone']);
            }

            return $url;
        } catch (\Throwable) {
            return $url.'&gateway=pending';
        }
    }

    public function all(): array
    {
        return $this->store->all();
    }

    public function confirm(string $actor, string $id, array $body): array
    {
        $reference = is_string($body['reference'] ?? null) ? trim($body['reference']) : '';
        $amount = $body['amountToman'] ?? null;
        if ((! is_int($amount) && ! is_float($amount)) || ! is_finite((float) $amount) || floor((float) $amount) !== (float) $amount || abs($amount) > 9007199254740991 || ! preg_match('/^[a-zA-Z0-9-]{4,80}$/D', $reference)) {
            throw new Problem(400, 'validation', 'شناسه پیگیری بانکی معتبر نیست');
        }
        $row = $this->store->transaction(function () use ($actor, $id, $reference, $amount): array {
            $this->store->lockReference($reference);
            if ($this->store->referenceUsed($reference, $id)) {
                throw new Problem(409, 'conflict', 'این تراکنش قبلاً ثبت شده است');
            }
            $updated = $this->store->confirm($id, $reference, (int) $amount);
            if (! $updated) {
                throw new Problem(409, 'conflict', 'مبلغ با سفارش مطابق نیست یا درخواست قبلاً تأیید شده است');
            }
            $this->store->audit($actor, 'onboarding_transfer_confirmed', $id, ['reference' => $reference, 'amountToman' => $updated['amountToman']]);

            return $updated;
        });

        $this->deliver($row['userId'], $id);
        $sms = $this->sendConfirmation($id, $row['phone']);

        return ['confirmed' => true, 'smsStatus' => $sms];
    }

    private function deliver(string $user, string $id): void
    {
        try {
            $this->delivery->sync($user, $id);
        } catch (\Throwable $error) {
            report($error);
        }
    }

    private function sendConfirmation(string $id, string $phone): string
    {
        $status = 'sent';
        try {
            $this->confirmation->send($phone);
        } catch (\Throwable) {
            $status = 'failed';
        }
        $this->store->smsStatus($id, $status);

        return $status;
    }
}
