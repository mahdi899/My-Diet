<?php

namespace App\Modules\Tracking\Infrastructure;

use App\Modules\Plans\Domain\CivilDates;
use App\Modules\Tracking\Application\TrackingStore;
use App\Modules\Tracking\Domain\ActivityRules;
use App\Shared\Domain\Amount;
use App\Shared\Domain\LegacyCrypto as Crypto;
use Closure;
use Illuminate\Database\ConnectionInterface;

final class MySqlTracking implements TrackingStore
{
    public function __construct(private ConnectionInterface $db) {}

    public function transaction(Closure $work): mixed
    {
        return $this->db->transaction($work);
    }

    public function lock(string $user): void
    {
        $this->db->select('select id from users where id=? for update', [$user]);
    }

    public function reasons(): array
    {
        return array_map(fn ($row) => ['id' => $row->id, 'label' => $row->label], $this->db->select('select id,label from substitution_reasons where active=1 order by id'));
    }

    public function reason(string $id): ?array
    {
        $row = $this->db->selectOne('select id,label from substitution_reasons where id=? and active=1', [$id]);

        return $row === null ? null : ['id' => $row->id, 'label' => $row->label];
    }

    public function command(string $user, string $command): ?array
    {
        $row = $this->db->selectOne('select payload,response from meal_activity_commands where user_id=? and command_id=?', [$user, $command]);

        return $row === null ? null : ['payload' => $this->decode($row->payload), 'response' => $this->decode($row->response)];
    }

    public function saveCommand(string $user, string $command, array $payload, array $response): void
    {
        $this->db->table('meal_activity_commands')->insert(['user_id' => $user, 'command_id' => $command, 'payload' => $this->json($payload), 'response' => $this->json($response)]);
    }

