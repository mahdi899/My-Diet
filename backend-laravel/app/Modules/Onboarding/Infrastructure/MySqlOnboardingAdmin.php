<?php

namespace App\Modules\Onboarding\Infrastructure;

use App\Modules\Identity\Application\IdentitySettings;
use App\Modules\Onboarding\Application\OnboardingAdminQueries;
use App\Shared\Domain\LegacyCrypto as Crypto;
use App\Shared\Domain\Problem;
use Illuminate\Database\ConnectionInterface;

final class MySqlOnboardingAdmin implements OnboardingAdminQueries
{
    public function __construct(private ConnectionInterface $db, private IdentitySettings $settings) {}

    private function decoded(?string $value): mixed
    {
        return $value === null ? null : json_decode($value, false, 512, JSON_THROW_ON_ERROR);
    }

    private function mask(string $phone): string
    {
        return strlen($phone) < 8 ? $phone : substr($phone, 0, 4).'***'.substr($phone, -4);
    }

    private function cursor(?string $cursor): ?array
    {
        if (! $cursor) {
            return null;
        }
        try {
            $parts = explode('|', Crypto::decode64($cursor));
            if (count($parts) < 2 || ! $parts[0] || ! $parts[1]) {
                return null;
            }
            $time = new \DateTimeImmutable($parts[0], new \DateTimeZone('UTC'));

            return [$time->setTimezone(new \DateTimeZone('UTC'))->format('Y-m-d H:i:s.u'), strtolower($parts[1])];
        } catch (\Throwable) {
            return null;
        }
    }

    private function size(mixed $value): int
    {
        if ($value === null || $value === '') {
            return 30;
        }
        if (! is_numeric($value) || ! is_finite((float) $value) || floor((float) $value) !== (float) $value) {
            throw new Problem(400, 'validation', 'اندازهٔ صفحه درست نیست');
        }

        return (int) max(1, min(100, (float) $value));
    }

    private function nextCursor(string $at, string $id): string
    {
        $date = new \DateTimeImmutable($at, new \DateTimeZone('UTC'));
        $timestamp = $date->format('Y-m-d\TH:i:s.u\Z');
        if (substr($date->format('u'), 3) === '000') {
            $timestamp = Crypto::iso($at);
        }

        return Crypto::base64url($timestamp.'|'.$id);
    }

    public function profiles(array $filter): array
    {
        $query = $this->db->table('nutrition_profiles as p')->join('users as u', 'u.id', '=', 'p.user_id')->select('p.*', 'u.display_name', 'u.phone_e164');
        if (! empty($filter['track'])) {
            if (! in_array($filter['track'], ['weight_loss', 'weight_gain', 'pregnancy', 'detox'], true)) {
                throw new Problem(400, 'validation', 'هدف نامعتبر است');
            }
            $query->where('p.track', $filter['track']);
        }
        foreach (['tier' => ['p.safety_tier', ['doctor_only', 'ai_ok']], 'source' => ['p.source', ['app', 'demo']]] as $key => [$column,$options]) {
            if (in_array($filter[$key] ?? null, $options, true)) {
                $query->where($column, $filter[$key]);
            }
        }
        foreach (['flag' => 'risk_flags', 'allergen' => 'allergens'] as $key => $column) {
            if (! empty($filter[$key])) {
                $query->whereJsonContains('p.'.$column, $filter[$key]);
            }
        }
        if (! empty($filter['q'])) {
            $query->whereRaw('locate(lower(?),lower(u.display_name)) > 0', [$filter['q']]);
        }
        $cursor = $this->cursor($filter['cursor'] ?? null);
        if ($cursor) {
            $query->whereRaw('(p.updated_at,p.user_id)<(?,?)', $cursor);
        }
        $size = $this->size($filter['limit'] ?? null);
        $rows = $query->orderByDesc('p.updated_at')->orderByDesc('p.user_id')->limit($size + 1)->get()->all();
        $page = array_slice($rows, 0, $size);
        $last = end($page);

        return ['items' => array_map(fn ($row) => [
            'userId' => $row->user_id, 'name' => $row->display_name, 'phone' => $this->mask($row->phone_e164), 'track' => $row->track, 'goal' => $row->goal, 'source' => $row->source, 'sex' => $row->sex, 'age' => $row->age,
            'bmi' => (float) $row->bmi, 'targetKcal' => $row->target_kcal, 'safetyTier' => $row->safety_tier, 'riskFlags' => $this->decoded($row->risk_flags), 'allergens' => $this->decoded($row->allergens),
            'consented' => $row->consented_at !== null, 'updatedAt' => Crypto::iso($row->updated_at)], $page),
            'nextCursor' => count($rows) > $size && $last ? $this->nextCursor($last->updated_at, $last->user_id) : null];
    }

