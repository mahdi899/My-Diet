<?php

namespace Tests\Feature;

use Tests\TestCase;

final class ProductImportTest extends TestCase
{
    public function test_full_import_requires_an_explicit_source_and_blocks_production_execution(): void
    {
        config(['database.connections.pgsql.url' => null]);
        $this->artisan('migration:import-product')->assertFailed();
        config(['database.connections.pgsql.url' => 'postgres://synthetic', 'identity.environment' => 'production']);
        $this->artisan('migration:import-product', ['--execute' => true])->assertFailed();
    }
}
