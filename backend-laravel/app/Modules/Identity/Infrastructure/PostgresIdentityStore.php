<?php

namespace App\Modules\Identity\Infrastructure;

use App\Modules\Identity\Application\IdentityStore;
use Closure;
use Illuminate\Database\ConnectionInterface;

final class PostgresIdentityStore implements IdentityStore
{
    public function __construct(private ConnectionInterface $db) {}

    public function transaction(Closure $work): mixed
    {
        return $this->db->transaction($work);
    }

    private function one(string $sql, array $params = []): ?array
    {
        $row = $this->db->selectOne($sql, $params);
        return $row === null ? null : (array) $row;
    }

    private function credentialsTable(string $role): string
    {
        return match ($role) {
            'admin' => 'admin_credentials',
            'specialist' => 'specialist_credentials',
            default => throw new \InvalidArgumentException('Invalid staff role'),
        };
    }

    public function credential(string $role, string $username): ?array
    {
        $table = $this->credentialsTable($role);
        return $this->one("select c.*, u.status from $table c join users u on u.id=c.user_id where c.username=? and u.role=? for update of c", [$username, $role]);
    }

    public function recordLogin(string $role, string $userId, bool $success): void
    {
        $table = $this->credentialsTable($role);
        $sql = $success ? "update $table set failed_attempts=0, locked_until=null where user_id=?" :
            "update $table set failed_attempts=failed_attempts+1, locked_until=case when failed_attempts>=4 then now()+interval '15 minutes' else locked_until end where user_id=?";
        $this->db->update($sql, [$userId]);
    }

    public function totpSecret(string $userId, bool $confirmedOnly = false): ?array
    {
        return $this->one('select secret_encrypted, confirmed_at from staff_totp where user_id=?'.($confirmedOnly ? ' and confirmed_at is not null' : ''), [$userId]);
    }

    public function saveTotp(string $userId, string $encrypted): void
    {
        $this->db->insert('insert into staff_totp(user_id,secret_encrypted) values(?,?) on conflict(user_id) do update set secret_encrypted=excluded.secret_encrypted, confirmed_at=null', [$userId, $encrypted]);
    }

    public function confirmTotp(string $userId): void
    {
        $this->db->update('update staff_totp set confirmed_at=now() where user_id=?', [$userId]);
    }

    public function createTotpChallenge(string $id, string $userId, string $hash, ?string $label, ?string $platform): void
    {
        $this->db->insert("insert into totp_challenges(id,user_id,token_hash,device_label,platform,expires_at) values(?,?,?,?,?,now()+interval '5 minutes')", [$id, $userId, $hash, $label, $platform]);
    }

