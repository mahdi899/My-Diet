<?php

namespace App\Modules\Plans\Infrastructure;

use App\Modules\Plans\Application\PlanEditorStore;
use App\Modules\Plans\Application\PlanQuestionStore;
use App\Modules\Plans\Domain\CivilDates;
use App\Shared\Domain\LegacyCrypto as Crypto;
use Illuminate\Database\ConnectionInterface;

final class MySqlPlanEditor implements PlanEditorStore
{
    public function __construct(private ConnectionInterface $db, private PlanQuestionStore $questions) {}

    private function row(?object $row): ?array
    {
        return $row === null ? null : (array) $row;
    }

    public function transaction(\Closure $work): mixed
    {
        return $this->db->transaction($work);
    }

    public function request(string $id, bool $lock = false): ?array
    {
        $query = $this->db->table('plan_requests')->where('id', $id);
        if ($lock) {
            $query->lockForUpdate();
        }
        $row = $this->row($query->first());
        if ($row) {
            $row['display_name'] = $this->db->table('users')->where('id', $row['user_id'])->value('display_name');
        }

        return $row;
    }

    public function lockOwner(string $user): void
    {
        $this->db->table('users')->where('id', $user)->lockForUpdate()->first();
    }

    public function versions(string $request): array
    {
        return array_map(fn ($row) => (array) $row, $this->db->table('plan_versions')->where('request_id', $request)->orderByDesc('version_number')->lockForUpdate()->get()->all());
    }

    public function version(string $id): ?array
    {
        return $this->row($this->db->table('plan_versions')->where('id', $id)->first());
    }

    public function specialist(string $id): ?array
    {
        return $this->row($this->db->table('specialist_profiles')->where('user_id', $id)->lockForUpdate()->first());
    }

    public function createVersion(string $request, int $number, ?string $author, array $days): string
    {
        $id = Crypto::uuid();
        $this->db->table('plan_versions')->insert(['id' => $id, 'request_id' => $request, 'version_number' => $number, 'status' => 'draft', 'created_by' => $author]);
        $context = $this->db->selectOne('select r.assigned_specialist_id,s.schema_version,s.answers,a.version_id,c.generation_id from plan_requests r join questionnaire_submissions s on s.id=r.submission_id left join active_plan_versions a on a.user_id=r.user_id left join plan_version_context c on c.version_id=a.version_id where r.id=?', [$request]);
        $this->db->table('plan_version_context')->insert(['version_id' => $id, 'assigned_specialist_id' => $context->assigned_specialist_id, 'questionnaire_schema_version' => $context->schema_version,
            'questionnaire_snapshot' => $context->answers, 'replaces_version_id' => $context->version_id, 'generation_id' => $context->generation_id]);
        $this->contents($id, $days, $author);

        return $id;
    }

    public function replaceContents(string $version, int $lock, array $days, ?string $approver): int
    {
        $dayIds = $this->db->table('plan_days')->where('plan_version_id', $version)->pluck('id')->all();
        $mealIds = $this->db->table('plan_meals')->whereIn('plan_day_id', $dayIds)->pluck('id')->all();
        $this->db->table('plan_meal_options')->whereIn('meal_id', $mealIds)->delete();
        $this->db->table('plan_meal_items')->whereIn('meal_id', $mealIds)->delete();
        $this->db->table('plan_meals')->whereIn('id', $mealIds)->delete();
        $this->db->table('plan_days')->whereIn('id', $dayIds)->delete();
        $this->db->table('plan_versions')->where('id', $version)->where('lock_version', $lock)->update(['lock_version' => $lock + 1]);
        $this->contents($version, $days, $approver);

        return $lock + 1;
    }

    private function contents(string $version, array $days, ?string $approver): void
    {
        foreach ($days as $index => $meals) {
            $day = Crypto::uuid();
            $this->db->table('plan_days')->insert(['id' => $day, 'plan_version_id' => $version, 'day_index' => $index]);
            foreach ($meals as $position => $meal) {
                $id = Crypto::uuid();
                $this->db->table('plan_meals')->insert(['id' => $id, 'plan_day_id' => $day, 'meal_uid' => strtolower($meal['mealUid']), 'position' => $position, 'meal_type' => $meal['mealType'],
                    'suggested_time' => $meal['suggestedTime'], 'title' => $meal['title'], 'calories' => $meal['calories'], 'notes' => $meal['notes']]);
                foreach ($meal['items'] as $itemPosition => $item) {
                    $this->db->table('plan_meal_items')->insert(['id' => Crypto::uuid(), 'meal_id' => $id, 'position' => $itemPosition, ...$item]);
                }
                foreach ($meal['options'] ?? [] as $option) {
                    $approved = $option['approved'] && $approver !== null;
                    $this->db->table('plan_meal_options')->insert(['meal_id' => $id, 'option_uid' => strtolower($option['optionId']), 'kind' => $option['kind'],
                        'document' => json_encode([...$option, 'approved' => $approved], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR), 'approved_by' => $approved ? $approver : null,
                        'approved_at' => $approved ? $this->db->raw('current_timestamp(6)') : null]);
                }
            }
        }
    }

