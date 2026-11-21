<?php

namespace App\Modules\Admin\Infrastructure;

use App\Modules\Admin\Domain\AdminRules;
use App\Modules\Identity\Application\IdentitySettings;
use App\Modules\Money\Domain\SubscriptionPlans;
use App\Modules\Plans\Domain\CivilDates;
use App\Modules\Worker\Application\WorkerStore;
use App\Shared\Domain\Amount;
use App\Shared\Domain\LegacyCrypto as Crypto;
use App\Shared\Domain\Problem;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Database\Query\Builder;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Cache;

final class MySqlAdminDesk
{
    public function __construct(private ConnectionInterface $db, private IdentitySettings $settings, private WorkerStore $worker, private DoctorActivity $activity) {}

    public function createSpecialist(string $actor, array $input): array
    {
        if ($this->db->table('users')->where('phone_e164', $input['phone'])->exists()) {
            throw new Problem(409, 'phone_taken', 'این شماره قبلاً ثبت شده است');
        }
        $id = Crypto::uuid();

        return $this->db->transaction(function () use ($actor, $input, $id): array {
            $this->db->table('users')->insert(['id' => $id, 'phone_e164' => $input['phone'], 'role' => 'specialist', 'display_name' => $input['displayName'], 'status' => 'active']);
            $this->db->table('wallets')->insert(['user_id' => $id]);
            if ($input['councilNo'] !== '' && $this->db->table('specialist_profiles')->where('medical_council_no', $input['councilNo'])->exists()) {
                throw new Problem(409, 'council_taken', 'این شمارهٔ نظام قبلاً ثبت شده است');
            }
            $this->db->table('specialist_profiles')->insert([
                'user_id' => $id, 'display_name' => $input['displayName'], 'credential' => $input['credential'], 'bio' => $input['bio'],
                'capacity' => $input['capacity'], 'medical_council_no' => $input['councilNo'], 'birth_date' => $input['birthDate'],
                'education' => $input['education'], 'portrait' => $input['portrait'],
            ]);
            if ($input['username'] !== null) {
                $this->assertLoginFree($input['username']);
                $this->db->table('specialist_credentials')->insert(['user_id' => $id, 'username' => $input['username'], 'password_hash' => $input['passwordHash']]);
            }
            $conversation = Crypto::uuid();
            $this->db->table('conversations')->insert(['id' => $conversation, 'kind' => 'support', 'user_id' => $id]);
            $this->db->table('conversation_participants')->insert(['conversation_id' => $conversation, 'user_id' => $id]);
            $this->audit($actor, 'specialist_created', 'user', $id, ['capacity' => $input['capacity']]);

            return ['id' => $id];
        });
    }

    public function updateSpecialist(string $actor, string $id, array $input): array
    {
        if (array_key_exists('capacity', $input) && ($input['capacity'] < 0 || $input['capacity'] > 500)) {
            throw new Problem(400, 'validation', 'ظرفیت پذیرش باید عددی بین ۰ و ۵۰۰ باشد');
        }

        return $this->db->transaction(function () use ($actor, $id, $input): array {
            $current = $this->db->selectOne('select user_id from specialist_profiles where user_id=? for update', [$id]);
            if ($current === null) {
                throw new Problem(404, 'not_found', 'متخصص پیدا نشد');
            }
            $row = $this->db->table('specialist_profiles')->where('user_id', $id)->first();
            $this->db->table('specialist_profiles')->where('user_id', $id)->update([
                'active' => $input['active'] ?? (bool) $row->active,
                'capacity' => $input['capacity'] ?? $row->capacity,
                'display_name' => $input['displayName'] ?? $row->display_name,
                'credential' => $input['credential'] ?? $row->credential,
                'bio' => $input['bio'] ?? $row->bio,
                'rating' => array_key_exists('rating', $input) ? $input['rating'] : $row->rating,
            ]);
            $this->audit($actor, 'specialist_updated', 'user', $id, array_filter($input, fn ($value) => $value !== null));
            if (($input['active'] ?? null) === false) {
                $this->db->statement("delete cp from conversation_participants cp join conversations c on c.id=cp.conversation_id where c.kind='care' and cp.user_id=?", [$id]);
                $this->db->table('plan_requests')->where('assigned_specialist_id', $id)->whereIn('status', ['queued', 'generating', 'in_review', 'awaiting_user', 'response_received'])->update(['assigned_specialist_id' => null, 'updated_at' => $this->db->raw('current_timestamp(6)')]);
            }

            return ['ok' => true];
        });
    }

    public function updateOwnProfile(string $id, array $input): array
    {
        if ($input === []) {
            throw new Problem(400, 'validation', 'اطلاعات واردشده ناقص یا نادرست است');
        }
        $current = $this->db->table('specialist_profiles')->where('user_id', $id)->first();
        if ($current === null) {
            throw new Problem(404, 'not_found', 'پروندهٔ متخصص پیدا نشد');
        }
        $council = $input['councilNo'] ?? $current->medical_council_no;
        if ($council !== '' && $council !== $current->medical_council_no && $this->db->table('specialist_profiles')->where('medical_council_no', $council)->where('user_id', '<>', $id)->exists()) {
            throw new Problem(409, 'council_taken', 'این شمارهٔ نظام قبلاً ثبت شده است');
        }
        $verification = AdminRules::verificationAfterCouncilChange($current->medical_council_no, $input['councilNo'] ?? null, $current->verification_status);
        $next = [
            'display_name' => $input['displayName'] ?? $current->display_name,
            'credential' => $input['credential'] ?? $current->credential,
            'bio' => $input['bio'] ?? $current->bio,
            'medical_council_no' => $council,
            'verification_status' => $verification,
            'portrait' => $input['portrait'] ?? $current->portrait,
            'education' => $input['education'] ?? $current->education,
        ];
        $this->db->table('specialist_profiles')->where('user_id', $id)->update($next);
        $this->audit($id, 'specialist_profile_updated', 'user', $id, ['councilChanged' => array_key_exists('councilNo', $input) && $input['councilNo'] !== $current->medical_council_no, 'verificationStatus' => $verification]);

        return ['displayName' => $next['display_name'], 'credential' => $next['credential'], 'bio' => $next['bio'], 'councilNo' => $council, 'verificationStatus' => $verification, 'active' => (bool) (int) $current->active, 'portrait' => $next['portrait'], 'education' => $next['education']];
    }

