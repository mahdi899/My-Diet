<?php

namespace App\Modules\Admin\Infrastructure;

use App\Shared\Domain\LegacyCrypto as Crypto;
use App\Shared\Domain\Problem;
use Illuminate\Database\ConnectionInterface;
use Throwable;

final class MySqlAnalytics
{
    private const PATHS = ['/onboarding', '/onboarding/', '/onboarding/index.html', '/onboarding/goals', '/onboarding/goals.html', '/onboarding/quiz', '/onboarding/quiz.html', '/onboarding/payment', '/onboarding/payment.html'];

    private const LOCAL_WEBSITE = 'd3a0eb23-8565-4267-b16d-6cd5111d3ff1';

    private const PAYMENT_STEPS = ['payment', 'payment_gateway', 'payment_transfer', 'payment_success'];

    private const MILESTONES = ['entry', 'goals', 'quiz', 'completed', 'plans', 'contacted', 'registered', 'payment', 'paid'];

    public function __construct(private ConnectionInterface $db) {}

    public function reset(string $actor): array
    {
        $this->db->statement("insert into app_settings (`key`, value, updated_at) values ('analytics.report_reset', cast('true' as json), current_timestamp(6)) as incoming on duplicate key update updated_at=current_timestamp(6), version=app_settings.version+1");
        $resetAt = Crypto::iso((string) $this->db->table('app_settings')->where('key', 'analytics.report_reset')->value('updated_at'));
        $this->db->table('audit_logs')->insert(['id' => Crypto::uuid(), 'actor_id' => $actor, 'action' => 'web_analytics_reset', 'target_type' => 'web_analytics', 'target_id' => null, 'detail' => json_encode(['resetAt' => $resetAt], JSON_THROW_ON_ERROR)]);

        return ['resetAt' => $resetAt];
    }

    public function live(?string $campaign): array
    {
        return $this->positions($campaign, false, null, null, false);
    }

    public function departures(?string $campaign, ?string $since, ?string $until, bool $includePaid = false): array
    {
        return $this->positions($campaign, true, $since, $until, $includePaid);
    }

    public function collectLocal(array $data): void
    {
        $id = Crypto::uuid();
        $this->db->transaction(function () use ($id, $data): void {
            $this->db->table('website_event')->insert([
                'event_id' => $id, 'website_id' => $this->website(), 'visit_id' => $data['journey'], 'session_id' => $data['journey'],
                'event_type' => $data['name'] === 'pageview' ? 1 : 2, 'event_name' => $data['name'], 'url_path' => $data['page'],
                'utm_source' => $data['source'] ?? null, 'utm_campaign' => $data['campaign'] ?? null, 'created_at' => $this->db->raw('current_timestamp(6)'),
            ]);
            $attributes = [];
            foreach (['journey', 'step', 'goal', 'activeMs'] as $key) {
                if (isset($data[$key])) {
                    $attributes[] = ['website_event_id' => $id, 'data_key' => $key, 'string_value' => $key === 'activeMs' ? null : $data[$key], 'number_value' => $key === 'activeMs' ? $data[$key] : null];
                }
            }
            $this->db->table('event_data')->insert($attributes);
        });
    }