    public function inReview(string $request): void
    {
        $this->db->table('plan_requests')->where('id', $request)->update(['status' => 'in_review', 'updated_at' => $this->db->raw('current_timestamp(6)')]);
    }

    public function blocked(string $request): bool
    {
        return $this->db->table('info_questions')->where('request_id', $request)->where('required', true)->whereIn('status', ['open', 'answered'])->lockForUpdate()->get()->isNotEmpty();
    }

    public function baseUnchanged(string $version, string $user): bool
    {
        $context = $this->db->table('plan_version_context')->where('version_id', $version)->lockForUpdate()->first();
        $active = $this->db->table('active_plan_versions')->where('user_id', $user)->lockForUpdate()->first();

        return $context !== null && $context->replaces_version_id === ($active->version_id ?? null);
    }

    public function publish(string $request, string $version, string $user, string $actor, string $week, string $effective): void
    {
        $now = $this->db->raw('current_timestamp(6)');
        $this->db->table('plan_version_context')->where('version_id', $version)->update(['assigned_specialist_id' => $actor, 'review_completed_at' => $now]);
        foreach ($this->db->table('plan_days')->where('plan_version_id', $version)->get() as $day) {
            $this->db->table('plan_days')->where('id', $day->id)->update(['civil_date' => CivilDates::add($week, $day->day_index)]);
        }
        $this->db->table('plan_versions')->where('request_id', $request)->where('status', 'published')->update(['status' => 'superseded']);
        $this->db->table('plan_versions')->where('id', $version)->update(['status' => 'published', 'published_at' => $now]);
        $this->db->table('plan_requests')->where('id', $request)->update(['status' => 'published', 'week_start' => $week, 'effective_from' => $effective, 'updated_at' => $now]);
        $this->db->table('active_plan_versions')->upsert(['user_id' => $user, 'version_id' => $version, 'updated_at' => $now], ['user_id'], ['version_id', 'updated_at']);
        $this->db->table('outbox_events')->insert(['id' => Crypto::uuid(), 'topic' => 'shopping.invalidate', 'aggregate_id' => $user, 'payload' => json_encode(['requestId' => $request, 'versionId' => $version], JSON_THROW_ON_ERROR)]);
    }

    public function event(string $request, string $actor, string $kind): void
    {
        $this->questions->event($request, $actor, $kind);
    }

    public function notify(string $user, string $kind, array $payload): void
    {
        $this->questions->notify($user, $kind, $payload);
    }

    public function healthAccess(string $actor, string $request, ?string $reason): void
    {
        $this->db->table('health_access_logs')->insert(['id' => Crypto::uuid(), 'actor_id' => $actor, 'request_id' => $request, 'reason' => $reason]);
    }

    public function patientAssigned(string $actor, string $patient): bool
    {
        return $this->db->table('plan_requests')->where(['user_id' => $patient, 'assigned_specialist_id' => $actor])->exists();
    }

    public function patientVersions(string $patient): array
    {
        return array_map(fn ($row) => (array) $row, $this->db->table('plan_versions as v')->join('plan_requests as r', 'r.id', '=', 'v.request_id')->where('r.user_id', $patient)
            ->whereIn('v.status', ['published', 'superseded'])->select('v.*', 'r.week_start')->orderByDesc('v.published_at')->limit(50)->get()->all());
    }

    public function generation(string $request): ?array
    {
        $row = $this->row($this->db->table('ai_generations')->where('request_id', $request)->orderByDesc('created_at')->first());
        if ($row) {
            foreach (['warnings', 'attempt_chain', 'ai_notes'] as $key) {
                $row[$key] = $row[$key] === null ? null : json_decode($row[$key], false, 512, JSON_THROW_ON_ERROR);
                if ($row[$key] instanceof \stdClass) {
                    $row[$key] = (array) $row[$key];
                }
            }
            if (is_array($row['attempt_chain'])) {
                $row['attempt_chain'] = array_map(fn ($attempt) => $attempt instanceof \stdClass ? (array) $attempt : $attempt, $row['attempt_chain']);
            }
        }

        return $row;
    }

    public function flags(string $request): array
    {
        $row = $this->db->table('plan_requests as r')->join('questionnaire_submissions as s', 's.id', '=', 'r.submission_id')->where('r.id', $request)->value('s.risk_flags');

        return $row === null ? [] : json_decode($row, true, 512, JSON_THROW_ON_ERROR);
    }
}