    public function profile(string $admin, string $user): array
    {
        $row = $this->db->table('nutrition_profiles as p')->join('users as u', 'u.id', '=', 'p.user_id')->where('p.user_id', $user)->select('p.*', 'u.display_name', 'u.phone_e164')->first();
        if (! $row) {
            throw new Problem(404, 'not_found', 'پروفایل پیدا نشد');
        }
        $profile = [];
        foreach (['track' => 'track', 'goal' => 'goal', 'source' => 'source', 'sex' => 'sex', 'age' => 'age', 'activity' => 'activity', 'bmrKcal' => 'bmr_kcal', 'tdeeKcal' => 'tdee_kcal', 'targetKcal' => 'target_kcal',
            'proteinG' => 'protein_g', 'carbsG' => 'carbs_g', 'fatG' => 'fat_g', 'dietStyle' => 'diet_style', 'mealsPerDay' => 'meals_per_day', 'budget' => 'budget', 'region' => 'region', 'safetyTier' => 'safety_tier', 'specVersion' => 'spec_version'] as $key => $column) {
            $profile[$key] = $row->$column;
        }
        foreach (['heightCm' => 'height_cm', 'weightKg' => 'weight_kg', 'targetWeightKg' => 'target_weight_kg', 'bmi' => 'bmi'] as $key => $column) {
            $profile[$key] = $row->$column === null ? null : (float) $row->$column;
        }
        foreach (['allergens' => 'allergens', 'conditions' => 'conditions', 'riskFlags' => 'risk_flags', 'safetyReasons' => 'safety_reasons', 'preferences' => 'preferences'] as $key => $column) {
            $profile[$key] = $this->decoded($row->$column);
        }
        $profile['consentedAt'] = $row->consented_at === null ? null : Crypto::iso($row->consented_at);
        $stored = $this->db->table('questionnaire_submissions')->where('id', $row->submission_id)->first();
        $submission = null;
        if ($stored) {
            $answers = $this->decoded($stored->answers);
            foreach (['healthDetails', 'allergies', 'medicines', 'dislikes'] as $key) {
                if (isset($answers->$key) && is_string($answers->$key)) {
                    $answers->$key = Crypto::decrypt($answers->$key, $this->settings->fieldKey);
                }
            }
            $submission = ['id' => $stored->id, 'submittedAt' => Crypto::iso($stored->submitted_at), 'answers' => $answers];
        }
        $history = array_map(fn ($r) => ['id' => $r->id, 'weight_kg' => (float) $r->weight_kg, 'target_kcal' => $r->target_kcal, 'created_at' => Crypto::iso($r->created_at)],
            $this->db->table('nutrition_profile_history')->where('user_id', $user)->orderByDesc('created_at')->limit(20)->get()->all());
        $requests = array_map(fn ($r) => ['id' => $r->id, 'kind' => $r->kind, 'status' => $r->status, 'created_at' => Crypto::iso($r->created_at)],
            $this->db->table('plan_requests')->where('user_id', $user)->orderByDesc('created_at')->limit(10)->get()->all());
        $facts = array_map(fn ($r) => ['key' => $r->question_key, 'code' => $r->value_code, 'num' => $r->value_num === null ? null : (float) $r->value_num],
            $this->db->table('onboarding_answer_facts')->where('submission_id', $row->submission_id)->orderBy('question_key')->orderBy('value_code')->get()->all());
        $this->db->table('audit_logs')->insert(['id' => Crypto::uuid(), 'actor_id' => $admin, 'action' => 'onboarding_profile_viewed', 'target_type' => 'nutrition_profile', 'target_id' => $user, 'detail' => '{}']);

        return ['userId' => $user, 'name' => $row->display_name, 'phone' => $row->phone_e164, 'profile' => $profile, 'submission' => $submission, 'facts' => $facts, 'history' => $history, 'planRequests' => $requests];
    }

