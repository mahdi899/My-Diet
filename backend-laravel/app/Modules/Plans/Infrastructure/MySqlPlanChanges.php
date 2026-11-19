<?php

namespace App\Modules\Plans\Infrastructure;

use App\Modules\Plans\Application\PlanChangeStore;
use App\Shared\Domain\LegacyCrypto as Crypto;
use App\Shared\Domain\Problem;
use Closure;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Database\QueryException;
use Throwable;

final class MySqlPlanChanges implements PlanChangeStore
{
    public function __construct(private ConnectionInterface $db) {}

    public function transaction(Closure $work): mixed
    {
        return $this->db->transaction($work);
    }

    public function duplicateKey(Throwable $error): bool
    {
        return $error instanceof QueryException && ($error->errorInfo[1] ?? null) === 1062;
    }

    public function reasons(bool $activeOnly): array
    {
        $query = $this->db->table('plan_change_reasons')->orderBy('id');
        if ($activeOnly) {
            $query->where('active', true);
        }

        return array_map(fn ($row) => ['id' => $row->id, 'label' => $row->label, 'active' => (bool) $row->active], $query->get()->all());
    }

    public function updateReason(string $id, string $label, bool $active): array
    {
        if ($this->db->table('plan_change_reasons')->where('id', $id)->update(['label' => $label, 'active' => $active]) === 0 && ! $this->db->table('plan_change_reasons')->where('id', $id)->exists()) {
            throw new Problem(404, 'not_found', 'دلیل تغییر پیدا نشد');
        }

        return ['id' => $id, 'label' => $label, 'active' => $active];
    }

    public function lockUser(string $user): void
    {
        $this->db->select('select id from users where id=? for update', [$user]);
    }

    public function lockRequest(string $request): void
    {
        $this->db->select('select id from plan_requests where id=? for update', [$request]);
    }

    public function byCommand(string $user, string $command): ?array
    {
        $row = $this->rowOf($this->db->selectOne('select id,version_id,explanation from plan_change_requests where user_id=? and command_id=?', [$user, $command]));
        if ($row === null) {
            return null;
        }
        $row['reasonIds'] = array_map(fn ($item) => $item->reason_id, $this->db->select('select reason_id from plan_change_reason_snapshots where request_id=?', [$row['id']]));
        $row['targets'] = array_map(fn ($item) => ['dayIndex' => (int) $item->day_index, 'mealUid' => $item->meal_uid], $this->db->select('select day_index,meal_uid from plan_change_targets where request_id=?', [$row['id']]));

        return $row;
    }

    public function activePlan(string $user): ?array
    {
        $row = $this->db->selectOne("select v.id,v.request_id,r.status,r.assigned_specialist_id as specialist_id,r.week_start from active_plan_versions a join plan_versions v on v.id=a.version_id and v.status='published' join plan_requests r on r.id=v.request_id where a.user_id=?", [$user]);

        return $row === null ? null : ['id' => $row->id, 'request_id' => $row->request_id, 'status' => $row->status, 'specialist_id' => $row->specialist_id, 'week_start' => $row->week_start === null ? null : substr((string) $row->week_start, 0, 10)];
    }

    public function activeReasons(array $ids): array
    {
        if ($ids === []) {
            return [];
        }

        return array_map(fn ($row) => ['id' => $row->id, 'label' => $row->label], $this->db->table('plan_change_reasons')->whereIn('id', $ids)->where('active', true)->get()->all());
    }

    public function targetExists(string $version, int $day, ?string $meal): bool
    {
        return $this->db->selectOne('select 1 as found from plan_days d left join plan_meals m on m.plan_day_id=d.id and m.meal_uid=? where d.plan_version_id=? and d.day_index=? and (? is null or m.id is not null)', [$meal, $version, $day, $meal]) !== null;
    }

    public function insert(string $id, string $user, string $request, string $version, string $command, string $explanation): void
    {
        $this->db->table('plan_change_requests')->insert(['id' => $id, 'user_id' => $user, 'plan_request_id' => $request, 'version_id' => $version, 'command_id' => $command, 'explanation' => $explanation, 'status' => 'awaiting_review']);
    }

    public function snapshotReason(string $request, string $reason, string $label): void
    {
        $this->db->table('plan_change_reason_snapshots')->insert(['request_id' => $request, 'reason_id' => $reason, 'label' => $label]);
    }

    public function target(string $request, int $day, ?string $meal): void
    {
        $this->db->table('plan_change_targets')->insert(['id' => Crypto::uuid(), 'request_id' => $request, 'day_index' => $day, 'meal_uid' => $meal]);
    }

    public function systemMessage(string $user, string $specialist, string $request, string $change, string $body): void
    {
        $existing = $this->db->table('conversations')->where(['request_id' => $request, 'kind' => 'care'])->value('id');
        if ($existing === null) {
            $existing = Crypto::uuid();
            $this->db->table('conversations')->insert(['id' => $existing, 'kind' => 'care', 'user_id' => $user, 'request_id' => $request]);
            $this->db->table('conversation_participants')->insert([['conversation_id' => $existing, 'user_id' => $user], ['conversation_id' => $existing, 'user_id' => $specialist]]);
        }
        $this->db->table('messages')->insert(['id' => Crypto::uuid(), 'conversation_id' => $existing, 'author_id' => $user, 'body' => $body, 'kind' => 'system', 'change_request_id' => $change]);
    }

