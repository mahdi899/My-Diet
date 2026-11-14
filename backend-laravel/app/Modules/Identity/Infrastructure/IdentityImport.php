<?php

namespace App\Modules\Identity\Infrastructure;

use DateTimeImmutable;
use DateTimeZone;
use Illuminate\Database\ConnectionInterface;
use RuntimeException;
use Throwable;

/** Rehearsal importer for Identity only. The source transaction is always read-only. */
final class IdentityImport
{
    public const TABLES = [
        'users' => ['id'],
        'specialist_profiles' => ['user_id'],
        'admin_credentials' => ['user_id'],
        'specialist_credentials' => ['user_id'],
        'wallets' => ['user_id'],
        'conversations' => ['id'],
        'conversation_participants' => ['conversation_id', 'user_id'],
        'otp_challenges' => ['id'],
        'sessions' => ['id'],
        'refresh_tokens' => ['id'],
        'staff_totp' => ['user_id'],
        'totp_challenges' => ['id'],
        'user_personal_details' => ['user_id'],
    ];

    public function run(ConnectionInterface $source, ConnectionInterface $target, bool $execute = false): array
    {
        if ($source->getDriverName() !== 'pgsql' || $target->getDriverName() !== 'mysql') {
            throw new RuntimeException('Identity rehearsal requires a PostgreSQL source and a MySQL destination.');
        }
        if ($source->transactionLevel() !== 0 || $target->transactionLevel() !== 0) {
            throw new RuntimeException('The rehearsal importer requires dedicated connections.');
        }
        $source->beginTransaction();
        $locked = false;
        $targetStarted = false;
        try {
            $source->statement('set transaction isolation level repeatable read read only');
            $locked = (bool) $target->selectOne("select get_lock('sabzine:identity-import',0) as acquired")->acquired;
            if (! $locked) {
                throw new RuntimeException('An identity import is already running.');
            }
            foreach (array_keys(self::TABLES) as $table) {
                if ($target->table($table)->exists()) {
                    throw new RuntimeException('Identity import requires an empty destination: '.$table);
                }
            }
            if ($source->table('conversations')->whereNotNull('request_id')->exists()) {
                throw new RuntimeException('Plan-linked conversations require the Plans schema and coordinated full-data importer. Identity-only import is blocked.');
            }
            $target->beginTransaction();
            $targetStarted = true;
            $report = [];
            foreach (self::TABLES as $table => $primary) {
                $sourceColumns = array_map(fn ($r) => $r->column_name, $source->select(
                    "select column_name from information_schema.columns where table_schema='public' and table_name=? order by ordinal_position", [$table]));
                $metadata = [];
                foreach ($target->select('select column_name as column_name,data_type as data_type,character_maximum_length as character_maximum_length from information_schema.columns where table_schema=database() and table_name=?', [$table]) as $column) {
                    $metadata[$column->column_name] = $column;
                }
                if (! $sourceColumns || array_diff($sourceColumns, array_keys($metadata))) {
                    throw new RuntimeException('Source/destination columns require reconciliation: '.$table);
                }
                $digest = hash_init('sha256');
                $count = 0;
                foreach ($this->rows($source, $table, $sourceColumns, $primary) as $row) {
                    $normalized = $this->normalize($row, $metadata);
                    hash_update($digest, $this->canonical($normalized, $sourceColumns));
                    $count++;
                    if ($execute) {
                        $insert = $normalized;
                        if ($table === 'refresh_tokens') {
                            $insert['parent_id'] = null;
                        }
                        $target->table($table)->insert($insert);
                    }
                }
                if ($execute && $table === 'refresh_tokens') {
                    foreach ($this->rows($source, $table, ['id', 'parent_id'], $primary) as $row) {
                        if ($row['parent_id'] !== null) {
                            $target->table($table)->where('id', $row['id'])->update(['parent_id' => $row['parent_id']]);
                        }
                    }
                }
                $checksum = hash_final($digest);
                if ($execute) {
                    $actual = hash_init('sha256');
                    foreach ($this->targetRows($target, $table, $sourceColumns, $primary) as $row) {
                        hash_update($actual, $this->canonical($this->normalize($row, $metadata), $sourceColumns));
                    }
                    if (! hash_equals($checksum, hash_final($actual)) || $target->table($table)->count() !== $count) {
                        throw new RuntimeException('Identity copy verification failed: '.$table);
                    }
                }
                $report[$table] = ['rows' => $count, 'sha256' => $checksum];
            }
            if ($execute) {
                $target->commit();
            } else {
                $target->rollBack();
            }

            return ['scope' => 'identity-rehearsal-only', 'executed' => $execute, 'tables' => $report];
        } catch (Throwable $error) {
            if ($targetStarted && $target->transactionLevel() > 0) {
                $target->rollBack();
            }
            throw $error;
        } finally {
            $source->rollBack();
            if ($locked) {
                $target->select("select release_lock('sabzine:identity-import')");
            }
        }
    }

    private function rows(ConnectionInterface $source, string $table, array $columns, array $primary): \Generator
    {
        $allowed = array_keys(self::TABLES);
        if (! in_array($table, $allowed, true)) {
            throw new RuntimeException('Unsupported identity table');
        }
        foreach ([...$columns, ...$primary] as $column) {
            if (! preg_match('/^[a-z_][a-z0-9_]*$/D', $column)) {
                throw new RuntimeException('Invalid source column');
            }
        }
        $cursor = 'identity_import_cursor';
        $source->statement('declare '.$cursor.' no scroll cursor for select '.implode(',', $columns).' from '.$table.' order by '.implode(',', $primary));
        try {
            do {
                $batch = $source->select('fetch forward 200 from '.$cursor);
                foreach ($batch as $row) {
                    yield (array) $row;
                }
            } while ($batch);
        } finally {
            $source->statement('close '.$cursor);
        }
    }

    private function targetRows(ConnectionInterface $target, string $table, array $columns, array $primary): \Generator
    {
        $last = null;
        do {
            $query = $target->table($table)->select($columns)->limit(200);
            foreach ($primary as $column) {
                $query->orderBy($column);
            }
            if ($last !== null) {
                $query->whereRaw('('.implode(',', $primary).') > ('.implode(',', array_fill(0, count($primary), '?')).')', $last);
            }
            $batch = $query->get();
            foreach ($batch as $row) {
                $row = (array) $row;
                $last = array_map(fn ($key) => $row[$key], $primary);
                yield $row;
            }
        } while ($batch->count() === 200);
    }

    private function normalize(array $row, array $metadata): array
    {
        foreach ($row as $name => &$value) {
            if ($value === null) {
                continue;
            }
            $column = $metadata[$name];
            if (in_array($column->data_type, ['datetime', 'timestamp'], true)) {
                if (! is_string($value) || str_contains($value, 'infinity')) {
                    throw new RuntimeException('Unrepresentable source timestamp: '.$name);
                }
                $value = (new DateTimeImmutable($value, new DateTimeZone('UTC')))->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s.u');
            } elseif (is_bool($value)) {
                $value = $value ? '1' : '0';
            } else {
                $value = (string) $value;
            }
            if ($column->character_maximum_length !== null && mb_strlen($value, 'UTF-8') > $column->character_maximum_length) {
                throw new RuntimeException('Source text exceeds target capacity: '.$name);
            }
        }

        return $row;
    }

    private function canonical(array $row, array $columns): string
    {
        $values = [];
        foreach ($columns as $column) {
            $value = $row[$column];
            $values[] = $value;
        }

        return json_encode($values, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR)."\n";
    }
}
