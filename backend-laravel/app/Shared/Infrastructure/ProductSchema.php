<?php

namespace App\Shared\Infrastructure;

use DateTimeImmutable;
use DateTimeZone;
use Illuminate\Database\ConnectionInterface;
use RuntimeException;

final class ProductSchema
{
    public function __construct(private ConnectionInterface $db) {}

    public function up(): void
    {
        $schema = json_decode(file_get_contents(base_path('contracts/mysql-schema.json')), true, 512, JSON_THROW_ON_ERROR);
        foreach ($schema['tables'] as $table) {
            if (! $this->db->getSchemaBuilder()->hasTable($table['name'])) {
                $this->db->unprepared($table['sql']);
            }
        }
        foreach ($schema['constraints'] as $constraint) {
            $exists = $this->db->selectOne('select count(*) as n from information_schema.table_constraints where constraint_schema=database() and table_name=? and constraint_name=?', [$constraint['table'], $constraint['name']]);
            if ((int) $exists->n === 0) {
                $this->db->unprepared($constraint['sql']);
            }
        }
        foreach ($schema['indexes'] as $index) {
            $this->index($index['table'], $index['name'], $index['sql']);
        }
        $this->performance();
        if (! config('runtime.skip_product_seeds')) {
            $this->seed($schema['seeds']);
        }
        (new ProductIntegrity($this->db))->install();
    }

    private function seed(array $seeds): void
    {
        $source = json_decode(file_get_contents(base_path('contracts/postgres-schema.json')), true, 512, JSON_THROW_ON_ERROR);
        $metadata = array_column($source['tables'], null, 'name');
        $visited = [];
        $visit = function (string $table) use (&$visit, &$visited, $metadata, $seeds): void {
            if (isset($visited[$table])) {
                return;
            }
            $visited[$table] = true;
            foreach ($metadata[$table]['constraints'] as $constraint) {
                if ($constraint['type'] === 'f' && preg_match('/REFERENCES ([a-z_]+)\\(/', $constraint['definition'], $match) && isset($seeds[$match[1]])) {
                    $visit($match[1]);
                }
            }
            $primary = array_values(array_filter($metadata[$table]['constraints'], fn ($c) => $c['type'] === 'p'))[0]['definition'];
            preg_match('/\\(([^)]+)\\)/', $primary, $match);
            $keys = array_map(fn ($name) => trim($name, ' "'), explode(',', $match[1]));
            foreach ($seeds[$table] as $row) {
                $where = array_intersect_key($row, array_flip($keys));
                if ($this->db->table($table)->where($where)->exists()) {
                    continue;
                }
                foreach ($metadata[$table]['columns'] as $column) {
                    $name = $column['name'];
                    $value = $row[$name] ?? null;
                    if (in_array($column['type'], ['jsonb', 'text[]'], true) && ($value !== null || $column['required'])) {
                        $row[$name] = json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
                    } elseif ($column['type'] === 'timestamp with time zone' && $value !== null) {
                        $row[$name] = (new DateTimeImmutable($value))->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s.u');
                    }
                }
                $this->db->table($table)->insert($row);
            }
        };
        $this->db->transaction(function () use ($seeds, $visit): void {
            foreach (array_keys($seeds) as $table) {
                $visit($table);
            }
        });
    }

    public function down(): void
    {
        throw new RuntimeException('Product schema rollback requires a reviewed data restore; destructive table drops are not automatic.');
    }

    private function index(string $table, string $name, string $sql): void
    {
        $exists = $this->db->selectOne('select count(*) as n from information_schema.statistics where table_schema=database() and table_name=? and index_name=?', [$table, $name]);
        if ((int) $exists->n === 0) {
            $this->db->unprepared($sql);
        }
    }

    /** MySQL replacements for the eight PostgreSQL indexes that were still pending. */
    private function performance(): void
    {
        if ($this->db->selectOne("select count(*) as n from information_schema.columns where table_schema=database() and table_name='meal_log_history' and column_name='scheduled_date_key'")->n === 0) {
            $this->db->unprepared('alter table meal_log_history add column scheduled_date_key char(10) generated always as (json_unquote(json_extract(`current`, \'$.scheduled_date\'))) stored');
        }
        if ($this->db->selectOne("select count(*) as n from information_schema.columns where table_schema=database() and table_name='food_catalog' and column_name='name_fa_search'")->n === 0) {
            $this->db->unprepared('alter table food_catalog add column name_fa_search varchar(255) character set utf8mb4 collate utf8mb4_0900_ai_ci generated always as (left(name_fa, 255)) stored');
        }
        $this->index('food_catalog', 'food_catalog_allergens', "create index food_catalog_allergens on food_catalog ((cast(allergens->'$' as char(64) array)))");
        $this->index('food_catalog', 'food_catalog_meals', "create index food_catalog_meals on food_catalog ((cast(meal_types->'$' as char(32) array)))");
        $this->index('food_catalog', 'food_catalog_tags', "create index food_catalog_tags on food_catalog ((cast(tags->'$' as char(64) array)))");
        $this->index('food_catalog', 'food_catalog_search', 'create fulltext index food_catalog_search on food_catalog (name_fa_search)');
        $this->index('meal_log_history', 'meal_history_owner_date', 'create index meal_history_owner_date on meal_log_history (user_id, scheduled_date_key, id)');
        $this->index('nutrition_profiles', 'nutrition_profiles_allergens', "create index nutrition_profiles_allergens on nutrition_profiles ((cast(allergens->'$' as char(64) array)))");
        $this->index('nutrition_profiles', 'nutrition_profiles_conditions', "create index nutrition_profiles_conditions on nutrition_profiles ((cast(conditions->'$' as char(64) array)))");
        $this->index('nutrition_profiles', 'nutrition_profiles_flags', "create index nutrition_profiles_flags on nutrition_profiles ((cast(risk_flags->'$' as char(64) array)))");
    }
}
