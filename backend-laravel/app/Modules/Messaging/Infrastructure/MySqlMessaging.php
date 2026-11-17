<?php

namespace App\Modules\Messaging\Infrastructure;

use App\Modules\Messaging\Application\MessagingStore;
use App\Shared\Domain\LegacyCrypto as Crypto;
use Illuminate\Database\ConnectionInterface;

final class MySqlMessaging implements MessagingStore
{
    public function __construct(private ConnectionInterface $db) {}

    public function transaction(callable $work): mixed
    {
        return $this->db->transaction($work);
    }

    public function conversations(string $user): array
    {
        $this->joinSupportStaff(admin: $user);
        $rows = $this->db->select("select c.id,c.kind,c.request_id,c.created_at from conversations c join conversation_participants p on p.conversation_id=c.id join users viewer on viewer.id=p.user_id left join plan_requests r on r.id=c.request_id where p.user_id=? and (c.kind<>'care' or viewer.role<>'specialist' or r.assigned_specialist_id=?) order by c.created_at desc", [$user, $user]);
        $counts = [];
        if ($rows !== []) {
            $ids = array_map(fn ($row) => $row->id, $rows);
            $marks = implode(',', array_fill(0, count($ids), '?'));
            foreach ($this->db->select("select c.id, count(m.id) as n from conversations c join conversation_participants p on p.conversation_id=c.id and p.user_id=? left join messages m on m.conversation_id=c.id and m.author_id<>? and m.created_at>coalesce(p.last_read_at,'1970-01-01') where c.id in ($marks) group by c.id", [$user, $user, ...$ids]) as $count) {
                $counts[$count->id] = (int) $count->n;
            }
        }

        return array_map(fn ($row) => ['id' => $row->id, 'kind' => $row->kind, 'requestId' => $row->request_id, 'createdAt' => Crypto::iso($row->created_at), 'unreadCount' => $counts[$row->id] ?? 0], $rows);
    }

    public function participant(string $user, string $conversation): bool
    {
        $this->joinSupportStaff($conversation, $user);

        return $this->db->selectOne("select p.user_id from conversation_participants p join conversations c on c.id=p.conversation_id join users viewer on viewer.id=p.user_id left join plan_requests r on r.id=c.request_id where p.conversation_id=? and p.user_id=? and (c.kind<>'care' or viewer.role<>'specialist' or r.assigned_specialist_id=?)", [$conversation, $user, $user]) !== null;
    }

    public function messages(string $conversation, ?int $after, int $limit): array
    {
        $sql = 'select id,author_id,body,created_at,kind,position,media_id,client_request_id from messages where conversation_id=?';
        $bind = [$conversation];
        if ($after !== null) {
            $sql .= ' and position>?';
            $bind[] = $after;
        }
        $sql .= ' order by position limit ?';
        $bind[] = $limit;

        return array_map(fn ($row) => ['id' => $row->id, 'authorId' => $row->author_id, 'body' => $row->body, 'kind' => $row->kind, 'mediaId' => $row->media_id, 'clientRequestId' => $row->client_request_id, 'position' => (int) $row->position, 'createdAt' => Crypto::iso($row->created_at)], $this->db->select($sql, $bind));
    }

    public function priorMessage(string $conversation, string $author, string $client): ?string
    {
        $id = $this->db->table('messages')->where(['conversation_id' => $conversation, 'author_id' => $author, 'client_request_id' => $client])->value('id');

        return is_string($id) ? $id : null;
    }

    public function mediaReady(string $id, string $owner, string $conversation): ?string
    {
        $row = $this->db->table('media_objects')->where(['id' => $id, 'owner_id' => $owner, 'conversation_id' => $conversation, 'status' => 'ready'])->first();

        return $row === null ? null : $row->purpose;
    }

    public function insertMessage(string $id, string $conversation, string $author, string $body, string $kind, ?string $client, ?string $media): void
    {
        $this->db->table('messages')->insert(['id' => $id, 'conversation_id' => $conversation, 'author_id' => $author, 'body' => $body, 'kind' => $kind, 'client_request_id' => $client, 'media_id' => $media]);
    }