    private function memberQuery(string $specialist): Builder
    {
        return $this->db->table('specialist_members as m')
            ->join('users as u', 'u.id', '=', 'm.user_id')
            ->leftJoin('nutrition_profiles as p', 'p.user_id', '=', 'u.id')
            ->where('m.specialist_id', $specialist)->where('u.status', '<>', 'deleted');
    }

    public function doctorMembers(string $specialist, bool $progress): array
    {
        return $this->memberQuery($specialist)->orderBy('u.display_name')->orderBy('u.id')
            ->get(['u.id', 'u.display_name as displayName', 'u.phone_e164 as phone', 'p.track', 'p.goal', 'u.created_at as registeredAt'])
            ->map(function ($row) use ($progress): array {
                $member = (array) $row;
                unset($member['registeredAt']);

                return $member + ($progress ? $this->dailyProgress($row->id, CivilDates::today($row->registeredAt)) : []);
            })->all();
    }

    public function doctorMemberActivity(string $specialist, string $user, mixed $date = null): array
    {
        $row = $this->memberQuery($specialist)->where('u.id', $user)->first(['u.created_at', 'u.display_name']);
        if ($row === null) {
            throw new Problem(404, 'not_found', 'این کاربر زیرمجموعهٔ این پزشک نیست');
        }

        return $this->memberActivity($user, $row, $date);
    }

    public function userProgress(): array
    {
        return $this->db->table('users as u')->leftJoin('nutrition_profiles as p', 'p.user_id', '=', 'u.id')
            ->where('u.role', 'user')->where('u.status', '<>', 'deleted')
            ->orderBy('u.display_name')->orderBy('u.id')
            ->get(['u.id', 'u.display_name as displayName', 'u.phone_e164 as phone', 'p.track', 'p.goal', 'u.created_at'])
            ->map(function ($row): array {
                $member = (array) $row;
                unset($member['created_at']);

                return $member + $this->dailyProgress($row->id, CivilDates::today($row->created_at));
            })->all();
    }

    public function userActivity(string $user, mixed $date = null): array
    {
        $row = $this->db->table('users as u')
            ->leftJoin('user_personal_details as pd', 'pd.user_id', '=', 'u.id')
            ->where('u.id', $user)->where('u.role', 'user')->where('u.status', '<>', 'deleted')
            ->first(['u.id', 'u.created_at', 'u.display_name', 'u.phone_e164', 'pd.details_encrypted']);
        if ($row === null) {
            throw new Problem(404, 'not_found', 'کاربر پیدا نشد');
        }
        $report = $this->memberActivity($user, $row, $date);
        if ($date === null) {
            $report['user'] = [
                'id' => $row->id,
                'displayName' => $this->nameOf($row),
                'phone' => $row->phone_e164,
                'portrait' => $this->photoOf($row->details_encrypted),
            ];
            $report['specialists'] = $this->db->table('specialist_members as m')->join('users as u', 'u.id', '=', 'm.specialist_id')
                ->leftJoin('specialist_profiles as sp', 'sp.user_id', '=', 'm.specialist_id')
                ->where('m.user_id', $user)->orderBy('u.display_name')
                ->get(['u.id', 'u.display_name as displayName', 'u.phone_e164 as phone', 'sp.portrait'])->all();
        }

        return $report;
    }

    private function memberActivity(string $user, object $row, mixed $date): array
    {
        $registeredOn = CivilDates::today($row->created_at);
        $today = CivilDates::today();
        if ($date !== null) {
            if (! is_string($date) || ! CivilDates::valid($date) || $date < $registeredOn || $date > $today) {
                throw new Problem(400, 'validation', 'تاریخ خارج از بازهٔ فعالیت کاربر است');
            }

            return $this->activity->nutrition($user, $date);
        }
        $days = $this->activity->days($user, $registeredOn, $today, true);

        return ['displayName' => $row->display_name, 'registeredOn' => $registeredOn, 'today' => $today,
            'completedDays' => $this->activity->completed($days), 'days' => (object) $days];
    }

    public function doctorMember(string $specialist, string $user): array
    {
        $row = $this->memberQuery($specialist)->where('u.id', $user)->first([
            'u.id', 'u.display_name as displayName', 'u.phone_e164 as phone', 'p.goal', 'p.track', 'p.age',
            'p.height_cm as heightCm', 'p.weight_kg as weightKg', 'p.target_weight_kg as targetWeightKg',
            'p.bmi', 'p.allergens', 'p.conditions',
        ]);
        if ($row === null) {
            throw new Problem(404, 'not_found', 'این کاربر زیرمجموعهٔ این پزشک نیست');
        }
        foreach (['allergens', 'conditions'] as $field) {
            $row->{$field} = json_decode($row->{$field} ?? '[]', true) ?: [];
        }

        return (array) $row + ['onboardingAnswers' => $this->intake($user)['answers'] ?? []];
    }

