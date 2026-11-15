<?php

namespace App\Modules\Food\Infrastructure;

use App\Modules\Food\Application\IngredientStore;
use Illuminate\Database\ConnectionInterface;

final class MySqlIngredients implements IngredientStore
{
    public function __construct(private ConnectionInterface $db) {}

    public function all(): array
    {
        return $this->db->table('food_ingredients as i')
            ->leftJoin('food_recipe_ingredients as r', 'r.ingredient_code', '=', 'i.code')
            ->groupBy('i.code', 'i.name_fa', 'i.category', 'i.nutrition_reference')
            ->orderBy('i.code')
            ->get([
                'i.code',
                'i.name_fa',
                'i.category',
                'i.nutrition_reference',
                $this->db->raw('count(distinct r.food_id) as recipe_count'),
            ])
            ->map(fn (object $row): array => [
                'code' => $row->code,
                'nameFa' => $row->name_fa,
                'category' => $row->category,
                'nutritionReference' => $row->nutrition_reference,
                'recipeCount' => (int) $row->recipe_count,
            ])
            ->all();
    }
}
