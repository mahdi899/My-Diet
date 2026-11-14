<?php

namespace App\Modules\Admin\Infrastructure;

use App\Shared\Domain\LegacyCrypto as Crypto;
use App\Shared\Domain\Problem;
use Illuminate\Database\ConnectionInterface;
use Throwable;

final class MySqlAnalytics
{
    private const PATHS = ['/onboarding', '/onboarding/', '/onboarding/index.html', '/onboarding/goals', '/onboarding/goals.html', '/onboarding/quiz', '/onboarding/quiz.html', '/onboarding/payment', '/onboarding/payment.html'];

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
        return $this->positions($campaign, false, null, null);
    }

    public function departures(?string $campaign, ?string $since, ?string $until): array
    {
        return $this->positions($campaign, true, $since, $until);
    }

    public function report(int $days, ?string $campaign): array
    {
        $events = $this->events();
        $website = (string) config('analytics.website_id');
        $reset = $this->resetTime();
        try {
            $where = 'e.website_id=? and e.created_at>=date_sub(current_timestamp(6), interval ? day) and (? is null or e.created_at>=?) and (? is null or e.utm_campaign=?) and (e.tag is null or e.tag<>\'qa\')';
            $bind = [$website, $days, $reset, $reset, $campaign, $campaign];
            $summary = $events->selectOne('select sum(e.event_type=1) as pageviews, count(distinct e.session_id) as visitors, count(distinct e.visit_id) as visits, count(distinct case when e.event_name=\'questionnaire_completed\' then e.visit_id end) as completed from website_event e where '.$where, $bind);
            $named = $events->select('select e.event_name as name, count(*) as count, count(distinct e.visit_id) as visits from website_event e where '.$where.' and e.event_type=2 group by e.event_name order by count(*) desc limit 50', $bind);
            $goalRows = $events->select('select d.string_value as goal, count(*) as clicks, count(distinct e.visit_id) as visits from website_event e join event_data d on d.website_event_id=e.event_id and d.data_key=\'goal\' where '.$where.' and e.event_name=\'goal_selected\' group by d.string_value order by count(*) desc', $bind);
            $stages = $events->select('select v.step, v.views, v.visits, round(coalesce(avg(t.seconds),0),1) as averageSeconds, round(coalesce(sum(t.seconds),0),1) as totalSeconds from (select s.string_value as step, count(*) as views, count(distinct e.visit_id) as visits from website_event e join event_data s on s.website_event_id=e.event_id and s.data_key=\'step\' where '.$where.' and e.event_name=\'step_view\' group by s.string_value) v left join (select e.visit_id, s.string_value as step, sum(least(30000, greatest(0, t.number_value)))/1000.0 as seconds from website_event e join event_data s on s.website_event_id=e.event_id and s.data_key=\'step\' join event_data t on t.website_event_id=e.event_id and t.data_key=\'activeMs\' where '.$where.' and e.event_name=\'step_time\' group by e.visit_id, s.string_value) t on t.step=v.step group by v.step, v.views, v.visits order by v.views desc limit 200', [...$bind, ...$bind]);
            $sources = $events->select('select coalesce(nullif(e.utm_source,\'\'), nullif(e.referrer_domain,\'\'), \'direct\') as source, coalesce(e.utm_campaign,\'\') as campaign, count(distinct e.visit_id) as visits from website_event e where '.$where.' and e.event_type=1 group by 1, 2 order by count(distinct e.visit_id) desc limit 100', $bind);
            $daily = $events->select('select date_format(date_add(e.created_at, interval 210 minute), \'%Y-%m-%d\') as day, sum(e.event_type=1) as pageviews, count(distinct e.visit_id) as visits from website_event e where '.$where.' group by 1 order by 1', $bind);
            $active = (int) ($events->selectOne('select count(*) as count from (select visit_id, event_name, created_at, row_number() over (partition by visit_id order by created_at desc) as rn from website_event e where '.$where.' and e.event_name in (\'active_heartbeat\',\'presence_end\')) presence where rn=1 and event_name=\'active_heartbeat\' and created_at>date_sub(current_timestamp(6), interval 25 second)', $bind)->count ?? 0);
            $exits = $this->exits($events, $where, $bind);
        } catch (Throwable) {
            throw new Problem(503, 'analytics_unavailable', 'دریافت گزارش رهگیری انجام نشد؛ دوباره تلاش کنید');
        }
        $clicks = array_sum(array_map(fn ($row) => (int) $row->clicks, $goalRows));

        return ['days' => $days, 'resetAt' => $reset, 'generatedAt' => gmdate('Y-m-d\TH:i:s.v\Z'), 'summary' => ['pageviews' => (int) $summary->pageviews, 'visitors' => (int) $summary->visitors, 'visits' => (int) $summary->visits, 'completed' => (int) $summary->completed], 'activeSessions' => $active, 'events' => array_map(fn ($row) => ['name' => $row->name, 'count' => (int) $row->count, 'visits' => (int) $row->visits], $named), 'goals' => array_map(fn ($row) => ['goal' => $row->goal, 'clicks' => (int) $row->clicks, 'visits' => (int) $row->visits, 'percent' => $clicks === 0 ? 0 : round((int) $row->clicks / $clicks * 1000) / 10], $goalRows), 'stages' => array_map(fn ($row) => ['step' => $row->step, 'views' => (int) $row->views, 'visits' => (int) $row->visits, 'averageSeconds' => (float) $row->averageSeconds, 'totalSeconds' => (float) $row->totalSeconds], $stages), 'exits' => $exits, 'sources' => array_map(fn ($row) => ['source' => $row->source, 'campaign' => $row->campaign, 'visits' => (int) $row->visits], $sources), 'daily' => array_map(fn ($row) => ['day' => $row->day, 'pageviews' => (int) $row->pageviews, 'visits' => (int) $row->visits], $daily)];
    }

    private function positions(?string $campaign, bool $departed, ?string $since, ?string $until): array
    {
        $events = $this->events();
        $window = $departed ? 86400 : 90;
        $paths = implode(',', array_fill(0, count(self::PATHS), '?'));
        $params = array_merge([(string) config('analytics.website_id'), $since ?? gmdate('Y-m-d H:i:s', time() - $window)], self::PATHS, [$campaign, $campaign]);
        try {
            $rows = $events->select("select id, page, step, campaign, lastSeen, event_name from (select coalesce(j.string_value, e.visit_id) as id, e.url_path as page, s.string_value as step, e.utm_campaign as campaign, e.created_at as lastSeen, e.event_name, row_number() over (partition by coalesce(j.string_value, e.visit_id) order by e.created_at desc, e.event_id desc) as rn from website_event e left join event_data j on j.website_event_id=e.event_id and j.data_key='journey' left join event_data s on s.website_event_id=e.event_id and s.data_key='step' where e.website_id=? and e.created_at>=? and (e.tag is null or e.tag<>'qa') and e.event_name in ('step_view','active_heartbeat','presence_end') and e.url_path in ($paths)) ranked where rn=1 and (? is null or campaign=?) order by lastSeen desc limit 200", $params);
        } catch (Throwable) {
            throw new Problem(503, 'analytics_unavailable', $departed ? 'دریافت نتیجهٔ نشست‌ها ممکن نشد' : 'دریافت موقعیت زنده کاربران ممکن نشد');
        }
        $now = time();
        $sessions = [];
        foreach ($rows as $row) {
            $seen = strtotime((string) $row->lastSeen.' UTC');
            $kept = $departed
                ? $seen < $now - 120 && ($until === null || $row->lastSeen < $until) && $row->step !== 'payment_success'
                : $row->step === 'preparing' || ($row->event_name !== 'presence_end' && $seen >= $now - 25);
            if (! $kept) {
                continue;
            }
            $phone = null;
            if (preg_match('/^[0-9a-f-]{36}$/i', (string) $row->id)) {
                $phone = $this->db->table('onboarding_analytics_journeys')->where('journey_id', $row->id)->value('phone_e164');
            }
            $sessions[] = ['id' => $row->id, 'page' => $row->page, 'step' => $row->step, 'campaign' => $row->campaign, 'lastSeen' => Crypto::iso((string) $row->lastSeen), 'phone' => $phone];
        }

        return ['sessions' => $sessions, 'generatedAt' => gmdate('Y-m-d\TH:i:s.v\Z')];
    }

    /** Last step of each onboarding path that went quiet without a verified phone. */
    private function exits(ConnectionInterface $events, string $where, array $bind): array
    {
        $rows = $events->select('select e.event_id, e.visit_id, e.event_name, e.created_at, j.string_value as journey, s.string_value as step from website_event e left join event_data j on j.website_event_id=e.event_id and j.data_key=\'journey\' left join event_data s on s.website_event_id=e.event_id and s.data_key=\'step\' where '.$where.' order by e.visit_id, e.created_at, e.event_id', $bind);
        $byVisit = [];
        foreach ($rows as $row) {
            $byVisit[$row->visit_id][] = $row;
        }
        $cutoff = time() - 120;
        $last = [];
        foreach ($byVisit as $eventsInVisit) {
            $registered = false;
            $latest = 0;
            $steps = [];
            foreach ($eventsInVisit as $row) {
                $seen = strtotime((string) $row->created_at.' UTC');
                $latest = max($latest, $seen);
                if ($row->event_name === 'phone_registered') {
                    $registered = true;
                }
                if ($row->event_name === 'step_view' && $row->step !== null) {
                    $steps[] = $row;
                }
            }
            if ($registered || $latest >= $cutoff || $steps === []) {
                continue;
            }
            $paths = [];
            $previous = null;
            $path = 0;
            foreach ($steps as $index => $row) {
                $step = (string) $row->step;
                $starts = $previous === null
                    || ($step === 'intro' && $previous !== 'intro')
                    || ($step === 'goals' && ! in_array($previous, ['intro', 'goals'], true))
                    || ($step === 'quiz' && ! in_array($previous, ['intro', 'goals'], true))
                    || (str_starts_with($step, 'question:') && str_starts_with((string) $previous, 'question:') && explode(':', $step, 3)[1] !== explode(':', (string) $previous, 3)[1]);
                if ($row->journey !== null) {
                    $key = 'new:'.$row->journey;
                } elseif ($starts) {
                    $path = $index;
                    $key = 'legacy:'.$row->event_id;
                } else {
                    $key = 'legacy:'.$steps[$path]->event_id;
                }
                $paths[$key] = $step;
                $previous = $row->journey === null ? $step : $previous;
            }
            foreach ($paths as $step) {
                $last[$step] = ($last[$step] ?? 0) + 1;
            }
        }
        $total = array_sum($last);
        $result = [];
        foreach ($last as $step => $visits) {
            $result[] = ['step' => $step, 'visits' => $visits, 'percent' => $total === 0 ? 0.0 : round(1000 * $visits / $total) / 10];
        }
        usort($result, fn ($a, $b) => $b['visits'] <=> $a['visits'] ?: $a['step'] <=> $b['step']);

        return $result;
    }

    private function events(): ConnectionInterface
    {
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
