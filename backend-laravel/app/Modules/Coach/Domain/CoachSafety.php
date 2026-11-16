<?php

namespace App\Modules\Coach\Domain;

final class CoachSafety
{
    public static function localReply(string $text): ?string
    {
        if (preg_match('/خودکشی|suicide/ui', $text) === 1) {
            return 'اگر همین حالا در خطر هستی با اورژانس ۱۱۵ تماس بگیر. من جایگزین مراقبت فوری نیستم.';
        }
        if (preg_match('/اختلال خوردن|پرخوری|گرسنگی شدید|هیچ.?چیز نخورم|غذا نخوردن/ui', $text) === 1) {
            return 'محدودیت شدید غذا را پیشنهاد نمی‌کنم. اگر سابقهٔ سختی با غذا خوردن داری، این را برای متخصص تغذیه می‌گذارم و خودم رژیم سخت‌تری نمی‌سازم.';
        }
        if (preg_match('/شماره کارت|کد ملی|password|رمز عبور/ui', $text) === 1) {
            return 'این پیام را برای مربی نفرست. اطلاعات حساس را در گفتگو ننویس.';
        }

        return null;
    }
}
