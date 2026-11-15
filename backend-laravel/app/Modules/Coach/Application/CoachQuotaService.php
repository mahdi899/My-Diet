<?php

namespace App\Modules\Coach\Application;

use App\Shared\Domain\Problem;

/**
 * Application service for coach quota enforcement.
 * Wraps CoachQuotaStore and throws Problem(429) when limits are reached.
 */
final class CoachQuotaService
{
    public function __construct(
        private CoachQuotaStore $store,
        private \App\Modules\Money\Application\MoneyStore $money,
    ) {}

    /**
     * Check whether the user may send a chat message.
     * Throws Problem 429 (quota_exceeded) if not allowed.
     * Noop if user has no quota row (no active plan = unlimited access denied elsewhere).
     */
    public function requireChat(string $userId): void
    {
        $this->requireActiveSubscription($userId);
        if (!$this->store->canChat($userId)) {
            throw new Problem(429, 'quota_exceeded', 'سقف پیام‌های امروز یا دوره پر شده است. می‌توانید یک بسته اضافی خریداری کنید.');
        }
    }

    /**
     * Check whether the user may send a photo for analysis.
     * Throws Problem 429 (vision_quota_exceeded) if not allowed.
     */
    public function requireVision(string $userId): void
    {
        $this->requireActiveSubscription($userId);
        if (!$this->store->canVision($userId)) {
            throw new Problem(429, 'vision_quota_exceeded', 'سقف تحلیل عکس غذا پر شده است. یک بسته اضافی دریافت کنید.');
        }
    }

    /**
     * Decrement after a successful chat reply.
     */
    public function consumeChat(string $userId): void
    {
        $this->store->decrementChat($userId);
    }

    /**
     * Decrement after a successful vision analysis.
     */
    public function consumeVision(string $userId): void
    {
        $this->store->decrementVision($userId);
    }

    /**
     * Returns the user quota state for display in the app.
     */
    public function state(string $userId): array
    {
        $state = $this->store->state($userId);
        if ($state === null) {
            return [
                'hasQuota' => false,
                'dailyRemaining' => null,
                'periodRemaining' => null,
                'visionRemaining' => null,
                'addonCredits' => 0,
                'addonPacks' => $this->store->addonPacks(),
            ];
        }

        return [
            'hasQuota' => true,
            'dailyRemaining' => $state['daily_remaining'],
            'dailyLimit' => $state['daily_msg_limit'],
            'periodRemaining' => $state['period_remaining'],
            'periodLimit' => $state['period_msg_limit'],
            'visionRemaining' => $state['vision_remaining'],
            'visionLimit' => $state['vision_limit'],
            'addonCredits' => $state['addon_credits'],
            'resetAt' => $state['reset_daily_at'] ?? null,
            'addonPacks' => $this->store->addonPacks(),
        ];
    }

    /**
     * Provision or refresh quota when a subscription is activated.
     */
    private function requireActiveSubscription(string $userId): void
    {
        $subscription = $this->money->subscription($userId);
        if ($subscription !== null && ($subscription['status'] ?? '') === 'expired') {
            throw new Problem(402, 'subscription_expired', 'اشتراک تمام شده است. تاریخچه و وزن می‌ماند؛ برای ادامه مربی اشتراک را تمدید کن.');
        }
    }

    public function provision(string $userId, string $planCode): void
    {
        $this->store->provision($userId, $planCode);
    }

    /**
     * Grant add-on credits from a successful purchase.
     */
    public function grantAddon(string $userId, string $packCode, int $credits, string $orderId): void
    {
        // Add-on packs expire 90 days from purchase
        $expiresAt = new \DateTimeImmutable('+90 days');
        $this->store->grantAddon($userId, $packCode, $credits, $orderId, $expiresAt);
    }

    /**
     * Returns plan quota configuration for admin.
     */
    public function planQuotas(): array
    {
        return $this->store->planQuotas();
    }

    /**
     * Updates plan quota configuration from admin panel.
     */
    public function updatePlanQuota(string $planCode, int $dailyLimit, int $periodLimit, int $periodDays, int $visionLimit): void
    {
        if ($dailyLimit < 1 || $dailyLimit > 100) {
            throw new Problem(422, 'invalid_quota', 'سقف روزانه باید بین ۱ و ۱۰۰ باشد');
        }
        if ($periodLimit < $dailyLimit) {
            throw new Problem(422, 'invalid_quota', 'سقف دوره نباید کمتر از سقف روزانه باشد');
        }
        $this->store->updatePlanQuota($planCode, $dailyLimit, $periodLimit, $periodDays, $visionLimit);
    }
}
