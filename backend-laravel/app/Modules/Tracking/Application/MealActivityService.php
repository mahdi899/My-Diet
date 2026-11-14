<?php

namespace App\Modules\Tracking\Application;

use App\Modules\Plans\Domain\CivilDates;
use App\Modules\Tracking\Domain\ActivityRules;
use App\Shared\Domain\Problem;

final class MealActivityService
{
    public function __construct(private TrackingStore $store) {}

    public function reasons(): array
    {
        return $this->store->reasons();
    }

    public function day(string $user, string $date, array $plan): array
    {
        $planned = array_map(fn (array $meal) => $meal['plannedCalories'] ?? null, $plan['meals']);
        $consumed = array_map(fn (array $meal) => ($meal['consumptionState'] ?? 'unrecorded') === 'unrecorded' ? null : ($meal['consumption']['consumedCalories'] ?? null), $plan['meals']);

        return ['date' => $date, 'calories' => ['planned' => $this->summarize($planned), 'consumed' => $this->summarize($consumed)], 'records' => $this->store->logs($user, $date), 'selections' => $this->store->selections($user, $date)];
    }

    public function history(string $user, string $date): array
    {
        return ['consumption' => $this->store->logHistory($user, $date), 'selections' => $this->store->selectionHistory($user, $date)];
    }

    public function record(string $user, array $body): array
    {
        $input = ActivityRules::activity($body);

        return $this->store->transaction(function () use ($user, $input): array {
            $this->store->lock($user);
            $payload = ['kind' => 'record', ...$input];
            $previous = $this->store->command($user, $input['commandId']);
            if ($previous !== null) {
                if ($this->canon($previous['payload']) != $this->canon($payload)) {
                    throw new Problem(409, 'idempotency_conflict', 'این شناسه برای درخواست دیگری استفاده شده است');
                }

                return $previous['response'];
            }
            if ($input['date'] !== CivilDates::today()) {
                throw new Problem(409, 'not_today', 'اصلاح یا ثبت مصرف فقط برای امروز ممکن است');
            }
            $option = $this->store->approvedOption($user, $input['versionId'], $input['mealUid'], $input['optionId'], $input['date'])
                ?? throw new Problem(404, 'not_found', 'گزینه تأییدشده پیدا نشد');
            $log = $this->store->log($user, $input['date'], $input['mealUid']);
            if ((int) ($log['revision'] ?? 0) !== $input['expectedRevision']) {
                throw new Problem(409, 'lock_conflict', 'ثبت مصرف تغییر کرده است');
            }
            $details = is_array($log['details'] ?? null) ? $log['details'] : [];
            $state = $details['state'] ?? null;
            $recorded = $log !== null && ($log['eaten'] || ($state && $state !== 'unrecorded'));
            if ($recorded && ($log['plan_version_id'] !== $input['versionId'] || $log['option_uid'] !== $input['optionId'])) {
                throw new Problem(409, 'consumption_exists', 'ابتدا ثبت قبلی را صریحاً اصلاح کنید');
            }
            if ($log === null || $log['plan_version_id'] !== $input['versionId']) {
                if ($this->store->latestVersion($user, $input['date']) !== $input['versionId']) {
                    throw new Problem(409, 'plan_changed', 'نسخه برنامه تغییر کرده است');
                }
            }
            $selected = $this->store->selection($user, $input['date'], $input['mealUid']);
            $changing = $log === null || $log['option_uid'] !== $input['optionId'] || $log['plan_version_id'] !== $input['versionId'];
            $mismatch = $selected !== null
                ? $selected['option_uid'] !== $input['optionId'] || $selected['version_id'] !== $input['versionId']
                : ($option['document']['kind'] ?? null) !== 'primary';
            if ($changing && $mismatch) {
                throw new Problem(409, 'selection_required', 'ابتدا جایگزین را انتخاب کنید');
            }
            $consumed = null;
            if ($input['state'] === 'as_planned') {
                $consumed = $this->number($option['document']['calories'] ?? null);
            }
            if ($input['state'] === 'skipped') {
                $consumed = 0;
            }
            if (isset($input['actual']) && in_array($input['state'], ['less', 'more'], true)) {
                $portion = $option['document']['portion'] ?? ['quantity' => 1, 'unit' => 'serving'];
                $consumed = ActivityRules::proportionalCalories($this->number($option['document']['calories'] ?? null), $portion, $input['actual']);
                $ratio = ActivityRules::compatibleRatio($portion, $input['actual']);
                if ($ratio !== null && ($input['state'] === 'less' ? $ratio >= 1 : $ratio <= 1)) {
                    throw new Problem(400, 'validation', 'مقدار واقعی با کمتر یا بیشتر مطابقت ندارد');
                }
            }
            $saved = ['state' => $input['state'], 'actual' => $input['actual'] ?? null, 'foodName' => $input['foodName'] ?? null, 'plannedCalories' => array_key_exists('calories', $option['document']) ? $option['document']['calories'] : null, 'consumedCalories' => $consumed];
            $revision = $this->store->saveLog($user, $option['request_id'], $input['date'], $input['mealUid'], $input['state'] === 'as_planned', $input['versionId'], $option['meal_id'], $input['optionId'], $saved);
            $response = [...$saved, 'revision' => $revision, 'versionId' => $input['versionId'], 'optionId' => $input['optionId'], 'reward' => $input['state'] === 'as_planned' ? $this->store->rewardForMeal($user, $option['request_id']) : null];
            $this->store->saveCommand($user, $input['commandId'], $payload, $response);

            return $response;
        });
    }