    public function receiptsForOthers(string $message, string $conversation, string $author): void
    {
        foreach ($this->others($conversation, $author) as $person) {
            $this->db->table('message_receipts')->insert(['message_id' => $message, 'user_id' => $person]);
        }
    }

    public function others(string $conversation, string $author): array
    {
        $this->joinSupportStaff($conversation);

        return array_map(fn ($row) => $row->user_id, $this->db->select('select user_id from conversation_participants where conversation_id=? and user_id<>?', [$conversation, $author]));
    }

    public function notify(string $user, string $kind, array $payload): void
    {
        $this->db->table('notifications')->insert(['id' => Crypto::uuid(), 'user_id' => $user, 'kind' => $kind, 'payload' => json_encode($payload, JSON_THROW_ON_ERROR)]);
    }

    public function markRead(string $user, string $conversation): int
    {
        return $this->db->table('conversation_participants')->where(['conversation_id' => $conversation, 'user_id' => $user])->update(['last_read_at' => $this->db->raw('current_timestamp(6)')]);
    }

    public function support(string $user): ?string
    {
        $id = $this->db->table('conversations')->where(['user_id' => $user, 'kind' => 'support'])->orderBy('created_at')->value('id');

        return is_string($id) ? $id : null;
    }

    public function openSupport(string $id, string $user): void
    {
        $this->db->table('conversations')->insert(['id' => $id, 'kind' => 'support', 'user_id' => $user]);
        $this->db->table('conversation_participants')->insert(['conversation_id' => $id, 'user_id' => $user]);
        $this->joinSupportStaff($id);
    }

    private function joinSupportStaff(?string $conversation = null, ?string $admin = null): void
    {
        $sql = "insert ignore into conversation_participants (conversation_id,user_id) select c.id,u.id from conversations c join users u on u.role='admin' and u.status='active' where c.kind='support'";
        $bindings = [];
        if ($conversation !== null) {
            $sql .= ' and c.id=?';
            $bindings[] = $conversation;
        }
        if ($admin !== null) {
            $sql .= ' and u.id=?';
            $bindings[] = $admin;
        }
        $this->db->statement($sql, $bindings);
    }

    public function careRequest(string $user): ?array
    {
        $row = $this->db->selectOne("select id,assigned_specialist_id from plan_requests where user_id=? and assigned_specialist_id is not null and status<>'cancelled' order by created_at desc limit 1", [$user]);

        return $row === null ? null : ['id' => $row->id, 'specialistId' => $row->assigned_specialist_id];
    }

    public function careConversation(string $request): ?string
    {
        $id = $this->db->table('conversations')->where(['request_id' => $request, 'kind' => 'care'])->value('id');

        return is_string($id) ? $id : null;
    }

    public function openCare(string $id, string $user, string $request, string $specialist): void
    {
        $this->db->table('conversations')->insert(['id' => $id, 'kind' => 'care', 'user_id' => $user, 'request_id' => $request]);
        $this->ensureParticipants($id, [$user, $specialist]);
    }

    public function ensureParticipants(string $conversation, array $users): void
    {
        foreach ($users as $user) {
            $this->db->statement('insert into conversation_participants (conversation_id,user_id) values (?,?) as incoming on duplicate key update user_id=conversation_participants.user_id', [$conversation, $user]);
        }
    }

    public function hasSystem(string $conversation): bool
    {
        return $this->db->table('messages')->where(['conversation_id' => $conversation, 'kind' => 'system'])->exists();
    }

    public function beginMedia(string $id, string $owner, string $conversation, string $purpose, string $declared, ?int $duration): string
    {
        $this->db->statement("insert into media_objects (id,owner_id,conversation_id,purpose,status,declared_type,storage_key,voice_duration_ms,expires_at) values (?,?,?,?,'pending',?,?,?,date_add(current_timestamp(6), interval 15 minute))", [$id, $owner, $conversation, $purpose, $declared, 'media/'.$id, $duration]);
        $expires = $this->db->table('media_objects')->where('id', $id)->value('expires_at');

        return Crypto::iso($expires);
    }

