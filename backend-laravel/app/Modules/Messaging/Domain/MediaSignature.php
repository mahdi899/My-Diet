<?php

namespace App\Modules\Messaging\Domain;

final class MediaSignature
{
    public const IMAGE_LIMIT = 1_500_000;

    public const VOICE_LIMIT = 1_000_000;

    public static function detect(string $bytes): ?string
    {
        if (strlen($bytes) >= 3 && $bytes[0] === "\xFF" && $bytes[1] === "\xD8" && $bytes[2] === "\xFF") {
            return 'image/jpeg';
        }
        if (strlen($bytes) >= 8 && str_starts_with($bytes, "\x89PNG\r\n\x1A\n")) {
            return 'image/png';
        }
        if (strlen($bytes) >= 6 && (str_starts_with($bytes, 'GIF89a') || str_starts_with($bytes, 'GIF87a'))) {
            return 'image/gif';
        }
        if (strlen($bytes) >= 4 && str_starts_with($bytes, 'OggS')) {
            return 'audio/ogg';
        }
        if (strlen($bytes) >= 12 && str_starts_with($bytes, 'RIFF') && substr($bytes, 8, 4) === 'WAVE') {
            return 'audio/wav';
        }

        return null;
    }

    public static function inspect(string $purpose, string $declared, string $bytes): string
    {
        $limit = $purpose === 'image' ? self::IMAGE_LIMIT : self::VOICE_LIMIT;
        $detected = self::detect($bytes);
        $matches = $detected !== null && ($purpose === 'image' ? str_starts_with($detected, 'image/') : str_starts_with($detected, 'audio/'));
        if ($bytes === '' || strlen($bytes) > $limit || ! $matches || $declared !== $detected) {
            throw new \InvalidArgumentException('signature');
        }

        return $detected;
    }
}
