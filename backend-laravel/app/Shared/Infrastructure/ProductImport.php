<?php

namespace App\Shared\Infrastructure;

use DateTimeImmutable;
use DateTimeZone;
use Illuminate\Database\ConnectionInterface;
use RuntimeException;
use Throwable;

/** Offline rehearsal: one read-only PostgreSQL snapshot, one verified MySQL transaction. */
final class ProductImport
{
    public function run(ConnectionInterface $source, ConnectionInterface $target, bool $execute = false): array
    {
        if ($source->getDriverName() !== 'pgsql' || $target->getDriverName() !== 'mysql' || $source->transactionLevel() !== 0 || $target->transactionLevel() !== 0) {
            throw new RuntimeException('Product import requires dedicated PostgreSQL and MySQL connections without an existing transaction.');
        }
        $catalog = json_decode(file_get_contents(base_path('contracts/postgres-schema.json')), true, 512, JSON_THROW_ON_ERROR)['tables'];
        $source->beginTransaction();
        $locked = false;
        try {
            $source->statement('set transaction isolation level repeatable read read only');
            $locked = (bool) $target->selectOne("select get_lock('sabzine:product-import',0) as acquired")->acquired;
            if (! $locked) {
                throw new RuntimeException('Another product import is running.');
            }
            $actual = array_map(fn ($r) => $r->name, $source->select("select tablename as name from pg_tables where schemaname='public' and tablename<>'pgmigrations' order by tablename"));
            if ($actual !== array_column($catalog, 'name')) {
                throw new RuntimeException('Source table inventory differs from the reviewed schema.');
            }
            $metadata = [];
            foreach ($catalog as $table) {
                $name = $table['name'];
                $columns = $source->select('select a.attname as name,format_type(a.atttypid,a.atttypmod) as type from pg_attribute a where a.attrelid=?::regclass and a.attnum>0 and not a.attisdropped order by a.attnum', [$name]);
                if (array_map(fn ($r) => [$r->name, $r->type], $columns) !== array_map(fn ($r) => [$r['name'], $r['type']], $table['columns'])) {
                    throw new RuntimeException('Source column types differ from the reviewed schema: '.$name);
                }
                $metadata[$name] = array_column(array_map(fn ($r) => (array) $r, $target->select('select column_name as name,data_type as type,character_maximum_length as capacity,numeric_precision as precision_value,numeric_scale as scale_value,extra from information_schema.columns where table_schema=database() and table_name=?', [$name])), null, 'name');
                if (array_diff(array_column($table['columns'], 'name'), array_keys($metadata[$name]))) {
                    throw new RuntimeException('MySQL columns are missing: '.$name);
                }
                if ($target->table($name)->exists()) {
                    throw new RuntimeException('Product import requires an empty destination: '.$name.'. Initialize a new rehearsal database with MIGRATION_SKIP_PRODUCT_SEEDS=true.');
                }
            }
            $target->beginTransaction();
            $target->statement('set @sabzine_import=1');
            $target->statement('set foreign_key_checks=0');
            $report = [];
            foreach ($catalog as $table) {
                $name = $table['name'];
                $columns = array_column($table['columns'], 'name');
                $primary = $this->primary($table);
                $hash = hash_init('sha256');
                $count = 0;
                foreach ($this->sourceRows($source, $table, $primary) as $row) {
                    $row = $this->normalize($row, $metadata[$name], $target);
                    hash_update($hash, $this->canonical($row, $columns));
                    if ($execute) {
                        $target->table($name)->insert($row);
                    }
                    $count++;
                }
                $report[$name] = ['rows' => $count, 'sha256' => hash_final($hash)];
            }
            if ($execute) {
                $this->verifyRelations($target, $catalog);
                foreach ($catalog as $table) {
                    $name = $table['name'];
                    $columns = array_column($table['columns'], 'name');
                    $hash = hash_init('sha256');
                    $count = 0;
                    foreach ($this->targetRows($target, $name, $columns, $this->primary($table)) as $row) {
                        hash_update($hash, $this->canonical($this->normalize($row, $metadata[$name], $target), $columns));
                        $count++;
                    }
                    if ($count !== $report[$name]['rows'] || ! hash_equals(hash_final($hash), $report[$name]['sha256'])) {
                        throw new RuntimeException('Count/checksum reconciliation failed: '.$name);
                    }
                }
                $target->commit();
            } else {
                $target->rollBack();
            }

            return ['scope' => 'full-product-rehearsal', 'executed' => $execute, 'sourceReadOnly' => true, 'tables' => $report,
                'excluded' => ['pgmigrations', 'pg-boss operational queue schema', 'external analytics database', 'filesystem media'], 'readyForProductionCutover' => false];
        } catch (Throwable $error) {
            if ($target->transactionLevel() > 0) {
                $target->rollBack();
            }
            throw $error;
        } finally {
            $source->rollBack();
            if ($locked) {
                $target->statement('set @sabzine_import=0');
                $target->statement('set foreign_key_checks=1');
                $target->select("select release_lock('sabzine:product-import')");
            }
        }
    }

