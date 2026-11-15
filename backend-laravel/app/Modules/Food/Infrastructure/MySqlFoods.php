<?php

namespace App\Modules\Food\Infrastructure;

use App\Modules\Food\Application\FoodStore;
use App\Shared\Domain\LegacyCrypto;
use Illuminate\Database\ConnectionInterface;

final class MySqlFoods implements FoodStore
{
    public function __construct(private ConnectionInterface $db) {}

    private function json(mixed $value): string
    {
        return json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    }

    private function view(object $row): array
    {
        $food = [];
        $columns = ['id', 'slug', 'name_fa', 'category', 'meal_types', 'serving_label', 'serving_g', 'kcal', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g', 'allergens', 'tags', 'regions', 'seasons', 'cost_tier', 'prep_minutes', 'ingredients', 'image', 'active', 'source', 'nutrition'];
        foreach ($columns as $column) {
            $key = lcfirst(str_replace(' ', '', ucwords(str_replace('_', ' ', $column))));
            $value = $row->$column;
            if ($value !== null && in_array($column, ['meal_types', 'allergens', 'tags', 'regions', 'seasons', 'ingredients', 'nutrition'], true)) {
                $value = json_decode($value, true, 512, JSON_THROW_ON_ERROR);
            } elseif (in_array($column, ['protein_g', 'carbs_g', 'fat_g', 'fiber_g'], true)) {
                $value = (float) $value;
            } elseif ($column === 'active') {
                $value = (bool) $value;
            }
            $food[$key] = $value;
        }

        return $food;
    }

    public function all(): array
    {
        $foods = array_map($this->view(...), $this->db->table('food_catalog')->orderBy('slug')->get()->all());
        $linked = $this->db->table('food_recipe_ingredients as r')->join('food_ingredients as i', 'i.code', '=', 'r.ingredient_code')->join('food_recipe_details as d', 'd.food_id', '=', 'r.food_id')->orderBy('r.position')->get(['r.food_id', 'i.name_fa', 'i.category', 'r.quantity', 'r.unit', 'd.servings']);
        $groups = [];
        foreach ($linked as $item) {
            $groups[$item->food_id][] = ['name' => $item->name_fa, 'quantity' => (float) $item->quantity / $item->servings, 'unit' => $item->unit, 'category' => $item->category];
        }
        foreach ($foods as &$food) {
            if (isset($groups[$food['id']])) {
                $food['ingredients'] = $groups[$food['id']];
            }
        }

        return $foods;
    }

    public function get(string $slug): ?array
    {
        $row = $this->db->table('food_catalog')->where('slug', $slug)->first();

        if (! $row) {
            return null;
        }
        $food = $this->view($row);
        $details = $this->db->table('food_recipe_details')->where('food_id', $row->id)->first();
        if ($details) {
            $food['recipe'] = ['sourceCode' => $details->source_code, 'servings' => $details->servings, 'cookMinutes' => $details->cook_minutes, 'instructions' => $details->instructions, 'metadata' => json_decode($details->metadata, true, 512, JSON_THROW_ON_ERROR), 'sourceMarkdown' => $details->source_markdown];
            $food['ingredients'] = $this->db->table('food_recipe_ingredients as r')->join('food_ingredients as i', 'i.code', '=', 'r.ingredient_code')->where('r.food_id', $row->id)->orderBy('r.position')->get()->map(fn ($i) => ['name' => $i->name_fa, 'quantity' => (float) $i->quantity / $details->servings, 'unit' => $i->unit, 'category' => $i->category])->all();
        }

        return $food;
    }

    public function put(array $food, bool $new, array $photo): void
    {
        $row = ['source' => 'admin'];
        foreach ($food as $key => $value) {
            $column = strtolower(preg_replace('/[A-Z]/', '_$0', $key));
            $row[$column] = in_array($key, ['mealTypes', 'allergens', 'tags', 'regions', 'seasons', 'ingredients', 'nutrition'], true) && $value !== null ? $this->json($value) : $value;
        }
        if ($photo['changed']) {
            $row['image_bytes'] = $photo['bytes'];
        }
        if ($new) {
            $row['id'] = LegacyCrypto::uuid();
            $this->db->table('food_catalog')->insert($row);
        } else {
            $row['updated_at'] = $this->db->raw('current_timestamp(6)');
            $this->db->table('food_catalog')->where('slug', $food['slug'])->update($row);
        }
        $id = $this->db->table('food_catalog')->where('slug', $food['slug'])->value('id');
        $details = $this->db->table('food_recipe_details')->where('food_id', $id)->first();
        if ($details) {
            $this->db->table('food_recipe_ingredients')->where('food_id', $id)->delete();
            foreach ($food['ingredients'] as $position => $ingredient) {
                $code = $this->db->table('food_ingredients')->where('name_fa', $ingredient['name'])->value('code');
                if (! $code) {
                    $code = 'ADM-'.substr(hash('sha256', $ingredient['name']), 0, 24);
                    $this->db->table('food_ingredients')->insertOrIgnore(['code' => $code, 'name_fa' => $ingredient['name'], 'category' => $ingredient['category'] ?? 'other']);
                }
                $this->db->table('food_recipe_ingredients')->insert(['food_id' => $id, 'ingredient_code' => $code, 'position' => $position, 'quantity' => $ingredient['quantity'] * $details->servings, 'unit' => $ingredient['unit']]);
            }
        }
    }

    public function activate(string $slug, bool $active): void
    {
        $this->db->table('food_catalog')->where('slug', $slug)->update(['active' => $active, 'updated_at' => $this->db->raw('current_timestamp(6)')]);
    }

    public function image(string $slug): ?string
    {
        $value = $this->db->table('food_catalog')->where('slug', $slug)->value('image_bytes');

        return is_resource($value) ? stream_get_contents($value) : $value;
    }

    public function revision(): string
    {
        $digest = hash_init('md5');
        foreach ($this->db->table('food_catalog')->orderBy('slug')->get() as $row) {
            $row = (array) $row;
            $bytes = $row['image_bytes'];
            $row['image_bytes'] = $bytes === null ? null : base64_encode(is_resource($bytes) ? stream_get_contents($bytes) : $bytes);
            hash_update($digest, $this->json($row)."\n");
        }

        return hash_final($digest);
    }

    public function replacement(string $id): ?array
    {
        $row = $this->db->table('food_catalog_replacements')->where('id', $id)->first();

        return $row ? [...(array) $row, 'previous_foods' => json_decode($row->previous_foods, true, 512, JSON_THROW_ON_ERROR)] : null;
    }

    public function replace(string $id, string $actor, array $foods, array $previous): void
    {
        $this->db->table('food_catalog_replacements')->insert(['id' => $id, 'actor_id' => $actor, 'previous_foods' => $this->json($previous), 'replacement_count' => count($foods)]);
        $this->db->table('food_catalog')->delete();
        foreach ($foods as $food) {
            $this->put([...$food, 'image' => $food['image'] ?? null, 'nutrition' => $food['nutrition'] ?? null], true, ['changed' => false]);
        }
    }

    public function audit(string $actor, string $action, array $detail): void
    {
        $this->db->table('audit_logs')->insert(['id' => LegacyCrypto::uuid(), 'actor_id' => $actor, 'action' => $action, 'target_type' => 'food_catalog', 'target_id' => null, 'detail' => $this->json((object) $detail)]);
    }

    public function transaction(\Closure $work): mixed
    {
        return $this->db->transaction(function () use ($work): mixed {
            $key = hash('sha256', 'food:catalog');
            $this->db->table('identity_mutexes')->insertOrIgnore(['lock_key' => $key]);
            $this->db->table('identity_mutexes')->where('lock_key', $key)->lockForUpdate()->first();

            return $work();
        });
    }
}
