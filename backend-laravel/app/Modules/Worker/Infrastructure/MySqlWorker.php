<?php

namespace App\Modules\Worker\Infrastructure;

use App\Modules\Worker\Application\WorkerStore;
use App\Shared\Domain\LegacyCrypto as Crypto;
use Illuminate\Database\ConnectionInterface;

final class MySqlWorker implements WorkerStore
{
    private const MONEY_TOPICS = ['payment.settle', 'payment.credit', 'wallet.credit', 'wallet.adjust', 'order.paid', 'ledger.apply'];

    public function __construct(private ConnectionInterface $db) {}

    public function relay(int $limit = 20): int
    {
        return $this->db->transaction(function () use ($limit) {
            $rows = $this->db->select('select id,topic,aggregate_id,payload from outbox_events where dispatched_at is null and attempts < 10 order by created_at limit ? for update skip locked', [$limit]);
            $delivered = 0;
            foreach ($rows as $row) {
                $this->db->table('outbox_events')->where('id', $row->id)->update(['attempts' => $this->db->raw('attempts+1')]);
                $payload = is_string($row->payload) ? $row->payload : json_encode($row->payload, JSON_THROW_ON_ERROR);
                $this->db->statement('insert into worker_jobs (id,outbox_id,topic,aggregate_id,payload,status) values (?,?,?,?,?,?) as incoming on duplicate key update outbox_id=worker_jobs.outbox_id', [Crypto::uuid(), $row->id, $row->topic, $row->aggregate_id, $payload, 'pending']);
                $updated = $this->db->table('outbox_events')->where('id', $row->id)->whereNull('dispatched_at')->update(['dispatched_at' => $this->db->raw('current_timestamp(6)')]);
                $delivered += $updated > 0 ? 1 : 0;
            }

            return $delivered;
        });
    }

    public function claim(int $limit = 1): array
    {
        return $this->db->transaction(function () use ($limit) {
            $rows = $this->db->select("select id,topic,aggregate_id,payload,attempts from worker_jobs where (status='pending' and available_at<=current_timestamp(6)) or (status='leased' and lease_until<current_timestamp(6)) order by created_at limit ? for update skip locked", [$limit]);
            foreach ($rows as $row) {
                $row->lease_token = Crypto::uuid();
                $this->db->update("update worker_jobs set status='leased', attempts=attempts+1, lease_token=?, lease_until=date_add(current_timestamp(6), interval 900 second), updated_at=current_timestamp(6) where id=?", [$row->lease_token, $row->id]);
                $row->attempts = (int) $row->attempts + 1;
            }

            return $rows;
        });
    }

    public function succeed(string $id, string $lease, ?string $note = null): void
    {
        $this->db->table('worker_jobs')->where('id', $id)->where('status', 'leased')->where('lease_token', $lease)->update(['status' => 'succeeded', 'lease_until' => null, 'lease_token' => null, 'last_error' => $note === null ? null : mb_substr($note, 0, 500), 'updated_at' => $this->db->raw('current_timestamp(6)')]);
    }

    public function fail(string $id, string $error, int $attempts, int $limit = 3, ?string $lease = null): void
    {
        $dead = $attempts >= $limit;
        $this->db->table('worker_jobs')->where('id', $id)->where('status', 'leased')->where('lease_token', $lease)->update([
            'status' => $dead ? 'dead' : 'pending',
            'available_at' => $this->db->raw('date_add(current_timestamp(6), interval 30 second)'),
            'lease_until' => null,
            'lease_token' => null,
            'last_error' => mb_substr($error, 0, 500),
            'updated_at' => $this->db->raw('current_timestamp(6)'),
        ]);
    }

    public function heartbeat(): void
    {
        $this->db->statement("insert into worker_status (role,heartbeat_at) values ('worker', current_timestamp(6)) as incoming on duplicate key update heartbeat_at=incoming.heartbeat_at");
    }

