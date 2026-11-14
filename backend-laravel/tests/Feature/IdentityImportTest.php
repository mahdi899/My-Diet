<?php

namespace Tests\Feature;

use App\Modules\Identity\Infrastructure\IdentityImport;
use App\Shared\Domain\LegacyCrypto as Crypto;
use Illuminate\Database\ConnectionInterface;
use Tests\TestCase;

final class IdentityImportTest extends TestCase
{
    public function test_rehearsal_commands_require_an_explicit_source_and_do_not_connect_by_default(): void
    {
        config(['database.connections.pgsql.url' => null]);
        $this->artisan('migration:preflight')->assertFailed();
        $this->artisan('migration:import-identity')->assertFailed();
    }

    public function test_identity_only_import_cannot_be_used_as_a_production_data_migration(): void
    {
        config(['identity.environment' => 'production', 'database.connections.pgsql.url' => 'postgres://synthetic']);
        $this->artisan('migration:import-identity', ['--execute' => true])->assertFailed();
    }

    public function test_import_refuses_nonempty_targets_without_modifying_existing_records(): void
    {
        if (! getenv('MYSQL_TEST_URL')) {
            $this->markTestSkipped('Requires the disposable MySQL harness.');
        }
        config(['database.connections.mysql.url' => getenv('MYSQL_TEST_URL')]);
        $target = app(ConnectionInterface::class);
        $source = \Mockery::mock(ConnectionInterface::class);
        $source->shouldReceive('getDriverName')->andReturn('pgsql');
        $source->shouldReceive('transactionLevel')->andReturn(0);
        $source->shouldReceive('beginTransaction')->once();
        $source->shouldReceive('statement')->with('set transaction isolation level repeatable read read only')->once();
        $source->shouldReceive('rollBack')->once();
        $id = Crypto::uuid();
        $target->table('users')->insert(['id' => $id, 'phone_e164' => '+989120001234', 'role' => 'user', 'status' => 'active']);
        try {
            app(IdentityImport::class)->run($source, $target, true);
            self::fail('Import should refuse a nonempty target');
        } catch (\RuntimeException $error) {
            self::assertStringContainsString('empty destination', $error->getMessage());
            self::assertSame($id, $target->table('users')->value('id'));
        } finally {
            $target->table('users')->where('id', $id)->delete();
        }
    }
}
