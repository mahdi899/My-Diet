<?php

namespace App\Modules\Privacy\Infrastructure;

use App\Modules\Identity\Application\IdentitySettings;
use App\Shared\Domain\LegacyCrypto as Crypto;
use App\Shared\Domain\Problem;
use Illuminate\Database\ConnectionInterface;

final class MySqlPrivacy
{
    public function __construct(private ConnectionInterface $db, private IdentitySettings $settings) {}

    public function export(string $user): array
    {
        $profile = $this->db->table('users')->where('id', $user)->first(['id', 'phone_e164', 'role', 'display_name', 'status', 'created_at']);
        $submissions = [];
        foreach ($this->db->table('questionnaire_submissions')->where('user_id', $user)->orderBy('submitted_at')->get() as $row) {
            $answers = $this->json($row->answers);
            foreach ($answers as $key => $value) {
                if (is_string($value)) {
                    $answers[$key] = $this->open($value);
                }
            }
            $submissions[] = ['submittedAt' => $row->submitted_at, 'riskFlags' => $this->json($row->risk_flags), 'answers' => $answers];
        }
        $draft = $this->db->table('onboarding_drafts')->where('user_id', $user)->first();
        $coach = $this->db->table('coach_messages')->where('user_id', $user)->orderBy('created_at')->get(['id', 'role', 'fallback_text', 'created_at']);
        $media = $this->db->table('media_objects')->where('owner_id', $user)->get(['id', 'purpose', 'status', 'detected_type', 'byte_size']);

        return [
            'profile' => $profile === null ? null : ['id' => $profile->id, 'phone' => $profile->phone_e164, 'role' => $profile->role, 'displayName' => $profile->display_name, 'status' => $profile->status, 'createdAt' => $profile->created_at],
            'questionnaire' => $submissions,
            'onboardingDraft' => $draft === null ? null : $this->json($draft->answers),
            'wallet' => $this->db->table('wallets')->where('user_id', $user)->first(['cash_toman', 'promo_toman']),
            'ledger' => $this->db->table('wallet_ledger')->where('user_id', $user)->orderBy('created_at')->get(['bucket', 'amount_toman', 'kind', 'created_at']),
            'messages' => $this->db->select('select m.id,m.body,m.created_at from messages m join conversation_participants p on p.conversation_id=m.conversation_id where p.user_id=? order by m.created_at', [$user]),
            'coachMessages' => $coach,
            'media' => $media,
        ];
    }

    public function delete(string $user): array
    {
        return $this->db->transaction(function () use ($user) {
            $row = $this->db->selectOne('select status,role from users where id=? for update', [$user]);
            if ($row === null || $row->status === 'deleted') {
                throw new Problem(409, 'account_deleted', 'این حساب حذف شده است');
            }
            if ($row->role === 'admin') {
                throw new Problem(403, 'forbidden', 'حساب مدیریت از اینجا حذف نمی‌شود');
            }
            $this->db->statement('set @sabzine_anonymize=1');
            $this->db->table('questionnaire_submissions')->where('user_id', $user)->update(['answers' => json_encode(['redacted' => true]), 'risk_flags' => '[]']);
            $this->db->table('onboarding_drafts')->where('user_id', $user)->update(['answers' => '{}']);
            $this->db->table('coach_messages')->where('user_id', $user)->update(['fallback_text' => '', 'payload' => '{}']);
            $this->db->table('coach_threads')->where('user_id', $user)->update(['summary' => '']);
            $this->db->table('coach_memory')->where('user_id', $user)->delete();
            $this->db->table('coach_media')->where('user_id', $user)->delete();
            $this->db->table('coach_food_entries')->where('user_id', $user)->update(['title' => 'حذف‌شده', 'items' => '[]', 'totals' => '{}']);
            $this->db->table('notifications')->where('user_id', $user)->delete();
            $owned = $this->db->table('media_objects')->where('owner_id', $user)->pluck('id');
            if ($owned->isNotEmpty()) {
                $this->db->table('media_bytes')->whereIn('media_id', $owned)->delete();
            }
            $this->db->statement('update messages set body=\'\' where conversation_id in (select conversation_id from conversation_participants where user_id=?)', [$user]);
            $this->db->table('program_reviews')->where('user_id', $user)->update(['body' => '']);
            $this->db->table('weight_entries')->where('user_id', $user)->delete();
            $this->db->table('user_personal_details')->where('user_id', $user)->delete();
            $this->db->table('users')->where('id', $user)->update(['status' => 'deleted', 'display_name' => null, 'phone_e164' => substr('d'.str_replace('-', '', $user), 0, 32), 'deleted_at' => $this->db->raw('current_timestamp(6)')]);
            $this->db->table('sessions')->where('user_id', $user)->whereNull('revoked_at')->update(['revoked_at' => $this->db->raw('current_timestamp(6)'), 'revoke_reason' => 'account_deleted']);
            $this->db->table('devices')->where('user_id', $user)->whereNull('revoked_at')->update(['revoked_at' => $this->db->raw('current_timestamp(6)')]);
            $this->db->table('audit_logs')->insert(['id' => Crypto::uuid(), 'actor_id' => $user, 'action' => 'account_delete', 'target_type' => 'user', 'target_id' => $user, 'detail' => json_encode(['ledgerRetained' => true])]);
            $ledger = (int) $this->db->table('wallet_ledger')->where('user_id', $user)->count();

            return ['deleted' => true, 'ledgerRetained' => true, 'ledgerRows' => $ledger];
        });
    }

    private function open(string $value): string
    {
        return str_starts_with($value, 'enc1:') ? Crypto::decrypt($value, $this->settings->fieldKey) : $value;
    }

    private function json(mixed $value): array
    {
        if (is_array($value)) {
            return $value;
        }
        $decoded = json_decode((string) $value, true);

        return is_array($decoded) ? $decoded : [];
    }
}
