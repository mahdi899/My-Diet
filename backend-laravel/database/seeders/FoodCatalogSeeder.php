<?php

namespace Database\Seeders;

use App\Modules\Food\Infrastructure\MarkdownRecipes;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class FoodCatalogSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $compressed = file_get_contents(database_path('seeders/data/food-recipes-998.md.gz'));
        $source = gzdecode($compressed);
        if ($source === false) {
            throw new \RuntimeException('Invalid food recipe seed archive');
        }
        $recipes = app(MarkdownRecipes::class)->parse($source);
        $db = app(ConnectionInterface::class);
        $json = fn (mixed $value): string => json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
        $db->transaction(function () use ($db, $recipes, $json): void {
            foreach ($recipes as $recipe) {
                // Never overwrite an existing food, its photos, or administrator edits.
                if ($db->table('food_catalog')->where('slug', $recipe['food']['slug'])->exists()) {
                    continue;
                }
                $id = Str::uuid()->toString();
                $food = $recipe['food'];
                $food['active'] = true;
                foreach (['meal_types', 'allergens', 'tags', 'regions', 'seasons'] as $key) {
                    $food[$key] = $json($food[$key]);
                }
                $food['ingredients'] = $json(array_map(fn (array $i): array => ['name' => $i['name'], 'quantity' => $i['quantity'] / $recipe['servings'], 'unit' => $i['unit'], 'category' => $i['category']], $recipe['ingredients']));
                $db->table('food_catalog')->insert(['id' => $id, ...$food]);
                $db->table('food_recipe_details')->insert(['food_id' => $id, 'source_code' => $recipe['code'], 'servings' => $recipe['servings'], 'cook_minutes' => $recipe['cook_minutes'], 'instructions' => $recipe['instructions'], 'metadata' => $json($recipe['fields']), 'source_markdown' => $recipe['markdown']]);
                foreach ($recipe['ingredients'] as $position => $ingredient) {
                    $db->table('food_ingredients')->insertOrIgnore(['code' => $ingredient['code'], 'name_fa' => $ingredient['name'], 'category' => $ingredient['category'], 'nutrition_reference' => $ingredient['reference']]);
                    $db->table('food_recipe_ingredients')->insert(['food_id' => $id, 'ingredient_code' => $ingredient['code'], 'position' => $position, 'quantity' => $ingredient['quantity'], 'unit' => $ingredient['unit']]);
                }
            }
        });
    }
}
