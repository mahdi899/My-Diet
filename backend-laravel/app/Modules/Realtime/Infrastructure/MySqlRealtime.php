<?php

namespace App\Modules\Realtime\Infrastructure;

use App\Modules\Realtime\Application\PushSender;
use App\Modules\Realtime\Application\RealtimeGateway;
use App\Shared\Domain\LegacyCrypto as Crypto;
use App\Shared\Domain\Problem;
use Illuminate\Database\ConnectionInterface;

final class MySqlRealtime implements RealtimeGateway
{
    public function __construct(private ConnectionInterface $db, private PushSender $push) {}

    public function register(string $user, string $session, string $platform, string $token, string $provider): array
    {
        if (! in_array($platform, ['android', 'ios', 'web'], true) || ! in_array($provider, ['console', 'fcm'], true) || strlen($token) < 8 || strlen($token) > 255) {
            throw new Problem(400, 'validation', 'دستگاه درست معرفی نشده است');
        }
        $id = Crypto::uuid();
        $this->db->statement('insert into devices (id,user_id,session_id,platform,push_token,provider) values (?,?,?,?,?,?) as incoming on duplicate key update user_id=incoming.user_id, session_id=incoming.session_id, platform=incoming.platform, provider=incoming.provider, revoked_at=null, last_seen_at=current_timestamp(6)', [$id, $user, $session, $platform, $token, $provider]);

        return ['id' => $this->db->table('devices')->where('push_token', $token)->value('id')];
    }

    public function remove(string $user, string $device): array
    {
        if ($this->db->table('devices')->where(['id' => $device, 'user_id' => $user])->whereNull('revoked_at')->update(['revoked_at' => $this->db->raw('current_timestamp(6)')]) === 0) {
            throw new Problem(404, 'not_found', 'دستگاه پیدا نشد');
        }

        return ['ok' => true];
    }

    public function deliver(string $user, string $kind): int
    {
        $devices = $this->db->table('devices')->where('user_id', $user)->whereNull('revoked_at')->get();
        foreach ($devices as $device) {
            $this->push->send($device->push_token, $kind);
            $this->db->table('push_deliveries')->insert(['id' => Crypto::uuid(), 'device_id' => $device->id, 'kind' => $kind]);
        }

        return $devices->count();
    }

    public function since(string $user, string $since): array
    {
        $since = (new \DateTimeImmutable($since, new \DateTimeZone('UTC')))->setTimezone(new \DateTimeZone('UTC'))->format('Y-m-d H:i:s.u');
        $stamp = fn ($at) => (new \DateTimeImmutable($at, new \DateTimeZone('UTC')))->format('Y-m-d\TH:i:s.u\Z');
        $events = [];
        foreach ($this->db->select('select id,kind,created_at from notifications where user_id=? and created_at>=? order by created_at,id', [$user, $since]) as $row) {
            $events[] = ['at' => $stamp($row->created_at), 'type' => 'notification', 'data' => ['id' => $row->id, 'kind' => $row->kind]];
        }
        foreach ($this->db->select("select m.id,m.conversation_id,m.created_at from messages m join conversation_participants p on p.conversation_id=m.conversation_id join conversations c on c.id=m.conversation_id join users viewer on viewer.id=p.user_id left join plan_requests r on r.id=c.request_id where p.user_id=? and m.author_id<>? and m.created_at>=? and (c.kind<>'care' or viewer.role<>'specialist' or r.assigned_specialist_id=?) order by m.created_at,m.id", [$user, $user, $since, $user]) as $row) {
            $events[] = ['at' => $stamp($row->created_at), 'type' => 'message', 'data' => ['messageId' => $row->id, 'conversationId' => $row->conversation_id]];
        }
        foreach ($this->db->select('select id,status,updated_at from plan_requests where updated_at>=? and (user_id=? or assigned_specialist_id=?) order by updated_at,id', [$since, $user, $user]) as $row) {
            $events[] = ['at' => $stamp($row->updated_at), 'type' => 'request', 'data' => ['requestId' => $row->id, 'status' => $row->status]];
        }
        usort($events, fn ($left, $right) => $left['at'] <=> $right['at']);

        return $events;
    }
}
