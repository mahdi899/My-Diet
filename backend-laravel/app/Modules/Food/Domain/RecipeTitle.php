<?php

namespace App\Modules\Food\Domain;

final class RecipeTitle
{
    public static function normalize(string $title): string
    {
        $title = trim($title);
        if (preg_match('/^خانواده[ٔ‌]?\h*«([^»]+)»\h*[—–-]\h*نسخه[ٔ‌]?\h+(با\h+.+)$/uD', $title, $parts) === 1) {
            return trim($parts[1]).'( '.trim($parts[2]).' )';
        }

        return $title;
    }
}
