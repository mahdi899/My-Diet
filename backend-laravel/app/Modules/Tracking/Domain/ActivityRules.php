<?php

namespace App\Modules\Tracking\Domain;

use App\Modules\Plans\Domain\CivilDates;
use App\Shared\Domain\Problem;

final class ActivityRules
{
    private const UNITS = ['g', 'kg', 'ml', 'l', 'piece', 'serving', 'cup', 'tbsp', 'tsp'];

    private const BASES = ['raw', 'cooked', 'as_served', 'unknown'];

    private const STATES = ['as_planned', 'less', 'more', 'different', 'skipped', 'unrecorded'];

    public static function activity(array $body): array
    {
        self::only($body, ['commandId', 'versionId', 'mealUid', 'optionId', 'date', 'expectedRevision', 'state', 'actual', 'foodName'], 'اطلاعات مصرف معتبر نیست');
        $input = [
            'commandId' => self::uuid($body, 'commandId', 'اطلاعات مصرف معتبر نیست'),
            'versionId' => self::uuid($body, 'versionId', 'اطلاعات مصرف معتبر نیست'),
            'mealUid' => self::uuid($body, 'mealUid', 'اطلاعات مصرف معتبر نیست'),
            'optionId' => self::uuid($body, 'optionId', 'اطلاعات مصرف معتبر نیست'),
            'date' => self::date($body, 'date', 'اطلاعات مصرف معتبر نیست'),
            'expectedRevision' => self::whole($body, 'expectedRevision', 0, null, 'اطلاعات مصرف معتبر نیست'),
            'state' => self::enum($body, 'state', self::STATES, 'اطلاعات مصرف معتبر نیست'),
        ];
        $needsActual = in_array($input['state'], ['less', 'more', 'different'], true);
        $hasActual = array_key_exists('actual', $body) && $body['actual'] !== null;
        $hasFood = array_key_exists('foodName', $body) && $body['foodName'] !== null;
        if ($needsActual !== $hasActual || (($input['state'] === 'different') !== $hasFood)) {
            throw new Problem(400, 'validation', 'اطلاعات مصرف معتبر نیست');
        }
        if ($hasActual) {
            $input['actual'] = self::quantity($body['actual'], 'اطلاعات مصرف معتبر نیست');
        }
        if ($hasFood) {
            $input['foodName'] = self::text($body['foodName'], 200, 'اطلاعات مصرف معتبر نیست');
        }

        return $input;
    }

    public static function selection(array $body): array
    {
        self::only($body, ['commandId', 'versionId', 'mealUid', 'optionId', 'date', 'expectedRevision', 'reasonId'], 'اطلاعات انتخاب معتبر نیست');
        $input = [
            'commandId' => self::uuid($body, 'commandId', 'اطلاعات انتخاب معتبر نیست'),
            'versionId' => self::uuid($body, 'versionId', 'اطلاعات انتخاب معتبر نیست'),
            'mealUid' => self::uuid($body, 'mealUid', 'اطلاعات انتخاب معتبر نیست'),
            'optionId' => self::uuid($body, 'optionId', 'اطلاعات انتخاب معتبر نیست'),
            'date' => self::date($body, 'date', 'اطلاعات انتخاب معتبر نیست'),
            'expectedRevision' => self::whole($body, 'expectedRevision', 0, null, 'اطلاعات انتخاب معتبر نیست'),
        ];
        if (array_key_exists('reasonId', $body) && $body['reasonId'] !== null) {
            if (! is_string($body['reasonId']) || self::length($body['reasonId']) > 80) {
                throw new Problem(400, 'validation', 'اطلاعات انتخاب معتبر نیست');
            }
            $input['reasonId'] = $body['reasonId'];
        }

        return $input;
    }

    /**
     * @param  array{quantity: float|int, unit: string, basis?: string}  $portion
     * @param  array{quantity: float|int, unit: string, basis?: string}  $actual
     */
    public static function compatibleRatio(array $portion, array $actual): ?float
    {
        $actualBasis = $actual['basis'] ?? null;
        $portionBasis = $portion['basis'] ?? null;
        if ($actualBasis !== null && ($actualBasis === 'unknown' || $portionBasis === 'unknown' || $actualBasis !== $portionBasis)) {
            return null;
        }
        if ($actualBasis === null && in_array($portionBasis, ['raw', 'cooked', 'unknown'], true)) {
            return null;
        }
        $scale = ['g' => ['mass', 1], 'kg' => ['mass', 1000], 'ml' => ['volume', 1], 'l' => ['volume', 1000]];
        $left = $scale[$actual['unit']] ?? null;
        $right = $scale[$portion['unit']] ?? null;
        if ($actual['unit'] !== $portion['unit'] && ($left === null || $right === null || $left[0] !== $right[0])) {
            return null;
        }
        $ratio = $actual['quantity'] * ($left[1] ?? 1) / ($portion['quantity'] * ($right[1] ?? 1));

        return is_finite($ratio) ? $ratio : null;
    }

