<?php

namespace App\Modules\Admin\Infrastructure;

use App\Modules\Admin\Application\AdminQueries;
use App\Shared\Domain\Amount;
use App\Shared\Domain\LegacyCrypto as Crypto;
use App\Shared\Domain\Problem;
use Illuminate\Database\ConnectionInterface;

final class MySqlAdminQueries implements AdminQueries
{
    public function __construct(private ConnectionInterface $db) {}

    public function dashboard(string $actor): array
    {
        $day = (new \DateTimeImmutable('today', new \DateTimeZone('Asia/Tehran')))->setTimezone(new \DateTimeZone('UTC'));
        $start = $day->format('Y-m-d H:i:s.u');
        $end = $day->modify('+1 day')->format('Y-m-d H:i:s.u');
        $week = $day->modify('-7 days')->format('Y-m-d H:i:s.u');
        $users = $this->db->table('users')->where('role', 'user')->where('status', '<>', 'deleted');
        $payments = $this->db->table('payments')->where('status', 'credited')->whereRaw('created_at>=date_sub(current_timestamp(6),interval 30 day)');
        $unread = $this->db->table('messages as m')->join('conversations as c', 'c.id', '=', 'm.conversation_id')
            ->leftJoin('conversation_participants as cp', fn ($join) => $join->on('cp.conversation_id', '=', 'c.id')->where('cp.user_id', $actor))
            ->where('c.kind', 'support')->where('m.author_id', '<>', $actor)->where(fn ($q) => $q->whereNull('cp.last_read_at')->orWhereColumn('m.created_at', '>', 'cp.last_read_at'))->count();

        return ['users' => $users->count(), 'newUsers' => (clone $users)->where('created_at', '>=', $week)->count(), 'revenueToman' => Amount::safe((string) $payments->sum('amount_toman')),
            'paidOrders' => $payments->count(), 'aiToday' => $this->db->table('ai_generations')->where('created_at', '>=', $start)->where('created_at', '<', $end)->count(), 'unreadMessages' => $unread];
    }

    public function orders(): array
    {
        return array_map(fn ($row) => ['id' => $row->id, 'user' => $row->display_name ?: $row->phone_e164, 'serviceCode' => $row->service_code, 'amountToman' => Amount::safe($row->price_toman), 'status' => $row->status, 'createdAt' => Crypto::iso($row->created_at)],
            $this->db->table('orders as o')->join('users as u', 'u.id', '=', 'o.user_id')->select('o.*', 'u.display_name', 'u.phone_e164')->orderByDesc('o.created_at')->orderByDesc('o.id')->limit(100)->get()->all());
    }

    public function payments(): array
    {
        return array_map(fn ($row) => [
            'id' => $row->id, 'user' => $row->display_name ?: $row->phone_e164, 'phone' => $row->phone_e164,
            'packageCode' => $row->package_code, 'amountToman' => Amount::safe($row->amount_toman), 'status' => $row->status,
            'createdAt' => Crypto::iso($row->created_at), 'paidAt' => $row->credited_at === null ? null : Crypto::iso($row->credited_at),
            'reference' => $row->ref_id,
        ],
            $this->db->table('payments as p')->join('users as u', 'u.id', '=', 'p.user_id')->select('p.*', 'u.display_name', 'u.phone_e164')->orderByDesc('p.created_at')->orderByDesc('p.id')->limit(100)->get()->all());
    }

    public function auditLogs(): array
    {
        return array_map(fn ($row) => ['id' => $row->id, 'actorId' => $row->actor_id, 'action' => $row->action, 'targetType' => $row->target_type, 'targetId' => $row->target_id, 'createdAt' => Crypto::iso($row->created_at)],
            $this->db->table('audit_logs')->orderByDesc('created_at')->limit(100)->get()->all());
    }

    public function specialists(bool $public): array
    {
        $query = $this->db->table('specialist_profiles as sp')->select('sp.*')->orderBy('sp.display_name');
        if ($public) {
            $query->where('sp.active', true);
        } else {
            $query->join('users as u', 'u.id', '=', 'sp.user_id')->leftJoin('specialist_credentials as sc', 'sc.user_id', '=', 'sp.user_id')
                ->addSelect('u.phone_e164', 'u.created_at as started_at', 'sc.username')->where('u.status', '<>', 'deleted');
        }
        $query->selectRaw("(select round(avg(pr.rating),2) from program_reviews pr join plan_requests r on r.id=pr.request_id where r.assigned_specialist_id=sp.user_id and pr.status='approved') as average,
            (select count(*) from program_reviews pr join plan_requests r on r.id=pr.request_id where r.assigned_specialist_id=sp.user_id and pr.status='approved') as reviews");
        if (! $public) {
            $query->selectRaw('(select count(*) from specialist_members sm where sm.specialist_id=sp.user_id) as subordinates');
        }

        return array_map(function ($row) use ($public): array {
            $result = ['id' => $row->user_id, 'displayName' => $row->display_name, 'credential' => $row->credential, 'bio' => $row->bio, 'averageRating' => $row->average === null ? null : (float) $row->average, 'reviewCount' => (int) $row->reviews];

            return $public ? $result : [...$result, 'phone' => $row->phone_e164, 'education' => $row->education ?: $row->credential, 'councilNo' => $row->medical_council_no,
                'birthDate' => $row->birth_date, 'portrait' => $row->portrait ?: null, 'username' => $row->username, 'capacity' => $row->capacity, 'active' => (bool) $row->active,
                'rating' => $row->rating === null ? null : (float) $row->rating, 'startedAt' => Crypto::iso($row->started_at), 'subordinateCount' => (int) $row->subordinates];
        }, $query->get()->all());
    }

    public function ownProfile(string $actor): array
    {
        $row = $this->db->table('specialist_profiles')->where('user_id', $actor)->first();
        if (! $row) {
            throw new Problem(404, 'not_found', 'پروندهٔ متخصص پیدا نشد');
        }

        return ['displayName' => $row->display_name, 'credential' => $row->credential, 'bio' => $row->bio, 'councilNo' => $row->medical_council_no, 'verificationStatus' => $row->verification_status, 'active' => (bool) $row->active];
    }
}