    private function primary(array $table): array
    {
        foreach ($table['constraints'] as $constraint) {
            if ($constraint['type'] === 'p' && preg_match('/\(([^)]+)\)/', $constraint['definition'], $match)) {
                return array_map(fn ($key) => trim($key, ' "'), explode(',', $match[1]));
            }
        }
        throw new RuntimeException('A stable primary key is required: '.$table['name']);
    }

    private function sourceRows(ConnectionInterface $source, array $table, array $primary): \Generator
    {
        $columns = array_map(fn ($column) => match (true) {
            in_array($column['type'], ['text[]', 'jsonb'], true) => 'to_json("'.$column['name'].'")::text as "'.$column['name'].'"',
            $column['type'] === 'bytea' => 'encode("'.$column['name'].'",\'hex\') as "'.$column['name'].'"',
            default => '"'.$column['name'].'"',
        }, $table['columns']);
        $order = array_map(function ($key) use ($table): string {
            $column = array_values(array_filter($table['columns'], fn ($c) => $c['name'] === $key))[0];

            return '"'.$key.'"'.($column['type'] === 'text' ? ' collate "C"' : '');
        }, $primary);
        $source->statement('declare product_import_cursor no scroll cursor for select '.implode(',', $columns).' from "'.$table['name'].'" order by '.implode(',', $order));
        try {
            do {
                $batch = $source->select('fetch forward 200 from product_import_cursor');
                foreach ($batch as $row) {
                    $row = (array) $row;
                    foreach ($table['columns'] as $column) {
                        if ($column['type'] === 'bytea' && $row[$column['name']] !== null) {
                            $row[$column['name']] = hex2bin($row[$column['name']]);
                        }
                    }
                    yield $row;
                }
            } while ($batch);
        } finally {
            $source->statement('close product_import_cursor');
        }
    }

    private function targetRows(ConnectionInterface $target, string $table, array $columns, array $primary): \Generator
    {
        $last = null;
        do {
            $query = $target->table($table)->select($columns)->limit(200);
            foreach ($primary as $key) {
                $query->orderBy($key);
            }
            if ($last !== null) {
                $query->whereRaw('('.implode(',', array_map(fn ($key) => '`'.$key.'`', $primary)).') > ('.implode(',', array_fill(0, count($primary), '?')).')', $last);
            }
            $batch = $query->get();
            foreach ($batch as $row) {
                $row = (array) $row;
                $last = array_map(fn ($key) => $row[$key], $primary);
                yield $row;
            }
        } while (count($batch) === 200);
    }

