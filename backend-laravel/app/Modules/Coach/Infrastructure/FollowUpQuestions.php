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
        if ($profile->safety_tier === 'doctor_only' && ! in_array('safety', $answered, true)) {
            return [['key' => 'safety', 'text' => 'متخصص برای بررسی برنامه‌ات آماده است. اگر محدودیت غذایی مشخصی از پزشکت داری، برای متخصص بنویس.']];
        }
        if (! in_array('routine', $answered, true)) {
            $questions[] = ['key' => 'routine', 'text' => 'بیشتر روزها ناهار را کجا می‌خوری؟ پیشنهادهایی می‌چینیم که همان‌جا شدنی باشند.', 'options' => [
                ['label' => 'ناهار در خانه', 'value' => 'ناهار را در خانه می‌خورم'],
                ['label' => 'غذا را با خودم می‌برم', 'value' => 'ناهار را با خودم می‌برم'],
                ['label' => 'از بیرون می‌گیرم', 'value' => 'ناهار را از بیرون می‌گیرم'],
            ]];
        }
        if (! in_array('cook_source', $answered, true)) {
            $questions[] = ['key' => 'cook_source', 'text' => 'بیشتر روزها غذایت چطور آماده می‌شود؟', 'options' => [
                ['label' => 'خودم می‌پزم', 'value' => 'بیشتر روزها خودم غذا می‌پزم'],
                ['label' => 'در خانه برایم می‌پزند', 'value' => 'بیشتر روزها در خانه برایم غذا می‌پزند'],
                ['label' => 'غذای آماده می‌گیرم', 'value' => 'بیشتر روزها غذای آماده می‌گیرم'],
            ]];
        }
        $recentWeight = $this->db->table('weight_entries')->where('user_id', $userId)
            ->where('civil_date', '>=', CivilDates::add(CivilDates::today(), -7))
            ->exists();
        if ($profile->goal === 'weight_loss' && ! $recentWeight && ! in_array('weight', $answered, true)) {
            array_splice($questions, 1, 0, [['key' => 'weight', 'text' => 'وزن این هفته را هنوز ندارم. اگر خواستی عدد امروز را بنویس تا روند را حدس نزنم.']]);
        }
        if (! in_array('favorites', $answered, true)) {
            $questions[] = ['key' => 'favorites', 'text' => 'کدام غذای خانگی را دوست داری در برنامه بماند؟ نامش را با «دوست دارم» بنویس، مثلاً «دوست دارم عدس‌پلو».'];
        }

        return array_slice($questions, 0, 2);
    }
}
