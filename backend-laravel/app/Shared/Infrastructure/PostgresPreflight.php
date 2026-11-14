<?php

namespace App\Shared\Infrastructure;

use Illuminate\Database\ConnectionInterface;
use RuntimeException;

final class PostgresPreflight
{
    public function inspect(ConnectionInterface $source, ConnectionInterface $target): array
    {
        if ($source->getDriverName() !== 'pgsql' || $target->getDriverName() !== 'mysql') {
            throw new RuntimeException('Expected PostgreSQL source and MySQL destination');
        }
        $source->beginTransaction();
        try {
            $source->statement('set transaction isolation level repeatable read read only');
            $sourceTables = array_map(fn ($r) => $r->table_name, $source->select("select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE' and table_name<>'pgmigrations' order by table_name"));
            $targetTables = array_map(fn ($r) => $r->table_name, $target->select("select table_name as table_name from information_schema.tables where table_schema=database() and table_type='BASE TABLE' order by table_name"));
            $columns = array_map(fn ($r) => (array) $r, $source->select("select table_name,column_name,data_type,udt_name from information_schema.columns where table_schema='public' and (data_type in ('ARRAY','jsonb','timestamp with time zone','uuid','bytea') or udt_name in ('vector','tsvector')) order by table_name,ordinal_position"));
            $triggers = array_map(fn ($r) => (array) $r, $source->select("select event_object_table as table_name,trigger_name,event_manipulation as event from information_schema.triggers where trigger_schema='public' order by event_object_table,trigger_name,event_manipulation"));
            $partial = array_map(fn ($r) => (array) $r, $source->select("select tablename as table_name,indexname as index_name from pg_indexes where schemaname='public' and indexdef ilike '% WHERE %' order by tablename,indexname"));
            $functions = array_map(fn ($r) => $r->routine_name, $source->select("select distinct routine_name from information_schema.routines where routine_schema='public' order by routine_name"));

            return [
                'sourceEngine' => 'PostgreSQL', 'targetEngine' => 'MySQL 8.4 LTS (provisional)',
                'sourceTableCount' => count($sourceTables),
                'targetTablesPresent' => array_values(array_intersect($sourceTables, $targetTables)),
                'missingTargetTables' => array_values(array_diff($sourceTables, $targetTables)),
                'columnsRequiringExplicitConversion' => $columns,
                'triggersRequiringBehavioralParity' => $triggers,
                'partialIndexesRequiringReplacement' => $partial,
                'sourceFunctionsRequiringReview' => $functions,
                'readyForFullDataMigration' => false,
            ];
        } finally {
            $source->rollBack();
        }
    }
}