    public function report(int $days, ?string $campaign): array
    {
        $events = $this->events();
        $website = $this->website();
        $reset = $this->resetTime();
        try {
            $where = 'e.website_id=? and e.created_at>=date_sub(current_timestamp(6), interval ? day) and (? is null or e.created_at>=?) and (? is null or e.utm_campaign=?) and (e.tag is null or e.tag<>\'qa\')';
            $bind = [$website, $days, $reset, $reset, $campaign, $campaign];
            $summary = $events->selectOne('select sum(e.event_type=1) as pageviews, count(distinct e.session_id) as visitors, count(distinct e.visit_id) as visits, count(distinct case when e.event_name=\'questionnaire_completed\' then e.visit_id end) as completed from website_event e where '.$where, $bind);
            $named = $events->select('select e.event_name as name, count(*) as count, count(distinct e.visit_id) as visits from website_event e where '.$where.' and e.event_type=2 group by e.event_name order by count(*) desc limit 50', $bind);
            $goalRows = $events->select('select d.string_value as goal, count(*) as clicks, count(distinct coalesce(j.string_value,e.visit_id)) as visits from website_event e join event_data d on d.website_event_id=e.event_id and d.data_key=\'goal\' left join event_data j on j.website_event_id=e.event_id and j.data_key=\'journey\' where '.$where.' and e.event_name=\'goal_selected\' group by d.string_value order by visits desc, clicks desc, goal', $bind);
            $stages = $events->select('select v.step, v.views, v.visits, round(coalesce(avg(t.seconds),0),1) as averageSeconds, round(coalesce(sum(t.seconds),0),1) as totalSeconds from (select s.string_value as step, count(*) as views, count(distinct e.visit_id) as visits from website_event e join event_data s on s.website_event_id=e.event_id and s.data_key=\'step\' where '.$where.' and e.event_name=\'step_view\' group by s.string_value) v left join (select e.visit_id, s.string_value as step, sum(least(30000, greatest(0, t.number_value)))/1000.0 as seconds from website_event e join event_data s on s.website_event_id=e.event_id and s.data_key=\'step\' join event_data t on t.website_event_id=e.event_id and t.data_key=\'activeMs\' where '.$where.' and e.event_name=\'step_time\' group by e.visit_id, s.string_value) t on t.step=v.step group by v.step, v.views, v.visits order by v.views desc limit 200', [...$bind, ...$bind]);
            $sources = $events->select('select coalesce(nullif(e.utm_source,\'\'), nullif(e.referrer_domain,\'\'), \'direct\') as source, coalesce(e.utm_campaign,\'\') as campaign, count(distinct e.visit_id) as visits from website_event e where '.$where.' and e.event_type=1 group by 1, 2 order by count(distinct e.visit_id) desc limit 100', $bind);
            $daily = $events->select('select date_format(date_add(e.created_at, interval 210 minute), \'%Y-%m-%d\') as day, sum(e.event_type=1) as pageviews, count(distinct e.visit_id) as visits from website_event e where '.$where.' group by 1 order by 1', $bind);
            $active = (int) ($events->selectOne('select count(*) as count from (select visit_id, event_name, created_at, row_number() over (partition by visit_id order by created_at desc) as rn from website_event e where '.$where.' and e.event_name in (\'active_heartbeat\',\'presence_end\')) presence where rn=1 and event_name=\'active_heartbeat\' and created_at>date_sub(current_timestamp(6), interval 25 second)', $bind)->count ?? 0);
            [$funnel, $exits] = $this->funnel($events, $where, $bind);
        } catch (Throwable) {
            throw new Problem(503, 'analytics_unavailable', 'دریافت گزارش رهگیری انجام نشد؛ دوباره تلاش کنید');
        }
        $clicks = array_sum(array_map(fn ($row) => (int) $row->clicks, $goalRows));

        return ['days' => $days, 'resetAt' => $reset, 'generatedAt' => gmdate('Y-m-d\TH:i:s.v\Z'), 'summary' => ['pageviews' => (int) $summary->pageviews, 'visitors' => (int) $summary->visitors, 'visits' => (int) $summary->visits, 'completed' => (int) $summary->completed], 'activeSessions' => $active, 'events' => array_map(fn ($row) => ['name' => $row->name, 'count' => (int) $row->count, 'visits' => (int) $row->visits], $named), 'goals' => array_map(fn ($row) => ['goal' => $row->goal, 'clicks' => (int) $row->clicks, 'visits' => (int) $row->visits, 'percent' => $clicks === 0 ? 0 : round((int) $row->clicks / $clicks * 1000) / 10], $goalRows), 'stages' => array_map(fn ($row) => ['step' => $row->step, 'views' => (int) $row->views, 'visits' => (int) $row->visits, 'averageSeconds' => (float) $row->averageSeconds, 'totalSeconds' => (float) $row->totalSeconds], $stages), 'funnel' => $funnel, 'exits' => $exits, 'sources' => array_map(fn ($row) => ['source' => $row->source, 'campaign' => $row->campaign, 'visits' => (int) $row->visits], $sources), 'daily' => array_map(fn ($row) => ['day' => $row->day, 'pageviews' => (int) $row->pageviews, 'visits' => (int) $row->visits], $daily)];
    }