    public function select(string $user, array $body): array
    {
        $input = ActivityRules::selection($body);

        return $this->store->transaction(function () use ($user, $input): array {
            $this->store->lock($user);
            $payload = ['kind' => 'select', ...$input];
            $previous = $this->store->command($user, $input['commandId']);
            if ($previous !== null) {
                if ($this->canon($previous['payload']) != $this->canon($payload)) {
                    throw new Problem(409, 'idempotency_conflict', 'این شناسه برای درخواست دیگری استفاده شده است');
                }

                return $previous['response'];
            }
            if ($input['date'] < CivilDates::today()) {
                throw new Problem(409, 'past_day', 'انتخاب برای روزهای گذشته مجاز نیست');
            }
            if ($this->store->latestVersion($user, $input['date']) !== $input['versionId']) {
                throw new Problem(409, 'plan_changed', 'نسخه برنامه تغییر کرده است');
            }
            $option = $this->store->approvedOption($user, $input['versionId'], $input['mealUid'], $input['optionId'], $input['date'])
                ?? throw new Problem(404, 'not_found', 'گزینه تأییدشده پیدا نشد');
            $log = $this->store->log($user, $input['date'], $input['mealUid']);
            $details = is_array($log['details'] ?? null) ? $log['details'] : [];
            if ($log !== null && ($log['eaten'] || ($details !== [] && ($details['state'] ?? null) !== 'unrecorded'))) {
                throw new Problem(409, 'consumption_exists', 'انتخاب وعده ثبت‌شده تغییر نمی‌کند؛ ابتدا مصرف را اصلاح کنید');
            }
            $current = $this->store->selection($user, $input['date'], $input['mealUid']);
            if ((int) ($current['revision'] ?? 0) !== $input['expectedRevision']) {
                throw new Problem(409, 'lock_conflict', 'انتخاب تغییر کرده است');
            }
            $reason = isset($input['reasonId']) ? $this->store->reason($input['reasonId']) : null;
            if ((isset($input['reasonId']) && $reason === null) || ($input['date'] === CivilDates::today() && $reason === null)) {
                throw new Problem(400, 'reason_required', 'دلیل معتبر انتخاب لازم است');
            }
            $revision = $this->store->saveSelection($user, $input['date'], $input['mealUid'], $input['versionId'], $option['meal_id'], $input['optionId'], $reason['id'] ?? null, $reason['label'] ?? null, $current);
            $this->store->invalidateShopping($user, $input['date'], $input['mealUid'], $revision);
            $response = ['revision' => $revision, 'optionId' => $input['optionId'], 'versionId' => $input['versionId']];
            $this->store->saveCommand($user, $input['commandId'], $payload, $response);

            return $response;
        });
    }

    private function summarize(array $values): array
    {
        $known = array_filter($values, fn ($value) => is_int($value) || is_float($value));

        return ['knownSubtotal' => array_sum($known), 'unknownCount' => count($values) - count($known), 'total' => count($known) === count($values) ? array_sum($values) : null];
    }

    private function number(mixed $value): ?float
    {
        return is_int($value) || is_float($value) ? $value + 0 : null;
    }

    private function canon(mixed $value): mixed
    {
        if (! is_array($value)) {
            return $value;
        }
        if (array_is_list($value)) {
            return array_map($this->canon(...), $value);
        }
        ksort($value);
        foreach ($value as $key => $item) {
            $value[$key] = $this->canon($item);
        }

        return $value;
    }
}
