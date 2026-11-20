<?php

namespace App\Modules\Food\Domain;

final class RecipeTitle
{
    public static function normalize(string $title): string
    {
        $title = trim($title);
        if (preg_match('/^خانواده[ٔ‌]?\h*«([^»]+)»\h*[—–-]\h*نسخه[ٔ‌]?\h+(با\h+.+)$/uD', $title, $parts) === 1) {
            $title = trim($parts[1]).'( '.trim($parts[2]).' )';
        }

        return preg_replace('/^باقلاپلو با ماهیچه لطیف و آب پیاز زعفرانی\( با (مرغ ران|مرغ سینه|بوقلمون ران|بوقلمون سینه|اردک|بلدرچین) \)$/uD', 'باقلاپلو زعفرانی با $1', $title) ?? $title;
    }
}
