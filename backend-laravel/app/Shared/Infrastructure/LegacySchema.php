<?php

namespace App\Shared\Infrastructure;

use Illuminate\Database\ConnectionInterface;
use RuntimeException;

/** Imports the unchanged SQL with the same history and advisory lock as node-pg-migrate. */
final class LegacySchema
{
    private const LOCK_ID = 7241865325823964;

    public function __construct(private ConnectionInterface $db) {}

    public function migrate(string $directory, bool $plan = false): array
    {
        $manifest = json_decode(file_get_contents($directory.'/manifest.json'), true, 512, JSON_THROW_ON_ERROR);
        $files = glob($directory.'/*.sql');
        sort($files, SORT_STRING);
        if (count($files) !== count($manifest)) {
            throw new RuntimeException('Legacy SQL inventory mismatch');
        }
        foreach ($files as $file) {
            if (($manifest[basename($file)] ?? '') !== hash_file('sha256', $file)) {
                throw new RuntimeException('Legacy migration checksum mismatch: '.basename($file));
            }
        }
        $locked = $this->db->selectOne('select pg_try_advisory_lock(?) as acquired', [self::LOCK_ID])->acquired;
        if (!$locked) {
            throw new RuntimeException('Another schema migration is running');
        }
        try {
            $historyExists = $this->db->selectOne("select to_regclass('public.pgmigrations') as name")->name !== null;
            if (!$historyExists && $this->db->selectOne("select to_regclass('public.users') as name")->name !== null) {
                throw new RuntimeException('Existing schema has no pgmigrations history; explicit reconciliation is required');
            }
            $applied = $historyExists ? array_map(fn ($r) => $r->name, $this->db->select('select name from pgmigrations order by id')) : [];
            $names = array_map(fn ($f) => basename($f, '.sql'), $files);
            if ($applied !== array_slice($names, 0, count($applied))) {
                throw new RuntimeException('Unknown or out-of-order legacy migration history');
            }
            $pending = array_slice($files, count($applied));
            if ($plan) {
                return array_map('basename', $pending);
            }
            $this->db->transaction(function () use ($files, $pending, $manifest): void {
                $this->db->unprepared('create table if not exists pgmigrations(id serial primary key,name varchar(255) not null,run_on timestamp not null)');
                $this->db->unprepared('create table if not exists laravel_legacy_checksums(name varchar(255) primary key,sha256 char(64) not null)');
                foreach ($files as $file) {
                    $name = basename($file, '.sql');
                    $stored = $this->db->selectOne('select sha256 from laravel_legacy_checksums where name=?', [$name]);
                    if ($stored !== null && $stored->sha256 !== $manifest[basename($file)]) {
                        throw new RuntimeException('Previously adopted migration changed: '.$name);
                    }
                }
                foreach ($pending as $file) {
                    $sql = file_get_contents($file);
                    if (!preg_match('/^-- Up Migration\\R(.*?)^-- Down Migration\\R/ms', $sql, $parts)) {
                        throw new RuntimeException('Invalid legacy SQL migration: '.basename($file));
                    }
                    $this->db->unprepared($parts[1]);
                    $this->db->insert('insert into pgmigrations(name,run_on) values(?,now())', [basename($file, '.sql')]);
                }
                foreach ($files as $file) {
                    $this->db->insert('insert into laravel_legacy_checksums(name,sha256) values(?,?) on conflict(name) do nothing', [basename($file, '.sql'), $manifest[basename($file)]]);
                }
            });
            return array_map('basename', $pending);
        } finally {
            $this->db->select('select pg_advisory_unlock(?)', [self::LOCK_ID]);
        }
    }
}
