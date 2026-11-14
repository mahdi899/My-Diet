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
        return array_map($this->view(...), $this->db->table('food_catalog')->orderBy('slug')->get()->all());
    }

    public function get(string $slug): ?array
    {
        $row = $this->db->table('food_catalog')->where('slug', $slug)->first();

        return $row ? $this->view($row) : null;
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
            $this->db->statement('insert into identity_mutexes(lock_key) values(?) as incoming on duplicate key update lock_key=incoming.lock_key', [hash('sha256', 'food:catalog')]);

            return $work();
        });
    }
}