    public function approvedOption(string $user, string $version, string $meal, string $option, string $date): ?array
    {
        $row = $this->db->selectOne("select m.id as meal_id,r.id as request_id,o.document from plan_meals m
            join plan_days d on d.id=m.plan_day_id join plan_versions v on v.id=d.plan_version_id
            join plan_requests r on r.id=v.request_id join orders paid on paid.id=r.order_id and paid.status='paid'
            join plan_meal_options o on o.meal_id=m.id and o.option_uid=?
            where r.user_id=? and v.id=? and m.meal_uid=? and d.civil_date=? and d.civil_date>=r.effective_from
            and v.status in ('published','superseded') and o.approved_by is not null and o.approved_at is not null", [$option, $user, $version, $meal, $date]);
        if ($row === null) {
            return null;
        }
        $document = $this->decode($row->document);

        return ['meal_id' => $row->meal_id, 'request_id' => $row->request_id, 'document' => is_array($document) ? $document : []];
    }

    public function latestVersion(string $user, string $date): ?string
    {
        $row = $this->db->selectOne("select v.id from plan_versions v join plan_days d on d.plan_version_id=v.id
            join plan_requests r on r.id=v.request_id where r.user_id=? and d.civil_date=?
            and v.status in ('published','superseded') and date(convert_tz(v.published_at,'+00:00','+03:30'))<=d.civil_date
            order by v.published_at desc,v.id desc limit 1", [$user, $date]);

        return $row->id ?? null;
    }

    public function log(string $user, string $date, string $meal): ?array
    {
        $row = $this->db->selectOne('select * from meal_logs where user_id=? and scheduled_date=? and meal_uid=?', [$user, $date, $meal]);

        return $row === null ? null : $this->logRow($row);
    }

    public function saveLog(string $user, string $request, string $date, string $meal, bool $eaten, string $version, string $mealId, string $option, array $details): int
    {
        $current = $this->log($user, $date, $meal);
        $encoded = $this->json($details);
        if ($current === null) {
            $this->db->table('meal_logs')->insert(['id' => Crypto::uuid(), 'user_id' => $user, 'request_id' => $request, 'scheduled_date' => $date, 'meal_uid' => $meal,
                'eaten' => $eaten, 'plan_version_id' => $version, 'plan_meal_id' => $mealId, 'option_uid' => $option, 'details' => $encoded]);

            return 1;
        }
        $this->db->update('update meal_logs set eaten=?,plan_version_id=?,plan_meal_id=?,option_uid=?,details=?,updated_at=current_timestamp(6) where user_id=? and scheduled_date=? and meal_uid=?', [$eaten, $version, $mealId, $option, $encoded, $user, $date, $meal]);

        return (int) $this->db->table('meal_logs')->where(['user_id' => $user, 'scheduled_date' => $date, 'meal_uid' => $meal])->value('revision');
    }

    public function selection(string $user, string $date, string $meal): ?array
    {
        $row = $this->db->selectOne('select * from meal_selections where user_id=? and civil_date=? and meal_uid=?', [$user, $date, $meal]);

        return $row === null ? null : (array) $row;
    }

    public function saveSelection(string $user, string $date, string $meal, string $version, string $mealId, string $option, ?string $reason, ?string $label, ?array $previous): int
    {
        $current = $this->selection($user, $date, $meal);
        if ($current === null) {
            $this->db->table('meal_selections')->insert(['user_id' => $user, 'civil_date' => $date, 'meal_uid' => $meal, 'version_id' => $version, 'meal_id' => $mealId, 'option_uid' => $option, 'reason_id' => $reason, 'reason_label' => $label]);
            $revision = 1;
        } else {
            $this->db->update('update meal_selections set version_id=?,meal_id=?,option_uid=?,reason_id=?,reason_label=?,revision=revision+1,updated_at=current_timestamp(6) where user_id=? and civil_date=? and meal_uid=?', [$version, $mealId, $option, $reason, $label, $user, $date, $meal]);
            $revision = (int) $current['revision'] + 1;
        }
        $saved = $this->selection($user, $date, $meal);
        $this->db->table('meal_selection_history')->insert(['user_id' => $user, 'civil_date' => $date, 'meal_uid' => $meal, 'previous' => $previous === null ? null : $this->json($previous), 'current' => $this->json($saved)]);

        return $revision;
    }

    public function invalidateShopping(string $user, string $date, string $meal, int $revision): void
    {
        $this->db->table('outbox_events')->insert(['id' => Crypto::uuid(), 'topic' => 'shopping.invalidate', 'aggregate_id' => $user, 'payload' => $this->json(['date' => $date, 'mealUid' => $meal, 'selectionRevision' => $revision])]);
    }

    public function logs(string $user, string $date): array
    {
        return array_map(fn ($row) => ['mealUid' => $row->meal_uid, 'versionId' => $row->plan_version_id, 'optionId' => $row->option_uid, 'revision' => (int) $row->revision, 'details' => $this->decode($row->details), 'eaten' => (bool) $row->eaten], $this->db->select('select meal_uid,plan_version_id,option_uid,revision,details,eaten from meal_logs where user_id=? and scheduled_date=?', [$user, $date]));
    }

    public function selections(string $user, string $date): array
    {
        return array_map(fn ($row) => ['mealUid' => $row->meal_uid, 'versionId' => $row->version_id, 'optionId' => $row->option_uid, 'revision' => (int) $row->revision], $this->db->select('select meal_uid,version_id,option_uid,revision from meal_selections where user_id=? and civil_date=?', [$user, $date]));
    }

    public function logHistory(string $user, string $date): array
    {
        return array_map(fn ($row) => ['id' => (int) $row->id, 'previous' => $row->previous === null ? null : $this->decode($row->previous), 'current' => $this->decode($row->current), 'recordedAt' => Crypto::iso($row->recorded_at)], $this->db->select("select id,previous,current,recorded_at from meal_log_history where user_id=? and json_unquote(json_extract(current,'$.scheduled_date'))=? order by id desc limit 100", [$user, $date]));
    }

    public function selectionHistory(string $user, string $date): array
    {
        return array_map(fn ($row) => ['id' => (int) $row->id, 'previous' => $row->previous === null ? null : $this->decode($row->previous), 'current' => $this->decode($row->current), 'recordedAt' => Crypto::iso($row->recorded_at)], $this->db->select('select id,previous,current,recorded_at from meal_selection_history where user_id=? and civil_date=? order by id desc limit 100', [$user, $date]));
    }

    public function publishedMeal(string $user, string $meal): ?array
    {
        $row = $this->db->selectOne("select r.id as request_id,d.civil_date,r.week_start,r.effective_from,v.id as version_id,m.id as meal_id,o.option_uid
            from plan_meals m join plan_days d on d.id=m.plan_day_id join plan_versions v on v.id=d.plan_version_id and v.status='published'
            join plan_requests r on r.id=v.request_id left join plan_meal_options o on o.meal_id=m.id and o.kind='primary'
            where m.meal_uid=? and r.user_id=? order by v.published_at desc limit 1", [$meal, $user]);
        if ($row === null) {
            return null;
        }

        return ['request_id' => $row->request_id, 'civil_date' => $this->day($row->civil_date), 'week_start' => $this->day($row->week_start), 'effective_from' => $this->day($row->effective_from), 'version_id' => $row->version_id, 'meal_id' => $row->meal_id, 'option_uid' => $row->option_uid];
    }

    public function structuredActivity(string $user, string $meal, string $date): bool
    {
        return $this->db->selectOne("select 1 as found from meal_logs where user_id=? and meal_uid=? and scheduled_date=? and details<>cast('{}' as json)
            union all select 1 from meal_selections where user_id=? and meal_uid=? and civil_date=? limit 1", [$user, $meal, $date, $user, $meal, $date]) !== null;
    }

    public function saveSimpleLog(string $user, string $request, string $date, string $meal, bool $eaten, string $version, string $mealId, ?string $option): void
    {
        $this->db->statement('insert into meal_logs(id,user_id,request_id,scheduled_date,meal_uid,eaten,plan_version_id,plan_meal_id,option_uid) values(?,?,?,?,?,?,?,?,?) as new
            on duplicate key update eaten=new.eaten,updated_at=current_timestamp(6)', [Crypto::uuid(), $user, $request, $date, $meal, $eaten, $version, $mealId, $option]);
    }

    public function rewardForMeal(string $user, string $request): ?array
    {
        $row = $this->db->selectOne('select week_start,effective_from from plan_requests where id=? and user_id=?', [$request, $user]);
        if ($row === null || $row->week_start === null || $row->effective_from === null) {
            return null;
        }
        $week = $this->day($row->week_start);

        return $this->rewardIfComplete($user, $request, $week, $this->day($row->effective_from), CivilDates::add($week, 6));
    }

    public function rewardIfComplete(string $user, string $request, string $weekStart, string $effectiveFrom, string $friday): ?array
    {
        if (CivilDates::today() < $friday) {
            return null;
        }
        $meals = $this->db->select("select m.meal_uid from plan_meals m join plan_days d on d.id=m.plan_day_id join plan_versions v on v.id=d.plan_version_id and v.status='published'
            where v.request_id=? and d.civil_date>=? and d.civil_date<=?", [$request, $effectiveFrom, $friday]);
        if ($meals === []) {
            return null;
        }
        $eaten = array_column($this->db->select('select meal_uid from meal_logs where user_id=? and request_id=? and eaten=1 and scheduled_date>=? and scheduled_date<=?', [$user, $request, $effectiveFrom, $friday]), 'meal_uid');
        foreach ($meals as $meal) {
            if (! in_array($meal->meal_uid, $eaten, true)) {
                return null;
            }
        }
        $amount = Amount::safe((string) ($this->db->table('reward_policies')->where('kind', 'weekly_completion')->where('active', true)->value('amount_toman') ?? 0));
        if ($amount <= 0) {
            return null;
        }
        $reward = Crypto::uuid();
        if ($this->db->table('weekly_rewards')->insertOrIgnore(['id' => $reward, 'user_id' => $user, 'request_id' => $request, 'week_start' => $weekStart, 'amount_toman' => $amount]) === 0) {
            return null;
        }
        $this->db->update('update wallets set promo_toman=promo_toman+?,version=version+1 where user_id=?', [$amount, $user]);
        $this->db->table('wallet_ledger')->insert(['id' => Crypto::uuid(), 'user_id' => $user, 'bucket' => 'promo', 'amount_toman' => $amount, 'kind' => 'weekly_reward', 'reference_id' => $reward]);
        $this->notify($user, 'weekly_reward', ['requestId' => $request, 'weekStart' => $weekStart, 'amountToman' => $amount]);

        return ['amountToman' => $amount];
    }

    public function lateBulk(string $user, string $request, string $date): ?string
    {
        $total = (int) ($this->db->selectOne("select count(*) as total from plan_meals m join plan_days d on d.id=m.plan_day_id join plan_versions v on v.id=d.plan_version_id and v.status='published' where v.request_id=? and d.civil_date=?", [$request, $date])->total ?? 0);
        $logs = $this->db->selectOne('select sum(eaten) as eaten,min(updated_at) as first_at,max(updated_at) as last_at from meal_logs where user_id=? and request_id=? and scheduled_date=?', [$user, $request, $date]);
        if ($logs === null || $logs->first_at === null || $logs->last_at === null || ! ActivityRules::lateBulk($total, (int) $logs->eaten === $total, new \DateTimeImmutable($logs->first_at, new \DateTimeZone('UTC')), new \DateTimeImmutable($logs->last_at, new \DateTimeZone('UTC')))) {
            return null;
        }
        $this->db->table('meal_log_anomalies')->insertOrIgnore(['id' => Crypto::uuid(), 'user_id' => $user, 'scheduled_date' => $date, 'kind' => 'late_bulk_log']);

        return 'late_bulk_log';
    }

    public function saveWeight(string $user, string $date, float $kilograms): void
    {
        $this->db->statement('insert into weight_entries(user_id,civil_date,kilograms) values(?,?,?) as new on duplicate key update kilograms=new.kilograms', [$user, $date, $kilograms]);
    }

    public function weights(string $user): array
    {
        return array_map(fn ($row) => ['date' => $this->day($row->civil_date), 'kilograms' => (float) $row->kilograms], $this->db->select('select civil_date,kilograms from weight_entries where user_id=? order by civil_date', [$user]));
    }

    public function hasReward(string $user, string $request, string $week): bool
    {
        return $this->db->table('weekly_rewards')->where(['user_id' => $user, 'request_id' => $request, 'week_start' => $week])->exists();
    }

    public function saveReview(string $user, string $request, string $week, int $rating, string $body): string
    {
        $id = Crypto::uuid();
        if ($this->db->table('program_reviews')->insertOrIgnore(['id' => $id, 'user_id' => $user, 'request_id' => $request, 'week_start' => $week, 'rating' => $rating, 'body' => $body]) === 0) {
            return '';
        }

        return $id;
    }

    public function rewards(string $user, ?string $id): array
    {
        $query = $this->db->table('weekly_rewards')->where('user_id', $user)->orderBy('week_start');
        if ($id !== null) {
            $query->where('id', $id);
        }

        return array_map(fn ($row) => ['id' => $row->id, 'requestId' => $row->request_id, 'weekStart' => $this->day($row->week_start), 'amountToman' => Amount::safe((string) $row->amount_toman), 'acknowledgedAt' => $row->acknowledged_at === null ? null : Crypto::iso($row->acknowledged_at)], $query->get()->all());
    }

    public function acknowledge(string $user, string $id): ?string
    {
        $this->db->update('update weekly_rewards set acknowledged_at=current_timestamp(6) where id=? and user_id=? and acknowledged_at is null', [$id, $user]);
        $stamp = $this->db->table('weekly_rewards')->where(['id' => $id, 'user_id' => $user])->value('acknowledged_at');

        return $stamp === null ? null : Crypto::iso($stamp);
    }

    public function publicReviews(): array
    {
        return array_map(fn ($row) => ['id' => $row->id, 'rating' => (int) $row->rating, 'body' => $row->body, 'weekStart' => $this->day($row->week_start), 'reviewerName' => ActivityRules::reviewerName($row->author_name), 'specialistId' => $row->specialist_id, 'specialistName' => $row->specialist_name], $this->db->select("select pr.id,pr.rating,pr.body,pr.week_start,u.display_name as author_name,sp.user_id as specialist_id,sp.display_name as specialist_name
            from program_reviews pr join users u on u.id=pr.user_id join plan_requests r on r.id=pr.request_id
            left join specialist_profiles sp on sp.user_id=r.assigned_specialist_id where pr.status='approved' order by pr.created_at desc limit 50"));
    }

    public function specialist(string $user): ?array
    {
        $row = $this->db->selectOne("select sp.user_id,sp.display_name,sp.credential,sp.bio,
            (select round(avg(pr.rating),2) from program_reviews pr join plan_requests req on req.id=pr.request_id where req.assigned_specialist_id=sp.user_id and pr.status='approved') as average,
            (select count(*) from program_reviews pr join plan_requests req on req.id=pr.request_id where req.assigned_specialist_id=sp.user_id and pr.status='approved') as reviews
            from plan_requests r join specialist_profiles sp on sp.user_id=r.assigned_specialist_id
            where r.user_id=? and r.status<>'cancelled' and r.assigned_specialist_id is not null order by r.created_at desc limit 1", [$user]);
        if ($row === null) {
            return null;
        }

        return ['id' => $row->user_id, 'displayName' => $row->display_name, 'credential' => $row->credential, 'bio' => $row->bio, 'averageRating' => $row->average === null ? null : (float) $row->average, 'reviewCount' => (int) $row->reviews];
    }

    public function rewardWeeks(string $user): array
    {
        return array_map(fn ($row) => $this->day($row->week_start), $this->db->select('select week_start from weekly_rewards where user_id=?', [$user]));
    }

    public function unread(string $user): int
    {
        return (int) $this->db->table('notifications')->where('user_id', $user)->whereNull('read_at')->count();
    }

    public function questions(string $request): array
    {
        return array_map(fn ($row) => ['id' => $row->id, 'prompt' => $row->prompt, 'required' => (bool) $row->required, 'status' => $row->status], $this->db->select("select id,prompt,required,status from info_questions where request_id=? and status in ('open','answered') order by created_at", [$request]));
    }

    private function notify(string $user, string $kind, array $payload): void
    {
        $id = Crypto::uuid();
        $this->db->table('notifications')->insert(['id' => $id, 'user_id' => $user, 'kind' => $kind, 'payload' => $this->json($payload)]);
        if ($this->db->table('devices')->where('user_id', $user)->whereNull('revoked_at')->exists()) {
            $this->db->table('outbox_events')->insert(['id' => Crypto::uuid(), 'topic' => 'push.send', 'aggregate_id' => $id, 'payload' => $this->json(['notificationId' => $id, 'userId' => $user, 'kind' => $kind])]);
        }
    }

    private function logRow(object $row): array
    {
        $values = (array) $row;
        $values['eaten'] = (bool) $values['eaten'];
        $values['revision'] = (int) $values['revision'];
        $values['details'] = $this->decode($values['details']);

        return $values;
    }

    private function day(mixed $value): ?string
    {
        return $value === null ? null : substr((string) $value, 0, 10);
    }

    private function decode(mixed $value): mixed
    {
        if (! is_string($value)) {
            return $value;
        }
        $decoded = json_decode($value, true, 512, JSON_THROW_ON_ERROR);

        return $decoded === [] && str_contains($value, '{') ? new \stdClass : $decoded;
    }

    private function json(mixed $value): string
    {
        return json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    }
}
