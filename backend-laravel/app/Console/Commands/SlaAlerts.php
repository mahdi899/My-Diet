<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Shared\Domain\LegacyCrypto as Crypto;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Database\ConnectionInterface;

#[Signature('sabzine:sla-alerts')]
#[Description('Notify admins and move a review older than 24 hours to a specialist with free capacity')]
class SlaAlerts extends Command
{
    public function handle(ConnectionInterface $db): int
    {
        $overdue = $db->select("select r.id, r.assigned_specialist_id, u.display_name from plan_requests r join users u on u.id=r.user_id where r.status not in ('published','cancelled') and r.created_at < date_sub(current_timestamp(6), interval 24 hour)");
        $admins = $db->table('users')->where('role', 'admin')->pluck('id');
        $sent = 0;
        foreach ($overdue as $request) {
            foreach ($admins as $admin) {
                $exists = $db->table('notifications')->where('user_id', $admin)->where('kind', 'sla_overdue')->where('payload->requestId', $request->id)->where('created_at', '>=', now()->startOfDay())->exists();
                if ($exists) {
                    continue;
                }
                $db->table('notifications')->insert([
                    'id' => Crypto::uuid(),
                    'user_id' => $admin,
                    'kind' => 'sla_overdue',
                    'payload' => json_encode(['requestId' => $request->id, 'patient' => $request->display_name, 'specialistId' => $request->assigned_specialist_id], JSON_UNESCAPED_UNICODE),
                ]);
                $sent++;
            }
            $already = $db->table('notifications')->where('kind', 'sla_reassigned')->where('payload->requestId', $request->id)->exists();
            if ($already) {
                continue;
            }
            $backup = $this->backup($db, $request->assigned_specialist_id);
            if ($backup === null) {
                continue;
            }
            $db->table('plan_requests')->where('id', $request->id)->update([
                'assigned_specialist_id' => $backup,
                'updated_at' => $db->raw('current_timestamp(6)'),
            ]);
            $db->table('notifications')->insert([
                'id' => Crypto::uuid(),
                'user_id' => $backup,
                'kind' => 'sla_reassigned',
                'payload' => json_encode(['requestId' => $request->id, 'patient' => $request->display_name, 'previousSpecialistId' => $request->assigned_specialist_id], JSON_UNESCAPED_UNICODE),
            ]);
            $sent++;
        }
        $this->line((string) $sent);

        return 0;
    }

    private function backup(ConnectionInterface $db, ?string $current): ?string
    {
        $chosen = null;
        $least = INF;
        $people = $db->table('specialist_profiles as p')
            ->join('users as u', 'u.id', '=', 'p.user_id')
            ->where('p.active', 1)
            ->where('p.verification_status', 'verified')
            ->where('u.status', 'active')
            ->where('u.role', 'specialist')
            ->get(['p.user_id', 'p.capacity']);
        foreach ($people as $person) {
            if ($person->user_id === $current) {
                continue;
            }
            $count = $db->table('plan_requests')->where('assigned_specialist_id', $person->user_id)->whereNotIn('status', ['published', 'cancelled'])->count();
            if ($count < (int) $person->capacity && $count < $least) {
                $least = $count;
                $chosen = $person->user_id;
            }
        }

        return $chosen;
    }
}