    private function positions(?string $campaign, bool $departed, ?string $since, ?string $until, bool $includePaid): array
    {
        $events = $this->events();
        $window = $departed ? 86400 : 90;
        $paths = implode(',', array_fill(0, count(self::PATHS), '?'));
        $since = max($since ?? gmdate('Y-m-d H:i:s', time() - $window), $this->resetTime() ?? '');
        $params = array_merge([$this->website(), $since], self::PATHS, [$campaign, $campaign, $until, $until]);
        try {
            $presence = $departed ? '' : "and event_name<>'presence_end' and lastSeen>=date_sub(current_timestamp(6), interval 25 second)";
            $rows = $events->select("select id, page, step, campaign, lastSeen, reachedPayment from (select coalesce(j.string_value, e.visit_id) as id, e.url_path as page, s.string_value as step, e.utm_campaign as campaign, e.created_at as lastSeen, e.event_name, max(s.string_value in ('payment','payment_gateway','payment_transfer','payment_success')) over (partition by coalesce(j.string_value, e.visit_id)) as reachedPayment, row_number() over (partition by coalesce(j.string_value, e.visit_id) order by e.created_at desc, e.event_id desc) as rn from website_event e left join event_data j on j.website_event_id=e.event_id and j.data_key='journey' join event_data s on s.website_event_id=e.event_id and s.data_key='step' where e.website_id=? and e.created_at>=? and (e.tag is null or e.tag<>'qa') and e.event_name in ('step_view','active_heartbeat','presence_end') and e.url_path in ($paths)) ranked where rn=1 and (? is null or campaign=?) and (? is null or lastSeen<?) $presence order by lastSeen desc limit 500", $params);
            $links = $this->purchaseLinks(array_column($rows, 'id'));
        } catch (Throwable) {
            throw new Problem(503, 'analytics_unavailable', $departed ? 'دریافت نتیجهٔ نشست‌ها ممکن نشد' : 'دریافت موقعیت زنده کاربران ممکن نشد');
        }
        $cutoff = time() - 120;
        $sessions = [];
        foreach ($rows as $row) {
            $seen = strtotime((string) $row->lastSeen.' UTC');
            $link = $links[$row->id] ?? null;
            $paid = $link?->paidAt !== null;
            if ($departed && ($paid ? ! $includePaid : $seen >= $cutoff)) {
                continue;
            }
            $step = $row->step;
            if ($step === 'payment_success' || ($link?->hasOrder && ! in_array($step, self::PAYMENT_STEPS, true))) {
                $step = 'payment';
            }
            $sessions[] = ['id' => $row->id, 'page' => $row->page, 'step' => $paid ? 'payment_success' : $step, 'campaign' => $row->campaign, 'lastSeen' => Crypto::iso((string) $row->lastSeen), 'phone' => $link?->phone_e164, 'reachedPayment' => $paid || (bool) $row->reachedPayment || (bool) $link?->hasOrder, 'paid' => $paid];
            if (count($sessions) === 200) {
                break;
            }
        }

        return ['sessions' => $sessions, 'generatedAt' => gmdate('Y-m-d\TH:i:s.v\Z')];
    }