    public function lockTotpChallenge(string $hash): ?array
    {
        return $this->one('select c.id,c.user_id,c.attempts,c.expires_at<=now() as expired,c.consumed_at,c.device_label,c.platform,u.role,u.status,t.secret_encrypted
            from totp_challenges c join users u on u.id=c.user_id join staff_totp t on t.user_id=c.user_id and t.confirmed_at is not null
            where c.token_hash=? for update of c', [$hash]);
    }

    public function consumeTotpChallenge(string $id, bool $success): void
    {
        $this->db->update($success ? 'update totp_challenges set consumed_at=now() where id=?' :
            'update totp_challenges set attempts=attempts+1,consumed_at=case when attempts+1>=5 then now() else consumed_at end where id=?', [$id]);
    }

    public function lockOtpBudgets(string $phone, string $ip): array
    {
        $this->db->select('select pg_advisory_xact_lock(hashtextextended(?,0))', ['otp:ip:'.$ip]);
        $this->db->select('select pg_advisory_xact_lock(hashtextextended(?,0))', ['otp:phone:'.$phone]);
        return $this->one("select
            (select count(*)::int from otp_challenges where phone_e164=? and locked_at>now()-interval '1 hour') as locks,
            (select max(locked_at)>now()-interval '15 minutes' from otp_challenges where phone_e164=? and locked_at>now()-interval '1 hour') as recently_locked,
            (select count(*)::int from otp_challenges where phone_e164=? and created_at>now()-interval '1 hour') as hourly,
            (select count(*)::int from otp_challenges where phone_e164=? and created_at>now()-interval '1 day') as daily,
            (select count(*)::int from otp_challenges where ip=? and created_at>now()-interval '1 hour') as network,
            exists(select 1 from otp_challenges where phone_e164=? and created_at>now()-interval '60 seconds') as cooling",
            [$phone, $phone, $phone, $phone, $ip, $phone]);
    }

    public function accountStatus(string $phone): ?string
    {
        return $this->one("select status from users where phone_e164=? and role='user'", [$phone])['status'] ?? null;
    }

    public function createOtp(string $id, string $phone, string $hmac, string $ip): void
    {
        $this->db->update('update otp_challenges set superseded_at=now() where phone_e164=? and consumed_at is null and superseded_at is null', [$phone]);
        $this->db->insert("insert into otp_challenges(id,phone_e164,code_hmac,ip,expires_at) values(?,?,?,?,now()+interval '2 minutes')", [$id, $phone, $hmac, $ip]);
    }

    public function lockOtp(string $phone): ?array
    {
        return $this->one('select id,code_hmac,attempts,consumed_at,superseded_at,locked_at,expires_at<=now() as expired from otp_challenges where phone_e164=? order by created_at desc limit 1 for update', [$phone]);
    }

    public function consumeOtp(string $id, bool $success): void
    {
        $this->db->update($success ? 'update otp_challenges set consumed_at=now() where id=?' :
            'update otp_challenges set attempts=attempts+1,locked_at=case when attempts+1>=5 then now() else locked_at end,consumed_at=case when attempts+1>=5 then now() else consumed_at end where id=?', [$id]);
    }

    public function lockUser(string $phone): ?array
    {
        return $this->one('select id,role,status from users where phone_e164=? for update', [$phone]);
    }

    public function createCustomer(string $id, string $conversationId, string $phone): void
    {
        $this->db->insert("insert into users(id,phone_e164,role,status) values(?,?,'user','pending')", [$id, $phone]);
        $this->db->insert('insert into wallets(user_id) values(?)', [$id]);
        $this->db->insert("insert into conversations(id,kind,user_id) values(?,'support',?)", [$conversationId, $id]);
        $this->db->insert('insert into conversation_participants(conversation_id,user_id) values(?,?)', [$conversationId, $id]);
    }

    public function createSession(string $id, string $userId, ?string $label, ?string $platform): string
    {
        return $this->one("insert into sessions(id,user_id,created_at,absolute_expires_at,platform,device_label,last_seen_at) values(?,?,now(),now()+interval '30 days',?,?,now()) returning absolute_expires_at",
            [$id, $userId, $platform, $label])['absolute_expires_at'];
    }

    public function addRefresh(string $id, string $sessionId, string $hash, ?string $parentId): string
    {
        return $this->one('insert into refresh_tokens(id,session_id,token_hash,parent_id,expires_at) select ?,s.id,?,?,s.absolute_expires_at from sessions s where s.id=? returning expires_at',
            [$id, $hash, $parentId, $sessionId])['expires_at'];
    }

    public function lockRefresh(string $hash): ?array
    {
        return $this->one('select t.id,t.session_id,t.used_at,s.revoked_at,s.absolute_expires_at<=now() as expired,s.user_id,u.role,u.status
            from refresh_tokens t join sessions s on s.id=t.session_id join users u on u.id=s.user_id where t.token_hash=? for update of s,t', [$hash]);
    }

    public function useRefresh(string $id, string $sessionId): void
    {
        $this->db->update('update refresh_tokens set used_at=now() where id=? and used_at is null', [$id]);
        $this->db->update('update sessions set last_seen_at=now() where id=?', [$sessionId]);
    }

    public function revoke(string $userId, string $sessionId, string $reason): int
    {
        return $this->db->update('update sessions set revoked_at=now(),revoke_reason=? where id=? and user_id=? and revoked_at is null', [$reason, $sessionId, $userId]);
    }

    public function sessions(string $userId): array
    {
        return array_map(fn ($r) => (array) $r, $this->db->select('select id,created_at,absolute_expires_at,platform,device_label from sessions where user_id=? and revoked_at is null and absolute_expires_at>now() order by created_at desc', [$userId]));
    }

    public function authenticatedSession(string $userId, string $sessionId): ?array
    {
        return $this->one('select s.revoked_at,u.role,u.status,p.active as specialist_active from sessions s join users u on u.id=s.user_id left join specialist_profiles p on p.user_id=u.id where s.id=? and s.user_id=? and s.absolute_expires_at>now()', [$sessionId, $userId]);
    }

    public function profile(string $userId): ?string
    {
        return $this->one('select display_name from users where id=?', [$userId])['display_name'] ?? null;
    }

    public function rename(string $userId, string $name): void
    {
        $this->db->update('update users set display_name=? where id=?', [$name, $userId]);
    }

    public function personalDetails(string $userId): ?string
    {
        return $this->one('select details_encrypted from user_personal_details where user_id=?', [$userId])['details_encrypted'] ?? null;
    }

    public function savePersonalDetails(string $userId, string $name, string $encrypted): void
    {
        $this->transaction(function () use ($userId, $name, $encrypted): void {
            $this->rename($userId, $name);
            $this->db->insert('insert into user_personal_details(user_id,details_encrypted) values(?,?) on conflict(user_id) do update set details_encrypted=excluded.details_encrypted', [$userId, $encrypted]);
        });
    }
}
