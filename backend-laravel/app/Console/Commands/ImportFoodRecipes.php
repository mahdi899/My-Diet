<?php

namespace App\Console\Commands;

use App\Modules\Food\Infrastructure\MarkdownRecipes;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

#[Signature('food:import-recipes {file} {--execute : Replace the local catalog after validation and backup}')]
#[Description('Validate and import the 998 Markdown recipes with shared ingredient references')]
class ImportFoodRecipes extends Command
{
    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $path = realpath($this->argument('file'));
        if (! $path || ! is_readable($path)) {
            throw new \RuntimeException('Recipe file is not readable');
        }
        $recipes = app(MarkdownRecipes::class)->parse(file_get_contents($path));
        $ingredients = [];
        foreach ($recipes as $recipe) {
            foreach ($recipe['ingredients'] as $ingredient) {
                $entry = ['code' => $ingredient['code'], 'name_fa' => $ingredient['name'], 'category' => $ingredient['category'], 'nutrition_reference' => $ingredient['reference']];
                if (isset($ingredients[$entry['code']]) && $ingredients[$entry['code']] !== $entry) {
                    throw new \RuntimeException('Conflicting ingredient '.$entry['code']);
                }
                $ingredients[$entry['code']] = $entry;
            }
        }
        $this->info(count($recipes).' recipes; '.count($ingredients).' shared ingredients validated.');
        if (! $this->option('execute')) {
            return self::SUCCESS;
        }
        if (! app()->environment('local')) {
            throw new \RuntimeException('This replacement command is local-only');
        }
        $db = app(ConnectionInterface::class);
        $json = fn ($value): string => json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
        $backup = 'food-backups/'.gmdate('Ymd-His').'-'.bin2hex(random_bytes(4)).'.json';
        $db->transaction(function () use ($db, $recipes, $ingredients, $json, $backup): void {
            $db->table('food_catalog')->lockForUpdate()->get();
            $snapshot = [];
            foreach (['food_catalog', 'food_ingredients', 'food_recipe_details', 'food_recipe_ingredients'] as $table) {
                $snapshot[$table] = $db->table($table)->get()->map(function ($row) {
                    $row = (array) $row;
                    if (isset($row['image_bytes'])) {
                        $row['image_bytes'] = base64_encode($row['image_bytes']);
                    }

                    return $row;
                })->all();
            }
            if (! Storage::disk('local')->put($backup, $json($snapshot))) {
                throw new \RuntimeException('Backup failed');
            }
            $db->table('food_recipe_ingredients')->delete();
            $db->table('food_recipe_details')->delete();
            $db->table('food_catalog')->delete();
            $db->table('food_ingredients')->delete();
            foreach ($ingredients as $ingredient) {
                $db->table('food_ingredients')->insert($ingredient);
            }
            foreach ($recipes as $recipe) {
                $id = Str::uuid()->toString();
                $food = $recipe['food'];
                foreach (['meal_types', 'allergens', 'tags', 'regions', 'seasons'] as $key) {
                    $food[$key] = $json($food[$key]);
                }
                $food['ingredients'] = $json(array_map(fn ($i) => ['name' => $i['name'], 'quantity' => $i['quantity'] / $recipe['servings'], 'unit' => $i['unit'], 'category' => $i['category']], $recipe['ingredients']));
                $db->table('food_catalog')->insert(['id' => $id, ...$food]);
                $db->table('food_recipe_details')->insert(['food_id' => $id, 'source_code' => $recipe['code'], 'servings' => $recipe['servings'], 'cook_minutes' => $recipe['cook_minutes'], 'instructions' => $recipe['instructions'], 'metadata' => $json($recipe['fields']), 'source_markdown' => $recipe['markdown']]);
                foreach ($recipe['ingredients'] as $position => $i) {
                    $db->table('food_recipe_ingredients')->insert(['food_id' => $id, 'ingredient_code' => $i['code'], 'position' => $position, 'quantity' => $i['quantity'], 'unit' => $i['unit']]);
                }
            }
            if ($db->table('food_catalog')->count() !== 998) {
                throw new \RuntimeException('Import count mismatch');
            }
        });
        $this->info('Imported 998 foods without images. Backup: '.Storage::disk('local')->path($backup));

        return self::SUCCESS;
    }
}
