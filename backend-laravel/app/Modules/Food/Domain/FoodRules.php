<?php

namespace App\Modules\Food\Domain;

use App\Shared\Domain\JsonSchema;
use App\Shared\Domain\LegacyCrypto as Crypto;
use App\Shared\Domain\Problem;

final class FoodRules
{
    public function __construct(private array $schema) {}

    public static function length(string $text): int
    {
        return (int) (strlen(mb_convert_encoding($text, 'UTF-16LE', 'UTF-8')) / 2);
    }

    public static function trim(string $text): string
    {
        return preg_replace('/^[\s\p{Z}\x{FEFF}]+|[\s\p{Z}\x{FEFF}]+$/u', '', $text);
    }

    public function parse(mixed $input): array
    {
        $input = $input instanceof \stdClass ? (array) $input : $input;
        if (is_array($input)) {
            foreach (['slug', 'nameFa', 'servingLabel'] as $key) {
                if (isset($input[$key]) && is_string($input[$key])) {
                    $input[$key] = self::trim($input[$key]);
                }
            }
            foreach (['allergens', 'tags', 'regions'] as $key) {
                if (isset($input[$key]) && is_array($input[$key])) {
                    $input[$key] = array_map(fn ($word) => is_string($word) ? self::trim($word) : $word, $input[$key]);
                }
            }
            if (isset($input['ingredients']) && is_array($input['ingredients'])) {
                $input['ingredients'] = array_map(function ($ingredient) {
                    if (is_array($ingredient) || $ingredient instanceof \stdClass) {
                        $ingredient = (array) $ingredient;
                        if (isset($ingredient['name']) && is_string($ingredient['name'])) {
                            $ingredient['name'] = self::trim($ingredient['name']);
                        }
                    }

                    return $ingredient;
                }, $input['ingredients']);
            }
        }
        try {
            $food = JsonSchema::parse($input, $this->schema);
            if (isset($food['nutrition']) && (! str_starts_with($food['nutrition']['sourceUrl'], 'https://') || ! filter_var($food['nutrition']['sourceUrl'], FILTER_VALIDATE_URL))) {
                throw new \InvalidArgumentException('nutrition.sourceUrl');
            }

            return $food;
        } catch (\InvalidArgumentException $error) {
            throw new Problem(400, 'validation', 'فیلد «'.$error->getMessage().'» معتبر نیست');
        }
    }

    public static function photo(array $input): array
    {
        if (! array_key_exists('imageData', $input)) {
            return ['changed' => false, 'bytes' => null];
        }
        $raw = $input['imageData'];
        if ($raw === null || $raw === '') {
            return ['changed' => true, 'bytes' => null];
        }
        if (! is_string($raw)) {
            throw new Problem(400, 'validation', 'عکس غذا معتبر نیست');
        }
        $bytes = base64_decode(preg_replace('~^data:image/jpeg;base64,~', '', $raw), false);
        if (strlen($bytes) < 32 || strlen($bytes) > 1200000 || ! str_starts_with($bytes, "\xff\xd8\xff")) {
            throw new Problem(400, 'validation', 'عکس باید JPEG و کوچک‌تر از ۱٫۲ مگابایت باشد');
        }

        return ['changed' => true, 'bytes' => $bytes];
    }

    public static function compose(array $input, array $foods): array
    {
        $kind = $input['kind'] ?? null;
        $items = $input['items'] ?? null;
        $note = $input['note'] ?? '';
        $invalid = fn (): never => throw new Problem(400, 'validation', 'ترکیب غذا نامعتبر است');
        if (! in_array($kind, ['primary', 'ai_alternative', 'specialist_alternative'], true) || ! is_array($items) || ! array_is_list($items) || count($items) < 1 || count($items) > 5 || ! is_string($note) || self::length(self::trim($note)) > 300) {
            $invalid();
        }
        $merged = [];
        $lines = [];
        $titles = [];
        $prep = 0;
        $macros = ['kcal' => 0, 'proteinG' => 0, 'carbsG' => 0, 'fatG' => 0];
        foreach ($items as $item) {
            $item = (array) $item;
            $slug = $item['slug'] ?? null;
            $servings = $item['servings'] ?? null;
            if (! is_string($slug) || self::length($slug) < 1 || self::length($slug) > 80 || (! is_int($servings) && ! is_float($servings)) || $servings < .25 || $servings > 6) {
                $invalid();
            }
            $food = $foods[$slug] ?? throw new Problem(404, 'not_found', 'غذا پیدا نشد');
            if (! $food['active']) {
                throw new Problem(409, 'food_inactive', 'این غذا در کاتالوگ غیرفعال است');
            }
            foreach ($macros as $key => $value) {
                $macros[$key] += $food[$key] * $servings;
            }
            foreach ($food['ingredients'] as $ingredient) {
                $key = $ingredient['name'].'|'.$ingredient['unit'];
                $quantity = round($ingredient['quantity'] * $servings, 2);
                if (isset($merged[$key])) {
                    $merged[$key]['quantity'] = round($merged[$key]['quantity'] + $quantity, 2);
                } else {
                    $merged[$key] = ['name' => $ingredient['name'], 'quantity' => $quantity, 'unit' => $ingredient['unit'], 'basis' => 'raw', 'category' => $ingredient['category']];
                }
            }
            $phrase = $servings == 1 ? $food['servingLabel'] : ($servings == .5 ? 'نصفِ '.$food['servingLabel'] : strtr((string) $servings, ['0' => '۰', '1' => '۱', '2' => '۲', '3' => '۳', '4' => '۴', '5' => '۵', '6' => '۶', '7' => '۷', '8' => '۸', '9' => '۹', '.' => '٫']).' برابرِ '.$food['servingLabel']);
            $lines[] = $food['nameFa'].': '.$phrase;
            $titles[] = $food['nameFa'];
            $prep = max($prep, $food['prepMinutes']);
        }
        $note = self::trim($note);
        if ($note !== '') {
            $lines[] = $note;
        }
        $macros = array_map(fn ($value) => (int) floor($value + .5), $macros);

        return ['option' => ['optionId' => Crypto::uuid(), 'kind' => $kind, 'title' => mb_substr(implode(' + ', $titles), 0, 200),
            'portion' => ['quantity' => 1, 'unit' => 'serving', 'basis' => 'as_served'], 'calories' => $macros['kcal'], 'preparationMinutes' => min(1440, $prep),
            'instructions' => mb_substr(implode("\n", $lines), 0, 4000), 'ingredients' => array_slice(array_values($merged), 0, 30), 'approved' => false], 'macros' => $macros];
    }
}
