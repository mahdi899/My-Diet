<?php

namespace App\Modules\Plans\Domain;

use App\Shared\Domain\JsonSchema;
use App\Shared\Domain\LegacyCrypto as Crypto;
use App\Shared\Domain\Problem;

final class PlanDraftRules
{
    public function __construct(private array $optionSchema) {}

    public static function trim(string $text): string
    {
        return preg_replace('/^[\\s\\p{Z}\\x{FEFF}]+|[\\s\\p{Z}\\x{FEFF}]+$/u', '', $text);
    }

    private static function length(string $text): int
    {
        return (int) (strlen(mb_convert_encoding($text, 'UTF-16LE', 'UTF-8')) / 2);
    }

    private static function fail(string $message): never
    {
        throw new Problem(400, 'validation', $message);
    }

    private static function string(mixed $value): string
    {
        return match (true) {
            is_string($value) => $value, $value === null => 'null', $value === true => 'true', $value === false => 'false',
            is_array($value) => implode(',', array_map(fn ($v) => $v === null ? '' : self::string($v), $value)),
            is_object($value) => '[object Object]', default => (string) $value,
        };
    }

    private static function number(mixed $value): float
    {
        if (is_bool($value)) {
            return $value ? 1 : 0;
        }
        if (is_array($value)) {
            $value = self::string($value);
        }
        if (is_string($value)) {
            $value = self::trim($value);
            if ($value === '') {
                return 0;
            }
            if (preg_match('/^0[xob][0-9a-f]+$/iD', $value)) {
                return match (strtolower($value[1])) {
                    'x' => (float) hexdec(substr($value, 2)),'o' => (float) octdec(substr($value, 2)),'b' => (float) bindec(substr($value, 2))
                };
            }
        }

        return is_numeric($value) ? (float) $value : NAN;
    }

    private function options(mixed $value): array
    {
        $message = 'گزینه‌های وعده با مقدار و واحد معتبر لازم است';
        if (! is_array($value) || count($value) < 1 || count($value) > 3) {
            self::fail($message);
        }
        $options = [];
        foreach ($value as $raw) {
            if (! $raw instanceof \stdClass || array_diff(array_keys((array) $raw), array_keys($this->optionSchema['properties']))) {
                self::fail($message);
            }
            $raw = clone $raw;
            foreach (['title', 'instructions'] as $field) {
                if (is_string($raw->$field ?? null)) {
                    $raw->$field = self::trim($raw->$field);
                }
            }
            if (is_array($raw->ingredients ?? null)) {
                $raw->ingredients = array_map(function ($item): mixed {
                    if ($item instanceof \stdClass) {
                        $item = clone $item;
                        if (is_string($item->name ?? null)) {
                            $item->name = self::trim($item->name);
                        }
                    }

                    return $item;
                }, $raw->ingredients);
            }
            try {
                $options[] = JsonSchema::parse($raw, $this->optionSchema);
            } catch (\InvalidArgumentException) {
                self::fail($message);
            }
        }
        if (! array_any($options, fn ($o) => $o['kind'] === 'primary')) {
            self::fail('گزینهٔ اصلی وعده لازم است');
        }
        foreach (['kind', 'optionId'] as $key) {
            if (count(array_unique(array_column($options, $key))) !== count($options)) {
                self::fail('شناسه و نوع گزینه‌ها باید یکتا باشد');
            }
        }

        return $options;
    }

    public function parse(mixed $body): array
    {
        $body = is_object($body) ? (array) $body : $body;
        if (! is_array($body) || ! is_array($body['days'] ?? null) || count($body['days']) !== 7) {
            self::fail('برنامه باید هفت روز داشته باشد');
        }
        $days = [];
        foreach ($body['days'] as $day) {
            $day = is_object($day) ? (array) $day : $day;
            if (! is_array($day) || ! is_array($day['meals'] ?? null)) {
                self::fail('وعده‌های روز درست نیست');
            }
            if (count($day['meals']) > 12) {
                self::fail('تعداد وعده‌های یک روز زیاد است');
            }
            $days[] = array_map($this->meal(...), $day['meals']);
        }
        $uids = [];
        $options = [];
        foreach ($days as $meals) {
            foreach ($meals as $meal) {
                $uids[] = $meal['mealUid'];
                array_push($options, ...array_column($meal['options'] ?? [], 'optionId'));
            }
        }
        if (count(array_unique($uids)) !== count($uids) || count(array_unique($options)) !== count($options)) {
            self::fail('شناسه وعده و گزینه در نسخه باید یکتا باشد');
        }

        return $days;
    }