    private function normalize(array $row, array $metadata, ConnectionInterface $target): array
    {
        foreach ($row as $key => &$value) {
            if ($value === null) {
                continue;
            }
            $column = $metadata[$key];
            if ($column['type'] === 'json') {
                $value = $target->selectOne('select cast(? as json) as normalized', [(string) $value])->normalized;
            } elseif (in_array($column['type'], ['datetime', 'timestamp', 'date'], true)) {
                if (! is_string($value) || str_contains($value, 'infinity')) {
                    throw new RuntimeException('Unrepresentable timestamp: '.$key);
                }
                $date = (new DateTimeImmutable($value, new DateTimeZone('UTC')))->setTimezone(new DateTimeZone('UTC'));
                if ((int) $date->format('Y') < 1000 || (int) $date->format('Y') > 9999) {
                    throw new RuntimeException('Timestamp exceeds MySQL range: '.$key);
                }
                $value = $date->format($column['type'] === 'date' ? 'Y-m-d' : 'Y-m-d H:i:s.u');
            } elseif (is_bool($value)) {
                $value = $value ? '1' : '0';
            } elseif (is_resource($value)) {
                $value = stream_get_contents($value);
            } else {
                $value = (string) $value;
            }
            if ($column['type'] === 'decimal') {
                $negative = str_starts_with($value, '-');
                $parts = explode('.', ltrim($value, '+-'), 2);
                $integer = ltrim($parts[0], '0');
                $fraction = rtrim($parts[1] ?? '', '0');
                if (! preg_match('/^[+-]?[0-9]+(?:\.[0-9]+)?$/D', $value) || strlen($fraction) > $column['scale_value'] || strlen($integer) > $column['precision_value'] - $column['scale_value']) {
                    throw new RuntimeException('Decimal cannot be represented without loss: '.$key);
                }
                $value = ($negative && ($integer !== '' || $fraction !== '') ? '-' : '').($integer === '' ? '0' : $integer).($fraction === '' ? '' : '.'.$fraction);
            }
            if ($column['capacity'] !== null && ! in_array($column['type'], ['blob', 'longblob', 'mediumblob', 'tinyblob'], true) && mb_strlen($value, 'UTF-8') > $column['capacity']) {
                throw new RuntimeException('Source text exceeds target capacity: '.$key);
            }
        }

        return $row;
    }

    private function canonical(array $row, array $columns): string
    {
        return json_encode(array_map(fn ($key) => $row[$key] === null ? null : base64_encode((string) $row[$key]), $columns), JSON_THROW_ON_ERROR)."\n";
    }

    private function verifyRelations(ConnectionInterface $target, array $catalog): void
    {
        $relations = $target->select('select table_name as table_name,column_name as column_name,referenced_table_name as referenced_table_name,referenced_column_name as referenced_column_name,constraint_name as constraint_name,ordinal_position as ordinal_position from information_schema.key_column_usage where table_schema=database() and referenced_table_name is not null order by table_name,constraint_name,ordinal_position');
        $groups = [];
        foreach ($relations as $relation) {
            $groups[$relation->table_name.'.'.$relation->constraint_name][] = $relation;
        }
        foreach ($groups as $name => $columns) {
            $first = $columns[0];
            $join = implode(' and ', array_map(fn ($c) => 'child.`'.$c->column_name.'`=parent.`'.$c->referenced_column_name.'`', $columns));
            $present = implode(' and ', array_map(fn ($c) => 'child.`'.$c->column_name.'` is not null', $columns));
            if ($target->selectOne('select 1 as invalid from `'.$first->table_name.'` child left join `'.$first->referenced_table_name.'` parent on '.$join.' where '.$present.' and parent.`'.$first->referenced_column_name.'` is null limit 1')) {
                throw new RuntimeException('Foreign key reconciliation failed: '.$name);
            }
        }
        if ($target->selectOne('select 1 as invalid from refresh_tokens t join sessions s on s.id=t.session_id where t.expires_at<>s.absolute_expires_at limit 1')) {
            throw new RuntimeException('Refresh token/session expiry reconciliation failed.');
        }
    }
}
