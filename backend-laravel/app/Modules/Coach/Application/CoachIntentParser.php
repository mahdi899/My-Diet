<?php

namespace App\Modules\Coach\Application;

/**
 * Routes a Persian coach message to a local action or leaves it for the model.
 * Each rule has a positive phrase and a guard so a lookalike sentence cannot steal the action.
 *
 * @phpstan-type Intent array{intent: string, confidence: float, params: array<string, mixed>}
 */
final class CoachIntentParser
{
    /**
     * @return Intent
     */
    public function parse(string $messageText): array
    {
        $text = str_replace("\u{200c}", '', mb_strtolower(trim($messageText), 'UTF-8'));
        $text = strtr($text, [
            '۰' => '0', '۱' => '1', '۲' => '2', '۳' => '3', '۴' => '4',
            '۵' => '5', '۶' => '6', '۷' => '7', '۸' => '8', '۹' => '9',
            '٠' => '0', '١' => '1', '٢' => '2', '٣' => '3', '٤' => '4',
            '٥' => '5', '٦' => '6', '٧' => '7', '٨' => '8', '٩' => '9',
            '٫' => '.',
        ]);

        return $this->weight($text)
            ?? $this->quota($text)
            ?? $this->subscription($text)
            ?? $this->shopping($text)
            ?? $this->recipe($text)
            ?? $this->intake($text)
            ?? $this->foodInfo($text)
            ?? $this->water($text)
            ?? $this->undo($text)
            ?? $this->swap($text)
            ?? $this->consumption($text)
            ?? $this->newPlan($text)
            ?? $this->plan($text)
            ?? $this->mood($text)
            ?? $this->memory($text)
            ?? $this->plateau($text)
            ?? $this->open($text);
    }

    /** @return Intent|null */
    private function weight(string $text): ?array
    {
        $asking = $this->has($text, ['وزن قبلی', 'آخرین وزن', 'وزنم چند', 'وزنم چقدر', 'چند بود']);
        $number = $this->weightNumber($text);
        $logging = $number !== null && $this->has($text, ['کیلو', 'وزن', 'ثبت']) && ! $this->has($text, ['کم کردم', 'چند کیلو', 'قبلی', 'آخرین']);
        if ($logging) {
            return $this->hit('log_weight', 0.95, ['weight' => $number]);
        }
        if ($asking && $number === null) {
            return $this->hit('show_weight', 0.9, []);
        }

        return null;
    }

    /** @return Intent|null */
    private function quota(string $text): ?array
    {
        if ($this->has($text, ['اعتبار چت', 'سهمیه', 'چند پیام', 'پیام دارم'])) {
            return $this->hit('show_quota', 0.9, []);
        }

        return null;
    }

    /** @return Intent|null */
    private function subscription(string $text): ?array
    {
        if ($this->has($text, ['اشتراک', 'چند روز مونده', 'چند روز مانده'])) {
            return $this->hit('show_subscription', 0.9, []);
        }

        return null;
    }

    /** @return Intent|null */
    private function shopping(string $text): ?array
    {
        if ($this->has($text, ['لیست خرید', 'خرید هفته'])) {
            return $this->hit('show_shopping', 0.9, []);
        }

        return null;
    }

    /** @return Intent|null */
    private function recipe(string $text): ?array
    {
        if (! $this->has($text, ['دستور پخت', 'رسپی', 'چطور بپزم', 'طرز تهیه'])) {
            return null;
        }

        return $this->hit('show_recipe', 0.9, ['food' => $this->foodName($text)]);
    }

    /** @return Intent|null */
    private function intake(string $text): ?array
    {
        $aboutToday = $this->has($text, ['امروز', 'مصرف کردم', 'خوردم امروز']);
        $kcal = $this->has($text, ['کالری', 'انرژی']);
        $protein = str_contains($text, 'پروتئین');
        if (($kcal || $protein) && $aboutToday && ! $this->has($text, ['این غذا', 'دستور'])) {
            return $this->hit('show_intake', 0.9, ['nutrient' => $protein && ! $kcal ? 'protein' : 'kcal']);
        }

        return null;
    }

