<?php

namespace App\Modules\Plans\Domain;

final class CivilDates
{
    public static function valid(string $date): bool
    {
        return preg_match('/^([0-9]{4})-([0-9]{2})-([0-9]{2})$/D', $date, $match) === 1 && checkdate((int) $match[2], (int) $match[3], (int) $match[1]) && (int) $match[1] >= 100;
    }

    public static function add(string $date, int $days): string
    {
        return (new \DateTimeImmutable($date, new \DateTimeZone('UTC')))->modify(($days < 0 ? '' : '+').$days.' days')->format('Y-m-d');
    }

    public static function saturday(string $date): string
    {
        $weekday = (int) (new \DateTimeImmutable($date, new \DateTimeZone('UTC')))->format('w');

        return self::add($date, -(($weekday + 1) % 7));
    }

    public static function now(): \DateTimeImmutable
    {
        $override = getenv('SABZINE_NOW');

        return new \DateTimeImmutable(is_string($override) && $override !== '' ? $override : 'now', new \DateTimeZone('UTC'));
    }

    public static function today(?string $instant = null): string
    {
        $base = $instant !== null ? new \DateTimeImmutable($instant, new \DateTimeZone('UTC')) : self::now();

        return $base->setTimezone(new \DateTimeZone('Asia/Tehran'))->format('Y-m-d');
    }
}
