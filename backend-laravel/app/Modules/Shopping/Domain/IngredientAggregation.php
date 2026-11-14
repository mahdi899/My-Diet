<?php

namespace App\Modules\Shopping\Domain;

final class IngredientAggregation
{
    public static function label(string $value): string
    {
        $folded = str_replace(['ي', 'ك'], ['ی', 'ک'], $value);

        return mb_strtolower(trim(preg_replace('/[\s\x{200c}]+/u', ' ', $folded)));
    }

    /**
     * @param  list<array{name: string, quantity: float|int|null, unit: string|null, basis: string, category?: string, source: string}>  $inputs
     * @return list<array{key: string, name: string, originalLabels: list<string>, quantity: float|null, unit: string|null, basis: string, category: string, incomplete: bool, sources: list<string>}>
     */
    public static function aggregate(array $inputs): array
    {
        $units = [
            'g' => ['g', 1], 'گرم' => ['g', 1], 'kg' => ['g', 1000], 'کیلوگرم' => ['g', 1000],
            'ml' => ['ml', 1], 'میلی لیتر' => ['ml', 1], 'l' => ['ml', 1000], 'لیتر' => ['ml', 1000],
            'piece' => ['piece', 1], 'عدد' => ['piece', 1], 'serving' => ['serving', 1], 'cup' => ['cup', 1],
            'tbsp' => ['tbsp', 1], 'tsp' => ['tsp', 1],
        ];
        $result = [];
        foreach ($inputs as $input) {
            $label = self::label($input['name']);
            $unitLabel = self::label($input['unit'] ?? '');
            $mapped = $units[$unitLabel] ?? null;
            $positive = $input['quantity'] !== null && is_finite((float) $input['quantity']) && $input['quantity'] > 0;
            $known = $label !== '' && $mapped !== null && $positive && $input['basis'] !== 'unknown';
            $category = $input['category'] ?? 'other';
            $key = hash('sha256', json_encode([$label, $mapped[0] ?? $input['unit'], $input['basis'], $category, $known ? null : $input['source']], JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR));
            $calculated = $positive ? $input['quantity'] * ($mapped[1] ?? 1) : null;
            $quantity = $calculated !== null && is_finite((float) $calculated) ? $calculated : null;
            if (isset($result[$key])) {
                $result[$key]['quantity'] = $result[$key]['quantity'] === null || $quantity === null ? null : round(($result[$key]['quantity'] + $quantity) * 1e6) / 1e6;
                if ($result[$key]['quantity'] !== null && ! is_finite($result[$key]['quantity'])) {
                    $result[$key]['quantity'] = null;
                    $result[$key]['incomplete'] = true;
                }
                if (! in_array($input['name'], $result[$key]['originalLabels'], true)) {
                    $result[$key]['originalLabels'][] = $input['name'];
                }
                $result[$key]['sources'][] = $input['source'];
            } else {
                $result[$key] = ['key' => $key, 'name' => $input['name'], 'originalLabels' => [$input['name']], 'quantity' => $quantity,
                    'unit' => $mapped[0] ?? $input['unit'], 'basis' => $input['basis'], 'category' => $category, 'incomplete' => ! $known, 'sources' => [$input['source']]];
            }
        }
        $items = array_values($result);
        usort($items, fn (array $a, array $b): int => $a['category'] <=> $b['category'] ?: $a['key'] <=> $b['key']);

        return $items;
    }
}