    /** @return Intent|null */
    private function foodInfo(string $text): ?array
    {
        if (! $this->has($text, ['چند کالری', 'کالری داره', 'کالری دارد', 'پروتئین داره'])) {
            return null;
        }

        return $this->hit('show_food', 0.9, ['food' => $this->foodName($text)]);
    }

    /** @return Intent|null */
    private function water(string $text): ?array
    {
        if ($this->has($text, ['آبپز', 'ابپز', 'آبمیوه', 'ابمیوه'])) {
            return null;
        }
        $question = $this->has($text, ['چقدر', 'چند لیوان', 'چند تا لیوان']) && ! preg_match('/\d+\s*لیوان/u', $text);
        if ($question && str_contains($text, 'آب')) {
            return $this->hit('show_water', 0.9, []);
        }
        $drank = $this->has($text, ['خوردم', 'نوشیدم', 'ثبت']);
        $amount = str_contains($text, 'لیوان') || str_contains($text, 'میلی');
        if ($amount && $drank && (str_contains($text, 'آب') || str_contains($text, 'نوشیدم'))) {
            return $this->hit('log_water', 0.95, $this->waterAmount($text));
        }

        return null;
    }

    /** @return Intent|null */
    private function undo(string $text): ?array
    {
        if ($this->has($text, ['حذف کن', 'پاک کن', 'اشتباه ثبت', 'اصلاح کن', 'لغو کن'])) {
            return $this->hit('undo_meal', 0.9, ['meal' => $this->mealCode($text)]);
        }

        return null;
    }

    /** @return Intent|null */
    private function swap(string $text): ?array
    {
        $explicit = $this->has($text, ['عوض کن', 'تعویض', 'جایگزین', 'به جای', 'بجای']);
        $rejectMeal = $this->has($text, ['نمیخوام این', 'این وعده را نمیخوام', 'اینو نمیخوام']);
        if (! $explicit && ! $rejectMeal) {
            return null;
        }

        return $this->hit('swap_meal', 0.9, [
            'meal' => $this->mealCode($text),
            'reason' => $this->swapReason($text),
        ]);
    }

    /** @return Intent|null */
    private function consumption(string $text): ?array
    {
        if (! $this->has($text, ['خوردم', 'مصرف کردم']) || str_contains($text, 'آب')) {
            return null;
        }

        return $this->hit('log_consumption', 0.9, ['meal' => $this->mealCode($text)]);
    }

    /** @return Intent|null */
    private function plan(string $text): ?array
    {
        $meal = $this->mealCode($text);
        $asks = $this->has($text, ['برنامه', 'چی بخورم', 'چیه', 'چیست', 'چی هست']) || ($meal !== null && $this->has($text, ['امروز', 'فردا', 'دیروز']));
        if (! $asks && ! $this->has($text, ['ناهار امروز', 'شام امروز', 'صبحانه امروز', 'ناهارم چی', 'شام فردا'])) {
            return null;
        }
        if (! $this->has($text, ['برنامه', 'وعده', 'غذا', 'امروز', 'فردا', 'دیروز', 'هفته', 'چی']) && $meal === null) {
            return null;
        }
        $span = 'today';
        if (str_contains($text, 'هفته')) {
            $span = 'week';
        } elseif (str_contains($text, 'فردا')) {
            $span = 'tomorrow';
        } elseif (str_contains($text, 'دیروز')) {
            $span = 'yesterday';
        }

        return $this->hit('show_plan', 0.9, ['day' => $span, 'meal' => $meal]);
    }

    /** @return Intent|null */
    private function mood(string $text): ?array
    {
        if (! $this->has($text, ['حال امروز', 'حالم', 'حال و روز'])) {
            return null;
        }
        foreach (['عالی', 'خوب', 'معمولی', 'خسته'] as $mood) {
            if (str_contains($text, $mood)) {
                return $this->hit('log_mood', 0.9, ['mood' => $mood]);
            }
        }

        return $this->hit('log_mood', 0.9, ['mood' => null]);
    }

    /** @return Intent|null */
    private function newPlan(string $text): ?array
    {
        if ($this->has($text, ['رژیم جدید', 'برنامه جدید', 'هفته بعد', 'برنامه هفته بعد'])) {
            return $this->hit('refer_plan', 0.9, []);
        }

        return null;
    }

