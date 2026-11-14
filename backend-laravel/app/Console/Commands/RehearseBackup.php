<?php

namespace App\Console\Commands;

use App\Shared\Infrastructure\MySqlBackup;
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
        try {
            $result = app(MySqlBackup::class)->rehearse($url);
            $this->line(json_encode($result, JSON_THROW_ON_ERROR));

            return 0;
        } catch (\Throwable $error) {
            $this->error($error->getMessage());

            return 1;
        }
    }
}
