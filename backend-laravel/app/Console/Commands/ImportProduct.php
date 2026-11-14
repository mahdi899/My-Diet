<?php

namespace App\Console\Commands;

use App\Shared\Infrastructure\ProductImport;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

#[Signature('migration:import-product {--execute : Copy and reconcile all product tables into an empty offline rehearsal database}')]
#[Description('Validate or rehearse all PostgreSQL product data conversions to MySQL without writing to the source')]
class ImportProduct extends Command
{
    /**
     * Execute the console command.
     */
    public function handle(ProductImport $import): int
    {
        if (! config('database.connections.pgsql.url')) {
            $this->error('Set POSTGRES_SOURCE_URL to the source snapshot connection.');

            return self::FAILURE;
        }
        if (config('identity.environment') === 'production' && $this->option('execute')) {
            $this->error('Production cutover remains blocked until all application, queue and rollback gates are verified. Use a separate offline rehearsal environment.');

            return self::FAILURE;
        }
        $report = $import->run(DB::connection('pgsql'), DB::connection('mysql'), (bool) $this->option('execute'));
        $this->line(json_encode($report, JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR));

        return self::SUCCESS;
    }
}
