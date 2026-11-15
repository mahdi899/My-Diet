<?php

namespace App\Modules\Food\Application;

use App\Modules\Food\Domain\IngredientCatalog;
use App\Shared\Domain\Problem;

final class IngredientService
{
    public function __construct(private IngredientStore $store) {}

    /**
     * @param  array<string, mixed>  $filter
     * @return array{items: list<array{code: string, nameFa: string, category: string, nutritionReference: ?string, recipeCount: int}>, nextCursor: ?string}
     */
    public function listing(array $filter): array
    {
        $category = is_string($filter['category'] ?? null) ? $filter['category'] : '';
        if ($category !== '' && ! in_array($category, IngredientCatalog::CATEGORIES, true)) {
            throw new Problem(400, 'validation', 'دستهٔ مادهٔ اولیه نامعتبر است');
        }
        $q = is_string($filter['q'] ?? null) ? $filter['q'] : '';
        preg_match_all('/[\p{L}\p{N}-]+/u', \Normalizer::normalize($q, \Normalizer::FORM_KC), $matches);
        $words = array_slice($matches[0], 0, 6);
        $cursor = is_string($filter['cursor'] ?? null) ? $filter['cursor'] : '';
        $items = array_values(array_filter($this->store->all(), function (array $ingredient) use ($category, $q, $words, $cursor): bool {
            if ($category !== '' && $ingredient['category'] !== $category) {
                return false;
            }
            if ($cursor !== '' && strcmp($ingredient['code'], $cursor) <= 0) {
                return false;
            }
            if ($q !== '' && str_contains(strtolower($ingredient['code']), strtolower($q))) {
                return true;
            }
            if ($words) {
                foreach ($words as $word) {
                    if (! preg_match('/(?:^|[^\p{L}\p{N}])'.preg_quote($word, '/').'/iu', $ingredient['nameFa'])) {
                        return false;
                    }
                }
            } elseif ($q !== '') {
                return false;
            }

            return true;
        }));
        $limit = max(1, min(200, (int) ($filter['limit'] ?? 50)));
        $page = array_slice($items, 0, $limit);

        return ['items' => $page, 'nextCursor' => count($items) > $limit ? $page[count($page) - 1]['code'] : null];
    }
}
