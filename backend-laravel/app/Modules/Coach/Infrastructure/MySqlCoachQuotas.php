<?php

namespace App\Modules\Coach\Infrastructure;

use App\Modules\Coach\Application\CoachQuotaStore;
use App\Modules\Plans\Domain\CivilDates;
use App\Shared\Domain\LegacyCrypto as Crypto;
use Illuminate\Database\ConnectionInterface;

/**
 * MySQL implementation of CoachQuotaStore.
 *
 * Uses INSERT ... ON DUPLICATE KEY UPDATE for atomic upserts.
 * Daily reset checks civil date (Persian date string from CivilDates::today()).
 * Period reset checks period_start + period_days.
 */
final class MySqlCoachQuotas implements CoachQuotaStore
{
    // Add-on pack catalog (can be moved to DB later)
    private const PACKS = [
        ['code' => 'pack_30',  'credits' => 30,  'price_toman' => 50_000,  'label' => '۳۰ پیام اضافی'],
        ['code' => 'pack_100', 'credits' => 100, 'price_toman' => 150_000, 'label' => '۱۰۰ پیام اضافی'],
    ];

    public function __construct(private ConnectionInterface $db) {}

    public function state(string $userId): ?array
    {
        $row = $this->db->table('coach_quotas')->where('user_id', $userId)->first();
        if ($row === null) {
            return null;
        }

        $this->maybeResetDaily($userId, $row);
        $this->maybeResetPeriod($userId, $row);

        // Re-fetch after potential resets
        $row = $this->db->table('coach_quotas')->where('user_id', $userId)->first();
        $addons = $this->activeAddonCredits($userId);

        return [
            'daily_msg_limit'   => (int) $row->daily_msg_limit,
            'period_msg_limit'  => (int) $row->period_msg_limit,
            'vision_limit'      => (int) $row->vision_limit,
            'daily_msg_used'    => (int) $row->daily_msg_used,
            'period_msg_used'   => (int) $row->period_msg_used,
            'vision_used'       => (int) $row->vision_used,
            'daily_remaining'   => max(0, (int) $row->daily_msg_limit - (int) $row->daily_msg_used),
            'period_remaining'  => max(0, (int) $row->period_msg_limit - (int) $row->period_msg_used),
            'vision_remaining'  => max(0, (int) $row->vision_limit - (int) $row->vision_used),
            'addon_credits'     => $addons,
            'reset_daily_at'    => $row->reset_daily_at,
        ];
    }

    public function provision(string $userId, string $planCode): void
    {
        $cfg = $this->db->table('coach_plan_quotas')->where('plan_code', $planCode)->first();
        if ($cfg === null) {
            // Unknown plan: use conservative defaults
            $daily = 8; $period = 120; $vision = 8;
        } else {
            $daily = (int) $cfg->daily_msg_limit;
            $period = (int) $cfg->period_msg_limit;
            $vision = (int) $cfg->vision_limit;
        }

        $today = CivilDates::today();
        $this->db->statement(
            'INSERT INTO coach_quotas
                (user_id, plan_code, daily_msg_limit, period_msg_limit, vision_limit,
                 daily_msg_used, period_msg_used, vision_used, reset_daily_at, period_start)
             VALUES (?, ?, ?, ?, ?, 0, 0, 0, ?, ?)
             AS incoming
             ON DUPLICATE KEY UPDATE
                plan_code       = incoming.plan_code,
                daily_msg_limit = incoming.daily_msg_limit,
                period_msg_limit= incoming.period_msg_limit,
                vision_limit    = incoming.vision_limit,
                daily_msg_used  = 0,
                period_msg_used = 0,
                vision_used     = 0,
                reset_daily_at  = incoming.reset_daily_at,
                period_start    = incoming.period_start',
            [$userId, $planCode, $daily, $period, $vision, $today, $today]
        );
    }

    public function canChat(string $userId): bool
    {
        $row = $this->db->table('coach_quotas')->where('user_id', $userId)->first();
        if ($row === null) {
            return true; // no quota row = no active plan = will be blocked elsewhere
        }

        $this->maybeResetDaily($userId, $row);
        $this->maybeResetPeriod($userId, $row);
        $row = $this->db->table('coach_quotas')->where('user_id', $userId)->first();

        // Check daily and period limits
        $dailyOk  = (int) $row->daily_msg_used  < (int) $row->daily_msg_limit;
        $periodOk = (int) $row->period_msg_used < (int) $row->period_msg_limit;

        if ($dailyOk && $periodOk) {
            return true;
        }

        // Fall back to add-on credits
        return $this->activeAddonCredits($userId) > 0;
    }

    public function canVision(string $userId): bool
    {
        $row = $this->db->table('coach_quotas')->where('user_id', $userId)->first();
        if ($row === null) {
            return true;
        }

        $this->maybeResetPeriod($userId, $row);
        $row = $this->db->table('coach_quotas')->where('user_id', $userId)->first();

        return (int) $row->vision_used < (int) $row->vision_limit;
    }

