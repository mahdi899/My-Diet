<?php

declare(strict_types=1);

namespace App\Modules\Coach\Infrastructure;

use App\Modules\Money\Application\MoneyService;
use App\Modules\Plans\Domain\CivilDates;
use App\Modules\Plans\Infrastructure\MealSwapService;
use App\Modules\Shopping\Application\ShoppingService;
use App\Modules\Tracking\Application\TrackingService;
use App\Shared\Domain\Problem;
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

    public function swap(string $userId, string $text): string|array|null
    {
        $meal = $this->todayMeal($userId, $text);
        if ($meal === null) {
            return $this->askMeal($userId, 'کدام وعده را عوض کنم؟', ' را عوض کن');
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
        $cards = [];
        foreach (array_slice($options, 0, 4) as $option) {
            $cards[] = [
                'slug' => $option['slug'],
                'name' => $option['name'],
                'kcal' => (int) $option['kcal'],
                'protein' => (int) round((float) ($option['protein'] ?? 0)),
                'prepMinutes' => (int) ($option['prepMinutes'] ?? 0),
            ];
        }
        $prompt = 'برای «'.$meal['title'].'» یکی را انتخاب کن.';

        return [
            'type' => 'swap_options',
            'text' => $prompt,
            'payload' => [
                'text' => $prompt,
                'mealId' => $meal['id'],
                'mealTitle' => $meal['title'],
                'reason' => $reason,
                'options' => $cards,
            ],
        ];
    }

    public function logMeal(string $userId, string $text): string|array|null
    {
        $meal = $this->todayMeal($userId, $text);
        if ($meal === null) {
            return $this->askMeal($userId, 'کدام وعده را خوردی؟', ' را خوردم');
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
        if ($wanted === null) {
            return null;
        }
        foreach ($meals as $meal) {
            if ($meal['type'] === $wanted) {
                return $meal;
            }
        }

        return null;
    }

    /**
     * @param  array<string, mixed>  $params
     */
    public function answer(string $userId, string $intent, array $params): string|array|null
    {
        return match ($intent) {
            'show_plan' => $this->plan($userId, (string) ($params['day'] ?? 'today'), is_string($params['meal'] ?? null) ? $params['meal'] : null),
            'show_food' => $this->food($params['food'] ?? null, false),
            'show_recipe' => $this->food($params['food'] ?? null, true),
            'show_intake' => $this->intake($userId),
            'show_weight' => $this->lastWeight($userId),
            'show_water' => $this->waterToday($userId),
            'show_quota' => $this->quota($userId),
            'show_subscription' => $this->subscription($userId),
            'show_shopping' => $this->shopping($userId),
            'undo_meal' => $this->confirmUndo($userId, is_string($params['meal'] ?? null) ? $params['meal'] : null),
            'refer_plan' => $this->text('برنامه تازه را همین‌جا نمی‌سازم. از تب برنامه درخواست بده تا متخصص هم آن را ببیند.'),
            'log_mood' => $this->moodAsk($params['mood'] ?? null),
            default => null,
        };
    }

    public function clearMeal(string $userId, ?string $mealType): string
    {
        $meal = $this->mealByType($userId, $mealType);
        if ($meal === null) {
            return 'وعده‌ای برای اصلاح پیدا نکردم.';
        }
        $uid = $this->db->table('plan_meals')->where('id', $meal['id'])->value('meal_uid');
        if (! is_string($uid) || $uid === '') {
            return 'این وعده را نمی‌توانم اصلاح کنم.';
        }
        $this->tracking->setMeal($userId, $uid, false);

        return 'مصرف «'.$meal['title'].'» برداشته شد.';
    }

    private function plan(string $userId, string $day, ?string $mealType): array
    {
        if ($day === 'week') {
            $days = [];
            foreach ($this->context->weekPlan($userId) as $index => $one) {
                $titles = array_map(fn (array $meal) => $meal['typeFa'].': '.$meal['title'], $one['meals']);
                $days[] = ['title' => $this->weekday($index), 'subtitle' => $titles === [] ? 'وعده‌ای نیست' : implode(' · ', $titles)];
            }

            return $this->card('fact_card', 'برنامه این هفته', ['title' => 'برنامه این هفته', 'kind' => 'week', 'items' => $days]);
        }
        $date = match ($day) {
            'tomorrow' => CivilDates::add(CivilDates::today(), 1),
            'yesterday' => CivilDates::add(CivilDates::today(), -1),
            default => CivilDates::today(),
        };
        $plan = $this->context->mealsOn($userId, $date);
        $meals = $plan['meals'] ?? [];
        if ($mealType !== null) {
            $meals = array_values(array_filter($meals, fn (array $meal) => $meal['type'] === $mealType));
        }
        if ($meals === []) {
            return $this->text('برای این روز وعده‌ای در برنامه نیست.');
        }
        $label = match ($day) {
            'tomorrow' => 'فردا',
            'yesterday' => 'دیروز',
            default => 'امروز',
        };
        $lead = count($meals) === 1
            ? $meals[0]['typeFa'].' '.$label.'ت اینه'
            : 'برنامه '.$label.' اینه';

        return $this->card('fact_card', $lead, [
            'title' => $lead,
            'date' => $date,
            'kind' => 'meals',
            'items' => array_map(fn (array $meal) => [
                'title' => $meal['title'],
                'meal' => $meal['typeFa'],
                'kcal' => $meal['kcal'],
            ], $meals),
        ]);
    }

    private function food(mixed $name, bool $recipe): array
    {
        if (! is_string($name) || mb_strlen($name, 'UTF-8') < 2) {
            return $this->text($recipe ? 'اسم غذا را بگو تا دستور پخت را بیاورم.' : 'اسم غذا را بگو تا کالری ثبت‌شده را بگویم.');
        }
        $like = '%'.addcslashes($name, '%_\\').'%';
        $row = $this->db->table('food_catalog')->where('active', 1)->where('name_fa', 'like', $like)->orderByRaw('CHAR_LENGTH(name_fa)')->first();
        if ($row === null) {
            return $this->text('«'.$name.'» در غذاهای ثبت‌شده پیدا نشد.');
        }
        if (! $recipe) {
            return $this->card('fact_card', (string) $row->name_fa, [
                'title' => (string) $row->name_fa,
                'kind' => 'nutrition',
                'items' => [
                    ['title' => $this->digits((int) $row->kcal).' کالری'],
                    ['title' => $this->digits((int) round((float) $row->protein_g)).' گرم پروتئین'],
                    ['title' => $this->digits((int) round((float) $row->carbs_g)).' گرم کربوهیدرات'],
                    ['title' => $this->digits((int) round((float) $row->fat_g)).' گرم چربی'],
                ],
            ]);
        }
        $details = $this->db->table('food_recipe_details')->where('food_id', $row->id)->first();
        $steps = is_object($details) ? trim((string) $details->instructions) : '';
        if ($steps === '') {
            return $this->text('برای «'.$row->name_fa.'» دستور پختی ثبت نشده است.');
        }
        if (mb_strlen($steps, 'UTF-8') > 420) {
            $steps = mb_substr($steps, 0, 420, 'UTF-8').'…';
        }

        return $this->card('fact_card', 'دستور '.$row->name_fa, [
            'title' => (string) $row->name_fa,
            'kind' => 'recipe',
            'body' => $steps,
        ]);
    }

    private function intake(string $userId): array
    {
        $today = CivilDates::today();
        $kcal = (int) $this->db->table('meal_logs as l')
            ->join('plan_meals as m', 'm.id', '=', 'l.plan_meal_id')
            ->where('l.user_id', $userId)->where('l.scheduled_date', $today)->where('l.eaten', 1)
            ->sum('m.calories');
        $protein = (int) round((float) $this->db->table('meal_logs as l')
            ->join('plan_meals as m', 'm.id', '=', 'l.plan_meal_id')
            ->leftJoin('food_catalog as f', 'f.name_fa', '=', 'm.title')
            ->where('l.user_id', $userId)->where('l.scheduled_date', $today)->where('l.eaten', 1)
            ->sum('f.protein_g'));

        return $this->card('fact_card', 'مصرف امروز', [
            'title' => 'مصرف امروز',
            'kind' => 'nutrition',
            'items' => [
                ['title' => $this->digits($kcal).' کالری ثبت‌شده'],
                ['title' => $this->digits($protein).' گرم پروتئین'],
            ],
        ]);
    }

    private function lastWeight(string $userId): array
    {
        $row = $this->db->table('weight_entries')->where('user_id', $userId)->orderByDesc('civil_date')->first();
        if ($row === null) {
            return $this->text('هنوز وزنی ثبت نشده است.');
        }

        return $this->card('fact_card', 'آخرین وزن', [
            'title' => 'آخرین وزن',
            'kind' => 'nutrition',
            'items' => [['title' => $this->digits((float) $row->kilograms).' کیلوگرم'], ['title' => (string) $row->civil_date]],
        ]);
    }

    private function waterToday(string $userId): array
    {
        $ml = (int) ($this->db->table('coach_water')->where(['user_id' => $userId, 'civil_date' => CivilDates::today()])->value('ml') ?? 0);

        return $this->card('fact_card', 'آب امروز', [
            'title' => 'آب امروز',
            'kind' => 'nutrition',
            'items' => [['title' => $this->digits($ml).' میلی‌لیتر'], ['title' => $this->digits((int) floor($ml / 250)).' لیوان']],
        ]);
    }

    private function quota(string $userId): array
    {
        $state = app(CoachQuotaService::class)->state($userId);
        if (($state['hasQuota'] ?? false) !== true) {
            return $this->text('سهمیه چت برای این حساب فعال نیست.');
        }

        return $this->card('fact_card', 'اعتبار چت', [
            'title' => 'اعتبار چت',
            'kind' => 'nutrition',
            'items' => [
                ['title' => $this->digits((int) $state['dailyRemaining']).' پیام امروز'],
                ['title' => $this->digits((int) $state['periodRemaining']).' پیام این دوره'],
            ],
        ]);
    }

    private function subscription(string $userId): array
    {
        $subscription = app(MoneyService::class)->subscription($userId)['subscription'] ?? null;
        if (! is_array($subscription) || ($subscription['endsAt'] ?? null) === null) {
            return $this->text('اشتراک فعالی با تاریخ پایان پیدا نکردم.');
        }
        $end = new \DateTimeImmutable((string) $subscription['endsAt']);
        $days = (int) (new \DateTimeImmutable('now', new \DateTimeZone('UTC')))->diff($end)->format('%r%a');

        return $this->card('fact_card', 'اشتراک', [
            'title' => (string) ($subscription['title'] ?? 'اشتراک'),
            'kind' => 'nutrition',
            'items' => [['title' => $days >= 0 ? $this->digits($days).' روز مانده' : 'تمام شده']],
        ]);
    }

    private function shopping(string $userId): array
    {
        $start = CivilDates::saturday(CivilDates::today());
        $days = array_map(fn (int $offset): string => CivilDates::add($start, $offset), range(0, 6));
        try {
            $list = app(ShoppingService::class)->get($userId, ['weekStart' => $start, 'days' => $days]);
        } catch (Problem $error) {
            return $this->text($error->messageFa);
        }
        $items = array_slice(array_map(fn (array $item) => ['title' => (string) $item['name']], $list['items'] ?? []), 0, 12);
        if ($items === []) {
            return $this->text('برای این هفته ماده اولیه‌ای در لیست خرید نیست.');
        }

        return $this->card('fact_card', 'لیست خرید این هفته', ['title' => 'لیست خرید این هفته', 'kind' => 'list', 'items' => $items]);
    }

    private function confirmUndo(string $userId, ?string $mealType): array
    {
        if ($mealType === null) {
            return $this->askMeal($userId, 'کدام وعده ثبت‌شده را بردارم؟', ' را پاک کن');
        }
        $meal = $this->mealByType($userId, $mealType);
        if ($meal === null) {
            return $this->text('این وعده امروز در برنامه نیست.');
        }

        return $this->card('quick_replies', 'مصرف «'.$meal['title'].'» برداشته شود؟', [
            'prompt' => 'مصرف «'.$meal['title'].'» برداشته شود؟',
            'options' => [
                ['label' => 'بله، حذف شود', 'action' => 'undo_meal', 'args' => ['mealType' => $mealType]],
                ['label' => 'نه', 'action' => 'dismiss', 'args' => []],
            ],
        ]);
    }

    private function moodAsk(mixed $mood): ?array
    {
        if (is_string($mood) && $mood !== '') {
            return null;
        }

        return $this->card('quick_replies', 'حال امروزت چطور است؟', [
            'prompt' => 'حال امروزت چطور است؟',
            'options' => array_map(fn (string $item) => ['label' => $item, 'value' => 'حال امروز '.$item], ['عالی', 'خوب', 'معمولی', 'خسته']),
        ]);
    }

    private function askMeal(string $userId, string $prompt, string $suffix): array
    {
        $plan = $this->context->mealsOn($userId, CivilDates::today());
        $options = [];
        foreach ($plan['meals'] ?? [] as $meal) {
            $label = $meal['typeFa'].$suffix;
            $options[] = ['label' => $label, 'value' => $label];
        }
        if ($options === []) {
            return $this->text('برای امروز وعده‌ای در برنامه نیست.');
        }

        return $this->card('quick_replies', $prompt, ['prompt' => $prompt, 'options' => $options]);
    }

    /** @param  array<string, mixed>  $payload */
    private function card(string $type, string $text, array $payload): array
    {
        $payload['text'] = $payload['text'] ?? $text;

        return ['type' => $type, 'text' => $text, 'payload' => $payload];
    }

    private function text(string $text): array
    {
        return $this->card('text', $text, ['text' => $text]);
    }

    private function mealByType(string $userId, ?string $type): ?array
    {
        if ($type === null) {
            return null;
        }
        foreach ($this->context->mealsOn($userId, CivilDates::today())['meals'] ?? [] as $meal) {
            if ($meal['type'] === $type) {
                return $meal;
            }
        }

        return null;
    }

    private function weekday(int $offset): string
    {
        return ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'][$offset] ?? 'روز';
    }

    private function digits(int|float $value): string
    {
        return strtr((string) $value, ['0' => '۰', '1' => '۱', '2' => '۲', '3' => '۳', '4' => '۴', '5' => '۵', '6' => '۶', '7' => '۷', '8' => '۸', '9' => '۹', '.' => '٫']);
    }
}
