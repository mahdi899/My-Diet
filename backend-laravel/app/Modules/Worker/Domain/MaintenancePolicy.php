<?php

namespace App\Modules\Worker\Domain;

final class MaintenancePolicy
{
    public const PAYMENT_INQUIRY_MS = 15 * 60 * 1000;

    public const PAYMENT_EXPIRE_MS = 30 * 60 * 1000;

    public const GENERATING_STUCK_MS = 15 * 60 * 1000;

    public const OTP_RETAIN_MS = 7 * 24 * 60 * 60 * 1000;

    public const AI_RAW_RETAIN_MS = 30 * 24 * 60 * 60 * 1000;

    public static function shouldExpirePendingPayment(int $ageMs): bool
    {
        return $ageMs >= self::PAYMENT_EXPIRE_MS;
    }

    public static function shouldInquirePendingPayment(int $ageMs): bool
    {
        return $ageMs >= self::PAYMENT_INQUIRY_MS && $ageMs < self::PAYMENT_EXPIRE_MS;
    }

    public static function shouldRequeueGenerating(int $ageMs): bool
    {
        return $ageMs >= self::GENERATING_STUCK_MS;
    }

    public static function shouldPurgeChallenge(int $ageMs): bool
    {
        return $ageMs >= self::OTP_RETAIN_MS;
    }

    public static function shouldClearAiRaw(int $ageMs): bool
    {
        return $ageMs >= self::AI_RAW_RETAIN_MS;
    }
}
