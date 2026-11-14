<?php

namespace App\Modules\Onboarding\Infrastructure;

use App\Modules\Onboarding\Application\TransferStore;
use App\Shared\Domain\Amount;
use App\Shared\Domain\LegacyCrypto as Crypto;
use Illuminate\Database\ConnectionInterface;

final class MySqlTransfers implements TransferStore
{
    public function __construct(private ConnectionInterface $db) {}

    private function record(?object $row): ?array
    {
        return $row ? ['id' => $row->id, 'plan' => $row->plan, 'amount_toman' => Amount::safe($row->amount_toman), 'expires_at' => Crypto::iso($row->expires_at),
            'confirmed_at' => $row->confirmed_at === null ? null : Crypto::iso($row->confirmed_at), 'gateway_started' => $row->zibal_track_id !== null] : null;
    }

    public function transaction(\Closure $work): mixed
    {
        return $this->db->transaction($work);
    }

    public function lockUser(string $user): ?string
    {
        return $this->db->table('users')->where('id', $user)->lockForUpdate()->value('phone_e164');
    }

    public function verified(string $submission, string $hash): bool
    {
        return $this->db->table('demo_lead_submissions')->where(['id' => $submission, 'phone_hash' => $hash, 'phone_verified' => true])->exists();
    }

    public function reusable(string $user, string $submission, string $plan): ?array
    {
        return $this->record($this->db->table('onboarding_transfers')->where(['user_id' => $user, 'submission_id' => $submission, 'plan' => $plan])
            ->where(fn ($q) => $q->whereNotNull('confirmed_at')->orWhereRaw('expires_at>current_timestamp(6)'))->orderByDesc('created_at')->first());
    }

    public function insert(string $id, string $user, string $submission, string $plan, int $amount): ?array
    {
        $this->db->statement('insert into onboarding_transfers(id,user_id,submission_id,plan,amount_toman,expires_at) values(?,?,?,?,?,date_add(current_timestamp(6),interval 30 minute)) as incoming on duplicate key update id=onboarding_transfers.id', [$id, $user, $submission, $plan, $amount]);

        return $this->record($this->db->table('onboarding_transfers')->where('id', $id)->first());
    }

    public function status(string $id, string $user): ?array
    {
        return $this->record($this->db->table('onboarding_transfers')->where(['id' => $id, 'user_id' => $user])->first());
    }

    public function payment(string $id, string $user): ?array
    {
        $row = $this->db->table('onboarding_transfers')->where(['id' => $id, 'user_id' => $user])->selectRaw('*,expires_at>current_timestamp(6) as active')->lockForUpdate()->first();

        return $row ? ['amountToman' => Amount::safe($row->amount_toman), 'trackId' => $row->zibal_track_id, 'confirmed' => $row->confirmed_at !== null, 'active' => (bool) $row->active] : null;
    }

    public function attach(string $id, string $track): void
    {
        $this->db->table('onboarding_transfers')->where('id', $id)->update(['zibal_track_id' => $track]);
    }

    public function byTrack(string $track): ?array
    {
        $row = $this->db->table('onboarding_transfers')->where('zibal_track_id', $track)->first();

        return $row ? ['id' => $row->id, 'amountToman' => Amount::safe($row->amount_toman), 'confirmed' => $row->confirmed_at !== null] : null;
    }

    public function lockReference(string $reference): void
    {
        $key = hash('sha256', 'onboarding:reference:'.$reference);
        $this->db->statement('insert into identity_mutexes(lock_key) values(?) as incoming on duplicate key update lock_key=incoming.lock_key', [$key]);
        $this->db->table('identity_mutexes')->where('lock_key', $key)->lockForUpdate()->first();
    }

    public function referenceUsed(string $reference, string $except): bool
    {
        return $this->db->table('onboarding_transfers')->where('bank_reference', $reference)->where('id', '<>', $except)->lockForUpdate()->first() !== null;
    }

    public function confirm(string $id, string $reference, ?int $bankAmount = null): ?array
    {
        $row = $this->db->table('onboarding_transfers')->where('id', $id)->lockForUpdate()->first();
        if (! $row || $row->confirmed_at !== null || ($bankAmount !== null && ((int) $row->amount_toman !== $bankAmount || $row->zibal_track_id !== null))) {
            return null;
        }
        $this->db->table('onboarding_transfers')->where('id', $id)->update(['confirmed_at' => $this->db->raw('current_timestamp(6)'), 'bank_reference' => $reference, 'sms_status' => 'sending']);

        return ['phone' => $this->db->table('users')->where('id', $row->user_id)->value('phone_e164'), 'amountToman' => Amount::safe($row->amount_toman)];
    }

    public function audit(?string $actor, string $action, string $id, array $detail): void
    {
        $this->db->table('audit_logs')->insert(['id' => Crypto::uuid(), 'actor_id' => $actor, 'action' => $action, 'target_type' => 'onboarding_transfer', 'target_id' => $id, 'detail' => json_encode($detail, JSON_THROW_ON_ERROR)]);
    }

    public function all(): array
    {
        return array_map(function ($row): array {
            $row = (array) $row;
            foreach (['created_at', 'expires_at', 'confirmed_at'] as $key) {
                $row[$key] = $row[$key] === null ? null : Crypto::iso($row[$key]);
            }
            $row['amount_toman'] = Amount::safe($row['amount_toman']);

            return $row;
        }, $this->db->table('onboarding_transfers as t')->join('users as u', 'u.id', '=', 't.user_id')
            ->select('t.id', 't.user_id', 't.submission_id', 't.plan', 't.amount_toman', 't.expires_at', 't.created_at', 't.confirmed_at', 't.bank_reference', 't.sms_status', 't.zibal_track_id', 'u.phone_e164')
            ->orderByDesc('t.created_at')->limit(200)->get()->all());
    }

    public function smsStatus(string $id, string $status): void
    {
        $this->db->table('onboarding_transfers')->where('id', $id)->update(['sms_status' => $status]);
    }
}
