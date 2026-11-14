<?php

namespace App\Console\Commands;

use App\Modules\Identity\Infrastructure\IdentityImport;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

#[Signature('migration:import-identity {--execute : Copy into an empty rehearsal database; default is validation only}')]
#[Description('Rehearse Identity data conversion from a read-only PostgreSQL snapshot to MySQL')]
class ImportIdentity extends Command
{
    /**
     * Execute the console command.
     */
    public function handle(IdentityImport $import): int
    {
        if (! config('database.connections.pgsql.url')) {
            $this->error('Set POSTGRES_SOURCE_URL to a read-only source connection.');

            return self::FAILURE;
        }
        if (config('identity.environment') === 'production' && $this->option('execute')) {
            $this->error('The Identity-only importer is for rehearsal. The coordinated full-data migration is not ready.');

            return self::FAILURE;
        }
        $report = $import->run(DB::connection('pgsql'), DB::connection('mysql'), (bool) $this->option('execute'));
        $this->line(json_encode($report, JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR));

        return self::SUCCESS;
    }
}
