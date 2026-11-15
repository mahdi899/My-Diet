<?php

namespace App\Modules\Coach\Application;

/**
 * Port (interface) for coach quota management.
 * Infrastructure: MySqlCoachQuotas.
 */
interface CoachQuotaStore
{
    /**
     * Returns current quota state for the user.
     * Returns null if user has no active subscription quota (unlimited).
     *
     * @return array{daily_msg_limit:int, period_msg_limit:int, vision_limit:int,
     *               daily_msg_used:int, period_msg_used:int, vision_used:int,
     *               daily_remaining:int, period_remaining:int, vision_remaining:int,
     *               addon_credits:int}|null
     */
    public function state(string $userId): ?array;

    /**
     * Ensure a quota row exists for this user based on their current plan.
     * Called when subscription activates or renews.
     */
    public function provision(string $userId, string $planCode): void;

    /**
     * Returns true if the user is allowed to send a message.
     * Checks daily limit, period limit, and add-on credits.
     */
    public function canChat(string $userId): bool;

    /**
     * Returns true if the user is allowed to send a photo for analysis.
     */
    public function canVision(string $userId): bool;

    /**
     * Decrements the chat message count. Called after successful AI reply.
     * Prefers add-on credits over plan quota (uses plan first if no addons).
     */
    public function decrementChat(string $userId): void;

    /**
     * Decrements the vision/photo count.
     */
    public function decrementVision(string $userId): void;

    /**
     * Grants add-on credits from a purchased pack.
     */
    public function grantAddon(string $userId, string $packCode, int $credits, string $orderId, ?\DateTimeInterface $expiresAt = null): void;

    /**
     * Returns available add-on pack definitions (for purchase).
     *
     * @return list<array{code:string, credits:int, price_toman:int, label:string}>
     */
    public function addonPacks(): array;

    /**
     * Updates plan quota configuration (called by admin panel).
     */
    public function updatePlanQuota(string $planCode, int $dailyLimit, int $periodLimit, int $periodDays, int $visionLimit): void;

    /**
     * Returns all plan quota configurations for admin display.
     *
     * @return list<array{plan_code:string, daily_msg_limit:int, period_msg_limit:int, period_days:int, vision_limit:int}>
     */
    public function planQuotas(): array;
}
