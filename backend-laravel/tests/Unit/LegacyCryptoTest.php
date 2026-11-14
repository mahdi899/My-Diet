<?php

namespace Tests\Unit;

use App\Shared\Domain\LegacyCrypto as Crypto;
use App\Shared\Domain\Problem;
use PHPUnit\Framework\TestCase;

final class LegacyCryptoTest extends TestCase
{
    private function vectors(): array
    {
        return json_decode(file_get_contents(__DIR__.'/../Fixtures/node-crypto.json'), true, 512, JSON_THROW_ON_ERROR);
    }

    public function test_existing_ascii_and_unicode_node_passwords_remain_valid(): void
    {
        foreach ($this->vectors()['passwords'] as $vector) {
            self::assertTrue(Crypto::verifyPassword($vector['password'], $vector['encoded']));
            self::assertFalse(Crypto::verifyPassword($vector['password'].'wrong', $vector['encoded']));
        }
        self::assertFalse(Crypto::verifyPassword('password', 'invalid'));
    }

    public function test_node_encrypted_fields_can_be_decrypted_and_authentication_is_enforced(): void
    {
        $v = $this->vectors();
        self::assertSame($v['plain'], Crypto::decrypt($v['encrypted'], $v['key']));
        self::assertSame('legacy plaintext', Crypto::decrypt('legacy plaintext', $v['key']));
        self::assertSame('', Crypto::encrypt('', $v['key']));
        self::assertSame($v['encrypted'], Crypto::encrypt($v['encrypted'], $v['key']));
        $this->expectException(\RuntimeException::class);
        Crypto::decrypt($v['encrypted'], 'wrong-key');
    }

    public function test_node_jwt_has_identical_signature_and_expired_or_tampered_tokens_fail(): void
    {
        $v = $this->vectors();
        self::assertSame($v['jwt'], Crypto::sign($v['claims'], $v['key']));
        self::assertSame($v['claims'], Crypto::verify($v['jwt'], $v['key']));
        foreach ([$v['jwt'].'x', Crypto::sign([...$v['claims'], 'exp' => 1], $v['key']),
            Crypto::sign([...$v['claims'], 'role' => 'owner'], $v['key'])] as $invalid) {
            try {
                Crypto::verify($invalid, $v['key']);
                self::fail('Invalid JWT accepted');
            } catch (Problem $problem) {
                self::assertSame(401, $problem->status);
            }
        }
    }

    public function test_totp_and_uuid_formats_match_node(): void
    {
        $v = $this->vectors()['totp'];
        self::assertSame($v['base32'], Crypto::base32(base64_decode($v['secret'])));
        self::assertSame($v['code'], Crypto::totp(base64_decode($v['secret']), (int) ($v['at'] / 1000)));
        self::assertMatchesRegularExpression('/^[a-f0-9]{8}-[a-f0-9]{4}-7[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/', Crypto::uuid());
    }

    public function test_domain_and_application_do_not_depend_on_laravel_or_sql(): void
    {
        $root = __DIR__.'/../../app';
        $iterator = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($root));
        foreach ($iterator as $file) {
            $path = str_replace('\\', '/', $file->getPathname());
            if (! $file->isFile() || ! preg_match('~/(Domain|Application)/~', $path)) {
                continue;
            }
            $source = file_get_contents($path);
            self::assertDoesNotMatchRegularExpression('/Illuminate\\\\|Facades\\\\|\\bDB::|\\bPDO\\b|\\bselect\\s+.*\\bfrom\\b/i', $source, $path);
        }
    }
}
