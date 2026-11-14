<?php

namespace App\Modules\Tracking\Application;

use App\Modules\Money\Application\MoneyService;
use App\Modules\Plans\Application\PlanQueries;
use App\Modules\Plans\Domain\CivilDates;
use App\Modules\Tracking\Domain\ActivityRules;
use App\Shared\Domain\Problem;

final class TrackingService
{
    public function __construct(private TrackingStore $store, private PlanQueries $plans, private MoneyService $money) {}

    public function dashboard(string $user): array
    {
        $plan = $this->plans->published($user);

        return ['wallet' => $this->money->wallet($user), 'streak' => ActivityRules::streak($this->store->rewardWeeks($user), CivilDates::today()), 'unreadNotifications' => $this->store->unread($user), 'plan' => $plan, 'infoQuestions' => $plan === null ? [] : $this->store->questions($plan['requestId'])];
    }

    public function setMeal(string $user, string $meal, bool $eaten): array
    {
        $today = CivilDates::today();

        return $this->store->transaction(function () use ($user, $meal, $eaten, $today): array {
            $this->store->lock($user);
            if ($this->store->structuredActivity($user, $meal, $today)) {
                throw new Problem(409, 'structured_activity_required', 'این وعده باید از مسیر ثبت مصرف نسخه‌دار اصلاح شود');
            }
            $found = $this->store->publishedMeal($user, $meal);
            if ($found === null || $found['civil_date'] === null || $found['week_start'] === null || $found['effective_from'] === null) {
                throw new Problem(404, 'not_found', 'این وعده در برنامهٔ تأییدشده نیست');
            }
            $friday = CivilDates::add($found['week_start'], 6);
            if ($found['civil_date'] !== $today || $today > $friday || $found['civil_date'] < $found['effective_from']) {
                throw new Problem(409, 'not_today', 'ثبت وعده فقط برای امروز ممکن است');
            }
            $this->store->saveSimpleLog($user, $found['request_id'], $found['civil_date'], $meal, $eaten, $found['version_id'], $found['meal_id'], $found['option_uid']);

            return ['eaten' => $eaten, 'reward' => $eaten ? $this->store->rewardForMeal($user, $found['request_id']) : null, 'anomaly' => $this->store->lateBulk($user, $found['request_id'], $found['civil_date'])];
        });
    }

    public function setWeight(string $user, float $kilograms): array
    {
        if (! is_finite($kilograms) || $kilograms < 25 || $kilograms > 300) {
            throw new Problem(400, 'validation', 'وزن باید بین ۲۵ و ۳۰۰ کیلوگرم باشد');
        }
        $today = CivilDates::today();
        $this->store->saveWeight($user, $today, $kilograms);

        return ['date' => $today, 'kilograms' => $kilograms];
    }

    public function weights(string $user): array
    {
        return $this->store->weights($user);
    }

    public function review(string $user, string $request, string $week, int $rating, string $body): array
    {
        if ($rating < 1 || $rating > 5) {
            throw new Problem(400, 'validation', 'امتیاز باید بین ۱ و ۵ باشد');
        }
        if (! $this->store->hasReward($user, $request, $week)) {
            throw new Problem(409, 'week_not_complete', 'امتیاز بعد از تمام شدن هفتهٔ پاداش‌گرفته ممکن است');
        }
        $id = $this->store->saveReview($user, $request, $week, $rating, $body);
        if ($id === '') {
            throw new Problem(409, 'already_reviewed', 'برای این هفته امتیاز ثبت شده است');
        }

        return ['id' => $id, 'status' => 'pending'];
    }

    public function pendingRewards(string $user): array
    {
        return array_values(array_filter($this->store->rewards($user, null), fn (array $reward): bool => $reward['acknowledgedAt'] === null));
    }

    public function acknowledge(string $user, string $id): array
    {
        $rows = $this->store->rewards($user, $id);
        $row = $rows[0] ?? null;
        if ($row === null) {
            throw new Problem(404, 'not_found', 'پاداش پیدا نشد');
        }
        if ($row['acknowledgedAt'] !== null) {
            return $row;
        }
        $stamp = $this->store->acknowledge($user, $id);
        if ($stamp === null) {
            throw new Problem(404, 'not_found', 'پاداش پیدا نشد');
        }
        $row['acknowledgedAt'] = $stamp;

        return $row;
    }

    public function publicReviews(): array
    {
        return $this->store->publicReviews();
    }

    public function specialist(string $user): ?array
    {
        return $this->store->specialist($user);
    }

    public function mealBody(array $body): array
    {
        if (array_diff(array_keys($body), ['mealUid', 'eaten'])) {
            throw new Problem(400, 'validation', 'فیلد اضافی پذیرفته نیست');
        }
        if (! is_bool($body['eaten'] ?? null)) {
            throw new Problem(400, 'validation', 'اطلاعات واردشده ناقص یا نادرست است');
        }

        return ['mealUid' => $this->uuid($body['mealUid'] ?? null), 'eaten' => $body['eaten']];
    }

    public function weightBody(array $body): float
    {
        if (array_diff(array_keys($body), ['kilograms'])) {
            throw new Problem(400, 'validation', 'فیلد اضافی پذیرفته نیست');
        }
        if (! is_int($body['kilograms'] ?? null) && ! is_float($body['kilograms'] ?? null)) {
            throw new Problem(400, 'validation', 'وزن باید بین ۲۵ و ۳۰۰ کیلوگرم باشد');
        }

        return $body['kilograms'] + 0;
    }

    public function reviewBody(array $body): array
    {
        if (array_diff(array_keys($body), ['requestId', 'weekStart', 'rating', 'body'])) {
            throw new Problem(400, 'validation', 'فیلد اضافی پذیرفته نیست');
        }
        if (! is_int($body['rating'] ?? null)) {
            throw new Problem(400, 'validation', 'امتیاز باید بین ۱ و ۵ باشد');
        }
        $week = $body['weekStart'] ?? null;
        if (! is_string($week)) {
            throw new Problem(400, 'validation', 'اطلاعات واردشده ناقص یا نادرست است');
        }
        $trimmed = trim($week);
        if ($trimmed === '' || strlen($trimmed) > 10) {
            throw new Problem(400, 'validation', 'اطلاعات واردشده ناقص یا نادرست است');
        }
        $text = $body['body'] ?? '';
        if (! is_string($text)) {
            throw new Problem(400, 'validation', 'اطلاعات واردشده ناقص یا نادرست است');
        }

        return ['requestId' => $this->uuid($body['requestId'] ?? null), 'weekStart' => $trimmed, 'rating' => $body['rating'], 'body' => mb_substr(trim($text), 0, 1000)];
    }

    private function uuid(mixed $value): string
    {
        if (! is_string($value) || ! preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iD', $value)) {
            throw new Problem(400, 'validation', 'شناسه معتبر نیست');
        }

        return strtolower($value);
    }
}