    /**
     * @param  array{quantity: float|int, unit: string, basis?: string}  $portion
     * @param  array{quantity: float|int, unit: string, basis?: string}  $actual
     */
    public static function proportionalCalories(?float $calories, array $portion, array $actual): ?float
    {
        $ratio = self::compatibleRatio($portion, $actual);
        if ($calories === null || $ratio === null || ! is_finite($calories * $ratio)) {
            return null;
        }
        $result = round($calories * $ratio * 100) / 100;

        return is_finite($result) ? $result : null;
    }

    public static function tehranMinutes(\DateTimeInterface $instant): int
    {
        $shifted = \DateTimeImmutable::createFromInterface($instant)->setTimezone(new \DateTimeZone('Asia/Tehran'));

        return ((int) $shifted->format('G')) * 60 + (int) $shifted->format('i');
    }

    public static function lateBulk(int $mealCount, bool $allEaten, \DateTimeInterface $first, \DateTimeInterface $last, ?\DateTimeInterface $now = null): bool
    {
        if (! $allEaten || $mealCount < 2) {
            return false;
        }
        $now ??= CivilDates::now();
        if (self::tehranMinutes($now) < 23 * 60 + 50) {
            return false;
        }

        return ($last->getTimestamp() - $first->getTimestamp()) <= 120;
    }

    public static function reviewerName(?string $name): string
    {
        $parts = preg_split('/\s+/u', trim($name ?? ''), -1, PREG_SPLIT_NO_EMPTY);
        $first = $parts[0] ?? '';
        if ($first === '') {
            return '';
        }
        $last = count($parts) > 1 ? $parts[array_key_last($parts)] : '';
        if ($last === '') {
            return $first;
        }

        return $first.' '.mb_substr($last, 0, 1).'.';
    }

    /** @param  list<string>  $weekStarts */
    public static function streak(array $weekStarts, string $today): int
    {
        $unique = array_values(array_unique($weekStarts));
        sort($unique);
        if ($unique === []) {
            return 0;
        }
        $current = CivilDates::saturday($today);
        $cursor = $unique[array_key_last($unique)];
        if ($cursor !== $current && $cursor !== CivilDates::add($current, -7)) {
            return 0;
        }
        $have = array_flip($unique);
        $count = 0;
        while (isset($have[$cursor])) {
            $count++;
            $cursor = CivilDates::add($cursor, -7);
        }

        return $count;
    }

    public static function quantity(mixed $value, string $message): array
    {
        if (! is_array($value) || array_is_list($value)) {
            throw new Problem(400, 'validation', $message);
        }
        self::only($value, ['quantity', 'unit', 'basis'], $message);
        if (! is_int($value['quantity'] ?? null) && ! is_float($value['quantity'] ?? null) || ! is_finite((float) $value['quantity']) || $value['quantity'] <= 0 || $value['quantity'] > 1e6) {
            throw new Problem(400, 'validation', $message);
        }
        if (! in_array($value['unit'] ?? null, self::UNITS, true)) {
            throw new Problem(400, 'validation', $message);
        }
        $quantity = ['quantity' => $value['quantity'] + 0, 'unit' => $value['unit']];
        if (array_key_exists('basis', $value)) {
            if (! in_array($value['basis'], self::BASES, true)) {
                throw new Problem(400, 'validation', $message);
            }
            $quantity['basis'] = $value['basis'];
        }

        return $quantity;
    }

    private static function only(array $body, array $keys, string $message): void
    {
        if (array_diff(array_keys($body), $keys)) {
            throw new Problem(400, 'validation', $message);
        }
    }

    private static function uuid(array $body, string $key, string $message): string
    {
        $value = $body[$key] ?? null;
        if (! is_string($value) || ! preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iD', $value)) {
            throw new Problem(400, 'validation', $message);
        }

        return strtolower($value);
    }

    private static function date(array $body, string $key, string $message): string
    {
        $value = $body[$key] ?? null;
        if (! is_string($value) || ! CivilDates::valid($value)) {
            throw new Problem(400, 'validation', $message);
        }

        return $value;
    }

    private static function whole(array $body, string $key, int $min, ?int $max, string $message): int
    {
        $value = $body[$key] ?? null;
        if (! is_int($value) || $value < $min || ($max !== null && $value > $max)) {
            throw new Problem(400, 'validation', $message);
        }

        return $value;
    }

    private static function enum(array $body, string $key, array $allowed, string $message): string
    {
        $value = $body[$key] ?? null;
        if (! is_string($value) || ! in_array($value, $allowed, true)) {
            throw new Problem(400, 'validation', $message);
        }

        return $value;
    }

    private static function text(mixed $value, int $max, string $message): string
    {
        if (! is_string($value)) {
            throw new Problem(400, 'validation', $message);
        }
        $trimmed = preg_replace('/^[\s\p{Z}\x{FEFF}]+|[\s\p{Z}\x{FEFF}]+$/u', '', $value);
        if ($trimmed === '' || self::length($trimmed) > $max) {
            throw new Problem(400, 'validation', $message);
        }

        return $trimmed;
    }

    private static function length(string $value): int
    {
        return (int) (strlen(mb_convert_encoding($value, 'UTF-16LE', 'UTF-8')) / 2);
    }
}
