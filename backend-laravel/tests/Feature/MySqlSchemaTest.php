<?php

namespace Tests\Feature;

use App\Shared\Domain\LegacyCrypto as Crypto;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Database\QueryException;
use Tests\TestCase;

final class MySqlSchemaTest extends TestCase
{
    private ?ConnectionInterface $db = null;

    protected function setUp(): void
    {
        parent::setUp();
        if (! getenv('MYSQL_TEST_URL')) {
            $this->markTestSkipped('Requires the disposable MySQL harness.');
        }
        config(['database.default' => 'mysql', 'database.connections.mysql.url' => getenv('MYSQL_TEST_URL')]);
        $this->db = app(ConnectionInterface::class);
        $this->db->beginTransaction();
    }

    protected function tearDown(): void
    {
        if ($this->db !== null && $this->db->transactionLevel() > 0) {
            $this->db->rollBack();
        }
        parent::tearDown();
    }

    private function user(): string
    {
        $id = Crypto::uuid();
        $this->db->table('users')->insert(['id' => $id, 'phone_e164' => '+989120000001', 'role' => 'user', 'status' => 'active']);

        return $id;
    }

    public function test_mysql_84_is_used_with_utc_case_sensitive_unicode_and_foreign_keys(): void
    {
        $version = $this->db->selectOne('select version() as version,@@session.time_zone as timezone,@@collation_connection as collation,@@foreign_key_checks as fk');
        self::assertStringStartsWith('8.4.', $version->version);
        self::assertSame('+00:00', $version->timezone);
        self::assertSame('utf8mb4_0900_bin', $version->collation);
        self::assertSame(1, $version->fk);
        $this->expectException(QueryException::class);
        $this->db->table('wallets')->insert(['user_id' => Crypto::uuid()]);
    }

    public function test_mysql_enforces_session_lifetime_and_refresh_expiry_in_the_database(): void
    {
        $user = $this->user();
        $session = Crypto::uuid();
        $this->db->insert('insert into sessions(id,user_id,created_at,absolute_expires_at) values(?,?,current_timestamp(6),date_add(current_timestamp(6),interval 30 day))', [$session, $user]);
        $this->expectException(QueryException::class);
        $this->db->insert('insert into refresh_tokens(id,session_id,token_hash,expires_at) values(?,?,?,date_add(current_timestamp(6),interval 31 day))',
            [Crypto::uuid(), $session, hash('sha256', 'test-only')]);
    }

    public function test_mysql_rejects_extending_a_session_or_negative_wallet_balance(): void
    {
        $user = $this->user();
        try {
            $this->db->insert('insert into sessions(id,user_id,created_at,absolute_expires_at) values(?,?,current_timestamp(6),date_add(current_timestamp(6),interval 31 day))', [Crypto::uuid(), $user]);
            self::fail('Session lifetime constraint was not enforced');
        } catch (QueryException $error) {
            self::assertStringContainsString('sessions_fixed_lifetime', $error->getMessage());
        }
        $this->expectException(QueryException::class);
        $this->db->table('wallets')->insert(['user_id' => $user, 'cash_toman' => -1]);
    }
}