    private function dailyProgress(string $user, string $registeredOn): array
    {
        return Cache::remember('doctor-member-progress:'.$user, 86400, function () use ($user): array {
            $start = $this->db->table('plan_requests')->where('user_id', $user)->where('status', 'published')
                ->where('week_start', '<=', CivilDates::today())->min('week_start');
            $weights = $this->db->table('weight_entries')->where('user_id', $user)->where('civil_date', '<=', CivilDates::today());
            $first = (clone $weights)->orderBy('civil_date')->first(['civil_date', 'kilograms']);
            $latest = $weights->orderByDesc('civil_date')->first(['civil_date', 'kilograms']);
            $days = $start === null ? null : (new \DateTimeImmutable((string) $start))->diff(new \DateTimeImmutable(CivilDates::today()))->days;

            return ['week' => $days === null ? null : intdiv((int) $days, 7) + 1,
                'weightChangeKg' => $first === null || $latest === null || $first->civil_date === $latest->civil_date
                    ? null : round((float) $latest->kilograms - (float) $first->kilograms, 1),
                'refreshedAt' => now()->toISOString()];
        }) + ['completedDays' => $this->activity->completed($this->activity->days($user, $registeredOn, CivilDates::today()))];
    }

    public function setVerification(string $actor, string $id, string $status): array
    {
        if (! $this->db->table('specialist_profiles')->where('user_id', $id)->exists()) {
            throw new Problem(404, 'not_found', 'متخصص پیدا نشد');
        }
        $this->db->table('specialist_profiles')->where('user_id', $id)->update(['verification_status' => $status]);
        $this->audit($actor, 'specialist_verification', 'user', $id, ['status' => $status]);

        return ['id' => $id, 'verificationStatus' => $status];
    }

    public function members(string $id, bool $available): array
    {
        if (! $this->db->table('specialist_profiles')->where('user_id', $id)->exists()) {
            throw new Problem(404, 'not_found', 'متخصص پیدا نشد');
        }
        $sql = $available
            ? "select u.id, u.phone_e164, u.display_name, u.created_at, pd.details_encrypted from users u left join user_personal_details pd on pd.user_id=u.id where u.role='user' and u.status<>'deleted' and not exists (select 1 from specialist_members sm where sm.user_id=u.id) order by u.display_name, u.phone_e164 limit 300"
            : "select u.id, u.phone_e164, u.display_name, u.created_at, pd.details_encrypted from specialist_members sm join users u on u.id=sm.user_id left join user_personal_details pd on pd.user_id=u.id where sm.specialist_id=? and u.status<>'deleted' order by u.display_name, u.phone_e164";

        return array_map(fn ($row) => ['id' => $row->id, 'phone' => $row->phone_e164, 'displayName' => $this->nameOf($row) ?: $row->phone_e164, 'photo' => $this->photoOf($row->details_encrypted)]
            + ($available ? [] : $this->dailyProgress($row->id, CivilDates::today($row->created_at))), $this->db->select($sql, $available ? [] : [$id]));
    }

    public function addMember(string $actor, string $specialist, string $user): array
    {
        if ($specialist === $user) {
            throw new Problem(400, 'validation', 'پزشک نمی‌تواند زیرمجموعهٔ خودش باشد');
        }

        return $this->db->transaction(function () use ($actor, $specialist, $user): array {
            if ($this->db->selectOne('select user_id from specialist_profiles where user_id=? for update', [$specialist]) === null) {
                throw new Problem(404, 'not_found', 'متخصص پیدا نشد');
            }
            $account = $this->db->selectOne('select role, status from users where id=? for update', [$user]);
            if ($account === null || $account->status === 'deleted') {
                throw new Problem(404, 'not_found', 'کاربر پیدا نشد');
            }
            if ($account->role !== 'user') {
                throw new Problem(409, 'conflict', 'فقط حساب کاربری را می‌توان به زیرمجموعه اضافه کرد');
            }
            $current = $this->db->table('specialist_members')->where('user_id', $user)->value('specialist_id');
            if ($current === $specialist) {
                throw new Problem(409, 'conflict', 'این کاربر همین حالا زیرمجموعهٔ این پزشک است');
            }
            if ($current !== null) {
                throw new Problem(409, 'conflict', 'این کاربر زیرمجموعهٔ پزشک دیگری است');
            }
            $this->db->table('specialist_members')->insert(['user_id' => $user, 'specialist_id' => $specialist]);
            $this->audit($actor, 'specialist_member_added', 'specialist', $specialist, ['userId' => $user]);

            return ['ok' => true];
        });
    }

    public function removeMember(string $actor, string $specialist, string $user): array
    {
        return $this->db->transaction(function () use ($actor, $specialist, $user): array {
            if ($this->db->table('specialist_members')->where(['specialist_id' => $specialist, 'user_id' => $user])->delete() === 0) {
                throw new Problem(404, 'not_found', 'این کاربر زیرمجموعهٔ این پزشک نیست');
            }
            $this->audit($actor, 'specialist_member_removed', 'specialist', $specialist, ['userId' => $user]);

            return ['ok' => true];
        });
    }

    public function assign(string $actor, string $request, string $specialist, string $reason): array
    {
        return $this->db->transaction(function () use ($actor, $request, $specialist, $reason): array {
            $found = $this->db->selectOne("select p.user_id from specialist_profiles p join users u on u.id=p.user_id where p.user_id=? and p.active=1 and p.verification_status='verified' and u.status='active' and u.role='specialist' for update", [$specialist]);
            if ($found === null) {
                throw new Problem(404, 'not_found', 'متخصص پیدا نشد');
            }
            $row = $this->db->selectOne('select id, assigned_specialist_id from plan_requests where id=? for update', [$request]);
            if ($row === null) {
                throw new Problem(404, 'not_found', 'درخواست پیدا نشد');
            }
            $this->db->table('plan_requests')->where('id', $request)->update(['assigned_specialist_id' => $specialist, 'updated_at' => $this->db->raw('current_timestamp(6)')]);
            $this->db->statement("delete cp from conversation_participants cp join conversations c on c.id=cp.conversation_id join users u on u.id=cp.user_id where c.request_id=? and c.kind='care' and u.role='specialist' and cp.user_id<>?", [$request, $specialist]);
            $this->db->statement("insert ignore into conversation_participants (conversation_id, user_id) select id, ? from conversations where request_id=? and kind='care'", [$specialist, $request]);
            $this->db->table('health_access_logs')->insert(['id' => Crypto::uuid(), 'actor_id' => $actor, 'request_id' => $request, 'reason' => $reason]);
            $this->audit($actor, 'request_assigned', 'plan_request', $request, ['previousSpecialistId' => $row->assigned_specialist_id, 'specialistId' => $specialist, 'reason' => $reason]);

            return ['ok' => true];
        });
    }

