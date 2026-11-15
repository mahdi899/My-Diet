<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Shared\Domain\LegacyCrypto as Crypto;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Database\ConnectionInterface;

#[Signature('sabzine:sla-alerts')]
#[Description('Notify admins about specialist reviews older than 24 hours')]
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
        }
        $this->line((string) $sent);

        return 0;
    }
}
