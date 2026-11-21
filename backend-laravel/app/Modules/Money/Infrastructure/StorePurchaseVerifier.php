<?php

namespace App\Modules\Money\Infrastructure;

use App\Shared\Domain\Problem;

/**
 * Store receipts are stored before this runs. Replace the body with the
 * Bazaar or Myket payment API; a checkout stays unpaid until verify returns.
 */
final class StorePurchaseVerifier
{
    public function __construct(private array $config) {}

    public function verify(string $store, string $productId, string $token, ?string $signature): void
    {
        $credential = match ($store) {
            'bazaar' => $this->config['bazaar_access_token'] ?? null,
            'myket' => $this->config['myket_access_token'] ?? null,
            default => null,
        };
        $ready = is_string($credential) && $credential !== '';

        throw new Problem(503, 'store_verifier_unconfigured', $ready
            ? 'تأیید پرداخت فروشگاه هنوز پیاده‌سازی نشده است'
            : 'تأیید پرداخت فروشگاه هنوز به سرور وصل نشده است');
    }
}
