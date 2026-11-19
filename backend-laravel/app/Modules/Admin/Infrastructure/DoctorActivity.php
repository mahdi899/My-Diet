<?php

namespace App\Modules\Admin\Infrastructure;

use App\Modules\Plans\Application\PlanQueries;
use App\Modules\Plans\Domain\CivilDates;
use App\Modules\Rewards\Domain\StreakRules;
use Illuminate\Database\ConnectionInterface;

final class DoctorActivity
{
    public function __construct(private ConnectionInterface $db, private PlanQueries $plans) {}

    public function nutrition(string $user, string $date): array
    {
        $until = (new \DateTimeImmutable(CivilDates::add($date, 1), new \DateTimeZone('Asia/Tehran')))
            ->setTimezone(new \DateTimeZone('UTC'))->format('Y-m-d H:i:s');
        $target = $this->db->table('nutrition_profile_history')->where('user_id', $user)->where('created_at', '<', $until)
            ->orderByDesc('created_at')->orderByDesc('id')->value('target_kcal');
        $target ??= $this->db->table('nutrition_profiles')->where('user_id', $user)->where('updated_at', '<', $until)->value('target_kcal');

        $meals = [];
        $known = [];
        $hasUnknown = false;
        $plan = $this->plans->day($user, $date);
        foreach ($plan['meals'] as $meal) {
            $options = array_map(fn ($option) => $this->foodOption($option), $meal['options']);
            if ($options === []) {
                $options[] = ['id' => null, 'kind' => 'primary', 'title' => $meal['title'], 'kcal' => $meal['calories']];
            }
            $log = $meal['consumption'];
            $state = $meal['consumptionState'];
            $consumed = null;
            $calories = $log['consumedCalories'] ?? null;
            if (in_array($state, ['as_planned', 'less', 'more'], true)) {
                $optionId = $log['optionId'] ?? null;
                if ($optionId !== null && ($log['versionId'] ?? null) !== $plan['versionId']) {
                    $document = $this->db->table('plan_meal_options as o')->join('plan_meals as m', 'm.id', '=', 'o.meal_id')
                        ->join('plan_days as d', 'd.id', '=', 'm.plan_day_id')
                        ->where('d.plan_version_id', $log['versionId'])->where('d.civil_date', $date)
                        ->where('m.meal_uid', $meal['mealUid'])->where('o.option_uid', $optionId)->value('o.document');
                    $consumed = $document === null ? null : $this->foodOption(json_decode($document, true));
                } else {
                    foreach ($options as $option) {
                        if ($optionId === null ? $option['kind'] === 'primary' : $option['id'] === $optionId) {
                            $consumed = $option;
                            break;
                        }
                    }
                }
                if ($state === 'as_planned') {
                    $calories ??= $consumed['kcal'] ?? null;
                }
            }
            $calories = $state === 'skipped' ? 0 : $calories;
            if ($calories !== null) {
                $known[] = $calories;
            } elseif ($state !== 'unrecorded') {
                $hasUnknown = true;
            }
            $meals[] = ['id' => $meal['mealUid'], 'type' => $meal['mealType'], 'state' => $state, 'options' => $options,
                'consumed' => $consumed, 'otherFood' => $state === 'different' ? ($log['foodName'] ?? null) : null,
                'consumedKcal' => $calories];
        }

        foreach ($this->db->table('coach_food_entries')->where(['user_id' => $user, 'civil_date' => $date, 'status' => 'logged'])->pluck('totals') as $totals) {
            $kcal = json_decode($totals, true)['kcal'] ?? null;
            if (is_numeric($kcal)) {
                $known[] = (float) $kcal;
            } else {
                $hasUnknown = true;
            }
        }

        return ['targetKcal' => $target === null ? null : (int) $target,
            'consumedKcal' => $known === [] ? null : (int) round(array_sum($known)),
            'hasUnknownCalories' => $hasUnknown, 'meals' => $meals];
    }

    private function foodOption(array $option): array
    {
        return ['id' => $option['optionId'] ?? null, 'kind' => $option['kind'], 'title' => $option['title'],
            'kcal' => $option['calories'] ?? null];
    }

    public function days(string $user, string $from, string $to, bool $details = false): array
    {
        $planned = $this->db->table('plan_versions as v')
            ->join('plan_requests as r', 'r.id', '=', 'v.request_id')
            ->join('orders as o', 'o.id', '=', 'r.order_id')
            ->join('plan_days as d', 'd.plan_version_id', '=', 'v.id')
            ->join('plan_meals as m', 'm.plan_day_id', '=', 'd.id')
            ->where('r.user_id', $user)->whereIn('v.status', ['published', 'superseded'])
            ->whereNotNull('v.published_at')->where('r.status', '<>', 'cancelled')
            ->where('o.status', 'paid')->whereBetween('d.civil_date', [$from, $to])
            ->orderByDesc('v.published_at')->orderByDesc('v.id')
            ->get(['d.civil_date', 'v.id as version_id', 'v.published_at', 'r.id as request_id', 'm.meal_uid']);

        $days = [];
        $expected = [];
        $versions = [];
        $empty = ['planned' => 0, 'recorded' => 0, 'mealStates' => [], 'foods' => [], 'waterMl' => null, 'weightKg' => null];
        foreach ($planned as $meal) {
            $date = $meal->civil_date;
            if (CivilDates::today($meal->published_at) > $date) {
                continue;
            }
            $versions[$date] ??= $meal->version_id;
            if ($versions[$date] !== $meal->version_id) {
                continue;
            }
            $key = $meal->request_id.':'.$meal->meal_uid;
            if (! isset($expected[$date][$key])) {
                $expected[$date][$key] = true;
                $days[$date] ??= $empty;
                $days[$date]['planned']++;
            }
        }

        $logs = $this->db->table('meal_logs')->where('user_id', $user)->whereBetween('scheduled_date', [$from, $to])
            ->get(['scheduled_date', 'request_id', 'meal_uid', 'eaten', 'details']);
        foreach ($logs as $log) {
            $date = $log->scheduled_date;
            $data = json_decode($log->details ?? '{}', true);
            $state = $data['state'] ?? ((bool) $log->eaten ? 'as_planned' : 'unrecorded');
            $key = $log->request_id.':'.$log->meal_uid;
            if (isset($expected[$date][$key]) && StreakRules::recorded((bool) $log->eaten, $state)) {
                $days[$date]['recorded']++;
            }
            if ($details && $state !== 'unrecorded') {
                $days[$date] ??= $empty;
                $days[$date]['mealStates'][$state] = ($days[$date]['mealStates'][$state] ?? 0) + 1;
            }
        }

        if ($details) {
            foreach (['coach_water' => ['ml', 'waterMl'], 'weight_entries' => ['kilograms', 'weightKg']] as $table => [$column, $field]) {
                foreach ($this->db->table($table)->where('user_id', $user)->whereBetween('civil_date', [$from, $to])->pluck($column, 'civil_date') as $date => $value) {
                    $days[$date] ??= $empty;
                    $days[$date][$field] = (float) $value;
                }
            }
            $foods = $this->db->table('coach_food_entries')->where('user_id', $user)->where('status', 'logged')
                ->whereBetween('civil_date', [$from, $to])->orderBy('created_at')->get(['civil_date', 'title']);
            foreach ($foods as $food) {
                $days[$food->civil_date] ??= $empty;
                $days[$food->civil_date]['foods'][] = $food->title;
            }
        }

        return $days;
    }

    public function completed(array $days): int
    {
        return count(array_filter($days, fn ($day) => $day['planned'] > 0 && $day['planned'] === $day['recorded']));
    }
}