    public function subscriptionPrices(): array
    {
        $plans = [];
        foreach (SubscriptionPlans::ALL as $plan) {
            $stored = $this->db->table('subscription_plan_prices')->where('plan_code', $plan['id'])->where('effective_from', '<=', $this->db->raw('current_timestamp(6)'))->orderByDesc('effective_from')->value('amount_toman');
            $plans[] = ['id' => $plan['id'], 'title' => $plan['title'], 'days' => $plan['days'], 'priceToman' => (int) ($stored ?? $plan['priceToman'])];
        }

        return ['plans' => $plans];
    }

    public function setSubscriptionPrice(string $actor, string $plan, int $amount): array
    {
        $this->money($amount);
        if (! isset(SubscriptionPlans::ALL[$plan])) {
            throw new Problem(404, 'not_found', 'پلن اشتراک پیدا نشد');
        }
        $this->db->table('subscription_plan_prices')->insert(['id' => Crypto::uuid(), 'plan_code' => $plan, 'amount_toman' => $amount]);
        $this->audit($actor, 'subscription_price_changed', 'subscription_plan', null, ['planId' => $plan, 'amountToman' => $amount]);

        return ['planId' => $plan, 'days' => SubscriptionPlans::ALL[$plan]['days'], 'amountToman' => $amount];
    }

    public function setReward(string $actor, int $amount): array
    {
        if ($amount !== 0) {
            $this->money($amount);
        }

        return $this->db->transaction(function () use ($actor, $amount): array {
            $this->db->table('reward_policies')->where('kind', 'weekly_completion')->update(['amount_toman' => $amount]);
            $this->db->statement("insert into app_settings (`key`, value) values ('reward.weekly_completion_toman', cast(? as json)) as incoming on duplicate key update value=incoming.value, version=app_settings.version+1, updated_at=current_timestamp(6)", [json_encode($amount)]);
            $this->audit($actor, 'reward_changed', 'reward_policy', null, ['amountToman' => $amount]);

            return ['amountToman' => $amount];
        });
    }

    public function reviews(string $status): array
    {
        if (! in_array($status, ['pending', 'approved', 'rejected'], true)) {
            throw new Problem(400, 'validation', 'وضعیت نظر شناخته نشد');
        }

        return array_map(fn ($row) => ['id' => $row->id, 'userId' => $row->user_id, 'requestId' => $row->request_id, 'weekStart' => substr((string) $row->week_start, 0, 10), 'rating' => (int) $row->rating, 'body' => $row->body, 'status' => $row->status], $this->db->table('program_reviews')->where('status', $status)->orderByDesc('created_at')->limit(50)->get()->all());
    }

    public function moderateReview(string $actor, string $id, string $status): array
    {
        if ($this->db->table('program_reviews')->where('id', $id)->update(['status' => $status]) === 0) {
            throw new Problem(404, 'not_found', 'نظر پیدا نشد');
        }
        $this->audit($actor, 'review_moderated', 'program_review', $id, ['status' => $status]);

        return ['id' => $id, 'status' => $status];
    }

    public function ledger(?string $user): array
    {
        $query = $this->db->table('wallet_ledger')->orderByDesc('created_at')->limit(100);
        if ($user !== null) {
            $query->where('user_id', $user);
        }

        return array_map(fn ($row) => ['id' => $row->id, 'userId' => $row->user_id, 'bucket' => $row->bucket, 'amountToman' => Amount::safe($row->amount_toman), 'kind' => $row->kind, 'referenceId' => $row->reference_id, 'createdAt' => Crypto::iso($row->created_at)], $query->get()->all());
    }

    public function generations(): array
    {
        return array_map(fn ($row) => ['id' => $row->id, 'requestId' => $row->request_id, 'provider' => $row->provider, 'status' => $row->status, 'skippedReason' => $row->skipped_reason, 'createdAt' => Crypto::iso($row->created_at)], $this->db->table('ai_generations')->orderByDesc('created_at')->limit(100)->get(['id', 'request_id', 'provider', 'status', 'skipped_reason', 'created_at'])->all());
    }

    public function executions(): array
    {
        return array_map(fn ($row) => ['requestId' => $row->request_id, 'status' => $row->status, 'startedAt' => Crypto::iso($row->started_at), 'finishedAt' => $row->finished_at === null ? null : Crypto::iso($row->finished_at), 'errorCode' => $row->error_code], $this->db->table('ai_execution_claims')->orderByDesc('started_at')->limit(100)->get()->all());
    }

    public function reconcile(string $actor, string $request, int $cost, string $reason): array
    {
        if ($cost < 0 || mb_strlen(trim($reason)) < 3) {
            throw new Problem(400, 'validation', 'هزینه و دلیل بررسی معتبر نیست');
        }

        return $this->db->transaction(function () use ($actor, $request, $cost, $reason): array {
            $claim = $this->db->selectOne("select * from ai_execution_claims where request_id=? and status='failed' for update", [$request]);
            if ($claim === null || $claim->error_code === 'reconciled') {
                throw new Problem(409, 'conflict', 'تلاش نامشخصی برای بررسی وجود ندارد');
            }
            $generation = $this->db->table('ai_generations')->where(['request_id' => $request, 'status' => 'failed'])->orderByDesc('created_at')->value('id');
            if ($generation !== null) {
                $this->db->table('ai_generations')->where('id', $generation)->update(['cost_micros' => $cost]);
            }
            $this->db->table('ai_execution_claims')->where('request_id', $request)->update(['error_code' => 'reconciled']);
            $this->audit($actor, 'ai_cost_reconciled', 'plan_request', $request, ['costMicros' => $cost, 'reason' => trim($reason), 'previousError' => $claim->error_code]);

            return ['ok' => true];
        });
    }

