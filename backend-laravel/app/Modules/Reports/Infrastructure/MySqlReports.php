<?php

namespace App\Modules\Reports\Infrastructure;

use App\Modules\Plans\Domain\CivilDates;
use App\Shared\Domain\Amount;
use App\Shared\Domain\LegacyCrypto as Crypto;
use App\Shared\Domain\Problem;
use Illuminate\Database\ConnectionInterface;

final class MySqlReports
{
    public function __construct(private ConnectionInterface $db) {}

    public function retention(string $from, string $to, string $event): array
    {
        if (! CivilDates::valid($from) || ! CivilDates::valid($to) || $from > $to) {
            return ['status' => 'invalid', 'rows' => []];
        }
        if (! in_array($event, ['activity', 'tracking', 'purchase'], true)) {
            throw new Problem(400, 'validation', 'رویداد بازگشت نامعتبر است');
        }
        $rows = [];
        $within = function (int $days) use ($event): string {
            $end = "date_add(f.started_on,interval $days day)";

            return match ($event) {
                'activity' => "exists(select 1 from sessions s where s.user_id=f.user_id and ((date(date_add(s.created_at,interval 210 minute))>f.started_on and date(date_add(s.created_at,interval 210 minute))<=$end) or (date(date_add(s.last_seen_at,interval 210 minute))>f.started_on and date(date_add(s.last_seen_at,interval 210 minute))<=$end)))",
                'tracking' => "exists(select 1 from meal_logs m where m.user_id=f.user_id and m.scheduled_date>f.started_on and m.scheduled_date<=$end and (m.eaten=1 or json_unquote(json_extract(m.details,'$.state')) collate utf8mb4_0900_bin in ('as_planned','less','more','different')))",
                'purchase' => "exists(select 1 from orders o where o.user_id=f.user_id and o.status='paid' and o.id<>f.order_id and date(date_add(o.created_at,interval 210 minute))>f.started_on and date(date_add(o.created_at,interval 210 minute))<=$end)"
            };
        };
        $sql = "with ranked as (select user_id,id as order_id,date(date_add(created_at,interval 210 minute)) as started_on,row_number() over(partition by user_id order by created_at,id) as n from orders where status='paid' and service_code='new_plan'),
            first_orders as (select user_id,order_id,started_on from ranked where n=1)
            select started_on,count(*) as size,sum(".$within(7).') as week1,sum('.$within(14).') as week2,sum('.$within(28).') as week4 from first_orders f where started_on between ? and ? group by started_on order by started_on';
        foreach ($this->db->select($sql, [$from, $to]) as $row) {
            $started = substr((string) $row->started_on, 0, 10);
            $age = (int) (new \DateTimeImmutable($to))->diff(new \DateTimeImmutable($started))->days;
            $size = (int) $row->size;
            $cells = [];
            foreach (['week1' => 7, 'week2' => 14, 'week4' => 28] as $key => $days) {
                $cells[$key] = $age < $days ? ['state' => 'not_yet_measurable'] : ($size === 0 ? ['state' => 'no_denominator'] :
                    ['state' => 'measured', 'count' => (int) $row->$key, 'denominator' => $size, 'percent' => (int) floor(100 * $row->$key / $size + 0.5)]);
            }
            $rows[] = ['id' => $started, 'label' => $started, 'size' => $size, 'ageDays' => $age, 'cells' => $cells];
        }

        $definitions = ['activity' => 'بازگشت به برنامه بعد از روز شروع، بدون الزام ثبت وعده یا خرید', 'tracking' => 'ثبت حداقل یک وعدهٔ خورده‌شده در همان پنجره', 'purchase' => 'سفارش پرداخت‌شدهٔ بعدی در همان پنجره'];

        return ['status' => $rows === [] ? 'empty' : 'ready', 'from' => $from, 'to' => $to, 'asOf' => $to, 'event' => $event, 'definition' => $definitions[$event], 'anchor' => 'first_paid_new_plan', 'rows' => $rows];
    }

    public function foods(string $from, string $to, string $kind): array
    {
        if (! CivilDates::valid($from) || ! CivilDates::valid($to) || $from > $to) {
            return ['status' => 'invalid', 'rows' => []];
        }
        if (! in_array($kind, ['selected', 'alternative', 'disliked', 'reason'], true)) {
            throw new Problem(400, 'validation', 'نوع رتبه‌بندی شناخته نشد');
        }
        $events = [];
        if ($kind === 'reason') {
            foreach ($this->db->select('select reason_id,reason_label from meal_selections where civil_date between ? and ? and reason_id is not null', [$from, $to]) as $row) {
                $events[] = ['id' => $row->reason_id, 'label' => $row->reason_label];
            }
        } elseif ($kind === 'disliked') {
            foreach ($this->db->table('weekly_feedback')->whereBetween('week_start', [$from, $to])->get(['dislikes']) as $row) {
                foreach (json_decode($row->dislikes, true) as $item) {
                    $option = $this->db->table('plan_meal_options')->where('option_uid', $item)->value('document');
                    $label = $option ? (json_decode($option, true)['title'] ?? $item) : $item;
                    $events[] = ['id' => $label, 'label' => $label];
                }
            }
        } else {
            foreach ($this->db->select("select o.document from meal_selections s join plan_meal_options o on o.meal_id=s.meal_id and o.option_uid=s.option_uid where s.civil_date between ? and ? and (?='selected' or o.kind<>'primary')", [$from, $to, $kind]) as $row) {
                $label = json_decode($row->document, true)['title'] ?? '';
                if ($label !== '') {
                    $events[] = ['id' => $label, 'label' => $label];
                }
            }
        }
        $grouped = [];
        foreach ($events as $event) {
            $key = mb_strtolower(trim(preg_replace('/\s+/u', ' ', \Normalizer::normalize($event['label'], \Normalizer::FORM_KC))));
            if ($key === '') {
                continue;
            }
            $grouped[$key] ??= ['id' => $event['id'], 'label' => trim($event['label']), 'count' => 0, 'uncertain' => mb_strlen($key) < 4];
            $grouped[$key]['count']++;
        }
        $rows = array_values($grouped);
        usort($rows, fn ($a, $b) => $b['count'] <=> $a['count'] ?: strcmp($a['label'], $b['label']));

        return ['status' => $rows === [] ? 'empty' : 'ready', 'kind' => $kind, 'matching' => 'exact_normalized_label', 'rows' => $rows];
    }

    public function feedback(string $from, string $to): array
    {
        if (! CivilDates::valid($from) || ! CivilDates::valid($to) || $from > $to) {
            return ['status' => 'invalid', 'rows' => []];
        }
        $row = $this->db->selectOne("with eligible as (select distinct user_id from plan_requests where status='published' and week_start between ? and ?),
            first_orders as (select user_id,min(created_at) as first_at from orders where status='paid' group by user_id)
            select (select count(*) from eligible) as eligible,
            (select count(distinct f.user_id) from weekly_feedback f join eligible e on e.user_id=f.user_id where f.week_start between ? and ?) as submitted,
            (select count(distinct e.user_id) from eligible e join first_orders f on f.user_id=e.user_id join orders o on o.user_id=e.user_id and o.status='paid' and o.created_at>f.first_at where date(date_add(o.created_at,interval 210 minute)) between ? and ?) as continued", [$from, $to, $from, $to, $from, $to]);
        if (! $row->eligible) {
            return ['status' => 'empty'];
        }
        $cell = fn ($count) => ['count' => (int) $count, 'denominator' => (int) $row->eligible, 'percent' => (int) floor(100 * $count / $row->eligible + 0.5)];

        return ['status' => 'ready', 'participation' => $cell($row->submitted), 'continuation' => $cell($row->continued), 'continuationSeparateFromFeedback' => true];
    }

    public function specialists(string $sort): array
    {
        if (! in_array($sort, ['rating', 'response', 'workload'], true)) {
            throw new Problem(400, 'validation', 'مرتب‌سازی متخصص شناخته نشد');
        }
        $average = fn ($values) => $values === [] ? null : array_sum($values) / count($values);
        $rows = [];
        foreach ($this->db->table('specialist_profiles')->orderBy('display_name')->get() as $person) {
            $stars = $this->db->table('program_reviews as p')->join('plan_requests as r', 'r.id', '=', 'p.request_id')->where('r.assigned_specialist_id', $person->user_id)->pluck('p.rating')->all();
            $replies = $this->db->select("with asked as (select c.id,min(m.created_at) as asked_at from conversations c join plan_requests r on r.id=c.request_id join messages m on m.conversation_id=c.id and m.author_id=r.user_id and m.kind<>'system' where c.kind='care' and r.assigned_specialist_id=? group by c.id)
                select a.asked_at,min(m.created_at) as replied_at from asked a left join messages m on m.conversation_id=a.id and m.author_id=? and m.kind<>'system' and m.created_at>a.asked_at group by a.id,a.asked_at", [$person->user_id, $person->user_id]);
            $answered = array_values(array_filter($replies, fn ($r) => $r->replied_at !== null));
            $times = array_map(fn ($r) => (strtotime($r->replied_at) - strtotime($r->asked_at)) / 60, $answered);
            $changes = $this->db->table('plan_change_requests as c')->join('plan_requests as r', 'r.id', '=', 'c.plan_request_id')->where('r.assigned_specialist_id', $person->user_id)->select('c.*')->get()->all();
            $responses = array_values(array_filter($changes, fn ($c) => $c->first_responded_at !== null));
            $resolved = array_values(array_filter($changes, fn ($c) => in_array($c->status, ['approved', 'rejected'], true)));
            $pendingChanges = count(array_filter($changes, fn ($c) => in_array($c->status, ['awaiting_review', 'under_review'], true)));
            $pendingMessages = count($replies) - count($answered);
            $rows[] = ['id' => $person->user_id, 'name' => $person->display_name, 'ratingCount' => count($stars), 'ratingAverage' => $average($stars),
                'smallSample' => count($stars) > 0 && count($stars) < 5, 'distribution' => array_map(fn ($star) => ['star' => $star, 'count' => count(array_filter($stars, fn ($s) => $s === $star))], range(1, 5)),
                'messageResponse' => $average($times), 'messageSamples' => count($times),
                'changeResponse' => $average(array_map(fn ($c) => (strtotime($c->first_responded_at) - strtotime($c->created_at)) / 60, $responses)), 'changeResponseSamples' => count($responses),
                'reviewTime' => $average(array_map(fn ($c) => (strtotime($c->updated_at) - strtotime($c->created_at)) / 60, $resolved)), 'reviewSamples' => count($resolved),
                'pendingMessages' => $pendingMessages, 'pendingChanges' => $pendingChanges, 'pending' => $pendingChanges + $pendingMessages];
        }
        $field = ['rating' => 'ratingAverage', 'response' => 'messageResponse', 'workload' => 'pending'][$sort];
        usort($rows, fn ($a, $b) => ($a[$field] === null ? 1 : ($b[$field] === null ? -1 : (($a[$field] <=> $b[$field]) * ($sort === 'response' ? 1 : -1)))) ?: strcmp($a['name'], $b['name']));

        return ['sort' => $sort, 'timing' => 'elapsed_minutes', 'businessHours' => false, 'unanswered' => 'excluded_from_average', 'automaticMessages' => 'excluded', 'moderation' => 'ratings_kept', 'rows' => $rows];
    }

    public function sla(string $specialist): array
    {
        return $this->slaBoard($specialist)[0] ?? ['specialistId' => $specialist, 'displayName' => '', 'requests' => 0, 'published' => 0, 'overdue' => 0, 'medianResponseMinutes' => null];
    }

    public function adminSla(): array
    {
        return ['slaHours' => 24, 'specialists' => $this->slaBoard(null),
            'requestsByStatus' => array_map(fn ($r) => ['status' => $r->status, 'requests' => (int) $r->requests], $this->db->select('select status,count(*) as requests from plan_requests group by status order by status')),
            'creditedPaymentsByGateway' => array_map(fn ($r) => ['gateway' => $r->gateway, 'payments' => (int) $r->payments, 'amountToman' => Amount::safe($r->amount_toman)], $this->db->select("select gateway,count(*) as payments,sum(amount_toman) as amount_toman from payments where status='credited' group by gateway order by gateway"))];
    }

    private function slaBoard(?string $specialist): array
    {
        $people = $this->db->table('specialist_profiles')->orderBy('display_name');
        if ($specialist !== null) {
            $people->where('user_id', $specialist);
        }
        $board = [];
        foreach ($people->get() as $person) {
            $requests = $this->db->select("select r.id,r.status,r.created_at,min(e.created_at) as first_at from plan_requests r left join request_events e on e.request_id=r.id and e.kind in ('draft_edited','info_question','published') where r.assigned_specialist_id=? group by r.id,r.status,r.created_at", [$person->user_id]);
            $times = array_values(array_map(fn ($r) => (strtotime($r->first_at) - strtotime($r->created_at)) / 60, array_filter($requests, fn ($r) => $r->first_at !== null)));
            sort($times, SORT_NUMERIC);
            $n = count($times);
            $median = $n === 0 ? null : ($n % 2 ? $times[intdiv($n, 2)] : ($times[$n / 2 - 1] + $times[$n / 2]) / 2);
            $board[] = ['specialistId' => $person->user_id, 'displayName' => $person->display_name, 'requests' => count($requests),
                'published' => count(array_filter($requests, fn ($r) => $r->status === 'published')),
                'overdue' => count(array_filter($requests, fn ($r) => ! in_array($r->status, ['published', 'cancelled'], true) && $r->first_at === null && time() - strtotime($r->created_at) > 86400)),
                'medianResponseMinutes' => $median === null ? null : (int) floor($median + 0.5)];
        }

        return $board;
    }

    public function journey(array $body, ?string $user): array
    {
        $install = $body['installId'] ?? null;
        $session = $body['sessionId'] ?? null;
        $events = $body['events'] ?? null;
        if (! is_string($install) || ! is_string($session) || ! is_array($events) || $events === [] || count($events) > 40) {
            throw new Problem(400, 'validation', 'دستهٔ رویداد نامعتبر است');
        }
        $previous = null;
        $clean = [];
        foreach ($events as $event) {
            $at = $event['occurredAt'] ?? null;
            $type = $event['type'] ?? null;
            if (! is_string($at) || strtotime($at) === false || ! is_string($type) || ! preg_match('/^[a-z][a-z0-9_]{0,40}$/D', $type)) {
                throw new Problem(400, 'validation', 'رویداد نامعتبر است');
            }
            if ($previous !== null && $at < $previous) {
                throw new Problem(400, 'validation', 'زمان رویدادها باید به ترتیب باشد');
            }
            $previous = $at;
            $properties = is_array($event['properties'] ?? null) ? $event['properties'] : [];
            unset($properties['sessionType'], $properties['userId']);
            $clean[] = ['type' => $type, 'occurredAt' => $at, 'properties' => $properties];
        }
        $platform = in_array($body['platform'] ?? '', ['android', 'ios', 'web'], true) ? $body['platform'] : 'android';
        $version = is_string($body['appVersion'] ?? null) && preg_match('/^\d+\.\d+\.\d+$/D', $body['appVersion']) ? $body['appVersion'] : '0.0.0';
        if (! $this->db->table('journey_installs')->where('id', $install)->exists()) {
            $this->db->table('journey_installs')->insert(['id' => $install, 'linked_user_id' => $user, 'linked_at' => $user === null ? null : $this->db->raw('current_timestamp(6)')]);
        }
        $returning = $this->db->table('journey_sessions')->where('install_id', $install)->exists();
        if (! $this->db->table('journey_sessions')->where('id', $session)->exists()) {
            $this->db->table('journey_sessions')->insert(['id' => $session, 'install_id' => $install, 'user_id' => $user, 'platform' => $platform, 'app_version' => $version, 'session_type' => $returning ? 'returning' : 'first_visit', 'first_authenticated' => $user !== null, 'started_on' => substr($clean[0]['occurredAt'], 0, 10)]);
        }
        foreach ($clean as $event) {
            $this->db->table('journey_events')->insert(['id' => Crypto::uuid(), 'session_id' => $session, 'kind' => $event['type'], 'occurred_at' => gmdate('Y-m-d H:i:s.u', strtotime($event['occurredAt'])), 'properties' => json_encode($event['properties']), 'payload_hash' => hash('sha256', json_encode($event))]);
        }

        return ['accepted' => count($clean), 'sessionType' => $returning ? 'returning' : 'first_visit'];
    }

    public function journeyReport(string $from, string $to, string $platform = 'all', string $appVersion = 'all', string $sessionType = ''): array
    {
        $limitations = 'Edges come only from recorded navigation. Active time sums activeMs and ignores background gaps. Linking an install to an account does not prove the same person across devices. This feed is not the payment or reward ledger.';
        if (! CivilDates::valid($from) || ! CivilDates::valid($to) || $from > $to
            || ! in_array($sessionType, ['first_visit', 'returning'], true)
            || ! in_array($platform, ['all', 'android', 'ios', 'web'], true)
            || ($appVersion !== 'all' && preg_match('/^\d+\.\d+\.\d+$/D', $appVersion) !== 1)) {
            return ['status' => 'invalid'];
        }
        $size = $this->db->table('journey_sessions')->whereBetween('started_on', [$from, $to])
            ->when($platform !== 'all', fn ($query) => $query->where('platform', $platform))
            ->when($appVersion !== 'all', fn ($query) => $query->where('app_version', $appVersion))
            ->count();
        if ($size > 2000) {
            return ['status' => 'too_large', 'limitations' => $limitations];
        }
        $rows = $this->db->select(
            "select s.id, s.started_on, s.session_type, s.first_authenticated, s.gapped, e.kind, e.properties
             from journey_sessions s
             left join journey_events e on e.session_id = s.id
             where s.started_on between ? and ?
               and (? = 'all' or s.platform = ?)
               and (? = 'all' or s.app_version = ?)
             order by s.started_on, s.id, e.occurred_at",
            [$from, $to, $platform, $platform, $appVersion, $appVersion],
        );
        $samples = [];
        foreach ($rows as $row) {
            $sample = $samples[$row->id] ?? ['sessionType' => $row->session_type, 'firstAuthenticated' => (bool) $row->first_authenticated, 'gapped' => (bool) $row->gapped, 'events' => []];
            if ($row->kind !== null) {
                $properties = is_string($row->properties) ? json_decode($row->properties, true) : (array) $row->properties;
                $sample['events'][] = ['type' => $row->kind, 'properties' => is_array($properties) ? $properties : []];
            }
            $samples[$row->id] = $sample;
        }
        $samples = array_values($samples);
        $comparison = [
            'firstVisitSessions' => count(array_filter($samples, fn ($item) => $item['sessionType'] === 'first_visit')),
            'returningSessions' => count(array_filter($samples, fn ($item) => $item['sessionType'] === 'returning')),
            'firstAuthenticatedSessions' => count(array_filter($samples, fn ($item) => $item['firstAuthenticated'])),
        ];
        $selected = array_values(array_filter($samples, fn ($item) => $item['sessionType'] === $sessionType));
        if ($selected === []) {
            return ['status' => 'empty', 'nodes' => [], 'edges' => [], 'journeys' => [], 'entries' => [], 'exits' => [], 'dropOff' => [], 'active' => [], 'comparison' => $comparison, 'limitations' => $limitations];
        }

        return ['status' => 'ready', ...$this->journeyGraph($selected), 'comparison' => $comparison, 'limitations' => $limitations];
    }

    /** @param list<array{sessionType: string, firstAuthenticated: bool, gapped: bool, events: list<array{type: string, properties: array<string, mixed>}>}> $sessions */
    private function journeyGraph(array $sessions): array
    {
        $visits = [];
        $active = [];
        $exits = [];
        $entries = [];
        $edges = [];
        $paths = [];
        $signals = ['planPurchaseStarted' => 0, 'planPurchaseCompleted' => 0, 'questionnaireCompleted' => 0, 'mealRecorded' => 0, 'alternativeSelected' => 0, 'feedbackSubmitted' => 0, 'gappedSessions' => 0];
        $signalTypes = ['plan_purchase_started' => 'planPurchaseStarted', 'plan_purchase_completed' => 'planPurchaseCompleted', 'questionnaire_completed' => 'questionnaireCompleted', 'meal_recorded' => 'mealRecorded', 'alternative_selected' => 'alternativeSelected', 'feedback_submitted' => 'feedbackSubmitted'];
        foreach ($sessions as $item) {
            if ($item['gapped']) {
                $signals['gappedSessions']++;
            }
            $screens = array_values(array_filter($item['events'], fn ($event) => $event['type'] === 'screen_viewed'));
            $path = implode(' → ', array_map(fn ($event) => (string) ($event['properties']['screenId'] ?? ''), $screens));
            if ($path !== '') {
                $paths[$path] = ($paths[$path] ?? 0) + 1;
            }
            if ($screens !== []) {
                $first = (string) ($screens[0]['properties']['screenId'] ?? '');
                $last = (string) ($screens[array_key_last($screens)]['properties']['screenId'] ?? '');
                $entries[$first] = ($entries[$first] ?? 0) + 1;
                $exits[$last] = ($exits[$last] ?? 0) + 1;
            }
            foreach ($screens as $event) {
                $screenId = (string) ($event['properties']['screenId'] ?? '');
                $visits[$screenId] = ($visits[$screenId] ?? 0) + 1;
                $milliseconds = $event['properties']['activeMs'] ?? 0;
                $active[$screenId] = ($active[$screenId] ?? 0) + (is_numeric($milliseconds) ? (int) $milliseconds : 0);
            }
            foreach ($item['events'] as $event) {
                if ($event['type'] === 'navigation') {
                    $key = ($event['properties']['fromScreenId'] ?? '')."\t".($event['properties']['toScreenId'] ?? '');
                    $edges[$key] = ($edges[$key] ?? 0) + 1;
                } elseif (isset($signalTypes[$event['type']])) {
                    $signals[$signalTypes[$event['type']]]++;
                }
            }
        }
        $outgoing = [];
        foreach ($edges as $key => $count) {
            $fromScreenId = explode("\t", $key)[0];
            $outgoing[$fromScreenId] = ($outgoing[$fromScreenId] ?? 0) + $count;
        }
        $share = fn (int $count, int $total): ?int => $total === 0 ? null : (int) round((100 * $count) / $total);
        $edgeRows = [];
        foreach ($edges as $key => $count) {
            [$fromScreenId, $toScreenId] = array_pad(explode("\t", $key), 2, '');
            $edgeRows[] = ['fromScreenId' => $fromScreenId, 'toScreenId' => $toScreenId, 'count' => $count, 'percent' => $share($count, $outgoing[$fromScreenId] ?? 0)];
        }
        usort($edgeRows, fn ($left, $right) => $right['count'] <=> $left['count'] ?: $left['fromScreenId'] <=> $right['fromScreenId']);
        $ranked = function (array $map) use ($share, $sessions): array {
            $rows = [];
            foreach ($map as $screenId => $count) {
                $rows[] = ['screenId' => (string) $screenId, 'count' => $count, 'percent' => $share($count, count($sessions))];
            }
            usort($rows, fn ($left, $right) => $right['count'] <=> $left['count'] ?: $left['screenId'] <=> $right['screenId']);

            return $rows;
        };
        $nodes = [];
        foreach ($visits as $screenId => $count) {
            $nodes[] = ['screenId' => (string) $screenId, 'count' => $count];
        }
        usort($nodes, fn ($left, $right) => $right['count'] <=> $left['count'] ?: $left['screenId'] <=> $right['screenId']);
        $journeys = [];
        foreach ($paths as $path => $count) {
            $journeys[] = ['path' => (string) $path, 'count' => $count, 'percent' => $share($count, count($sessions))];
        }
        usort($journeys, fn ($left, $right) => $right['count'] <=> $left['count'] ?: $left['path'] <=> $right['path']);
        $dropOff = [];
        foreach ($exits as $screenId => $count) {
            $dropOff[] = ['screenId' => (string) $screenId, 'count' => $count, 'visits' => $visits[$screenId] ?? 0, 'percent' => $share($count, $visits[$screenId] ?? 0)];
        }
        usort($dropOff, fn ($left, $right) => ($right['percent'] ?? -1) <=> ($left['percent'] ?? -1) ?: $left['screenId'] <=> $right['screenId']);
        $activeRows = [];
        foreach ($active as $screenId => $milliseconds) {
            $activeRows[] = ['screenId' => (string) $screenId, 'milliseconds' => $milliseconds];
        }
        usort($activeRows, fn ($left, $right) => $right['milliseconds'] <=> $left['milliseconds'] ?: $left['screenId'] <=> $right['screenId']);

        return [
            'sessions' => count($sessions),
            'bounded' => count($nodes) > 40 || count($edgeRows) > 80 || count($journeys) > 25,
            'nodes' => array_slice($nodes, 0, 40),
            'edges' => array_slice($edgeRows, 0, 80),
            'journeys' => array_slice($journeys, 0, 25),
            'entries' => $ranked($entries),
            'exits' => $ranked($exits),
            'dropOff' => $dropOff,
            'active' => $activeRows,
            'signals' => [...$signals, 'authoritative' => false],
        ];
    }
}
