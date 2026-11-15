<?php

declare(strict_types=1);

namespace App\Modules\Coach\Application;

use Illuminate\Database\ConnectionInterface;

/** At most two follow-up questions. Onboarding itself is not extended. */
final class FollowUpQuestions
{
    public function __construct(private ConnectionInterface $db) {}

    public function forUser(string $userId): array
    {
        $profile = $this->db->table('nutrition_profiles')->where('user_id', $userId)->first();
        if ($profile === null) {
            return [['key' => 'profile', 'text' => 'برای شخصی شدن برنامه، پرسش‌نامه تغذیه را کامل کن.']];
        }
        $questions = [];
        if ($profile->region === null || trim((string) $profile->region) === '') {
            $questions[] = ['key' => 'region', 'text' => 'غذاهای معمول شهرت چیست؟ تا برنامه به مواد در دسترس نزدیک‌تر شود.'];
        }
        if ($profile->safety_tier === 'doctor_only') {
            $questions[] = ['key' => 'safety', 'text' => 'اگر توصیه تازه پزشکی داری بنویس. تا تأیید متخصص، رژیم اجرایی فعال نمی‌شود.'];
        }
        $hasPattern = $this->db->table('coach_preferences')->where(['user_id' => $userId, 'pref_key' => 'pattern', 'active' => 1])->exists();
        if (! $hasPattern && count($questions) < 2) {
            $questions[] = ['key' => 'kitchen', 'text' => 'معمولاً وقت آشپزی داری یا غذای سریع برایت مناسب‌تر است؟'];
        }

        return array_slice($questions, 0, 2);
    }
}