    public function notify(string $user, string $change): void
    {
        $id = Crypto::uuid();
        $this->db->table('notifications')->insert(['id' => $id, 'user_id' => $user, 'kind' => 'plan_change', 'payload' => json_encode(['changeRequestId' => $change], JSON_THROW_ON_ERROR)]);
        if ($this->db->table('devices')->where('user_id', $user)->whereNull('revoked_at')->exists()) {
            $this->db->table('outbox_events')->insert(['id' => Crypto::uuid(), 'topic' => 'push.send', 'aggregate_id' => $id, 'payload' => json_encode(['notificationId' => $id, 'userId' => $user, 'kind' => 'plan_change'], JSON_THROW_ON_ERROR)]);
        }
    }

    public function present(string $id, bool $staff): array
    {
        $row = $this->row($id) ?? throw new Problem(404, 'not_found', 'درخواست تغییر پیدا نشد');
        $reasons = array_map(fn ($item) => ['id' => $item->reason_id, 'label' => $item->label], $this->db->select('select reason_id,label from plan_change_reason_snapshots where request_id=? order by reason_id', [$id]));
        $targets = array_map(fn ($item) => ['dayIndex' => (int) $item->day_index, 'mealUid' => $item->meal_uid], $this->db->select('select day_index,meal_uid from plan_change_targets where request_id=? order by day_index', [$id]));
        $question = $this->db->selectOne('select id,prompt,answer,status from plan_change_questions where request_id=? order by created_at desc limit 1', [$id]);
        $view = ['id' => $row['id'], 'planRequestId' => $row['plan_request_id'], 'versionId' => $row['version_id'], 'status' => $row['status'], 'substate' => $row['substate'], 'explanation' => $row['explanation'], 'reasons' => $reasons, 'targets' => $targets, 'rejectionExplanation' => $row['rejection_explanation'], 'publishedVersionId' => $row['published_version_id'], 'question' => $question === null ? null : ['id' => $question->id, 'prompt' => $question->prompt, 'answer' => $question->answer, 'status' => $question->status], 'createdAt' => Crypto::iso($row['created_at'])];
        if ($staff) {
            $view = ['id' => $view['id'], 'userId' => $row['user_id'], 'displayName' => $this->db->table('users')->where('id', $row['user_id'])->value('display_name'), ...array_diff_key($view, ['id' => true])];
        }

        return $view;
    }

    public function idsForUser(string $user): array
    {
        return array_map(fn ($row) => $row->id, $this->db->select('select id from plan_change_requests where user_id=? order by created_at desc', [$user]));
    }

    public function queueIds(string $specialist): array
    {
        return array_map(fn ($row) => $row->id, $this->db->select("select c.id from plan_change_requests c join plan_requests r on r.id=c.plan_request_id where r.assigned_specialist_id=? and c.status in ('awaiting_review','under_review') order by c.created_at", [$specialist]));
    }

    public function row(string $id): ?array
    {
        return $this->rowOf($this->db->selectOne('select id,user_id,plan_request_id,version_id,command_id,explanation,status,substate,rejection_explanation,published_version_id,created_at,first_responded_at from plan_change_requests where id=?', [$id]));
    }

    public function lock(string $id): array
    {
        return $this->rowOf($this->db->selectOne('select id,user_id,plan_request_id,version_id,command_id,explanation,status,substate,rejection_explanation,published_version_id,created_at,first_responded_at from plan_change_requests where id=? for update', [$id])) ?? throw new Problem(404, 'not_found', 'درخواست تغییر پیدا نشد');
    }

    public function save(string $id, array $values, bool $respond = false): void
    {
        $values['updated_at'] = $this->db->raw('current_timestamp(6)');
        if ($respond) {
            $values['first_responded_at'] = $this->db->raw('coalesce(first_responded_at, current_timestamp(6))');
        }
        $this->db->table('plan_change_requests')->where('id', $id)->update($values);
    }

    public function answer(string $request, string $body): bool
    {
        $open = $this->db->selectOne("select id from plan_change_questions where request_id=? and status='open' for update", [$request]);
        if ($open === null) {
            return false;
        }
        $this->db->table('plan_change_questions')->where('id', $open->id)->update(['status' => 'answered', 'answer' => $body]);

        return true;
    }

    public function ask(string $request, string $prompt): void
    {
        $this->db->table('plan_change_questions')->insert(['id' => Crypto::uuid(), 'request_id' => $request, 'prompt' => $prompt, 'status' => 'open']);
    }

    public function specialist(string $request): string
    {
        $id = $this->db->table('plan_requests')->where('id', $request)->value('assigned_specialist_id');
        if (! is_string($id) || $id === '') {
            throw new Problem(409, 'no_specialist', 'متخصص فعالی برای این برنامه تعیین نشده است');
        }

        return $id;
    }

    public function assertAssigned(string $specialist, string $request): void
    {
        if (! $this->db->table('plan_requests')->where(['id' => $request, 'assigned_specialist_id' => $specialist])->exists()) {
            throw new Problem(404, 'not_found', 'درخواست تغییر پیدا نشد');
        }
    }

    public function activeVersion(string $user): ?string
    {
        $id = $this->db->table('active_plan_versions')->where('user_id', $user)->value('version_id');

        return is_string($id) ? $id : null;
    }

    public function hasOpenQuestion(string $request): bool
    {
        return $this->db->table('plan_change_questions')->where(['request_id' => $request, 'status' => 'open'])->exists();
    }

    private function rowOf(?object $row): ?array
    {
        return $row === null ? null : (array) $row;
    }
}