    public function user(string $id): array
    {
        $user = $this->db->table('users')->where('id', $id)->first(['id', 'phone_e164', 'role', 'display_name', 'status', 'created_at']);
        if ($user === null) {
            throw new Problem(404, 'not_found', 'کاربر پیدا نشد');
        }
        $details = $this->details($id);
        $intake = $this->intake($id);

        $account = $this->account($id);
        $registration = $this->registration($account);

        return ['id' => $user->id, 'phone' => $user->phone_e164, 'role' => $user->role, 'displayName' => $details['name'] ?? $intake['displayName'] ?? $user->display_name, 'personalDetails' => $details, 'status' => $user->status, 'createdAt' => Crypto::iso($user->created_at), 'packageTitle' => $account->package_title, 'daysRemaining' => $this->daysRemaining($account->ends_at), 'registrationLabel' => $registration['label'], 'registration' => $registration, 'intake' => $intake === null ? null : ['trackId' => $intake['trackId'], 'trackLabel' => $intake['trackLabel'], 'source' => $intake['source'], 'answers' => $intake['answers']]];
    }

    public function requests(): array
    {
        return array_map(fn ($row) => ['id' => $row->id, 'userId' => $row->user_id, 'status' => $row->status, 'kind' => $row->kind, 'createdAt' => Crypto::iso($row->created_at)], $this->db->table('plan_requests')->orderByDesc('created_at')->limit(100)->get(['id', 'user_id', 'status', 'kind', 'created_at'])->all());
    }

    public function support(): array
    {
        return array_map(fn ($row) => ['id' => $row->id, 'userId' => $row->user_id, 'createdAt' => Crypto::iso($row->created_at)], $this->db->table('conversations')->where('kind', 'support')->orderByDesc('created_at')->limit(100)->get(['id', 'user_id', 'created_at'])->all());
    }

    public function saveDaily(string $actor, string $date, string $body): array
    {
        $this->db->statement('insert into daily_messages (civil_date, body) values (?, ?) as incoming on duplicate key update body=incoming.body, updated_at=current_timestamp(6)', [$date, $body]);
        $this->audit($actor, 'daily_message', 'daily_message', null, ['date' => $date]);

        return ['date' => $date, 'body' => $body];
    }

    public function daily(string $date): array
    {
        return ['date' => $date, 'body' => $this->db->table('daily_messages')->where('civil_date', $date)->value('body')];
    }

    public function users(): array
    {
        $rows = $this->db->select("select u.id, u.phone_e164, u.role, u.status, u.display_name, u.signup_channel, p.source as profile_source, c.name as campaign_name, c.source as campaign_source, coalesce(s.title_fa, ordered.title_fa) as package_title, a.ends_at, pd.details_encrypted from users u left join user_personal_details pd on pd.user_id=u.id left join nutrition_profiles p on p.user_id=u.id left join demo_campaign_links c on c.slug=u.signup_channel left join user_service_access a on a.user_id=u.id left join services s on s.code=a.service_code left join (select o.user_id, sv.title_fa from orders o join services sv on sv.code=o.service_code join (select user_id, max(created_at) as created_at from orders where status='paid' group by user_id) latest on latest.user_id=o.user_id and latest.created_at=o.created_at where o.status='paid') ordered on ordered.user_id=u.id where u.role='user' and u.status<>'deleted' order by u.created_at desc limit 200");

        return array_map(function ($row): array {
            $details = $this->openDetails($row->details_encrypted);

            $registration = $this->registration($row);

            return ['id' => $row->id, 'phone' => $row->phone_e164, 'role' => $row->role, 'status' => $row->status, 'displayName' => $details['name'] ?? $row->display_name, 'photo' => is_string($details['photo'] ?? null) ? $details['photo'] : null, 'registrationLabel' => $registration['label'], 'registration' => $registration, 'packageTitle' => $row->package_title, 'daysRemaining' => $this->daysRemaining($row->ends_at)];
        }, $rows);
    }

    public function setStatus(string $actor, string $id, string $status): array
    {
        $user = $this->db->table('users')->where('id', $id)->first(['role', 'status']);
        if ($user === null) {
            throw new Problem(404, 'not_found', 'کاربر پیدا نشد');
        }
        if ($user->role === 'admin') {
            throw new Problem(403, 'forbidden', 'وضعیت حساب مدیریت از اینجا عوض نمی‌شود');
        }
        if ($user->status === 'deleted') {
            throw new Problem(409, 'account_deleted', 'این حساب حذف شده است');
        }
        $this->db->table('users')->where('id', $id)->update(['status' => $status]);
        $this->audit($actor, 'user_status', 'user', $id, ['status' => $status]);

        return ['id' => $id, 'status' => $status];
    }

