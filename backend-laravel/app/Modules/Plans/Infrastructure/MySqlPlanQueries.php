<?php

namespace App\Modules\Plans\Infrastructure;

use App\Modules\Plans\Application\PlanQueryStore;
use Illuminate\Database\ConnectionInterface;

final class MySqlPlanQueries implements PlanQueryStore
{
    public function __construct(private ConnectionInterface $db) {}

    private function rows(array $rows): array
    {
        return array_map(fn ($row) => (array) $row, $rows);
    }

    public function active(string $user): ?array
    {
        $row = $this->db->selectOne("select r.id,v.id as version_id,r.week_start,r.effective_from from plan_versions v join plan_requests r on r.id=v.request_id
            where r.user_id=? and v.status='published' and r.week_start is not null and (not exists(select 1 from active_plan_versions a where a.user_id=r.user_id)
            or exists(select 1 from active_plan_versions a where a.user_id=r.user_id and a.version_id=v.id)) order by v.published_at desc limit 1", [$user]);

        return $row === null ? null : (array) $row;
    }

    public function dated(string $user, string $from, string $to): array
    {
        return $this->rows($this->db->select("select v.id as version_id,r.id as request_id,v.status,v.published_at,d.civil_date,d.day_index from plan_days d
            join plan_versions v on v.id=d.plan_version_id join plan_requests r on r.id=v.request_id where r.user_id=? and v.status in ('published','superseded') and v.published_at is not null and d.civil_date between ? and ?", [$user, $from, $to]));
    }

    public function days(string $version): array
    {
        $days = $this->db->table('plan_days')->where('plan_version_id', $version)->orderBy('day_index')->get();
        $meals = $this->db->table('plan_meals as m')->join('plan_days as d', 'd.id', '=', 'm.plan_day_id')->where('d.plan_version_id', $version)->select('m.*')->orderBy('m.position')->get()->all();
        $items = $this->db->table('plan_meal_items as i')->join('plan_meals as m', 'm.id', '=', 'i.meal_id')->join('plan_days as d', 'd.id', '=', 'm.plan_day_id')->where('d.plan_version_id', $version)->select('i.*')->orderBy('i.position')->get()->all();
        $options = $this->db->table('plan_meal_options as o')->join('plan_meals as m', 'm.id', '=', 'o.meal_id')->join('plan_days as d', 'd.id', '=', 'm.plan_day_id')->where('d.plan_version_id', $version)->select('o.*')->orderBy('o.kind')->get()->all();
        $mealIds = array_map(fn ($meal) => $meal->id, $meals);
        $swaps = $mealIds === [] ? [] : $this->db->table('meal_swap_logs')->whereIn('meal_id', $mealIds)->orderBy('created_at')->get()->all();
        $latestSwap = [];
        foreach ($swaps as $swap) {
            $latestSwap[$swap->meal_id] = $swap;
        }

        return array_map(fn ($day) => ['id' => $day->id, 'dayIndex' => $day->day_index, 'meals' => array_map(fn ($meal) => [
            'id' => $meal->id,
            'mealUid' => $meal->meal_uid, 'options' => array_map(fn ($option) => json_decode($option->document, true, 512, JSON_THROW_ON_ERROR), array_values(array_filter($options, fn ($option) => $option->meal_id === $meal->id))),
            'mealType' => $meal->meal_type, 'suggestedTime' => $meal->suggested_time,
            'title' => isset($latestSwap[$meal->id]) ? $latestSwap[$meal->id]->new_title : $meal->title,
            'calories' => isset($latestSwap[$meal->id]) && $latestSwap[$meal->id]->new_kcal !== null ? (int) $latestSwap[$meal->id]->new_kcal : $meal->calories,
            'plannedTitle' => $meal->title,
            'notes' => $meal->notes,
            'items' => array_map(fn ($item) => ['name' => $item->name, 'quantity' => $item->quantity === null ? null : (float) $item->quantity, 'unit' => $item->unit], array_values(array_filter($items, fn ($item) => $item->meal_id === $meal->id))),
        ], array_values(array_filter($meals, fn ($meal) => $meal->plan_day_id === $day->id)))], $days->all());
    }

    public function activity(string $user, string $request, string $date): array
    {
        $logs = $this->rows($this->db->table('meal_logs')->where(['user_id' => $user, 'request_id' => $request, 'scheduled_date' => $date])->get()->all());
        foreach ($logs as &$row) {
            $row['details'] = json_decode($row['details'], true, 512, JSON_THROW_ON_ERROR);
            $row['eaten'] = (bool) $row['eaten'];
        }

        return ['logs' => $logs, 'selections' => $this->rows($this->db->table('meal_selections')->where(['user_id' => $user, 'civil_date' => $date])->get()->all())];
    }

    public function latest(string $user): ?array
    {
        $row = $this->db->table('plan_requests as r')->join('users as u', 'u.id', '=', 'r.user_id')->leftJoin('nutrition_profiles as p', 'p.user_id', '=', 'r.user_id')->where('r.user_id', $user)->select('r.*', 'u.display_name', 'p.safety_tier')->orderByDesc('r.created_at')->first();

        return $row === null ? null : (array) $row;
    }

    public function latestGenerationStatus(string $request): ?string
    {
        $status = $this->db->table('ai_generations')->where('request_id', $request)->orderByDesc('created_at')->value('status');

        return is_string($status) ? $status : null;
    }

    public function requests(string $user): array
    {
        return $this->rows($this->db->table('plan_requests')->where('user_id', $user)->orderByDesc('created_at')->limit(50)->get()->all());
    }

    public function request(string $user, string $id): ?array
    {
        $row = $this->db->table('plan_requests')->where(['id' => $id, 'user_id' => $user])->first();

        return $row === null ? null : (array) $row;
    }

    public function events(string $request): array
    {
        return $this->rows($this->db->table('request_events')->where('request_id', $request)->orderBy('created_at')->get()->all());
    }

    public function questions(string $request): array
    {
        return $this->rows($this->db->table('info_questions')->where('request_id', $request)->orderBy('created_at')->get()->all());
    }

    public function answers(string $request): array
    {
        return $this->rows($this->db->table('info_answers as a')->join('info_questions as q', 'q.id', '=', 'a.question_id')->where('q.request_id', $request)->select('a.*')->orderBy('a.created_at')->get()->all());
    }

    public function conversation(string $request): ?string
    {
        return $this->db->table('conversations')->where(['request_id' => $request, 'kind' => 'care'])->value('id');
    }

    public function userQuestions(string $user, string $status): array
    {
        return $this->rows($this->db->table('info_questions as q')->join('plan_requests as r', 'r.id', '=', 'q.request_id')->where('r.user_id', $user)->where('q.status', $status)->select('q.*')->orderBy('q.created_at')->limit(100)->get()->all());
    }

    public function queue(string $actor, ?string $bucket): array
    {
        $where = ['generating' => "r.status in ('queued','generating')", 'awaiting_review' => "r.status='in_review' and r.kind='new_plan'", 'awaiting_user' => "r.status='awaiting_user'",
            'response_received' => "r.status='response_received'", 'revisions' => "r.kind in ('ai_revision','specialist_revision') and r.status not in ('published','cancelled')", 'published' => "r.status='published'"];
        $q = $this->db->table('plan_requests as r')->join('users as u', 'u.id', '=', 'r.user_id')->where('r.assigned_specialist_id', $actor)->select('r.id', 'r.status', 'r.kind', 'r.created_at', 'u.display_name')->orderByDesc('r.created_at')->limit(100);
        if ($bucket !== null) {
            $q->whereRaw($where[$bucket]);
        }

        return array_map(function (array $row): array {
            $waiting = ! in_array($row['status'], ['published', 'cancelled'], true);
            $elapsed = time() - strtotime((string) $row['created_at']);
            $row['overdue'] = $waiting && $elapsed > 86400;
            $row['slaHoursLeft'] = $waiting ? max(0, (int) ceil((86400 - $elapsed) / 3600)) : null;

            return $row;
        }, $this->rows($q->get()->all()));
    }
}
