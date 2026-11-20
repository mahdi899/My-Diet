<?php

namespace Tests\Feature;

use App\Modules\Identity\Application\OtpSender;
use App\Shared\Domain\LegacyCrypto as Crypto;
use Illuminate\Database\ConnectionInterface;
use Tests\TestCase;

final class IdentityContractTest extends TestCase
{
    private ?ConnectionInterface $db = null;

    protected function setUp(): void
    {
        parent::setUp();
        $url = getenv('MYSQL_TEST_URL');
        if (! $url) {
            $this->markTestSkipped('Run through the disposable MySQL compatibility harness (MYSQL_TEST_URL).');
        }
        config(['database.default' => 'mysql', 'database.connections.mysql.url' => $url, 'identity.environment' => 'development',
            'identity.fixed_otp' => '123456', 'identity.sms_provider' => 'console']);
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

    private function customer(string $phone = '09120000001'): array
    {
        $this->postJson('/v1/auth/otp/request', ['phone' => $phone])->assertCreated()
            ->assertExactJson(['expiresInSeconds' => 120, 'resendAfterSeconds' => 60]);

        return $this->postJson('/v1/auth/otp/verify', ['phone' => $phone, 'code' => '123456', 'deviceLabel' => 'Test phone', 'platform' => 'android'])
            ->assertCreated()->json();
    }

    private function staff(string $role = 'admin'): array
    {
        $id = Crypto::uuid();
        $fixture = json_decode(file_get_contents(__DIR__.'/../Fixtures/node-crypto.json'), true)['passwords'][0];
        $this->db->table('users')->insert(['id' => $id, 'phone_e164' => '+989120009999', 'role' => $role, 'status' => 'active']);
        $this->db->table($role.'_credentials')->insert(['user_id' => $id, 'username' => 'migration-admin', 'password_hash' => $fixture['encoded']]);
        if ($role === 'specialist') {
            $this->db->table('specialist_profiles')->insert(['user_id' => $id, 'display_name' => 'پزشک آزمایش']);
        }

        return [$id, $fixture['password']];
    }

    public function test_signup_creates_customer_wallet_conversation_and_pending_session_atomically(): void
    {
        $issued = $this->customer();
        $claims = Crypto::verify($issued['accessToken'], config('identity.jwt_secret'));
        self::assertSame('user', $issued['role']);
        self::assertSame('pending', $this->db->table('users')->where('id', $claims['sub'])->value('status'));
        self::assertSame(1, $this->db->table('wallets')->where('user_id', $claims['sub'])->count());
        self::assertSame(1, $this->db->table('conversation_participants')->where('user_id', $claims['sub'])->count());
        $this->withToken($issued['accessToken'])->getJson('/v1/me')->assertOk()->assertExactJson(['id' => $claims['sub'], 'role' => 'user', 'displayName' => null]);
        $this->withToken($issued['accessToken'])->getJson('/v1/me/totp')->assertForbidden();
        $this->postJson('/v1/auth/refresh', ['refreshToken' => $issued['refreshToken']])->assertForbidden();
    }

    public function test_failed_otp_attempts_commit_and_lock_on_exactly_the_fifth_attempt(): void
    {
        $this->postJson('/v1/auth/otp/request', ['phone' => '09120000001'])->assertCreated();
        for ($attempt = 1; $attempt <= 5; $attempt++) {
            $response = $this->postJson('/v1/auth/otp/verify', ['phone' => '09120000001', 'code' => '999999'])->assertUnauthorized();
            $row = $this->db->table('otp_challenges')->first();
            self::assertSame($attempt, $row->attempts);
            self::assertSame($attempt === 5, $row->locked_at !== null);
            self::assertSame($attempt === 5, $row->consumed_at !== null);
            if ($attempt === 5) {
                $response->assertJsonPath('messageFa', 'کد دیگر معتبر نیست. کد جدید بگیرید');
            }
        }
        $this->postJson('/v1/auth/otp/verify', ['phone' => '09120000001', 'code' => '123456'])->assertUnauthorized();
        self::assertSame(0, $this->db->table('users')->count());
    }

    public function test_otp_resend_budget_and_existing_account_checks_preserve_errors(): void
    {
        $this->postJson('/v1/auth/otp/request', ['phone' => '09120000001', 'existingAccountOnly' => true])
            ->assertNotFound()->assertJsonPath('code', 'account_not_registered');
        $this->postJson('/v1/auth/otp/request', ['phone' => '09120000001'])->assertCreated();
        $this->postJson('/v1/auth/otp/request', ['phone' => '09120000001'])->assertStatus(429)
            ->assertJsonPath('retryable', true)->assertJsonPath('messageFa', 'درخواست کد جدید کمی بعد ممکن است');
        self::assertSame(1, $this->db->table('otp_challenges')->count());
    }

    public function test_sms_outage_rolls_back_the_challenge(): void
    {
        $this->app->instance(OtpSender::class, new class implements OtpSender
        {
            public function send(string $phone, string $code): void
            {
                throw new \RuntimeException('Synthetic outage');
            }

            public function latest(string $phone): ?string
            {
                return null;
            }
        });
        $this->postJson('/v1/auth/otp/request', ['phone' => '09120000001'])->assertStatus(503)->assertJsonPath('code', 'sms_unavailable');
        self::assertSame(0, $this->db->table('otp_challenges')->count());
    }

    public function test_refresh_rotation_keeps_absolute_expiry_and_replay_revokes_the_entire_session(): void
    {
        $issued = $this->customer();
        $claims = Crypto::verify($issued['accessToken'], config('identity.jwt_secret'));
        $this->db->table('users')->where('id', $claims['sub'])->update(['status' => 'active']);
        $rotated = $this->postJson('/v1/auth/refresh', ['refreshToken' => $issued['refreshToken']])->assertCreated()->json();
        self::assertSame($issued['sessionExpiresAt'], $rotated['sessionExpiresAt']);
        self::assertNotSame($issued['refreshToken'], $rotated['refreshToken']);
        self::assertSame(2, $this->db->table('refresh_tokens')->count());
        $this->postJson('/v1/auth/refresh', ['refreshToken' => $issued['refreshToken']])->assertUnauthorized();
        self::assertSame('refresh_reuse', $this->db->table('sessions')->value('revoke_reason'));
        $this->withToken($rotated['accessToken'])->getJson('/v1/me')->assertUnauthorized();
        $this->postJson('/v1/auth/refresh', ['refreshToken' => $rotated['refreshToken']])->assertUnauthorized();
    }

    public function test_existing_node_staff_hash_and_failed_login_lockout_are_preserved(): void
    {
        [$id, $password] = $this->staff();
        for ($i = 1; $i <= 5; $i++) {
            $this->postJson('/v1/auth/admin/login', ['username' => 'migration-admin', 'password' => 'wrong'])->assertUnauthorized();
            $row = $this->db->table('admin_credentials')->where('user_id', $id)->first();
            self::assertSame($i, $row->failed_attempts);
            self::assertSame($i === 5, $row->locked_until !== null);
        }
        $this->postJson('/v1/auth/admin/login', ['username' => 'migration-admin', 'password' => $password])->assertUnauthorized();
        $this->db->table('admin_credentials')->where('user_id', $id)->update(['locked_until' => null]);
        $this->postJson('/v1/auth/admin/login', ['username' => ' MIGRATION-ADMIN ', 'password' => $password])->assertCreated()->assertJsonPath('role', 'admin');
        self::assertSame(0, $this->db->table('admin_credentials')->where('user_id', $id)->value('failed_attempts'));
    }

    public function test_staff_totp_setup_confirmation_challenge_and_replay(): void
    {
        [$id, $password] = $this->staff('specialist');
        $login = $this->postJson('/v1/auth/specialist/login', ['username' => 'migration-admin', 'password' => $password])->assertCreated()->json();
        $this->withToken($login['accessToken']);
        $this->getJson('/v1/me/totp')->assertOk()->assertExactJson(['enabled' => false]);
        $setup = $this->postJson('/v1/me/totp/setup', ['ignored' => true])->assertCreated()->json();
        self::assertStringContainsString('otpauth://totp/Sabzine:specialist?secret='.$setup['secret'], $setup['otpauthUrl']);
        $secret = Crypto::decode64(Crypto::decrypt($this->db->table('staff_totp')->where('user_id', $id)->value('secret_encrypted'), config('identity.field_key')));
        self::assertSame($setup['secret'], Crypto::base32($secret));
        $this->postJson('/v1/me/totp/confirm', ['code' => Crypto::totp($secret)])->assertCreated()->assertExactJson(['enabled' => true]);
        $this->postJson('/v1/me/totp/setup')->assertStatus(409);
        $challenge = $this->postJson('/v1/auth/specialist/login', ['username' => 'migration-admin', 'password' => $password])->assertCreated()->assertJsonPath('totpRequired', true)->json();
        self::assertArrayNotHasKey('accessToken', $challenge);
        for ($i = 1; $i <= 4; $i++) {
            $wrong = str_pad((string) ((int) Crypto::totp($secret) + 123) % 1000000, 6, '0', STR_PAD_LEFT);
            $this->postJson('/v1/auth/totp', ['totpToken' => $challenge['totpToken'], 'code' => $wrong])->assertUnauthorized();
            self::assertNull($this->db->table('totp_challenges')->value('consumed_at'));
        }
        $this->postJson('/v1/auth/totp', ['totpToken' => $challenge['totpToken'], 'code' => Crypto::totp($secret)])->assertCreated()->assertJsonPath('role', 'specialist');
        $this->postJson('/v1/auth/totp', ['totpToken' => $challenge['totpToken'], 'code' => Crypto::totp($secret)])->assertUnauthorized();
    }

    public function test_web_refresh_cookie_requires_client_header_and_logout_clears_it(): void
    {
        [$id, $password] = $this->staff();
        $response = $this->withHeader('x-sabzine-client', 'web')->postJson('/v1/auth/admin/login', ['username' => 'migration-admin', 'password' => $password])->assertCreated();
        self::assertArrayNotHasKey('refreshToken', $response->json());
        $cookies = $response->headers->getCookies();
        $cookie = $cookies[0];
        self::assertSame('sabzine_refresh', $cookie->getName());
        self::assertTrue($cookie->isHttpOnly());
        self::assertSame('strict', $cookie->getSameSite());
        self::assertSame('/v1/auth', $cookie->getPath());
        $this->withCredentials()->withUnencryptedCookie('sabzine_refresh', $cookie->getValue())->withoutHeader('x-sabzine-client')
            ->postJson('/v1/auth/refresh', ['refreshToken' => ''])->assertUnauthorized();
        $this->withHeader('x-sabzine-client', 'web')->postJson('/v1/auth/refresh', ['refreshToken' => ''])->assertCreated();
        $logout = $this->withToken($response->json('accessToken'))->postJson('/v1/auth/logout')->assertCreated()->assertExactJson(['ok' => true]);
        self::assertSame('', $logout->headers->getCookies()[0]->getValue());
        self::assertNotNull($this->db->table('sessions')->where('user_id', $id)->value('revoked_at'));
    }

    public function test_photo_can_be_saved_before_personal_details_and_preserves_the_display_name(): void
    {
        $issued = $this->customer();
        $this->withToken($issued['accessToken']);
        $this->patchJson('/v1/me', ['displayName' => 'سارا'])->assertOk();
        $photo = base64_encode(hex2bin('89504e470d0a1a0a').'portrait');
        $this->patchJson('/v1/me/personal-details', ['photo' => $photo])->assertOk()->assertJsonPath('details.photo', $photo);
        $this->getJson('/v1/me')->assertOk()->assertJsonPath('displayName', 'سارا');
        $this->getJson('/v1/me/personal-details')->assertOk()->assertExactJson(['details' => ['photo' => $photo]]);
        $this->patchJson('/v1/me/personal-details', ['photo' => 'invalid'])->assertStatus(400);
        $this->getJson('/v1/me/personal-details')->assertOk()->assertJsonPath('details.photo', $photo);
    }

    public function test_photo_only_updates_preserve_existing_personal_details(): void
    {
        $issued = $this->customer();
        $this->withToken($issued['accessToken']);
        $details = ['name' => 'سارا', 'age' => 30, 'height' => 165, 'weight' => 60, 'contactPhone' => '09120000001', 'photo' => null];
        $this->patchJson('/v1/me/personal-details', $details)->assertOk();
        $photo = base64_encode(hex2bin('89504e470d0a1a0a').'portrait');
        $this->patchJson('/v1/me/personal-details', ['photo' => $photo])->assertOk();
        $details['photo'] = $photo;
        $details['contactPhone'] = '+989120000001';
        $this->getJson('/v1/me/personal-details')->assertOk()->assertExactJson(['details' => $details]);
        $this->patchJson('/v1/me/personal-details', ['photo' => null])->assertOk()->assertJsonPath('details.photo', null)->assertJsonPath('details.age', 30);
        $this->getJson('/v1/me')->assertOk()->assertJsonPath('displayName', 'سارا');
    }

    public function test_profile_encryption_session_listing_and_scoped_revocation(): void
    {
        $issued = $this->customer();
        $claims = Crypto::verify($issued['accessToken'], config('identity.jwt_secret'));
        $this->withToken($issued['accessToken']);
        $this->patchJson('/v1/me', ['displayName' => 'آزمایش'])->assertOk()->assertJsonPath('displayName', 'آزمایش');
        $details = ['name' => 'آزمایش', 'age' => 30, 'height' => 175, 'weight' => 71.5, 'contactPhone' => '09120000001', 'photo' => null];
        $this->patchJson('/v1/me/personal-details', $details)->assertOk()->assertJsonPath('details.contactPhone', '+989120000001');
        $this->getJson('/v1/me/personal-details')->assertOk()->assertJsonPath('details.weight', 71.5);
        $encrypted = $this->db->table('user_personal_details')->where('user_id', $claims['sub'])->value('details_encrypted');
        self::assertStringStartsWith('enc1:', $encrypted);
        self::assertStringNotContainsString('آزمایش', $encrypted);
        $this->getJson('/v1/auth/sessions')->assertOk()->assertJsonCount(1)->assertJsonPath('0.current', true);
        $this->deleteJson('/v1/auth/sessions/'.Crypto::uuid())->assertNotFound();
        $this->deleteJson('/v1/auth/sessions/not-a-uuid')->assertStatus(400);
        $this->deleteJson('/v1/auth/sessions/'.$claims['sid'])->assertOk()->assertExactJson(['ok' => true]);
        $this->getJson('/v1/me')->assertUnauthorized();
    }
}
