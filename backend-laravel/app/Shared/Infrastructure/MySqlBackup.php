<?php

namespace App\Shared\Infrastructure;

use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Facades\DB;
use RuntimeException;
use Symfony\Component\Process\Process;

final class MySqlBackup
{
    public function rehearse(string $url): array
    {
        $parts = parse_url($url);
        $database = ltrim($parts['path'] ?? '', '/');
        if (! preg_match('/^[a-zA-Z0-9_]+$/D', $database) || (! str_contains($database, '_test') && ! str_contains($database, '_rehearsal'))) {
            throw new RuntimeException('Only an explicitly named disposable test or rehearsal database is permitted.');
        }
        $sourceName = 'backup-source-'.bin2hex(random_bytes(5));
        $restoredName = 'backup-target-'.bin2hex(random_bytes(5));
        $restored = $database.'_restore_'.bin2hex(random_bytes(4));
        if (strlen($restored) > 64) {
            throw new RuntimeException('Database name is too long.');
        }
        $settings = ['driver' => 'mysql', 'url' => $url, 'charset' => 'utf8mb4', 'collation' => 'utf8mb4_0900_bin', 'strict' => true, 'timezone' => '+00:00', 'prefix' => ''];
        config(['database.connections.'.$sourceName => $settings]);
        $source = DB::connection($sourceName);
        $snapshot = $this->fingerprints($source);
        $directory = sys_get_temp_dir().DIRECTORY_SEPARATOR.'sabzine-backup-'.bin2hex(random_bytes(8));
        if (! mkdir($directory, 0700)) {
            throw new RuntimeException('Cannot create private backup directory.');
        }
        $options = $directory.DIRECTORY_SEPARATOR.'client.cnf';
        $dump = $directory.DIRECTORY_SEPARATOR.'database.sql';
        $escape = fn ($s) => str_replace(['\\', "\n", "\r", '"'], ['\\\\', '\\n', '\\r', '\\"'], (string) $s);
        file_put_contents($options, "[client]\nhost=\"".$escape($parts['host'] ?? '127.0.0.1')."\"\nport=".(int) ($parts['port'] ?? 3306)."\nuser=\"".$escape(rawurldecode($parts['user'] ?? 'root'))."\"\npassword=\"".$escape(rawurldecode($parts['pass'] ?? ''))."\"\n");
        chmod($options, 0600);
        $created = false;
        try {
            $home = rtrim((string) env('MYSQL_HOME', dirname(base_path()).'/.tools/mysql84/mysql-8.4.13-winx64'), '/\\');
            $binary = fn ($name) => $home.'/bin/'.$name.(PHP_OS_FAMILY === 'Windows' ? '.exe' : '');
            if (! is_file($binary('mysqldump')) || ! is_file($binary('mysql'))) {
                throw new RuntimeException('MySQL client binaries are required; no rehearsal was performed.');
            }
            $this->run([$binary('mysqldump'), '--defaults-extra-file='.$options, '--single-transaction', '--routines', '--triggers', '--events', '--hex-blob', '--set-gtid-purged=OFF', '--no-tablespaces', '--result-file='.$dump, $database]);
            $source->statement('create database '.$restored.' character set utf8mb4 collate utf8mb4_0900_bin');
            $created = true;
            $input = fopen($dump, 'rb');
            try {
                $this->run([$binary('mysql'), '--defaults-extra-file='.$options, $restored], $input);
            } finally {
                fclose($input);
            }
            $settings['url'] = preg_replace('~/[^/]+$~', '/'.$restored, $url);
            config(['database.connections.'.$restoredName => $settings]);
            $target = DB::connection($restoredName);
            $actual = $this->fingerprints($target);
            if ($snapshot !== $actual) {
                throw new RuntimeException('Restored row counts/checksums differ from the source.');
            }
            $triggers = (int) $source->selectOne('select count(*) as n from information_schema.triggers where trigger_schema=?', [$database])->n;
            $restoredTriggers = (int) $target->selectOne('select count(*) as n from information_schema.triggers where trigger_schema=?', [$restored])->n;
            if ($triggers !== $restoredTriggers) {
                throw new RuntimeException('Restored triggers differ.');
            }

            return ['database' => $database, 'dump' => 'verified', 'restored' => true, 'tables' => count($snapshot), 'triggers' => $triggers, 'sha256' => hash_file('sha256', $dump), 'sourceChanged' => false];
        } finally {
            DB::purge($restoredName);
            if ($created) {
                $source->statement('drop database '.$restored);
            }
            DB::purge($sourceName);
            foreach ([$options, $dump] as $file) {
                if (is_file($file)) {
                    unlink($file);
                }
            }
            rmdir($directory);
        }
    }

    private function fingerprints(ConnectionInterface $db): array
    {
        $tables = $db->select("select table_name from information_schema.tables where table_schema=database() and table_type='BASE TABLE' order by table_name");
        $result = [];
        foreach ($tables as $table) {
            $name = $table->TABLE_NAME ?? $table->table_name;
            $hashes = [];
            foreach ($db->cursor('select * from '.chr(96).str_replace(chr(96), chr(96).chr(96), $name).chr(96)) as $row) {
                $hashes[] = hash('sha256', serialize((array) $row));
            }
            sort($hashes, SORT_STRING);
            $result[$name] = ['count' => count($hashes), 'sha256' => hash('sha256', implode('', $hashes))];
        }

        return $result;
    }

    private function run(array $arguments, mixed $input = null): void
    {
        $process = new Process($arguments, null, null, $input, 120);
        $process->run();
        if (! $process->isSuccessful()) {
            throw new RuntimeException('MySQL backup/restore process failed (exit '.$process->getExitCode().').');
        }
    }
}
