<?php

namespace App\Modules\Food\Infrastructure;

final class MarkdownRecipes
{
    /**
     * Create a new class instance.
     */
    public function parse(string $text): array
    {
        $text = str_replace("\r\n", "\n", $text);
        preg_match_all('/^## ((?:SRC|IRV|IR)-\d{4}) — ([^\n]+)\n(.*?)(?=^## (?:SRC|IRV|IR)-\d{4} — |\z)/msu', $text, $blocks, PREG_SET_ORDER);
        $recipes = [];
        foreach ($blocks as $block) {
            $fields = [];
            preg_match_all('/^\| ([^|]+) \| ([^|]*) \|$/mu', $block[3], $matches, PREG_SET_ORDER);
            foreach ($matches as $match) {
                if (! isset($fields[trim($match[1])])) {
                    $fields[trim($match[1])] = trim($match[2]);
                }
            }
            $code = $block[1];
            preg_match('/```text\n(.*?)```/su', $block[3], $ingredientBlock);
            preg_match('/تعداد سهم: ([۰-۹0-9]+)/u', $block[3], $servingMatch);
            preg_match('/### دستور تهیه\n(.*?)(?=\n### )/su', $block[3], $instructions);
            $servings = (int) $this->number($servingMatch[1] ?? '0');
            if (! $servings || empty($ingredientBlock[1]) || empty($instructions[1])) {
                throw new \RuntimeException("Incomplete recipe: $code");
            }
            $ingredients = [];
            foreach (explode("\n", trim($ingredientBlock[1])) as $line) {
                $parts = explode(':', trim($line));
                if (count($parts) !== 4 || ! is_numeric($parts[1]) || (float) $parts[1] <= 0) {
                    throw new \RuntimeException("Invalid ingredient: $code $line");
                }
                [$name, $quantity, $unit, $group] = $parts;
                $pattern = '/\| \['.str_replace('؛', '[؛:]', preg_quote($name, '/')).'\]\([^\n]*#(ING-\d+)\)<br>\1 \| [^|]+ \| ([^|]+) \|/u';
                if (! preg_match($pattern, $block[3], $reference)) {
                    throw new \RuntimeException("Missing ingredient reference: $code $name");
                }
                $ingredients[] = ['code' => $reference[1], 'name' => $name, 'quantity' => (float) $quantity, 'unit' => $unit, 'category' => $group, 'reference' => trim($reference[2])];
            }
            $tokens = function (string $key) use ($fields): array {
                preg_match('/`([^`]+)`/u', $fields[$key] ?? '', $match);

                return isset($match[1]) ? array_values(array_filter(array_map('trim', explode(',', $match[1])))) : [];
            };
            $category = $tokens('دسته')[0] ?? '';
            $category = match ($category) {
                'rice', 'stew', 'kebab', 'sandwich', 'pasta' => 'main',
                'meat', 'sea' => 'protein', 'patties', 'stuffed' => 'main', 'sides' => 'side', 'soups' => 'soup', 'sweet' => 'dessert', 'drinks' => 'drink',
                default => $category,
            };
            $recipes[] = ['code' => $code, 'fields' => $fields, 'servings' => $servings, 'ingredients' => $ingredients,
                'instructions' => trim($instructions[1]), 'markdown' => $block[0],
                'food' => ['slug' => strtolower(str_replace('-', '_', $code)), 'name_fa' => trim($block[2]), 'category' => $category,
                    'meal_types' => $tokens('وعده‌های مناسب'), 'serving_label' => $fields['اندازه یک پرس'] ?? '',
                    'serving_g' => (int) round($this->number($fields['وزن هر پرس — گرم'] ?? '')),
                    'kcal' => (int) round($this->number($fields['کیلوکالری هر پرس'] ?? '')),
                    'protein_g' => $this->number($fields['پروتئین هر پرس — گرم'] ?? ''), 'carbs_g' => $this->number($fields['کربوهیدرات هر پرس — گرم'] ?? ''),
                    'fat_g' => $this->number($fields['چربی هر پرس — گرم'] ?? ''), 'fiber_g' => $this->number($fields['فیبر هر پرس — گرم'] ?? ''),
                    'allergens' => $tokens('آلرژن‌های انگلیسی'), 'tags' => $tokens('برچسب‌های انگلیسی پیشنهادی'), 'regions' => $tokens('کد منطقه برای فرم'),
                    'seasons' => $tokens('فصل‌های پیشنهادی'), 'cost_tier' => match ($tokens('سطح هزینه پیشنهادی')[0] ?? '') {
                        'low', 'cheap' => 1, 'high', 'expensive' => 3, default => 2
                    },
                    'prep_minutes' => (int) $this->number($fields['زمان آماده‌سازی — دقیقه'] ?? ''), 'active' => false, 'image' => null, 'source' => 'FoodRecepie.md'],
                'cook_minutes' => (int) $this->number($fields['زمان پخت — دقیقه'] ?? '')];
        }
        if (count($recipes) !== 998 || count(array_unique(array_column($recipes, 'code'))) !== 998) {
            throw new \RuntimeException('Expected exactly 998 unique recipes, found '.count($recipes));
        }

        return $recipes;
    }

    private function number(string $value): float
    {
        $latin = strtr($value, array_combine(preg_split('//u', '۰۱۲۳۴۵۶۷۸۹٫٬', -1, PREG_SPLIT_NO_EMPTY), str_split('0123456789. ')));
        $latin = str_replace(' ', '', $latin);
        if (! preg_match('/[0-9]+(?:\.[0-9]+)?/', $latin, $match)) {
            throw new \RuntimeException("Missing numeric value: $value");
        }

        return (float) $match[0];
    }
}