    public function maintenance(): array
    {
        return $this->db->transaction(function () {
            $inquired = (int) $this->db->selectOne("select count(*) as n from payments where status='pending' and created_at<=date_sub(current_timestamp(6), interval 15 minute) and created_at>date_sub(current_timestamp(6), interval 30 minute)")->n;
            $expired = $this->db->update("update payments set status='failed' where status='pending' and created_at<=date_sub(current_timestamp(6), interval 30 minute)");
            $resumed = $this->db->update("update plan_requests r set status='in_review', updated_at=current_timestamp(6) where r.status='generating' and r.updated_at<=date_sub(current_timestamp(6), interval 15 minute) and exists (select 1 from plan_versions v where v.request_id=r.id)");
            $requeued = $this->db->select("select id from plan_requests r where r.status='generating' and r.updated_at<=date_sub(current_timestamp(6), interval 15 minute) and not exists (select 1 from plan_versions v where v.request_id=r.id) for update");
            foreach ($requeued as $row) {
                $this->db->table('plan_requests')->where('id', $row->id)->update(['status' => 'queued', 'updated_at' => $this->db->raw('current_timestamp(6)')]);
                $pending = $this->db->table('outbox_events')->where(['topic' => 'plan.generate', 'aggregate_id' => $row->id])->whereNull('dispatched_at')->exists();
                if (! $pending) {
                    $this->db->table('outbox_events')->insert(['id' => Crypto::uuid(), 'topic' => 'plan.generate', 'aggregate_id' => $row->id, 'payload' => json_encode(['requestId' => $row->id], JSON_THROW_ON_ERROR)]);
                }
            }
            $otp = $this->db->delete('delete from otp_challenges where created_at<=date_sub(current_timestamp(6), interval 7 day)');
            $totp = $this->db->delete('delete from totp_challenges where created_at<=date_sub(current_timestamp(6), interval 7 day)');
            $ai = $this->db->update('update ai_generations set raw_output=null where raw_output is not null and created_at<=date_sub(current_timestamp(6), interval 30 day)');
            $ledger = $this->db->select("select w.user_id from wallets w left join (select user_id, coalesce(sum(case when bucket='cash' then amount_toman else 0 end),0) as cash_toman, coalesce(sum(case when bucket='promo' then amount_toman else 0 end),0) as promo_toman from wallet_ledger group by user_id) l on l.user_id=w.user_id where w.cash_toman<>coalesce(l.cash_toman,0) or w.promo_toman<>coalesce(l.promo_toman,0) order by w.user_id limit 50");

            return [
                'expiredPayments' => $expired,
                'inquiredPayments' => $inquired,
                'requeuedDrafts' => count($requeued),
                'resumedDrafts' => $resumed,
                'purgedOtpChallenges' => $otp,
                'purgedTotpChallenges' => $totp,
                'clearedAiOutputs' => $ai,
                'ledgerMismatches' => count($ledger),
                'ledgerMismatchUserIds' => array_map(fn ($row) => $row->user_id, $ledger),
            ];
        });
    }

    public function drainSnapshot(array $jobs): array
    {
        $inserted = 0;
        $skipped = 0;
        foreach ($jobs as $job) {
            $topic = (string) ($job['topic'] ?? '');
            $state = (string) ($job['state'] ?? '');
            if ($topic === '' || in_array($state, ['completed', 'cancelled'], true) || in_array($topic, self::MONEY_TOPICS, true)) {
                $skipped++;

                continue;
            }
            $id = (string) ($job['id'] ?? '');
            if ($id === '' || $this->db->table('worker_jobs')->where('id', $id)->exists()) {
                $skipped++;

                continue;
            }
            $this->db->table('worker_jobs')->insert([
                'id' => $id,
                'topic' => $topic,
                'aggregate_id' => $job['aggregateId'] ?? '00000000-0000-0000-0000-000000000000',
                'payload' => json_encode($job['data'] ?? new \stdClass, JSON_THROW_ON_ERROR),
                'status' => 'pending',
            ]);
            $inserted++;
        }

        return ['inserted' => $inserted, 'skipped' => $skipped];
    }
}
