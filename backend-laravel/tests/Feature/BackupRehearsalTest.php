<?php

namespace Tests\Feature;

use App\Shared\Infrastructure\MySqlBackup;
use Tests\MySqlTestCase;

final class BackupRehearsalTest extends MySqlTestCase
{
    public function test_real_dump_restore_verifies_all_table_contents_and_triggers(): void
    {
        $url = getenv('MYSQL_BACKUP_TEST_URL');
        self::assertNotFalse($url, 'The disposable runner must provide a privileged test-only URL for backup/restore.');
        $result = $this->app->make(MySqlBackup::class)->rehearse($url);
        self::assertSame('verified', $result['dump']);
        self::assertTrue($result['restored']);
        self::assertGreaterThanOrEqual(117, $result['tables']);
        self::assertGreaterThan(0, $result['triggers']);
        self::assertFalse($result['sourceChanged']);
        self::assertMatchesRegularExpression('/^[a-f0-9]{64}$/', $result['sha256']);
    }
}
