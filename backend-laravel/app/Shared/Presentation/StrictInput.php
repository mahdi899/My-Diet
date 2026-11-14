<?php

namespace App\Shared\Presentation;

use App\Shared\Domain\Problem;
use Illuminate\Http\Request;
use JsonException;

final class StrictInput
{
    public static function body(Request $request, array $keys, bool $allowEmpty = false): array
    {
        try {
            $raw = $request->getContent();
            $object = $raw === '' && $allowEmpty ? new \stdClass : json_decode($raw, false, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            throw self::invalid();
        }
        if (! $object instanceof \stdClass) {
            throw self::invalid();
        }
        $body = (array) $object;
        if (array_diff(array_keys($body), $keys)) {
            throw new Problem(400, 'validation', 'فیلد اضافی پذیرفته نیست');
        }

        return $body;
    }

    public static function string(array $body, string $key, int $max): string
    {
        if (! isset($body[$key]) || ! is_string($body[$key])) {
            throw self::invalid();
        }
        $trimmed = preg_replace('/^[\s\p{Z}\x{FEFF}]+|[\s\p{Z}\x{FEFF}]+$/u', '', $body[$key]);
        if ($trimmed === '' || self::length($trimmed) > $max) {
            throw self::invalid();
        }

        return $trimmed;
    }

    public static function optional(array $body, string $key, int $max): ?string
    {
        return ($body[$key] ?? null) === null ? null : self::string($body, $key, $max);
    }

    public static function length(string $value): int
    {
        return (int) (strlen(mb_convert_encoding($value, 'UTF-16LE', 'UTF-8')) / 2);
    }

    public static function uuid(string $value): string
    {
        if (! preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iD', $value)) {
            throw new Problem(400, 'validation', 'شناسه معتبر نیست');
        }

        return strtolower($value);
    }

    public static function phone(string $input): string
    {
        $input = strtr($input, array_combine(preg_split('//u', '۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩', -1, PREG_SPLIT_NO_EMPTY), str_split('01234567890123456789')));
        if (preg_match('/[^0-9+ ()-]/u', trim($input))) {
            throw new Problem(400, 'invalid_phone', 'شمارهٔ موبایل معتبر نیست');
        }
        $digits = preg_replace('/[^0-9]/', '', $input);
        $length = strlen($digits);
        if (str_starts_with($digits, '0098')) {
            $national = substr($digits, 4);
        } elseif (str_starts_with($digits, '98') && $length === 12) {
            $national = substr($digits, 2);
        } elseif (str_starts_with($digits, '0') && $length === 11) {
            $national = substr($digits, 1);
        } elseif ($length === 10) {
            $national = $digits;
        } elseif ($length >= 11) {
            throw new Problem(400, 'unsupported_country', 'در این نسخه فقط شمارهٔ موبایل ایران پذیرفته می‌شود');
        } else {
            throw new Problem(400, 'invalid_phone', 'شمارهٔ موبایل معتبر نیست');
        }
        if (! preg_match('/^9[0-9]{9}$/D', $national)) {
            throw new Problem(400, 'invalid_phone', 'شمارهٔ موبایل معتبر نیست');
        }

        return '+98'.$national;
    }

    public static function code(array $body, string $message): string
    {
        $code = self::string($body, 'code', 6);
        if (! preg_match('/^[0-9]{6}$/D', $code)) {
            throw new Problem(401, 'unauthorized', $message);
        }

        return $code;
    }

    private static function invalid(): Problem
    {
        return new Problem(400, 'validation', 'اطلاعات واردشده ناقص یا نادرست است');
    }
}
