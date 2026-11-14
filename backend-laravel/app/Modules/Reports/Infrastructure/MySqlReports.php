<?php

namespace App\Modules\Reports\Infrastructure;

use App\Modules\Plans\Domain\CivilDates;
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
        if (! in_array($event, ['activity', 'meal', 'weight'], true)) {
            throw new Problem(400, 'validation', 'رویداد بازگشت نامعتبر است');
        }
        $rows = [];
        foreach ($this->db->select("select date(created_at) as started_on, count(*) as size from orders where status='paid' and service_code='new_plan' and date(created_at) between ? and ? group by date(created_at) order by started_on", [$from, $to]) as $row) {
            $started = substr((string) $row->started_on, 0, 10);
            $age = (int) (new \DateTimeImmutable($to))->diff(new \DateTimeImmutable($started))->days;
            $size = (int) $row->size;
            $cells = [];
            foreach (['week1' => 7, 'week2' => 14, 'week4' => 28] as $key => $days) {
                $cells[$key] = $age < $days ? ['status' => 'not_yet_measurable', 'count' => null] : ['status' => 'measured', 'count' => 0, 'rate' => $size === 0 ? null : 0];
            }
            $rows[] = ['id' => $started, 'label' => $started, 'size' => $size, 'ageDays' => $age, 'cells' => $cells];
        }

        return ['status' => $rows === [] ? 'empty' : 'ready', 'from' => $from, 'to' => $to, 'asOf' => $to, 'event' => $event, 'anchor' => 'first_paid_new_plan', 'rows' => $rows];
    }

    public function foods(string $from, string $to, string $kind): array
    {
        if (! CivilDates::valid($from) || ! CivilDates::valid($to) || $from > $to) {
            return ['status' => 'invalid', 'rows' => []];
        }
        if (! in_array($kind, ['selected', 'alternative', 'disliked', 'reason'], true)) {
            throw new Problem(400, 'validation', 'نوع رتبه‌بندی شناخته نشد');
        }
        $counts = [];
        if ($kind === 'reason') {
            foreach ($this->db->select('select reason_label from meal_selections where civil_date between ? and ? and reason_label is not null', [$from, $to]) as $row) {
                $counts[$row->reason_label] = ($counts[$row->reason_label] ?? 0) + 1;
            }
        }
        arsort($counts);
        $rows = [];
        foreach ($counts as $label => $count) {
            $rows[] = ['id' => $label, 'label' => $label, 'count' => $count];
        }

        return ['status' => $rows === [] ? 'empty' : 'ready', 'kind' => $kind, 'matching' => 'exact_normalized_label', 'rows' => $rows];
    }

    public function feedback(string $from, string $to): array
    {
        if (! CivilDates::valid($from) || ! CivilDates::valid($to) || $from > $to) {
            return ['status' => 'invalid', 'rows' => []];
        }
        $count = (int) $this->db->table('weekly_feedback')->whereBetween('week_start', [$from, $to])->count();

        return ['status' => $count === 0 ? 'empty' : 'ready', 'from' => $from, 'to' => $to, 'privateCount' => $count];
    }

    public function specialists(string $sort): array
    {
        if (! in_array($sort, ['rating', 'load'], true)) {
            throw new Problem(400, 'validation', 'مرتب‌سازی متخصص شناخته نشد');
        }
        $rows = $this->db->select('select sp.user_id, sp.display_name, sp.rating, (select count(*) from plan_requests r where r.assigned_specialist_id=sp.user_id and r.status in (\'queued\',\'generating\',\'in_review\',\'awaiting_user\',\'response_received\')) as open_count from specialist_profiles sp order by '.($sort === 'rating' ? 'sp.rating desc' : 'open_count desc'));

        return ['sort' => $sort, 'rows' => array_map(fn ($row) => ['id' => $row->user_id, 'name' => $row->display_name, 'rating' => $row->rating === null ? null : (float) $row->rating, 'openCount' => (int) $row->open_count], $rows)];
    }

    public function sla(string $specialist): array
    {
        $rows = $this->db->select("select id,status,created_at from plan_requests where assigned_specialist_id=? and status not in ('published','cancelled')", [$specialist]);
        $overdue = 0;
        foreach ($rows as $row) {
            $age = time() - strtotime((string) $row->created_at);
            $responded = $this->db->table('request_events')->where('request_id', $row->id)->where('actor_id', $specialist)->exists();
            if (! $responded && $age > 86400) {
                $overdue++;
            }
        }

        return ['open' => count($rows), 'overdue' => $overdue, 'thresholdHours' => 24];
    }

    public function adminSla(): array
    {
        $open = (int) $this->db->table('plan_requests')->whereNotIn('status', ['published', 'cancelled'])->count();

        return ['open' => $open, 'thresholdHours' => 24];
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

    public function journeyReport(string $from, string $to): array
    {
        if (! CivilDates::valid($from) || ! CivilDates::valid($to) || $from > $to) {
            return ['status' => 'invalid', 'nodes' => [], 'edges' => []];
        }
        $nodes = $this->db->select('select e.kind, count(*) as n from journey_events e join journey_sessions s on s.id=e.session_id where s.started_on between ? and ? group by e.kind order by n desc limit 40', [$from, $to]);

        return ['status' => 'ready', 'limitations' => 'This feed is not the payment or reward ledger.', 'nodes' => array_map(fn ($row) => ['screen' => $row->kind, 'count' => (int) $row->n], $nodes), 'edges' => []];
    }
}
