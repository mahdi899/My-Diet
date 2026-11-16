<?php

declare(strict_types=1);

namespace App\Modules\Plans\Infrastructure;

use App\Modules\Coach\Infrastructure\PreferenceService;
use App\Modules\Plans\Domain\CivilDates;
use App\Shared\Domain\LegacyCrypto as Crypto;
use Illuminate\Database\ConnectionInterface;

/** Queues the next 7-day draft after a published week ends. Does not call the model itself. */
final class NextWeekPlanner
{
    public function __construct(private ConnectionInterface $db, private PreferenceService $preferences) {}

    public function queueDue(): int
    {
        $today = CivilDates::today();
        $queued = 0;
        $parents = $this->db->table('plan_requests')->where('status', 'published')->whereNotNull('week_start')->get();
        foreach ($parents as $parent) {
            $end = CivilDates::add(substr((string) $parent->week_start, 0, 10), 6);
            if ($today <= $end) {
                continue;
            }
            $child = $this->db->table('plan_requests')->where('parent_request_id', $parent->id)->where('status', '<>', 'cancelled')->exists();
            if ($child) {
                continue;
            }
            $weights = $this->db->table('weight_entries')->where('user_id', $parent->user_id)->whereBetween('civil_date', [substr((string) $parent->week_start, 0, 10), $end])->count();
            $logs = $this->db->table('meal_logs')->where('user_id', $parent->user_id)->whereBetween('scheduled_date', [substr((string) $parent->week_start, 0, 10), $end])->count();
            if ($weights === 0) {
                $this->preferences->recordPattern($parent->user_id, 'no_weight_data');
            }
            if ($logs === 0) {
                $this->preferences->recordPattern($parent->user_id, 'no_intake_data');
            }
            $id = Crypto::uuid();
            $orderId = Crypto::uuid();
            $this->db->table('orders')->insert([
                'id' => $orderId,
                'user_id' => $parent->user_id,
                'service_code' => 'new_plan',
                'price_toman' => 0,
                'cash_toman' => 0,
                'promo_toman' => 0,
                'status' => 'paid',
                'idempotency_key' => 'next-week-'.$id,
            ]);
            $this->db->table('plan_requests')->insert([
                'id' => $id,
                'user_id' => $parent->user_id,
                'order_id' => $orderId,
                'kind' => 'ai_revision',
                'status' => 'queued',
                'submission_id' => $parent->submission_id,
                'assigned_specialist_id' => $parent->assigned_specialist_id,
                'parent_request_id' => $parent->id,
                'price_toman' => 0,
            ]);
            $this->db->table('outbox_events')->insert([
                'id' => Crypto::uuid(),
                'topic' => 'plan.generate',
                'aggregate_id' => $id,
                'payload' => json_encode(['requestId' => $id, 'nextWeek' => true]),
            ]);
            $queued++;
        }

        return $queued;
    }
}
