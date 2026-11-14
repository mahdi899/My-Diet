<?php

namespace App\Modules\Metrics\Presentation;

use App\Shared\Domain\Problem;
use Illuminate\Database\ConnectionInterface;
use Symfony\Component\HttpFoundation\Response;

final class MetricsController
{
    public function metrics(ConnectionInterface $db): Response
    {
        $lines = ['# HELP sabzine_outbox_undispatched Outbox rows not yet handed to the worker', '# TYPE sabzine_outbox_undispatched gauge'];
        foreach ($db->select('select topic, count(*) as n from outbox_events where dispatched_at is null group by topic') as $row) {
            $lines[] = 'sabzine_outbox_undispatched{topic="'.$this->label($row->topic).'"} '.(int) $row->n;
        }
        $lines[] = '# HELP sabzine_ai_generations_total Recorded draft attempts';
        $lines[] = '# TYPE sabzine_ai_generations_total counter';
        foreach ($db->select('select status, count(*) as n from ai_generations group by status') as $row) {
            $lines[] = 'sabzine_ai_generations_total{status="'.$this->label($row->status).'"} '.(int) $row->n;
        }
        $heartbeat = $db->table('worker_status')->where('role', 'worker')->value('heartbeat_at');
        $age = $heartbeat === null ? -1 : max(0, time() - strtotime((string) $heartbeat.' UTC'));
        $lines[] = '# HELP sabzine_worker_heartbeat_age_seconds Seconds since the worker heartbeat, or -1 when absent';
        $lines[] = '# TYPE sabzine_worker_heartbeat_age_seconds gauge';
        $lines[] = 'sabzine_worker_heartbeat_age_seconds '.$age;

        return response(implode("\n", $lines)."\n", 200, ['Content-Type' => 'text/plain; version=0.0.4; charset=utf-8']);
    }

    public function worker(ConnectionInterface $db): array
    {
        $heartbeat = $db->table('worker_status')->where('role', 'worker')->value('heartbeat_at');
        if ($heartbeat === null || time() - strtotime((string) $heartbeat.' UTC') > 30) {
            throw new Problem(503, 'worker_unavailable', 'کارگر پس‌زمینه تازه نیست');
        }

        return ['status' => 'ok', 'heartbeatAt' => $heartbeat];
    }

    private function label(string $value): string
    {
        return preg_replace('/[^A-Za-z0-9_.:-]/', '_', $value) ?? 'unknown';
    }
}
