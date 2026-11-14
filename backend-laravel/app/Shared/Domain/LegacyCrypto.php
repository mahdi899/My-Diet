<?php

namespace App\Shared\Domain;

use RuntimeException;
use Throwable;

/** Wire formats shared with Node. These are independent of Laravel's encryption and password hashing. */
final class LegacyCrypto
{
    public static function base64url(string $bytes): string
    {
        return rtrim(strtr(base64_encode($bytes), '+/', '-_'), '=');
    }

    public static function decode64(string $text): string
    {
        $decoded = base64_decode(strtr($text, '-_', '+/'), true);
        if ($decoded === false) {
            throw new RuntimeException('Invalid base64url');
        }
        return $decoded;
    }

    public static function uuid(): string
    {
        $hex = str_pad(dechex((int) floor(microtime(true) * 1000)), 12, '0', STR_PAD_LEFT).bin2hex(random_bytes(10));
        $hex[12] = '7';
        $hex[16] = dechex((hexdec($hex[16]) & 3) | 8);
        return substr($hex, 0, 8).'-'.substr($hex, 8, 4).'-'.substr($hex, 12, 4).'-'.substr($hex, 16, 4).'-'.substr($hex, 20);
    }

    public static function verifyPassword(string $password, string $encoded): bool
    {
        $parts = explode(':', $encoded);
        if (count($parts) !== 2 || !preg_match('/^[a-f0-9]{32}$/iD', $parts[0]) ||
            !preg_match('/^[a-f0-9]{128}$/iD', $parts[1]) || strlen(mb_convert_encoding($password, 'UTF-16LE', 'UTF-8')) / 2 > 256) {
            return false;
        }
        // Node uses the 32 ASCII hex characters as salt, not the decoded 16 bytes.
        $actual = sodium_crypto_pwhash_scryptsalsa208sha256(64, $password, $parts[0], 524288, 16777216);
        return hash_equals(strtolower($parts[1]), bin2hex($actual));
    }

    public static function encrypt(string $text, string $secret): string
    {
        if ($text === '' || str_starts_with($text, 'enc1:')) {
            return $text;
        }
        $iv = random_bytes(12);
        $cipher = openssl_encrypt($text, 'aes-256-gcm', hash('sha256', $secret, true), OPENSSL_RAW_DATA, $iv, $tag);
        if ($cipher === false) {
            throw new RuntimeException('Field encryption failed');
        }
        return 'enc1:'.self::base64url($iv).':'.self::base64url($tag).':'.self::base64url($cipher);
    }

    public static function decrypt(string $text, string $secret): string
    {
        $parts = explode(':', $text);
        if (!str_starts_with($text, 'enc1:') || count($parts) !== 4) {
            return $text;
        }
        $plain = openssl_decrypt(self::decode64($parts[3]), 'aes-256-gcm', hash('sha256', $secret, true),
            OPENSSL_RAW_DATA, self::decode64($parts[1]), self::decode64($parts[2]));
        if ($plain === false) {
            throw new RuntimeException('Field authentication failed');
        }
        return $plain;
    }

    public static function sign(array $claims, string $secret): string
    {
        $head = self::base64url('{"alg":"HS256","typ":"JWT"}');
        $body = self::base64url(json_encode($claims, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR));
        return $head.'.'.$body.'.'.self::base64url(hash_hmac('sha256', $head.'.'.$body, $secret, true));
    }

    public static function verify(string $token, string $secret): array
    {
        try {
            $parts = explode('.', $token);
            if (count($parts) !== 3 || in_array('', $parts, true)) {
                throw new RuntimeException;
            }
            $header = json_decode(self::decode64($parts[0]), true, 512, JSON_THROW_ON_ERROR);
            $claims = json_decode(self::decode64($parts[1]), true, 512, JSON_THROW_ON_ERROR);
            $signature = self::base64url(hash_hmac('sha256', $parts[0].'.'.$parts[1], $secret, true));
            if (($header['alg'] ?? null) !== 'HS256' || !hash_equals($signature, $parts[2]) ||
                !is_array($claims) || !is_string($claims['sub'] ?? null) || !is_string($claims['sid'] ?? null) ||
                !is_numeric($claims['exp'] ?? null) || $claims['exp'] <= microtime(true) ||
                !in_array($claims['role'] ?? null, ['user', 'specialist', 'admin'], true)) {
                throw new RuntimeException;
            }
            return $claims;
        } catch (Throwable) {
            throw new Problem(401, 'unauthorized', 'نشست معتبر نیست');
        }
    }

    public static function base32(string $bytes): string
    {
        $alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        $bits = 0;
        $value = 0;
        $output = '';
        foreach (unpack('C*', $bytes) as $byte) {
            $value = (($value << 8) | $byte) & 0xffff;
            $bits += 8;
            while ($bits >= 5) {
                $output .= $alphabet[($value >> ($bits - 5)) & 31];
                $bits -= 5;
            }
        }
        if ($bits > 0) {
            $output .= $alphabet[($value << (5 - $bits)) & 31];
        }
        return $output;
    }

    public static function totp(string $secret, ?int $seconds = null): string
    {
        $counter = intdiv($seconds ?? time(), 30);
        $hmac = hash_hmac('sha1', pack('N2', intdiv($counter, 4294967296), $counter & 0xffffffff), $secret, true);
        $offset = ord($hmac[19]) & 15;
        $number = unpack('N', substr($hmac, $offset, 4))[1] & 0x7fffffff;
        return str_pad((string) ($number % 1000000), 6, '0', STR_PAD_LEFT);
    }

    public static function totpMatches(string $secret, string $code): bool
    {
        if (!preg_match('/^[0-9]{6}$/D', $code)) {
            return false;
        }
        foreach ([-30, 0, 30] as $skew) {
            if (hash_equals(self::totp($secret, time() + $skew), $code)) {
                return true;
            }
        }
        return false;
    }

    public static function iso(string $date): string
    {
        return (new \DateTimeImmutable($date))->setTimezone(new \DateTimeZone('UTC'))->format('Y-m-d\TH:i:s.v\Z');
    }
}
