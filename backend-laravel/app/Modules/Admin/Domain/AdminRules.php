<?php

namespace App\Modules\Admin\Domain;

use App\Modules\Plans\Domain\CivilDates;
use App\Shared\Domain\Problem;

final class AdminRules
{
    public const VERIFICATION = ['pending', 'verified', 'rejected', 'suspended'];

    public static function councilExact(string $raw): string
    {
        $digits = self::digits($raw);
        if ($digits === null || strlen($digits) !== 6) {
            throw new Problem(400, 'validation', 'کد نظام پزشکی باید دقیقاً ۶ رقم باشد');
        }

        return $digits;
    }

    public static function councilOptional(string $raw): string
    {
        $digits = self::digits($raw);
        if ($digits === null || ($digits !== '' && (strlen($digits) < 4 || strlen($digits) > 12))) {
            throw new Problem(400, 'validation', 'شمارهٔ نظام درست نیست');
        }

        return $digits;
    }

    public static function loginName(string $raw): string
    {
        $value = strtolower(trim($raw));
        if (! preg_match('/^[a-z][a-z0-9._-]{2,31}$/D', $value)) {
            throw new Problem(400, 'validation', 'نام کاربری باید ۳ تا ۳۲ نویسهٔ انگلیسی باشد و با حرف شروع شود');
        }

        return $value;
    }

    public static function verificationAfterCouncilChange(string $current, ?string $next, string $status): string
    {
        if ($next === null || $next === $current) {
            return $status;
        }

        return 'pending';
    }

    public static function civil(string $date, string $message): string
    {
        if (! CivilDates::valid($date)) {
            throw new Problem(400, 'validation', $message);
        }

        return $date;
    }

    public static function campaign(string $name, string $slug, string $source): array
    {
        $slug = strtolower($slug);
        $source = strtolower($source);
        if (! preg_match('/^[a-z0-9]+(-[a-z0-9]+)*$/D', $slug) || ! preg_match('/^[a-z0-9_.-]+$/D', $source)) {
            throw new Problem(400, 'validation', 'پسوند لینک و منبع را با حروف انگلیسی، عدد و خط تیره وارد کنید');
        }

        return ['name' => $name, 'slug' => $slug, 'source' => $source];
    }

    public static function destination(string $source, string $slug): string
    {
        return '/onboarding/?'.http_build_query(['utm_source' => $source, 'utm_medium' => 'campaign', 'utm_campaign' => $slug]);
    }

    private static function digits(string $raw): ?string
    {
        $digits = '';
        $persian = '۰۱۲۳۴۵۶۷۸۹';
        $arabic = '٠١٢٣٤٥٦٧٨٩';
        foreach (preg_split('//u', trim($raw), -1, PREG_SPLIT_NO_EMPTY) as $char) {
            $index = mb_strpos($persian, $char);
            if ($index !== false) {
                $digits .= (string) $index;

                continue;
            }
            $index = mb_strpos($arabic, $char);
            if ($index !== false) {
                $digits .= (string) $index;

                continue;
            }
            if ($char >= '0' && $char <= '9') {
                $digits .= $char;

                continue;
            }
            if ($char === ' ' || $char === '-') {
                continue;
            }

            return null;
        }

        return $digits;
    }
}
