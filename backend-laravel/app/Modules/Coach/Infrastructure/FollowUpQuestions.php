<?php

declare(strict_types=1);

namespace App\Modules\Coach\Infrastructure;

use App\Modules\Plans\Domain\CivilDates;
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
        $answered = $this->db->table('coach_preferences')
            ->where(['user_id' => $userId, 'pref_key' => 'followup_answered', 'active' => 1])
            ->pluck('value')->all();
        $questions = [];
        if (($profile->region === null || trim((string) $profile->region) === '') && ! in_array('region', $answered, true)) {
            $questions[] = ['key' => 'region', 'text' => 'غذاهای معمول شهرت چیست؟ تا برنامه به مواد در دسترس نزدیک‌تر شود.'];
        }
        if ($profile->safety_tier === 'doctor_only' && ! in_array('safety', $answered, true)) {
            $questions[] = ['key' => 'safety', 'text' => 'اگر توصیه تازه پزشکی داری بنویس. تا تأیید متخصص، رژیم اجرایی فعال نمی‌شود.'];
        }
        $recentWeight = $this->db->table('weight_entries')->where('user_id', $userId)
            ->where('civil_date', '>=', CivilDates::add(CivilDates::today(), -7))
            ->exists();
        if ($profile->goal === 'weight_loss' && ! $recentWeight && ! in_array('weight', $answered, true) && count($questions) < 2) {
            $questions[] = ['key' => 'weight', 'text' => 'وزن این هفته را هنوز ندارم. اگر خواستی عدد امروز را بنویس تا روند را حدس نزنم.'];
        }
        $hasPattern = $this->db->table('coach_preferences')->where(['user_id' => $userId, 'pref_key' => 'pattern', 'active' => 1])->exists();
        if (! $hasPattern && ! in_array('kitchen', $answered, true) && count($questions) < 2) {
            $questions[] = ['key' => 'kitchen', 'text' => 'معمولاً وقت آشپزی داری یا غذای سریع برایت مناسب‌تر است؟'];
        }

        return array_slice($questions, 0, 2);
    }
}
