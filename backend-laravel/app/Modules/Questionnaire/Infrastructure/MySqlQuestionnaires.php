<?php

namespace App\Modules\Questionnaire\Infrastructure;

use App\Modules\Questionnaire\Application\QuestionnaireStore;
use App\Shared\Domain\LegacyCrypto;
use Closure;
use Illuminate\Database\ConnectionInterface;

final class MySqlQuestionnaires implements QuestionnaireStore
{
    public function __construct(private ConnectionInterface $db) {}

    private function row(?object $row): ?array
    {
        if ($row === null) {
            return null;
        }
        $row = (array) $row;
        foreach (['answers', 'document', 'risk_flags'] as $field) {
            if (isset($row[$field]) && is_string($row[$field])) {
                $row[$field] = json_decode($row[$field], true, 512, JSON_THROW_ON_ERROR);
            }
        }

        return $row;
    }

    public function published(): ?array
    {
        return $this->row($this->db->table('questionnaire_schemas')->where('status', 'published')->first());
    }

    public function draft(string $userId): ?array
    {
        return $this->row($this->db->table('questionnaire_drafts')->where('user_id', $userId)->first());
    }

    private function json(array $value, bool $record = false): string
    {
        return json_encode($record ? (object) $value : $value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    }

    public function saveDraft(string $userId, array $answers): void
    {
        $this->db->statement('insert into questionnaire_drafts(user_id,schema_version,answers) values(?,1,?) as incoming on duplicate key update answers=incoming.answers,updated_at=current_timestamp(6)', [$userId, $this->json($answers, true)]);
    }

    public function createSubmission(string $id, string $userId, int $schema, array $answers, array $flags, float $bmi, ?string $pregnancyAsOf): void
    {
        $this->db->table('questionnaire_submissions')->insert(['id' => $id, 'user_id' => $userId, 'schema_version' => $schema,
            'answers' => $this->json($answers, true), 'risk_flags' => $this->json($flags), 'bmi' => $bmi, 'pregnancy_as_of' => $pregnancyAsOf]);
    }

    public function setInitialName(string $userId, string $name): void
    {
        $this->db->table('users')->where('id', $userId)->where(fn ($q) => $q->whereNull('display_name')->orWhere('display_name', ''))->update(['display_name' => $name]);
    }

    public function latest(string $userId): ?array
    {
        return $this->row($this->db->table('questionnaire_submissions')->where('user_id', $userId)->orderByDesc('submitted_at')->first());
    }

    public function schema(int $version, bool $lock = false): ?array
    {
        $q = $this->db->table('questionnaire_schemas')->where('version', $version);

        return $this->row(($lock ? $q->lockForUpdate() : $q)->first());
    }

    public function openRequest(string $userId): ?array
    {
        return $this->row($this->db->table('plan_requests')->select('id', 'status')->where('user_id', $userId)
            ->whereIn('status', ['queued', 'generating', 'in_review', 'awaiting_user', 'response_received'])->orderByDesc('created_at')->first());
    }

    public function wallet(string $userId): ?array
    {
        return $this->row($this->db->table('wallets')->where('user_id', $userId)->first());
    }

    public function schemas(): array
    {
        return array_map(fn ($row) => ['version' => $row->version, 'status' => $row->status, 'document' => json_decode($row->document, false, 512, JSON_THROW_ON_ERROR)],
            $this->db->table('questionnaire_schemas')->orderBy('version')->get()->all());
    }

    public function createSchema(array $document): int
    {
        return $this->db->transaction(function () use ($document): int {
            $this->db->statement('insert into identity_mutexes(lock_key) values(?) as incoming on duplicate key update lock_key=incoming.lock_key', [hash('sha256', 'questionnaire:schema')]);
            $version = (int) $this->db->table('questionnaire_schemas')->max('version') + 1;
            $document['version'] = $version;
            $this->db->table('questionnaire_schemas')->insert(['version' => $version, 'document' => $this->json($document, true), 'status' => 'draft']);

            return $version;
        });
    }

    public function publish(int $version): void
    {
        $this->db->table('questionnaire_schemas')->where('status', 'published')->where('version', '<>', $version)->update(['status' => 'retired']);
        $this->db->table('questionnaire_schemas')->where('version', $version)->update(['status' => 'published', 'published_at' => $this->db->raw('current_timestamp(6)')]);
    }

    public function audit(string $actor, string $action, int $version): void
    {
        $this->db->table('audit_logs')->insert(['id' => LegacyCrypto::uuid(), 'actor_id' => $actor, 'action' => $action,
            'target_type' => 'questionnaire_schema', 'target_id' => null, 'detail' => $this->json(['version' => $version], true)]);
    }

    public function transaction(Closure $work): mixed
    {
        return $this->db->transaction(function () use ($work): mixed {
            $this->db->statement('insert into identity_mutexes(lock_key) values(?) as incoming on duplicate key update lock_key=incoming.lock_key', [hash('sha256', 'questionnaire:schema')]);

            return $work();
        });
    }
}
