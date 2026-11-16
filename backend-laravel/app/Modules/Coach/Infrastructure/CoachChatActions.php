<?php

declare(strict_types=1);

namespace App\Modules\Coach\Infrastructure;

use App\Modules\Plans\Infrastructure\MealSwapService;
use App\Modules\Tracking\Application\TrackingService;
use Illuminate\Database\ConnectionInterface;

/** Turns a Persian coach message into a stored action when the database can do it. */
final class CoachChatActions
{
    public function __construct(
        private ConnectionInterface $db,
        private PreferenceService $preferences,
        private MealSwapService $swaps,
        private TrackingService $tracking,
        private CoachContextBuilder $context,
    ) {}

    public function remember(string $userId, string $text): ?string
    {
        $disliked = $this->afterPhrase($text, 'دوست ندارم');
        if ($disliked !== null) {
            $this->preferences->recordUserStatement($userId, 'food_dislike', $disliked);

            return 'یادداشت کردم که «'.$disliked.'» را دوست نداری و در پیشنهاد بعدی نمی‌آید.';
        }
        $liked = $this->afterPhrase($text, 'دوست دارم');
        if ($liked !== null) {
            $this->preferences->recordUserStatement($userId, 'food_like', $liked);

            return 'یادداشت کردم که «'.$liked.'» را دوست داری.';
        }
        if (str_contains($text, 'وقت آشپزی') || str_contains($text, 'غذای سریع')) {
            $this->preferences->recordPattern($userId, str_contains($text, 'سریع') ? 'fast_meals' : 'cooks_at_home');
            $this->preferences->recordUserStatement($userId, 'followup_answered', 'kitchen');

            return 'یادداشت کردم و دیگر دربارهٔ وقت آشپزی نمی‌پرسم.';
        }

        return null;
    }

    private function afterPhrase(string $text, string $phrase): ?string
    {
        $pos = strpos($text, $phrase);
        if ($pos === false) {
            return null;
        }
        $food = trim(substr($text, $pos + strlen($phrase)));
        $food = preg_replace('/^[\s\.،]+|[\s\.،]+$/u', '', $food) ?? $food;

        return strlen($food) >= 2 ? mb_substr($food, 0, 40, 'UTF-8') : null;
    }

    public function swap(string $userId, string $text): ?string
    {
        $meal = $this->todayMeal($userId, $text);
        if ($meal === null) {
            return null;
        }
        $reason = str_contains($text, 'گرون') ? 'budget' : (str_contains($text, 'دوست ندارم') ? 'dislike' : 'variety');
        $options = $this->swaps->alternatives($userId, $meal['id'], $reason)['alternatives'];
        if ($options === []) {
            return 'برای «'.$meal['title'].'» جایگزین سازگار با حساسیت و ترجیح‌هایت پیدا نشد.';
        }
        foreach ($options as $option) {
            if (mb_stripos($text, $option['name']) !== false) {
                $applied = $this->swaps->apply($userId, $meal['id'], $option['slug'], $reason);

                return 'ثبت شد. به‌جای «'.$meal['title'].'» حالا «'.$applied['newMeal']['title'].'» است.';
            }
        }
        $lines = [];
        foreach ($options as $index => $option) {
            $lines[] = ($index + 1).'. '.$option['name'].' ('.$option['kcal'].' کالری)';
        }

        return "برای «{$meal['title']}» این‌ها سازگارند. اسم یکی را بفرست تا ثبت شود:\n".implode("\n", $lines);
    }

    public function logMeal(string $userId, string $text): ?string
    {
        $meal = $this->todayMeal($userId, $text);
        if ($meal === null) {
            return 'برای امروز وعده‌ای در برنامه نیست که ثبت شود.';
        }
        $uid = $this->db->table('plan_meals')->where('id', $meal['id'])->value('meal_uid');
        if (! is_string($uid) || $uid === '') {
            return null;
        }
        $this->tracking->setMeal($userId, $uid, true);

        return 'مصرف «'.$meal['title'].'» برای امروز ثبت شد. این با کالری برنامه‌ریزی‌شده یکی فرض نمی‌شود تا وقتی خودت تأیید نکرده باشی.';
    }

    private function todayMeal(string $userId, string $text): ?array
    {
        $plan = $this->context->buildForChat($userId, 'برنامه امروز غذا')['todayPlan'] ?? null;
        $meals = is_array($plan) ? ($plan['meals'] ?? []) : [];
        if ($meals === []) {
            return null;
        }
        $wanted = str_contains($text, 'صبحانه') ? 'breakfast' : (str_contains($text, 'شام') ? 'dinner' : (str_contains($text, 'میان') ? 'snack' : (str_contains($text, 'ناهار') ? 'lunch' : null)));
        if ($wanted !== null) {
            foreach ($meals as $meal) {
                if ($meal['type'] === $wanted) {
                    return $meal;
                }
            }
        }

        return $meals[0];
    }
}
