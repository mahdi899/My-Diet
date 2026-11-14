<?php

namespace App\Modules\Coach\Domain;

final class CoachSafety
{
    public static function localReply(string $text): ?string
    {
        if (preg_match('/خودکشی|suicide/ui', $text) === 1) {
            return 'اگر همین حالا در خطر هستی با اورژانس ۱۱۵ تماس بگیر. من جایگزین مراقبت فوری نیستم.';
        }
        if (preg_match('/شماره کارت|کد ملی|password|رمز عبور/ui', $text) === 1) {
            return 'این پیام را برای مربی نفرست. اطلاعات حساس را در گفتگو ننویس.';
        }

        return null;
    }
}
