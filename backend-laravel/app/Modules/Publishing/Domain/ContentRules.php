<?php

namespace App\Modules\Publishing\Domain;

use App\Shared\Domain\Problem;

final class ContentRules
{
    public static function fail(string $message, string $code = 'validation'): never
    {
        throw new Problem(400, $code, $message);
    }

    public static function text(mixed $value, int $max): string
    {
        if (! is_string($value)) {
            self::fail('متن مقاله درست نیست');
        }
        if (preg_match('/[<>]|javascript\s*:/i', $value)) {
            self::fail('متن نباید نشانهٔ HTML داشته باشد', 'unsafe_content');
        }
        $value = preg_replace('/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/u', '', $value);
        $value = preg_replace('/^[\s\p{Z}\x{FEFF}]+|[\s\p{Z}\x{FEFF}]+$/u', '', $value);
        if ($value === '' || strlen(mb_convert_encoding($value, 'UTF-16LE', 'UTF-8')) / 2 > $max) {
            self::fail('متن مقاله درست نیست');
        }

        return $value;
    }

    public static function slug(mixed $value): string
    {
        $value = self::text($value, 64);
        if (! preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/D', $value)) {
            self::fail('شناسهٔ مقاله درست نیست');
        }

        return $value;
    }

    public static function purpose(mixed $value): string
    {
        $value = self::text($value, 41);
        if (! preg_match('/^[a-z][a-z0-9_]{1,40}$/D', $value)) {
            self::fail('موضوع رضایت درست نیست');
        }

        return $value;
    }

    public static function window(mixed $page, mixed $size): array
    {
        $page = $page === null || $page === '' ? 1 : (is_numeric($page) ? (float) $page : NAN);
        $size = $size === null || $size === '' ? 20 : (is_numeric($size) ? (float) $size : NAN);
        if (! is_finite((float) $page) || floor($page) !== (float) $page || $page < 1 || $page > 1000) {
            self::fail('صفحه درست نیست');
        }
        if (! is_finite((float) $size) || floor($size) !== (float) $size || $size < 1 || $size > 20) {
            self::fail('اندازهٔ صفحه درست نیست');
        }

        return ['page' => (int) $page, 'pageSize' => (int) $size, 'offset' => (int) (($page - 1) * $size)];
    }

    public static function article(string $slug, array $body): array
    {
        if (! is_array($body['sections'] ?? null) || ! array_is_list($body['sections']) || count($body['sections']) < 1 || count($body['sections']) > 8) {
            self::fail('بخش‌های مقاله درست نیست');
        }
        foreach (['image' => [0, 3, 'تصویر مقاله درست نیست'], 'readingMinutes' => [1, 60, 'زمان مطالعه درست نیست']] as $key => [$min,$max,$message]) {
            $value = $body[$key] ?? null;
            if ((! is_int($value) && ! is_float($value)) || floor((float) $value) !== (float) $value || $value < $min || $value > $max) {
                self::fail($message);
            }
        }
        $input = ['slug' => $slug, 'title' => self::text($body['title'] ?? null, 120), 'category' => self::text($body['category'] ?? null, 40),
            'image' => (int) $body['image'], 'readingMinutes' => (int) $body['readingMinutes'], 'intro' => self::text($body['intro'] ?? null, 400)];
        $input['sections'] = array_map(function ($section): array {
            if (! $section instanceof \stdClass && (! is_array($section) || array_is_list($section))) {
                self::fail('بخش‌های مقاله درست نیست');
            }
            $section = (array) $section;
            if (array_diff(array_keys($section), ['heading', 'body'])) {
                self::fail('فیلد اضافی پذیرفته نیست');
            }

            return ['heading' => self::text($section['heading'] ?? null, 120), 'body' => self::text($section['body'] ?? null, 2000)];
        }, $body['sections']);

        return $input;
    }

    public static function config(array $body): array
    {
        $version = self::text($body['minAppVersion'] ?? null, 16);
        if (! preg_match('/^[0-9]+\.[0-9]+\.[0-9]+$/D', $version)) {
            self::fail('نسخهٔ برنامه درست نیست');
        }
        $status = $body['downloadStatus'] ?? null;
        $url = $body['downloadUrl'] ?? null;
        if ($status === 'not_released') {
            if ($url !== null && $url !== '') {
                self::fail('تا زمان انتشار، نشانی دانلود ساخته نمی‌شود', 'fabricated_url');
            }

            return ['minAppVersion' => $version, 'download' => ['status' => $status, 'url' => null]];
        }
        if ($status !== 'released' || ! is_string($url)) {
            self::fail('وضعیت دانلود درست نیست');
        }
        $parsed = parse_url($url);
        if (! $parsed || strtolower($parsed['scheme'] ?? '') !== 'https' || empty($parsed['host']) || ! empty($parsed['user']) || ! empty($parsed['pass'])
            || preg_match('/(^|\.)example\.(com|org|net)$|^localhost$|^127\.0\.0\.1$/iD', $parsed['host'])) {
            self::fail('نشانی دانلود قابل پذیرش نیست', 'fabricated_url');
        }
        $url = 'https://'.strtolower($parsed['host']).(isset($parsed['port']) && $parsed['port'] !== 443 ? ':'.$parsed['port'] : '').($parsed['path'] ?? '/').(isset($parsed['query']) ? '?'.$parsed['query'] : '').(isset($parsed['fragment']) ? '#'.$parsed['fragment'] : '');

        return ['minAppVersion' => $version, 'download' => ['status' => $status, 'url' => $url]];
    }
}
