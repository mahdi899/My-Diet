<?php

namespace App\Modules\Admin\Infrastructure;

use App\Modules\Plans\Domain\CivilDates;
use App\Modules\Rewards\Domain\StreakRules;
use Illuminate\Database\ConnectionInterface;

final class DoctorActivity
{
    public function __construct(private ConnectionInterface $db) {}

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