    public function lockMedia(string $id, string $owner): ?array
    {
        $row = $this->db->selectOne('select conversation_id,purpose,status,expires_at,declared_type from media_objects where id=? and owner_id=? for update', [$id, $owner]);

        return $row === null ? null : ['conversationId' => $row->conversation_id, 'purpose' => $row->purpose, 'status' => $row->status, 'expiresAt' => $row->expires_at, 'declaredType' => $row->declared_type];
    }

    public function expireMedia(string $id): void
    {
        $this->db->table('media_objects')->where('id', $id)->where('status', 'pending')->update(['status' => 'expired']);
    }

    public function quarantine(string $id): void
    {
        $this->db->table('media_objects')->where('id', $id)->update(['status' => 'quarantined']);
    }

    public function storeMedia(string $id, string $bytes, string $detected): void
    {
        $this->db->table('media_bytes')->insert(['media_id' => $id, 'content' => $bytes]);
        $this->db->table('media_objects')->where('id', $id)->update(['status' => 'ready', 'detected_type' => $detected, 'byte_size' => strlen($bytes)]);
    }

    public function mediaStatus(string $id): ?array
    {
        $row = $this->db->table('media_objects')->where('id', $id)->first();

        return $row === null ? null : ['conversationId' => $row->conversation_id, 'status' => $row->status];
    }

    public function grant(string $id, string $media, string $user, string $hash): void
    {
        $this->db->statement('insert into media_access_grants (id,media_id,user_id,token_hash,expires_at) values (?,?,?,?,date_add(current_timestamp(6), interval 60 second))', [$id, $media, $user, $hash]);
    }

    public function readGrant(string $media, string $user, string $hash): ?array
    {
        $row = $this->db->selectOne("select b.content,o.detected_type,o.conversation_id from media_access_grants g join media_objects o on o.id=g.media_id join media_bytes b on b.media_id=o.id where g.media_id=? and g.user_id=? and g.token_hash=? and g.expires_at>current_timestamp(6) and o.status='ready'", [$media, $user, $hash]);

        return $row === null ? null : ['content' => $row->content, 'detectedType' => $row->detected_type, 'conversationId' => $row->conversation_id];
    }

    public function messageAuthor(string $message, string $conversation): ?string
    {
        $id = $this->db->table('messages')->where(['id' => $message, 'conversation_id' => $conversation])->value('author_id');

        return is_string($id) ? $id : null;
    }

    public function stampReceipt(string $message, string $user, string $state): int
    {
        $column = $state === 'delivered' ? 'delivered_at' : 'read_at';

        return $this->db->update("update message_receipts set $column=coalesce($column, current_timestamp(6)) where message_id=? and user_id=?", [$message, $user]);
    }

    public function sync(string $user, ?string $since): array
    {
        $notes = (int) $this->db->selectOne('select count(*) as n from notifications where user_id=? and read_at is null and (? is null or created_at>?)', [$user, $since, $since])->n;
        $questions = (int) $this->db->selectOne("select count(*) as n from info_questions q join plan_requests r on r.id=q.request_id where r.user_id=? and q.status in ('open','answered')", [$user])->n;
        $rewards = (int) $this->db->selectOne('select count(*) as n from weekly_rewards where user_id=? and acknowledged_at is null', [$user])->n;
        $request = $this->db->selectOne('select id,status from plan_requests where user_id=? order by created_at desc limit 1', [$user]);

        return ['unreadNotifications' => $notes, 'openQuestions' => $questions, 'pendingRewards' => $rewards, 'request' => $request === null ? null : ['id' => $request->id, 'status' => $request->status]];
    }

    public function notifications(string $user): array
    {
        return array_map(function ($row) {
            $payload = is_string($row->payload) ? json_decode($row->payload, true) : $row->payload;

            return ['id' => $row->id, 'kind' => $row->kind, 'payload' => $payload, 'readAt' => $row->read_at === null ? null : Crypto::iso($row->read_at), 'createdAt' => Crypto::iso($row->created_at)];
        }, $this->db->select('select id,kind,payload,read_at,created_at from notifications where user_id=? order by created_at desc limit 50', [$user]));
    }

    public function readNotification(string $user, string $id): int
    {
        return $this->db->table('notifications')->where(['id' => $id, 'user_id' => $user])->whereNull('read_at')->update(['read_at' => $this->db->raw('current_timestamp(6)')]);
    }
}