    private function meal(mixed $raw): array
    {
        if (! $raw instanceof \stdClass) {
            self::fail('وعده درست نیست');
        }
        $raw = (array) $raw;
        $options = array_key_exists('options', $raw) ? $this->options($raw['options']) : null;
        $primary = array_values(array_filter($options ?? [], fn ($o) => $o['kind'] === 'primary'))[0] ?? null;
        $calories = $raw['calories'] ?? null;
        $sameCalories = array_key_exists('calories', $raw) && (($primary['calories'] ?? null) === null && $calories === null
            || (is_int($calories) || is_float($calories)) && (is_int($primary['calories'] ?? null) || is_float($primary['calories'] ?? null)) && (float) $primary['calories'] === (float) $calories);
        if ($primary && ($primary['title'] !== ($raw['title'] ?? null) || ! $sameCalories)) {
            self::fail('عنوان و کالری اصلی باید با گزینه اصلی یکسان باشد');
        }
        $type = ['breakfast' => 'breakfast', 'lunch' => 'lunch', 'dinner' => 'dinner', 'snack' => 'snack', 'صبحانه' => 'breakfast', 'ناهار' => 'lunch', 'شام' => 'dinner', 'میان‌وعده' => 'snack'][self::string($raw['mealType'] ?? '')] ?? null;
        if (! $type) {
            self::fail('نوع وعده درست نیست');
        }
        $title = is_string($raw['title'] ?? null) ? self::trim($raw['title']) : '';
        $calories = $raw['calories'] ?? null;
        if ($title === '' || self::length($title) > 120 || (! is_int($calories) && ! is_float($calories)) || floor((float) $calories) !== (float) $calories || $calories <= 0 || $calories > 5000) {
            self::fail('عنوان یا کالری وعده درست نیست');
        }
        $notes = is_string($raw['notes'] ?? null) ? self::trim($raw['notes']) : '';
        if (self::length($notes) > 500) {
            self::fail('توضیح وعده بیش از حد طولانی است');
        }
        $time = ($raw['suggestedTime'] ?? null) === null || $raw['suggestedTime'] === '' ? null : self::string($raw['suggestedTime']);
        if ($time && ! preg_match('/^([01][0-9]|2[0-3]):[0-5][0-9]$/D', $time)) {
            self::fail('ساعت وعده درست نیست');
        }
        if (! is_array($raw['items'] ?? null) || count($raw['items']) < 1 || count($raw['items']) > 20) {
            self::fail('هر وعده باید مادهٔ غذایی داشته باشد');
        }
        $uid = array_key_exists('mealUid', $raw) ? self::string($raw['mealUid']) : Crypto::uuid();
        if (! preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iD', $uid)) {
            self::fail('شناسه معتبر نیست');
        }
        $items = array_map(function ($item): array {
            $item = is_object($item) ? (array) $item : $item;
            if (! is_array($item)) {
                self::fail('مادهٔ غذایی درست نیست');
            }
            $name = is_string($item['name'] ?? null) ? self::trim($item['name']) : '';
            if ($name === '' || self::length($name) > 120) {
                self::fail('نام مادهٔ غذایی درست نیست');
            }
            $quantity = ($item['quantity'] ?? null) === null ? null : self::number($item['quantity']);
            if ($quantity !== null && (! is_finite($quantity) || $quantity <= 0)) {
                self::fail('مقدار مادهٔ غذایی درست نیست');
            }
            $unit = ($item['unit'] ?? null) === null ? null : self::trim(self::string($item['unit']));
            if ($unit && self::length($unit) > 16) {
                self::fail('واحد مادهٔ غذایی درست نیست');
            }

            return ['name' => $name, 'quantity' => $quantity, 'unit' => $unit ?: null];
        }, $primary['ingredients'] ?? $raw['items']);

        return ['mealUid' => $uid, ...($options === null ? [] : ['options' => $options]), 'mealType' => $type, 'suggestedTime' => $time, 'title' => $title, 'calories' => (int) $calories, 'notes' => $notes, 'items' => $items];
    }

    public static function publishable(array $days): void
    {
        if (count($days) !== 7 || array_any($days, fn ($day) => count($day['meals']) === 0)) {
            throw new Problem(409, 'plan_incomplete', 'هر روز باید حداقل یک وعده داشته باشد');
        }
        foreach ($days as $day) {
            foreach ($day['meals'] as $meal) {
                if (self::trim($meal['title']) === '' || $meal['calories'] <= 0 || ! $meal['items'] || array_any($meal['items'], fn ($i) => self::trim($i['name']) === '')) {
                    throw new Problem(409, 'plan_incomplete', 'هر وعده باید عنوان، مقدار و کالری داشته باشد');
                }
            }
        }
        foreach ($days as $day) {
            foreach ($day['meals'] as $meal) {
                if (count($meal['options'] ?? []) !== 3 || array_any($meal['options'], fn ($o) => ! $o['approved'])) {
                    throw new Problem(409, 'options_required', 'تمام گزینه‌های وعده باید کامل و به تأیید متخصص رسیده باشند');
                }
            }
        }
    }
}