    public function decrementChat(string $userId): void
    {
        $row = $this->db->table('coach_quotas')->where('user_id', $userId)->first();
        if ($row === null) {
            return;
        }

        $dailyOk  = (int) $row->daily_msg_used  < (int) $row->daily_msg_limit;
        $periodOk = (int) $row->period_msg_used < (int) $row->period_msg_limit;

        if ($dailyOk && $periodOk) {
            $this->db->table('coach_quotas')->where('user_id', $userId)->update([
                'daily_msg_used'  => $this->db->raw('daily_msg_used + 1'),
                'period_msg_used' => $this->db->raw('period_msg_used + 1'),
            ]);
        } else {
            // Decrement oldest non-expired add-on pack
            $this->db->statement(
                'UPDATE coach_addon_credits
                 SET credits_remaining = credits_remaining - 1
                 WHERE user_id = ?
                   AND credits_remaining > 0
                   AND (expires_at IS NULL OR expires_at > current_timestamp(6))
                 ORDER BY created_at
                 LIMIT 1',
                [$userId]
            );
        }
    }

    public function decrementVision(string $userId): void
    {
        $this->db->table('coach_quotas')->where('user_id', $userId)->update([
            'vision_used' => $this->db->raw('vision_used + 1'),
        ]);
    }

    public function grantAddon(string $userId, string $packCode, int $credits, string $orderId, ?\DateTimeInterface $expiresAt = null): void
    {
        $this->db->table('coach_addon_credits')->insert([
            'id'                => Crypto::uuid(),
            'user_id'           => $userId,
            'source_order_id'   => $orderId,
            'credits_total'     => $credits,
            'credits_remaining' => $credits,
            'pack_code'         => $packCode,
            'expires_at'        => $expiresAt?->format('Y-m-d H:i:s.u'),
            'created_at'        => $this->db->raw('current_timestamp(6)'),
        ]);
    }

    public function addonPacks(): array
    {
        return self::PACKS;
    }

    public function updatePlanQuota(string $planCode, int $dailyLimit, int $periodLimit, int $periodDays, int $visionLimit): void
    {
        $this->db->statement(
            'INSERT INTO coach_plan_quotas
                (plan_code, daily_msg_limit, period_msg_limit, period_days, vision_limit)
             VALUES (?, ?, ?, ?, ?)
             AS incoming
             ON DUPLICATE KEY UPDATE
                daily_msg_limit  = incoming.daily_msg_limit,
                period_msg_limit = incoming.period_msg_limit,
                period_days      = incoming.period_days,
                vision_limit     = incoming.vision_limit',
            [$planCode, $dailyLimit, $periodLimit, $periodDays, $visionLimit]
        );
    }

    public function planQuotas(): array
    {
        return $this->db->table('coach_plan_quotas')
            ->orderBy('plan_code')
            ->get()
            ->map(fn ($r) => [
                'plan_code'        => $r->plan_code,
                'daily_msg_limit'  => (int) $r->daily_msg_limit,
                'period_msg_limit' => (int) $r->period_msg_limit,
                'period_days'      => (int) $r->period_days,
                'vision_limit'     => (int) $r->vision_limit,
            ])
            ->all();
    }

    // ── private helpers ──────────────────────────────────────────────────────

    private function maybeResetDaily(string $userId, object $row): void
    {
        $today = CivilDates::today();
        if ($row->reset_daily_at !== $today) {
            $this->db->table('coach_quotas')->where('user_id', $userId)->update([
                'daily_msg_used' => 0,
                'reset_daily_at' => $today,
            ]);
        }
    }

    private function maybeResetPeriod(string $userId, object $row): void
    {
        if ($row->period_start === null) {
            return;
        }

        $cfg = $this->db->table('coach_plan_quotas')->where('plan_code', $row->plan_code)->first();
        $periodDays = $cfg ? (int) $cfg->period_days : 30;

        $start = new \DateTimeImmutable($row->period_start);
        $now   = new \DateTimeImmutable(CivilDates::today());
        $diff  = $start->diff($now)->days;

        if ($diff >= $periodDays) {
            $this->db->table('coach_quotas')->where('user_id', $userId)->update([
                'period_msg_used' => 0,
                'vision_used'     => 0,
                'period_start'    => CivilDates::today(),
            ]);
        }
    }

    private function activeAddonCredits(string $userId): int
    {
        return (int) $this->db->table('coach_addon_credits')
            ->where('user_id', $userId)
            ->where('credits_remaining', '>', 0)
            ->where(fn ($q) => $q->whereNull('expires_at')->orWhere('expires_at', '>', $this->db->raw('current_timestamp(6)')))
            ->sum('credits_remaining');
    }
}