    public function funnel(): array
    {
        $leads = $this->db->table('demo_lead_submissions');
        $profiles = $this->db->table('nutrition_profiles');
        $requests = $this->db->table('plan_requests');
        $stages = ['onboardingLeads' => $leads->count(), 'onboardingVerified' => (clone $leads)->where('phone_verified', true)->count(), 'onboardingClaimed' => (clone $leads)->whereNotNull('claimed_user_id')->count(),
            'drafts' => $this->db->table('onboarding_drafts')->count(), 'profiles' => $profiles->count(), 'consented' => (clone $profiles)->whereNotNull('consented_at')->count(),
            'doctorOnly' => (clone $profiles)->where('safety_tier', '<>', 'ai_ok')->count(), 'requests' => (clone $requests)->distinct()->count('user_id'), 'published' => (clone $requests)->where('status', 'published')->distinct()->count('user_id')];
        $daily = array_map(fn ($r) => ['day' => $r->day, 'track' => $r->track, 'source' => $r->source, 'profiles' => $r->profiles, 'avg_bmi' => (float) $r->avg_bmi, 'doctor_only' => (int) $r->doctor_only],
            $this->db->table('onboarding_daily_cache')->orderByDesc('day')->orderBy('track')->limit(120)->get()->all());

        return ['stages' => $stages, 'daily' => $daily];
    }

    public function refresh(): array
    {
        $this->db->transaction(function (): void {
            $mutex = hash('sha256', 'onboarding:funnel');
            $this->db->statement('insert into identity_mutexes(lock_key) values(?) as incoming on duplicate key update lock_key=incoming.lock_key', [$mutex]);
            $this->db->table('identity_mutexes')->where('lock_key', $mutex)->lockForUpdate()->first();
            $groups = [];
            $tehran = new \DateTimeZone('Asia/Tehran');
            $utc = new \DateTimeZone('UTC');
            /** PHP uses the IANA rules even when MySQL's optional timezone tables are not installed. */
            foreach ($this->db->table('nutrition_profiles')->select('user_id', 'created_at', 'track', 'source', 'bmi', 'safety_tier')->orderBy('user_id')->cursor() as $row) {
                $day = (new \DateTimeImmutable($row->created_at, $utc))->setTimezone($tehran)->format('Y-m-d');
                $key = $day.'|'.$row->track.'|'.$row->source;
                $groups[$key] ??= ['day' => $day, 'track' => $row->track, 'source' => $row->source, 'profiles' => 0, 'sum' => 0.0, 'doctor_only' => 0];
                $groups[$key]['profiles']++;
                $groups[$key]['sum'] += (float) $row->bmi;
                $groups[$key]['doctor_only'] += $row->safety_tier === 'ai_ok' ? 0 : 1;
            }
            $this->db->table('onboarding_daily_cache')->delete();
            foreach ($groups as $group) {
                $group['avg_bmi'] = round($group['sum'] / $group['profiles'], 1);
                unset($group['sum']);
                $this->db->table('onboarding_daily_cache')->insert($group);
            }
        });

        return ['ok' => true];
    }

    public function leads(?string $cursor, mixed $limit): array
    {
        $query = $this->db->table('demo_lead_submissions');
        $parsed = $this->cursor($cursor);
        if ($parsed) {
            $query->whereRaw('(created_at,id)<(?,?)', $parsed);
        }
        $size = $this->size($limit);
        $rows = $query->orderByDesc('created_at')->orderByDesc('id')->limit($size + 1)->get()->all();
        $page = array_slice($rows, 0, $size);
        $last = end($page);
        $items = array_map(function ($row): array {
            try {
                $phone = Crypto::decrypt($row->phone_encrypted, $this->settings->fieldKey);
            } catch (\Throwable) {
                $phone = '';
            }

            return ['id' => $row->id, 'goal' => $row->goal, 'phone' => $this->mask($phone), 'phoneVerified' => (bool) $row->phone_verified, 'claimedUserId' => $row->claimed_user_id,
                'claimedAt' => $row->claimed_at === null ? null : Crypto::iso($row->claimed_at), 'createdAt' => Crypto::iso($row->created_at)];
        }, $page);

        return ['items' => $items, 'nextCursor' => count($rows) > $size && $last ? $this->nextCursor($last->created_at, $last->id) : null];
    }
}