    public function deleteUser(string $actor, string $id): array
    {
        if ($actor === $id) {
            throw new Problem(403, 'forbidden', 'حذف حساب خودتان از این فهرست ممکن نیست');
        }

        return $this->db->transaction(function () use ($actor, $id): array {
            $user = $this->db->selectOne('select role from users where id=? for update', [$id]);
            if ($user === null) {
                throw new Problem(404, 'not_found', 'کاربر پیدا نشد');
            }
            if ($user->role === 'admin') {
                throw new Problem(403, 'forbidden', 'حساب مدیریت از اینجا حذف نمی‌شود');
            }
            $this->db->statement('set @sabzine_anonymize=1');
            $this->db->table('questionnaire_submissions')->where('user_id', $id)->update(['answers' => json_encode(['redacted' => true]), 'risk_flags' => '[]']);
            $this->db->table('onboarding_drafts')->where('user_id', $id)->update(['answers' => '{}']);
            $this->db->table('coach_messages')->where('user_id', $id)->update(['fallback_text' => '', 'payload' => '{}']);
            $this->db->table('coach_food_entries')->where('user_id', $id)->update(['media_id' => null, 'title' => 'حذف‌شده', 'items' => '[]', 'totals' => '{}']);
            $this->db->table('coach_media')->where('user_id', $id)->delete();
            $this->db->table('coach_memory')->where('user_id', $id)->delete();
            $owned = $this->db->table('media_objects')->where('owner_id', $id)->pluck('id');
            if ($owned->isNotEmpty()) {
                $this->db->table('media_bytes')->whereIn('media_id', $owned)->delete();
            }
            $this->db->statement('update messages set body=\'\' where conversation_id in (select conversation_id from conversation_participants where user_id=?)', [$id]);
            $this->db->table('users')->where('id', $id)->update(['status' => 'deleted', 'display_name' => null, 'phone_e164' => substr('d'.str_replace('-', '', $id), 0, 32), 'deleted_at' => $this->db->raw('current_timestamp(6)')]);
            $this->db->table('sessions')->where('user_id', $id)->whereNull('revoked_at')->update(['revoked_at' => $this->db->raw('current_timestamp(6)'), 'revoke_reason' => 'account_deleted']);
            $this->db->table('devices')->where('user_id', $id)->whereNull('revoked_at')->update(['revoked_at' => $this->db->raw('current_timestamp(6)')]);
            $this->audit($actor, 'user_delete', 'user', $id, ['purged' => true, 'ledgerRetained' => true]);

            return ['deleted' => true];
        });
    }

    public function setPackageDays(string $actor, string $id, int $days): array
    {
        if ($days < 0 || $days > 3650) {
            throw new Problem(400, 'validation', 'تعداد روز درست نیست');
        }

        return $this->db->transaction(function () use ($actor, $id, $days): array {
            $user = $this->db->selectOne('select status from users where id=? for update', [$id]);
            if ($user === null) {
                throw new Problem(404, 'not_found', 'کاربر پیدا نشد');
            }
            if ($user->status === 'deleted') {
                throw new Problem(409, 'account_deleted', 'این حساب حذف شده است');
            }
            $chosen = $this->db->selectOne('select code, title_fa from (select s.code, s.title_fa, 0 as rank from user_service_access a join services s on s.code=a.service_code where a.user_id=? union all select s.code, s.title_fa, 1 as rank from orders o join services s on s.code=o.service_code where o.user_id=? and o.status=\'paid\' union all select code, title_fa, 2 as rank from services where code=\'new_plan\') choices order by rank limit 1', [$id, $id]);
            if ($chosen === null) {
                throw new Problem(409, 'conflict', 'خدمتی برای این پکیج ثبت نشده است');
            }
            $this->db->table('users')->where('id', $id)->where('role', 'user')->update(['status' => 'active']);
            $this->db->statement('insert into user_service_access (user_id, service_code, ends_at) values (?, ?, date_add(current_timestamp(6), interval ? day)) as incoming on duplicate key update service_code=incoming.service_code, ends_at=incoming.ends_at, updated_at=current_timestamp(6)', [$id, $chosen->code, $days]);
            $this->audit($actor, 'user_package_days', 'user', $id, ['daysRemaining' => $days, 'serviceCode' => $chosen->code]);

            return ['id' => $id, 'packageTitle' => $chosen->title_fa, 'daysRemaining' => $days];
        });
    }

    public function controls(): array
    {
        $row = $this->control();

        return ['killSwitch' => (bool) (int) $row->kill_switch, 'dailyCostCapMicros' => $row->daily_cost_cap_micros === null ? null : (int) $row->daily_cost_cap_micros];
    }

    public function setControls(string $actor, array $input): array
    {
        if (! array_key_exists('killSwitch', $input) && ! array_key_exists('dailyCostCapMicros', $input)) {
            throw new Problem(400, 'validation', 'اطلاعات واردشده ناقص یا نادرست است');
        }
        if (array_key_exists('dailyCostCapMicros', $input) && $input['dailyCostCapMicros'] !== null && $input['dailyCostCapMicros'] < 0) {
            throw new Problem(400, 'validation', 'سقف هزینه درست نیست');
        }
        $current = $this->control();
        $kill = $input['killSwitch'] ?? (bool) (int) $current->kill_switch;
        $cap = array_key_exists('dailyCostCapMicros', $input) ? $input['dailyCostCapMicros'] : $current->daily_cost_cap_micros;
        $this->db->table('ai_controls')->where('id', 1)->update(['kill_switch' => $kill, 'daily_cost_cap_micros' => $cap, 'updated_at' => $this->db->raw('current_timestamp(6)')]);
        $this->audit($actor, 'ai_controls_updated', 'ai_controls', null, ['killSwitch' => $kill, 'dailyCostCapMicros' => $cap]);

        return ['killSwitch' => (bool) $kill, 'dailyCostCapMicros' => $cap === null ? null : (int) $cap];
    }

    public function cost(): array
    {
        $controls = $this->control();
        $start = (new \DateTimeImmutable(CivilDates::today().' 00:00:00', new \DateTimeZone('Asia/Tehran')))->setTimezone(new \DateTimeZone('UTC'))->format('Y-m-d H:i:s.u');
        $row = $this->db->selectOne('select count(*) as attempts, sum(status=\'drafted\') as drafted, sum(status=\'skipped\') as skipped, coalesce(sum(cost_micros),0) as spent from ai_generations where created_at>=?', [$start]);

        return ['day' => CivilDates::today(), 'spentMicros' => (int) $row->spent, 'capMicros' => $controls->daily_cost_cap_micros === null ? null : (int) $controls->daily_cost_cap_micros, 'killSwitch' => (bool) (int) $controls->kill_switch, 'attempts' => (int) $row->attempts, 'drafted' => (int) $row->drafted, 'skipped' => (int) $row->skipped];
    }