    private function funnel(ConnectionInterface $events, string $where, array $bind): array
    {
        $paths = implode(',', array_fill(0, count(self::PATHS), '?'));
        $rows = $events->select("with tracked as (
            select coalesce(j.string_value,e.visit_id) as id, e.event_id, e.event_name, e.created_at, s.string_value as step
            from website_event e left join event_data j on j.website_event_id=e.event_id and j.data_key='journey'
            left join event_data s on s.website_event_id=e.event_id and s.data_key='step'
            where $where and e.url_path in ($paths) and (e.event_type=2 or j.string_value is not null)
        ), journeys as (
            select id, max(created_at) as lastSeen,
                max(step='goals' or event_name='start_clicked') as goals,
                max(step='quiz' or step like 'question:%' or event_name='goal_selected') as quiz,
                max(event_name='questionnaire_completed') as completed,
                max(step='plans') as plans, max(event_name='phone_registered') as contacted, max(event_name='otp_verified') as registered,
                max(step in ('payment','payment_gateway','payment_transfer','payment_success')) as payment
            from tracked group by id
        ), steps as (
            select id, step, row_number() over (partition by id order by created_at desc, event_id desc) as rn
            from tracked where event_name='step_view' and step is not null
        ) select journeys.*, steps.step from journeys left join steps on steps.id=journeys.id and steps.rn=1", [...$bind, ...self::PATHS]);

        $links = $this->purchaseLinks(array_column($rows, 'id'));
        $counts = array_fill_keys(self::MILESTONES, 0);
        $cutoff = time() - 120;
        $last = [];
        foreach ($rows as $row) {
            $link = $links[$row->id] ?? null;
            $paid = $link?->paidAt !== null;
            $payment = (bool) $row->payment || (bool) $link?->hasOrder;
            $counts['entry']++;
            $counts['goals'] += (int) $row->goals;
            $counts['quiz'] += (int) $row->quiz;
            $counts['completed'] += (int) $row->completed;
            $counts['plans'] += (int) $row->plans;
            $counts['contacted'] += (int) ($row->contacted || $link !== null);
            $counts['registered'] += (int) ($row->registered || $link !== null);
            $counts['payment'] += (int) $payment;
            $counts['paid'] += (int) $paid;

            if (! $paid && strtotime($row->lastSeen.' UTC') < $cutoff) {
                $step = $row->step ?? 'intro';
                if ($step === 'payment_success' || ($link?->hasOrder && ! in_array($step, self::PAYMENT_STEPS, true))) {
                    $step = 'payment';
                }
                $last[$step] = ($last[$step] ?? 0) + 1;
            }
        }
        $funnel = [];
        foreach ($counts as $step => $visits) {
            $funnel[] = ['step' => $step, 'visits' => $visits, 'percent' => $this->percent($visits, $counts['entry'])];
        }
        $exits = [];
        $totalExits = array_sum($last);
        foreach ($last as $step => $visits) {
            $exits[] = ['step' => $step, 'visits' => $visits, 'percent' => $this->percent($visits, $totalExits)];
        }
        usort($exits, fn ($a, $b) => $b['visits'] <=> $a['visits'] ?: $a['step'] <=> $b['step']);

        return [$funnel, $exits];
    }

    private function percent(int $part, int $total): float
    {
        return $total === 0 ? 0.0 : round(100 * $part / $total, 1);
    }

    private function purchaseLinks(array $ids): array
    {
        $links = [];
        foreach (array_chunk($ids, 500) as $chunk) {
            $rows = $this->db->table('onboarding_analytics_journeys as j')
                ->leftJoin('onboarding_transfers as t', fn ($join) => $join->on('t.submission_id', '=', 'j.submission_id')->on('t.user_id', '=', 'j.user_id'))
                ->whereIn('j.journey_id', $chunk)->groupBy('j.journey_id', 'j.phone_e164')
                ->selectRaw('j.journey_id, j.phone_e164, count(t.id)>0 as hasOrder, min(t.confirmed_at) as paidAt')->get();
            foreach ($rows as $row) {
                $links[$row->journey_id] = $row;
            }
        }

        return $links;
    }

    private function website(): string
    {
        return app()->environment('local') ? self::LOCAL_WEBSITE : (string) config('analytics.website_id');
    }

    private function events(): ConnectionInterface
    {
        if (app()->environment('local')) {
            return $this->db;
        }
        $url = config('analytics.url');
        $website = config('analytics.website_id');
        if (! is_string($url) || $url === '' || ! is_string($website) || $website === '') {
            throw new Problem(503, 'analytics_unavailable', 'سرویس رهگیری هنوز متصل نشده است');
        }
        if ($url === (string) config('database.connections.mysql.url')) {
            return $this->db;
        }
        config(['database.connections.analytics' => ['driver' => 'mysql', 'url' => $url, 'charset' => 'utf8mb4', 'collation' => 'utf8mb4_0900_bin', 'prefix' => '']]);

        return app('db')->connection('analytics');
    }

    private function resetTime(): ?string
    {
        $value = $this->db->table('app_settings')->where('key', 'analytics.report_reset')->value('updated_at');

        return is_string($value) ? $value : null;
    }
}
