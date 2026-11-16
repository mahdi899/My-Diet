<?php

namespace App\Modules\Food\Infrastructure;

use App\Modules\Food\Application\IngredientStore;
use App\Shared\Domain\Problem;
use Illuminate\Database\ConnectionInterface;

final class MySqlIngredients implements IngredientStore
{
    public function __construct(private ConnectionInterface $db) {}

    public function update(string $code, array $input): void
    {
        $this->db->transaction(function () use ($code, $input): void {
            $previous = $this->db->table('food_ingredients')->where('code', $code)->lockForUpdate()->first();
            if (! $previous) {
                throw new Problem(404, 'not_found', 'مادهٔ اولیه پیدا نشد');
            }
            $this->db->table('food_ingredients')->where('code', $code)->update($input);
            $ids = $this->db->table('food_recipe_ingredients')->where('ingredient_code', $code)->pluck('food_id');
            foreach ($this->db->table('food_catalog')->whereIn('id', $ids)->lockForUpdate()->get() as $food) {
                $ingredients = json_decode($food->ingredients, true, 512, JSON_THROW_ON_ERROR);
                foreach ($ingredients as &$ingredient) {
                    if ($ingredient['name'] === $previous->name_fa) {
                        $ingredient['name'] = $input['name_fa'];
                        $ingredient['category'] = $input['category'];
                    }
                }
                unset($ingredient);
                $this->db->table('food_catalog')->where('id', $food->id)->update(['ingredients' => json_encode($ingredients, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR), 'updated_at' => $this->db->raw('current_timestamp(6)')]);
            }
        });
    }

    public function delete(string $code): void
    {
        $this->db->transaction(function () use ($code): void {
            if (! $this->db->table('food_ingredients')->where('code', $code)->lockForUpdate()->first()) {
                throw new Problem(404, 'not_found', 'مادهٔ اولیه پیدا نشد');
            }
            if ($this->db->table('food_recipe_ingredients')->where('ingredient_code', $code)->exists()) {
                throw new Problem(409, 'ingredient_in_use', 'این ماده در رسپی‌ها استفاده شده است؛ ابتدا آن را در غذاهای مرتبط جایگزین یا حذف کنید.');
            }
            $this->db->table('food_ingredients')->where('code', $code)->delete();
        });
    }

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
