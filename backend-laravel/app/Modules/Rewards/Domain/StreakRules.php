<?php

namespace App\Modules\Rewards\Domain;

use App\Modules\Plans\Domain\CivilDates;

final class StreakRules
{
    public const RESET = 'اگر یک روز وعده‌ها ثبت نشود، شمارش روزهای پیاپی از نو شروع می‌شود. ورود به برنامه یک روز را کامل نمی‌کند.';

    public const TODAY = 'امروز همهٔ وعده‌های برنامهٔ فعال باید ثبت شده باشند. رد کردن یا نانوشته ماندن وعده روز را کامل نمی‌کند.';

    public static function diff(string $later, string $earlier): int
    {
        $end = new \DateTimeImmutable($later, new \DateTimeZone('UTC'));
        $start = new \DateTimeImmutable($earlier, new \DateTimeZone('UTC'));

        return (int) round(($end->getTimestamp() - $start->getTimestamp()) / 86400);
    }

    public static function cycleStart(string $startsOn, int $length, string $today): ?string
    {
        $elapsed = self::diff($today, $startsOn);
        if ($elapsed < 0) {
            return null;
        }

        return CivilDates::add($startsOn, intdiv($elapsed, $length) * $length);
    }

    /**
     * @param  array{consecutiveDays: int, milestones: list<array{day: int, amountToman: int}>, startsOn: string, endsOn: ?string, effectiveOn: string, repeat: string}  $rules
     * @param  array<string, true>  $qualified
     * @param  array<string, true>  $partial
     * @param  array<int, true>  $granted
     * @return array{days: list<array{date: string, state: string}>, consecutive: int}
     */
    public static function project(array $rules, string $cycleStart, string $today, array $qualified, array $partial, array $granted): array
    {
        if ($rules['repeat'] === 'none' && self::diff($cycleStart, $rules['startsOn']) > 0) {
            return ['days' => [], 'consecutive' => 0];
        }
        $days = [];
        $consecutive = 0;
        for ($index = 0; $index < $rules['consecutiveDays']; $index++) {
            $date = CivilDates::add($cycleStart, $index);
            if ($date < $rules['effectiveOn'] || ($rules['endsOn'] !== null && $date > $rules['endsOn']) || $date > $today) {
                $days[] = ['date' => $date, 'state' => 'pending'];

                continue;
            }
            if (isset($qualified[$date])) {
                $consecutive++;
                $days[] = ['date' => $date, 'state' => 'qualified'];

                continue;
            }
            if ($date === $today && isset($partial[$date])) {
                $days[] = ['date' => $date, 'state' => 'pending_verification'];

                continue;
            }
            if ($date < $today) {
                $consecutive = 0;
                $days[] = ['date' => $date, 'state' => 'missed'];

                continue;
            }
            $days[] = ['date' => $date, 'state' => 'pending'];
        }
        foreach (array_keys($granted) as $day) {
            if (($days[$day - 1]['state'] ?? null) === 'qualified') {
                $days[$day - 1]['state'] = 'rewarded';
            }
        }

        return ['days' => $days, 'consecutive' => $consecutive];
    }

    public static function recorded(bool $eaten, ?string $state): bool
    {
        if ($state === 'skipped' || $state === 'unrecorded') {
            return false;
        }
        if (in_array($state, ['as_planned', 'less', 'more', 'different'], true)) {
            return true;
        }

        return $eaten && ($state === null || $state === '');
    }
}
