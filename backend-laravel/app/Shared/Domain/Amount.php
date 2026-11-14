<?php

namespace App\Shared\Domain;

final class Amount
{
    public static function safe(int|string $value): int
    {
        $text = (string) $value;
        if (! preg_match('/^-?[0-9]+$/D', $text) || abs((float) $text) > 9007199254740991) {
            throw new \RuntimeException('toman amount is outside the safe integer range');
        }

        return (int) $value;
    }
}
