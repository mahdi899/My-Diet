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
            $exists = $this->db->selectOne('select count(*) as n from information_schema.statistics where table_schema=database() and table_name=? and index_name=?', [$index['table'], $index['name']]);
            if ((int) $exists->n === 0) {
                $this->db->unprepared($index['sql']);
            }
        }
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
}
