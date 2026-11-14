<?php

namespace App\Console\Commands;

use App\Shared\Infrastructure\PostgresPreflight;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

#[Signature('migration:preflight')]
#[Description('Read source PostgreSQL schema and report missing MySQL tables and PostgreSQL-specific features')]
class MigrationPreflight extends Command
{
    /**
     * Execute the console command.
     */
    public function handle(PostgresPreflight $preflight): int
    {
        if (! config('database.connections.pgsql.url')) {
            $this->error('Set POSTGRES_SOURCE_URL to a read-only source connection.');

            return self::FAILURE;
        }
        $this->line(json_encode($preflight->inspect(DB::connection('pgsql'), DB::connection('mysql')), JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR));

        return self::SUCCESS;
    }
}
