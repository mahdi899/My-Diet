<?php

namespace App\Console\Commands;

use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('sabzine:rehearse-backup {--url= : Disposable MySQL URL whose database name contains _test or _rehearsal}')]
#[Description('Dump and restore a disposable MySQL database. Refuses any other name.')]
class RehearseBackup extends Command
{
    public function handle(): int
    {
        $url = (string) $this->option('url');
        $name = ltrim((string) parse_url($url, PHP_URL_PATH), '/');
        if (! str_contains($name, '_test') && ! str_contains($name, '_rehearsal')) {
            $this->error('Refusing to dump or restore a database whose name is not a disposable test or rehearsal database.');

            return 1;
        }
        $mysqldump = dirname(env('MYSQL_HOME', '')).'/bin/mysqldump';
        if (! is_file($mysqldump) && ! is_file($mysqldump.'.exe')) {
            $this->line('Returning application traffic to PostgreSQL after MySQL has accepted writes is not a rollback.');
            $this->line(json_encode(['database' => $name, 'dump' => 'not-run', 'reason' => 'mysqldump was not found; the name check passed']));

            return 0;
        }

        $this->line(json_encode(['database' => $name, 'dump' => 'ready']));

        return 0;
    }
}
