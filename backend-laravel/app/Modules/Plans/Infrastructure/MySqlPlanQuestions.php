<?php

namespace App\Modules\Plans\Infrastructure;

use App\Modules\Plans\Application\PlanQuestionStore;
use App\Shared\Domain\LegacyCrypto as Crypto;
use Illuminate\Database\ConnectionInterface;

final class MySqlPlanQuestions implements PlanQuestionStore
{
    public function __construct(private ConnectionInterface $db) {}

    public function transaction(\Closure $work): mixed
    {
        return $this->db->transaction($work);
    }

    public function request(string $id): ?array
    {
        $row = $this->db->table('plan_requests')->where('id', $id)->lockForUpdate()->first();

        return $row === null ? null : (array) $row;
    }

    public function question(string $id): ?array
    {
        $requestId = $this->db->table('info_questions')->where('id', $id)->value('request_id');
        if ($requestId === null) {
            return null;
        }
        $request = $this->request($requestId);
        $row = $this->db->table('info_questions')->where('id', $id)->lockForUpdate()->first();

        return ! $row || ! $request ? null : [...(array) $row, 'user_id' => $request['user_id'], 'assigned_specialist_id' => $request['assigned_specialist_id']];
    }

    public function create(string $id, string $request, string $actor, string $prompt, bool $required): void
    {
        $this->db->table('info_questions')->insert(['id' => $id, 'request_id' => $request, 'specialist_id' => $actor, 'prompt' => $prompt, 'required' => $required, 'status' => 'open']);
    }

    public function answer(string $question, string $author, string $body): void
    {
        $this->db->table('info_answers')->insert(['id' => Crypto::uuid(), 'question_id' => $question, 'author_id' => $author, 'body' => $body]);
    }

    public function questionStatus(string $id, string $status): void
    {
        $this->db->table('info_questions')->where('id', $id)->update(['status' => $status]);
    }

    public function requestStatus(string $id, string $status, ?array $only = null): void
    {
        $q = $this->db->table('plan_requests')->where('id', $id);
        if ($only !== null) {
            $q->whereIn('status', $only);
        }
        $q->update(['status' => $status, 'updated_at' => $this->db->raw('current_timestamp(6)')]);
    }

    public function hasRequired(string $request, array $statuses): bool
    {
        return $this->db->table('info_questions')->select('id')->where('request_id', $request)->where('required', true)->whereIn('status', $statuses)->lockForUpdate()->get()->isNotEmpty();
    }

    public function event(string $request, string $actor, string $kind, array $detail = []): void
    {
        $this->db->table('request_events')->insert(['id' => Crypto::uuid(), 'request_id' => $request, 'actor_id' => $actor, 'kind' => $kind, 'detail' => json_encode((object) $detail, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR)]);
    }

    public function notify(string $user, string $kind, array $payload): void
    {
        $id = Crypto::uuid();
        $this->db->table('notifications')->insert(['id' => $id, 'user_id' => $user, 'kind' => $kind, 'payload' => json_encode($payload, JSON_THROW_ON_ERROR)]);
        if ($this->db->table('devices')->where('user_id', $user)->whereNull('revoked_at')->exists()) {
            $this->db->table('outbox_events')->insert(['id' => Crypto::uuid(), 'topic' => 'push.send', 'aggregate_id' => $id, 'payload' => json_encode(['notificationId' => $id, 'userId' => $user, 'kind' => $kind], JSON_THROW_ON_ERROR)]);
        }
    }
}
