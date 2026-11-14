<?php

namespace App\Modules\Rewards\Application;

use App\Modules\Plans\Domain\CivilDates;
use App\Modules\Rewards\Domain\StreakRules;
use App\Shared\Domain\Problem;

final class StreakService
{
    public function __construct(private StreakStore $store) {}

    public function snapshot(string $user): array
    {
        return $this->store->transaction(fn () => $this->evaluate($user, null));
    }

    public function claim(string $user, string $command): array
    {
        return $this->store->transaction(function () use ($user, $command): array {
            $this->store->lockWallet($user);
            $prior = $this->store->claim($user, $command);
            if ($prior !== null) {
                return [...$prior, 'retried' => true];
            }
            $result = $this->evaluate($user, $command);
            $this->store->saveClaim($user, $command, $result);

            return $result;
        });
    }

    public function list(): array
    {
        return array_map(fn (string $id) => $this->store->rules($id), $this->store->ids());
    }

    public function publish(array $body): array
    {
        if (array_diff(array_keys($body), ['consecutiveDays', 'milestones', 'startsOn', 'endsOn', 'effectiveOn', 'repeat'])) {
            throw new Problem(400, 'validation', 'اطلاعات درخواست کامل نیست');
        }
        $days = $body['consecutiveDays'] ?? null;
        $milestones = $body['milestones'] ?? null;
        if (! is_int($days) || ! is_array($milestones) || array_is_list($milestones) === false || count($milestones) < 1 || count($milestones) > 10 || ! in_array($body['repeat'] ?? null, ['cycle', 'none'], true)) {
            throw new Problem(400, 'validation', 'اطلاعات درخواست کامل نیست');
        }
        $parsed = [];
        foreach ($milestones as $milestone) {
            if (! is_array($milestone) || array_is_list($milestone) || array_diff(array_keys($milestone), ['day', 'amountToman']) || ! is_int($milestone['day'] ?? null) || ! is_int($milestone['amountToman'] ?? null)) {
                throw new Problem(400, 'validation', 'اطلاعات درخواست کامل نیست');
            }
            $parsed[] = ['day' => $milestone['day'], 'amountToman' => $milestone['amountToman']];
        }
        usort($parsed, fn (array $left, array $right): int => $left['day'] <=> $right['day']);
        if ($days < 1 || $days > 30) {
            throw new Problem(400, 'validation', 'تعداد روزهای پیاپی باید بین ۱ و ۳۰ باشد');
        }
        if ($parsed === [] || array_filter($parsed, fn (array $item): bool => $item['day'] < 1 || $item['day'] > $days || $item['amountToman'] < 0)) {
            throw new Problem(400, 'validation', 'مایل‌ستون‌های کمپین را بررسی کن');
        }
        $starts = $body['startsOn'] ?? null;
        $effective = $body['effectiveOn'] ?? null;
        $ends = $body['endsOn'] ?? null;
        if (! is_string($starts) || ! CivilDates::valid($starts) || ! is_string($effective) || ! CivilDates::valid($effective) || ($ends !== null && (! is_string($ends) || ! CivilDates::valid($ends)))) {
            throw new Problem(400, 'validation', $ends !== null && ! is_string($ends) ? 'تاریخ پایان نامعتبر است' : 'تاریخ شروع نامعتبر است');
        }

        return $this->store->saveCampaign(['consecutiveDays' => $days, 'startsOn' => $starts, 'endsOn' => $ends, 'effectiveOn' => $effective, 'repeat' => $body['repeat']], $parsed);
    }

    public function claimBody(array $body): string
    {
        if (array_diff(array_keys($body), ['commandId']) || ! is_string($body['commandId'] ?? null) || ! preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iD', $body['commandId'])) {
            throw new Problem(400, 'validation', 'اطلاعات درخواست کامل نیست');
        }

        return strtolower($body['commandId']);
    }

    private function evaluate(string $user, ?string $command): array
    {
        $today = CivilDates::today();
        $wallet = $this->store->promo($user);
        $locked = $this->store->participation($user, $today);
        $campaign = $locked ? $this->store->rules($locked['campaign_id']) : $this->store->latest();
        if ($campaign === null) {
            return $this->empty($wallet);
        }
        $cycleStart = $locked['cycle_start'] ?? StreakRules::cycleStart($campaign['startsOn'], $campaign['consecutiveDays'], $today);
        if ($cycleStart === null) {
            return $this->empty($wallet, $campaign);
        }
        $activity = $this->store->activity($user, $cycleStart, $campaign['consecutiveDays']);
        $participation = $locked['id'] ?? '';
        if ($locked === null && ($command !== null || $activity['qualified'] !== [] || $activity['partial'] !== [])) {
            $created = $this->store->ensureParticipation($user, $campaign['id'], $cycleStart);
            $participation = $created['id'];
            if ($created['campaign_id'] !== $campaign['id']) {
                $campaign = $this->store->rules($created['campaign_id']);
            }
        }
        if ($campaign['repeat'] === 'none' && $cycleStart !== $campaign['startsOn']) {
            return $this->empty($wallet, $campaign);
        }
        $granted = $participation !== '' ? $this->store->granted($participation) : [];
        $projected = StreakRules::project($campaign, $cycleStart, $today, $activity['qualified'], $activity['partial'], $granted);
        if ($command !== null && $participation !== '') {
            $this->store->reverseShortfall($user, $participation, $projected['consecutive'], $today);
        }
        $grants = $command !== null && $participation !== '' ? $this->store->issue($user, $participation, $cycleStart, $campaign['milestones'], $projected['consecutive'], $activity['anomaly']) : [];
        $fresh = $participation !== '' ? $this->store->granted($participation) : $granted;
        $shown = StreakRules::project($campaign, $cycleStart, $today, $activity['qualified'], $activity['partial'], $fresh);
        $held = $participation !== '' && $this->store->held($participation);
        $issued = array_filter($grants, fn (array $grant): bool => $grant['issued']);
        $claimState = $issued !== [] ? 'confirmed' : ($grants !== [] || $held ? 'held' : ($granted !== [] && $grants === [] ? 'duplicate' : 'idle'));

        return ['version' => $campaign['version'], 'days' => $shown['days'], 'consecutive' => $shown['consecutive'], 'requiredDays' => $campaign['consecutiveDays'], 'todayRequirements' => StreakRules::TODAY, 'resetRule' => StreakRules::RESET, 'milestones' => $campaign['milestones'], 'claimState' => $claimState, 'grants' => array_map(fn (array $grant): array => ['id' => $grant['id'], 'day' => $grant['day'], 'amountToman' => $grant['amountToman'], 'cycleStart' => $cycleStart], array_values($issued)), 'wallet' => $this->store->promo($user)];
    }

    private function empty(int $wallet, ?array $campaign = null): array
    {
        return ['version' => $campaign['version'] ?? 0, 'days' => [], 'consecutive' => 0, 'requiredDays' => $campaign['consecutiveDays'] ?? 0, 'todayRequirements' => StreakRules::TODAY, 'resetRule' => StreakRules::RESET, 'milestones' => $campaign['milestones'] ?? [], 'claimState' => 'idle', 'grants' => [], 'wallet' => $wallet];
    }
}
