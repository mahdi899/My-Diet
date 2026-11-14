<?php

namespace App\Modules\Food\Domain;

final class FoodCsv
{
    public const COLUMNS = ['slug', 'name_fa', 'category', 'meal_types', 'serving_label', 'serving_g', 'kcal', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g', 'allergens', 'tags', 'regions', 'seasons', 'cost_tier', 'prep_minutes', 'ingredients', 'active', 'image', 'nutrition'];

    public static function rows(string $text): array
    {
        $source = preg_replace('/^\x{FEFF}/u', '', $text);
        $rows = [];
        $row = [];
        $field = '';
        $quoted = false;
        for ($i = 0, $length = strlen($source); $i < $length; $i++) {
            $char = $source[$i];
            if ($quoted) {
                if ($char === '"') {
                    if (($source[$i + 1] ?? '') === '"') {
                        $field .= '"';
                        $i++;
                    } else {
                        $quoted = false;
                    }
                } else {
                    $field .= $char;
                }
            } elseif ($char === '"') {
                $quoted = true;
            } elseif ($char === ',') {
                $row[] = $field;
                $field = '';
            } elseif ($char === "\n" || $char === "\r") {
                if ($char === "\r" && ($source[$i + 1] ?? '') === "\n") {
                    $i++;
                }
                $row[] = $field;
                $field = '';
                if (array_any($row, fn ($cell) => FoodRules::trim($cell) !== '')) {
                    $rows[] = $row;
                }
                $row = [];
            } else {
                $field .= $char;
            }
        }
        $row[] = $field;
        if (array_any($row, fn ($cell) => FoodRules::trim($cell) !== '')) {
            $rows[] = $row;
        }

        return $rows;
    }

    public static function food(array $cells): array
    {
        $list = fn ($cell) => array_values(array_filter(array_map(FoodRules::trim(...), explode('|', $cell ?? '')), fn ($item) => $item !== ''));
        $num = fn ($cell) => is_string($cell) && trim($cell) !== '' && is_numeric(trim($cell)) ? (float) trim($cell) : NAN;
        $food = ['slug' => $cells[0] ?? null, 'nameFa' => $cells[1] ?? null, 'category' => isset($cells[2]) ? trim($cells[2]) : null,
            'mealTypes' => $list($cells[3] ?? null), 'servingLabel' => $cells[4] ?? null, 'servingG' => ($cells[5] ?? null) === '' ? null : $num($cells[5] ?? null),
            'kcal' => $num($cells[6] ?? null), 'proteinG' => $num($cells[7] ?? null), 'carbsG' => $num($cells[8] ?? null), 'fatG' => $num($cells[9] ?? null), 'fiberG' => $num($cells[10] ?? null),
            'allergens' => $list($cells[11] ?? null), 'tags' => $list($cells[12] ?? null), 'regions' => $list($cells[13] ?? null), 'seasons' => $list($cells[14] ?? null),
            'costTier' => $num($cells[15] ?? null), 'prepMinutes' => $num($cells[16] ?? null), 'active' => strtolower(trim($cells[18] ?? 'true')) !== 'false',
            'ingredients' => array_map(function ($item) use ($num) {
                $parts = explode(':', $item);

                return ['name' => $parts[0] ?? null, 'quantity' => $num($parts[1] ?? null), 'unit' => $parts[2] ?? null, 'category' => $parts[3] ?? null];
            }, $list($cells[17] ?? null))];
        if (array_key_exists(19, $cells)) {
            $food['image'] = $cells[19] === '' ? null : $cells[19];
        }
        if (array_key_exists(20, $cells)) {
            $food['nutrition'] = $cells[20] === '' ? null : json_decode($cells[20], false, 512, JSON_THROW_ON_ERROR);
        }

        return $food;
    }

    public static function export(array $foods): string
    {
        $lines = [implode(',', self::COLUMNS)];
        foreach ($foods as $food) {
            $cells = [$food['slug'], $food['nameFa'], $food['category'], implode('|', $food['mealTypes']), $food['servingLabel'], $food['servingG'], $food['kcal'],
                $food['proteinG'], $food['carbsG'], $food['fatG'], $food['fiberG'], implode('|', $food['allergens']), implode('|', $food['tags']), implode('|', $food['regions']), implode('|', $food['seasons']),
                $food['costTier'], $food['prepMinutes'], implode('|', array_map(fn ($item) => implode(':', [$item['name'], $item['quantity'], $item['unit'], $item['category']]), $food['ingredients'])),
                $food['active'] ? 'true' : 'false', $food['image'], $food['nutrition'] === null ? '' : json_encode($food['nutrition'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR)];
            $lines[] = implode(',', array_map(function ($value) {
                $text = (string) ($value ?? '');

                return preg_match('/[",\r\n]/', $text) ? '"'.str_replace('"', '""', $text).'"' : $text;
            }, $cells));
        }

        return "\xef\xbb\xbf".implode("\r\n", $lines)."\r\n";
    }
}