    public function adjust(string $actor, array $input): array
    {
        $this->money($input['amount']);
        $reason = trim($input['reason']);
        if (mb_strlen($reason) < 3) {
            throw new Problem(400, 'validation', 'دلیل اصلاح را بنویسید');
        }
        $signed = $input['direction'] === 'debit' ? -$input['amount'] : $input['amount'];

        return $this->db->transaction(function () use ($actor, $input, $reason, $signed): array {
            $wallet = $this->db->selectOne('select cash_toman, promo_toman from wallets where user_id=? for update', [$input['userId']]);
            if ($wallet === null) {
                throw new Problem(404, 'not_found', 'کیف پول پیدا نشد');
            }
            $prior = $this->db->table('wallet_ledger')->where(['kind' => 'adjustment', 'reference_id' => $input['referenceId'], 'bucket' => 'cash'])->first();
            if ($prior !== null) {
                if ($prior->user_id !== $input['userId'] || (int) $prior->amount_toman !== $signed) {
                    throw new Problem(409, 'adjustment_conflict', 'این شناسه قبلاً برای اصلاح دیگری استفاده شده است');
                }

                return $this->adjustment($wallet, $input);
            }
            if ($input['direction'] === 'debit' && (int) $wallet->cash_toman < $input['amount']) {
                throw new Problem(402, 'insufficient_funds', 'موجودی نقدی کافی نیست');
            }
            $this->db->statement('update wallets set cash_toman=cash_toman+?, version=version+1 where user_id=?', [$signed, $input['userId']]);
            $this->db->table('wallet_ledger')->insert(['id' => Crypto::uuid(), 'user_id' => $input['userId'], 'bucket' => 'cash', 'amount_toman' => $signed, 'kind' => 'adjustment', 'reference_id' => $input['referenceId']]);
            $next = $this->db->table('wallets')->where('user_id', $input['userId'])->first(['cash_toman', 'promo_toman']);
            $this->audit($actor, 'wallet_adjusted', 'wallet', $input['userId'], ['direction' => $input['direction'], 'amountToman' => $input['amount'], 'referenceId' => $input['referenceId'], 'reason' => $reason]);

            return $this->adjustment($next, $input);
        });
    }

    public function deadLetters(): array
    {
        $rows = $this->db->table('outbox_events')->whereNull('dispatched_at')->where('attempts', '>=', 10)->orderBy('created_at')->limit(100)->get();

        return ['events' => array_map(fn ($row) => ['id' => $row->id, 'topic' => $row->topic, 'attempts' => (int) $row->attempts, 'createdAt' => Crypto::iso($row->created_at)], $rows->all())];
    }

    public function retryDead(string $actor, string $id): array
    {
        if ($this->db->table('outbox_events')->where('id', $id)->whereNull('dispatched_at')->where('attempts', '>=', 10)->update(['attempts' => 0]) === 0) {
            throw new Problem(404, 'not_found', 'رویداد مرده پیدا نشد');
        }
        $this->audit($actor, 'outbox_retried', 'outbox_event', $id, []);

        return ['id' => $id, 'attempts' => 0];
    }

    public function maintenance(string $actor): array
    {
        $summary = $this->worker->maintenance();
        $this->audit($actor, 'maintenance_ran', 'maintenance', null, $summary);

        return $summary;
    }

    private function adjustment(object $wallet, array $input): array
    {
        return ['userId' => $input['userId'], 'direction' => $input['direction'], 'amountToman' => $input['amount'], 'referenceId' => $input['referenceId'], 'cashToman' => Amount::safe($wallet->cash_toman), 'promoToman' => Amount::safe($wallet->promo_toman)];
    }

    private function control(): object
    {
        $row = $this->db->table('ai_controls')->where('id', 1)->first();
        if ($row === null) {
            throw new Problem(500, 'ai_controls_missing', 'تنظیم مدل پیدا نشد');
        }

        return $row;
    }

    private function assertLoginFree(string $username): void
    {
        if ($this->db->table('admin_credentials')->whereRaw('lower(username)=?', [$username])->exists() || $this->db->table('specialist_credentials')->where('username', $username)->exists()) {
            throw new Problem(409, 'username_taken', 'این نام کاربری قبلاً ثبت شده است');
        }
    }

    private function intake(string $id): ?array
    {
        $profile = $this->db->table('nutrition_profiles')->where('user_id', $id)->first(['track', 'source', 'submission_id']);
        if ($profile === null) {
            return null;
        }
        $questions = $this->questions();
        $tracks = $this->tracks();
        $extraLabels = ['track' => 'هدف انتخاب‌شده', 'sleep_hour' => 'ساعت خواب', 'wake_hour' => 'ساعت بیداری'];
        $answers = [];
        foreach ($this->db->table('onboarding_answer_facts')->where('submission_id', $profile->submission_id)->orderBy('question_key')->get() as $fact) {
            $question = $questions[$fact->question_key] ?? null;
            $label = $question['title'] ?? $extraLabels[$fact->question_key] ?? $fact->question_key;
            $answer = $fact->value_num;
            if ($fact->question_key === 'track') {
                $answer = $tracks[$fact->value_code] ?? $fact->value_code;
            }
            if ($answer === null && $question !== null) {
                foreach ($question['options'] ?? [] as $option) {
                    if (($option['code'] ?? null) === $fact->value_code) {
                        $answer = $option['label'];
                    }
                }
            }
            $answers[] = ['question' => $label, 'answer' => (string) ($answer ?? $fact->value_code)];
        }
        $stored = $this->db->table('questionnaire_submissions')
            ->where('id', $profile->submission_id)->where('user_id', $id)->value('answers');
        $textAnswers = json_decode($stored ?? '{}', true);
        foreach (['name', 'dislikes'] as $key) {
            $answer = $textAnswers[$key] ?? null;
            if (! is_string($answer) || trim($answer) === '') {
                continue;
            }
            if ($key === 'dislikes') {
                try {
                    $answer = Crypto::decrypt($answer, $this->settings->fieldKey);
                } catch (\Throwable) {
                    continue;
                }
            }
            if (trim($answer) !== '' && isset($questions[$key]['title'])) {
                $answers[] = ['question' => $questions[$key]['title'], 'answer' => $answer];
            }
        }

        return ['displayName' => null, 'trackId' => $profile->track, 'trackLabel' => $tracks[$profile->track] ?? $profile->track, 'source' => $profile->source === 'demo' ? 'demo' : 'app', 'answers' => $answers];
    }