    /** @return Intent|null */
    private function plateau(string $text): ?array
    {
        if ($this->has($text, ['لاغر نمیش', 'کم نمیش', 'کم نمی', 'وزنم ثابت', 'ثابت مونده', 'ثابت مانده', 'نتیجه نمی'])) {
            return $this->hit('check_progress', 0.7, []);
        }

        return null;
    }

    /** @return Intent|null */
    private function memory(string $text): ?array
    {
        if ($this->has($text, ['دوست ندارم', 'دوست دارم', 'بدم میاد', 'عاشق'])) {
            return $this->hit('remember', 0.85, []);
        }

        return null;
    }

    /** @return Intent */
    private function open(string $text): array
    {
        if ($this->has($text, ['خسته شدم', 'دلسرد', 'انگیزه', 'ناامید'])) {
            return $this->hit('motivation', 0.7, []);
        }
        if ($this->has($text, ['پیشرفت', 'کم کردم', 'نتیجه رژیم'])) {
            return $this->hit('check_progress', 0.7, []);
        }

        return $this->hit('general_question', 0.5, []);
    }

    /** @param  array<string, mixed>  $params */
    private function hit(string $intent, float $confidence, array $params): array
    {
        return ['intent' => $intent, 'confidence' => $confidence, 'params' => $params];
    }

    private function has(string $text, array $needles): bool
    {
        foreach ($needles as $needle) {
            if (str_contains($text, str_replace("\u{200c}", '', $needle))) {
                return true;
            }
        }

        return false;
    }

    private function weightNumber(string $text): ?float
    {
        if (preg_match('/(\d+(?:\.\d+)?)/u', $text, $matches) !== 1) {
            return null;
        }
        $number = (float) $matches[1];

        return $number >= 25 && $number <= 300 ? $number : null;
    }

    private function mealCode(string $text): ?string
    {
        return match (true) {
            str_contains($text, 'صبحانه') => 'breakfast',
            str_contains($text, 'ناهار') => 'lunch',
            str_contains($text, 'شام') => 'dinner',
            str_contains($text, 'میان') => 'snack',
            default => null,
        };
    }

    private function swapReason(string $text): string
    {
        return match (true) {
            $this->has($text, ['گرون', 'ارزون', 'بودجه']) => 'budget',
            $this->has($text, ['وقت', 'سریع']) => 'time',
            $this->has($text, ['ندارم', 'نیست']) => 'unavailable',
            $this->has($text, ['دوست ندارم', 'نمیخوام']) => 'dislike',
            default => 'variety',
        };
    }

    /** @return array{ml: int} */
    private function waterAmount(string $text): array
    {
        $glasses = 1;
        if (preg_match('/(\d+(?:\.\d+)?)\s*میلی/u', $text, $matches) === 1) {
            return ['ml' => max(50, min(1500, (int) round((float) $matches[1])))];
        }
        if (preg_match('/(\d+(?:\.\d+)?)\s*لیوان/u', $text, $matches) === 1) {
            $glasses = (float) $matches[1];
        } elseif (preg_match('/(یک|یه|دو|سه|چهار|پنج|شش|هفت|هشت)\s*لیوان/u', $text, $matches) === 1) {
            $glasses = match ($matches[1]) {
                'دو' => 2, 'سه' => 3, 'چهار' => 4, 'پنج' => 5, 'شش' => 6, 'هفت' => 7, 'هشت' => 8, default => 1,
            };
        }

        return ['ml' => (int) round(max(1, $glasses) * 250)];
    }

    private function foodName(string $text): ?string
    {
        $clean = preg_replace('/(دستور پخت|طرز تهیه|رسپی|چطور بپزم|چند کالری|کالری|پروتئین|این غذا|داره|دارد|را|رو|بگو|چی|چیه|چیست)/u', ' ', $text) ?? $text;
        $clean = trim(preg_replace('/\s+/u', ' ', $clean) ?? $clean);
        if ($clean === '' || mb_strlen($clean, 'UTF-8') < 2) {
            return null;
        }

        return mb_substr($clean, 0, 40, 'UTF-8');
    }
}