    private function details(string $id): ?array
    {
        $encrypted = $this->db->table('user_personal_details')->where('user_id', $id)->value('details_encrypted');
        if (! is_string($encrypted) || $encrypted === '') {
            return null;
        }
        $opened = $this->openDetails($encrypted);

        return $opened === [] ? null : $opened;
    }

    private function openDetails(?string $encrypted): array
    {
        if (! is_string($encrypted) || $encrypted === '') {
            return [];
        }
        try {
            $decoded = json_decode(Crypto::decrypt($encrypted, $this->settings->fieldKey), true, 512, JSON_THROW_ON_ERROR);

            return is_array($decoded) ? $decoded : [];
        } catch (\Throwable) {
            return [];
        }
    }

    private function nameOf(object $row): ?string
    {
        return $this->openDetails($row->details_encrypted)['name'] ?? $row->display_name;
    }

    private function photoOf(?string $encrypted): ?string
    {
        $photo = $this->openDetails($encrypted)['photo'] ?? null;

        return is_string($photo) ? $photo : null;
    }

    private function account(string $id): object
    {
        $row = $this->db->selectOne("select u.signup_channel, p.source as profile_source, c.name as campaign_name, c.source as campaign_source, coalesce(s.title_fa, ordered.title_fa) as package_title, a.ends_at from users u left join nutrition_profiles p on p.user_id=u.id left join demo_campaign_links c on c.slug=u.signup_channel left join user_service_access a on a.user_id=u.id left join services s on s.code=a.service_code left join (select o.user_id, sv.title_fa from orders o join services sv on sv.code=o.service_code join (select user_id, max(created_at) as created_at from orders where status='paid' group by user_id) latest on latest.user_id=o.user_id and latest.created_at=o.created_at where o.status='paid') ordered on ordered.user_id=u.id where u.id=?", [$id]);

        return $row ?? (object) ['signup_channel' => 'app', 'profile_source' => null, 'campaign_name' => null, 'campaign_source' => null, 'package_title' => null, 'ends_at' => null];
    }

    private function daysRemaining(mixed $ends): ?int
    {
        if ($ends === null || $ends === '') {
            return null;
        }

        return max(0, (int) ceil(((new \DateTimeImmutable((string) $ends))->getTimestamp() - CivilDates::now()->getTimestamp()) / 86400));
    }

    private function registration(object $row): array
    {
        $names = ['telegram' => 'تلگرام', 'instagram' => 'اینستاگرام', 'whatsapp' => 'واتساپ', 'rubika' => 'روبیکا', 'eitaa' => 'ایتا', 'website' => 'وب‌سایت', 'app' => 'اپلیکیشن'];
        $web = ($row->profile_source ?? null) === 'demo' || ($row->signup_channel ?? null) === 'demo' || ($row->campaign_name ?? null);
        $source = $row->campaign_source ?? null;

        return [
            'label' => $web ? 'آنبوردینگ وب' : 'اپلیکیشن',
            'link' => $row->campaign_name ?: null,
            'source' => $source ? ($names[$source] ?? $source) : null,
        ];
    }

    private function tracks(): array
    {
        $spec = json_decode(file_get_contents(app_path('Modules/Onboarding/Infrastructure/resources/spec.json')), true, 512, JSON_THROW_ON_ERROR);
        $titles = [];
        foreach ($spec['tracks'] as $track) {
            $titles[$track['id']] = $track['title'];
        }

        return $titles;
    }

    private function questions(): array
    {
        $spec = json_decode(file_get_contents(app_path('Modules/Onboarding/Infrastructure/resources/spec.json')), true, 512, JSON_THROW_ON_ERROR);
        $questions = [];
        $walk = function (array $nodes) use (&$walk, &$questions): void {
            foreach ($nodes as $node) {
                if (! is_array($node)) {
                    continue;
                }
                if (isset($node['key'])) {
                    $questions[$node['key']] = $node;
                }
                foreach ($node as $value) {
                    if (is_array($value) && array_is_list($value)) {
                        $walk($value);
                    }
                }
            }
        };
        $walk($spec['questions'] ?? []);

        return $questions;
    }

    private function money(int $amount): void
    {
        if ($amount <= 0 || $amount > 100_000_000) {
            throw new Problem(400, 'validation', 'مبلغ درست نیست');
        }
    }

    private function audit(string $actor, string $action, string $type, ?string $id, array $detail): void
    {
        try {
            $this->db->table('audit_logs')->insert(['id' => Crypto::uuid(), 'actor_id' => $actor, 'action' => $action, 'target_type' => $type, 'target_id' => $id, 'detail' => json_encode((object) $detail, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR)]);
        } catch (QueryException $error) {
            if ((int) ($error->errorInfo[1] ?? 0) !== 1062) {
                throw $error;
            }
        }
    }
}
