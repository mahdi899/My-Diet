<?php

namespace App\Modules\Plans\Infrastructure;

use App\Modules\Plans\Application\PlanGenerationStore;
use App\Modules\Plans\Domain\CivilDates;
use App\Shared\Domain\LegacyCrypto as Crypto;
use App\Shared\Domain\Problem;
use Illuminate\Database\ConnectionInterface;

final class MySqlPlanGeneration implements PlanGenerationStore
{
    private const SKIP_FLAGS = ['eating_disorder_history', 'high_risk_pregnancy', 'kidney', 'unintentional_weight_loss'];

    public function __construct(private ConnectionInterface $db) {}

    public function transaction(callable $work): mixed
    {
        return $this->db->transaction($work);
    }

    public function begin(string $requestId, bool $regenerate): ?array
    {
        return $this->db->transaction(function () use ($requestId, $regenerate) {
            $request = $this->db->selectOne('select r.id,r.user_id,r.status,r.assigned_specialist_id,s.schema_version,s.risk_flags from plan_requests r join questionnaire_submissions s on s.id=r.submission_id where r.id=? for update', [$requestId]);
            if ($request === null || ! in_array($request->status, ['queued', 'generating'], true)) {
                return null;
            }
            $versions = (int) $this->db->table('plan_versions')->where('request_id', $requestId)->count();
            if (! $regenerate && $versions > 0) {
                $this->db->table('plan_requests')->where('id', $requestId)->update(['status' => 'in_review', 'updated_at' => $this->db->raw('current_timestamp(6)')]);

                return null;
            }
            $flags = json_decode((string) $request->risk_flags, true);
            $skip = is_array($flags) && array_intersect(self::SKIP_FLAGS, $flags) !== [] ? 'high_risk' : $this->budgetBlock($request->user_id);
            $this->db->statement("insert into ai_execution_claims (request_id,status) values (?, 'started') as incoming on duplicate key update status='started', started_at=current_timestamp(6), finished_at=null, error_code=null", [$requestId]);
            $this->db->table('plan_requests')->where('id', $requestId)->update(['status' => 'generating', 'updated_at' => $this->db->raw('current_timestamp(6)')]);

            return ['skip' => $skip, 'userId' => $request->user_id, 'specialistId' => $request->assigned_specialist_id];
        });
    }

    public function finish(string $requestId, bool $regenerate, ?array $days, string $provider, ?string $reason): void
    {
        $this->db->transaction(function () use ($requestId, $regenerate, $days, $provider, $reason): void {
            $request = $this->db->selectOne('select id,user_id,assigned_specialist_id,submission_id,status from plan_requests where id=? for update', [$requestId]);
            if ($request === null || $request->status !== 'generating') {
                $this->db->table('ai_execution_claims')->where('request_id', $requestId)->update(['status' => 'failed', 'finished_at' => $this->db->raw('current_timestamp(6)'), 'error_code' => 'cancelled']);

                return;
            }
            $status = $days === null ? ($reason === null ? 'failed' : 'skipped') : 'drafted';
            if ($reason === 'invalid_draft' || $reason === 'provider_error') {
                $status = 'failed';
            }
            $draft = $this->db->table('plan_versions')->where('request_id', $requestId)->where('status', 'draft')->first();
            if ($regenerate && $draft && $days !== null) {
                $this->clearDays($draft->id);
                $this->writeDays($draft->id, $days);
                $this->db->table('plan_versions')->where('id', $draft->id)->update(['lock_version' => $draft->lock_version + 1]);
                $versionId = $draft->id;
            } elseif (! $draft && $this->db->table('plan_versions')->where('request_id', $requestId)->doesntExist() && $reason !== 'high_risk') {
                $versionId = Crypto::uuid();
                $this->db->table('plan_versions')->insert(['id' => $versionId, 'request_id' => $requestId, 'version_number' => 1, 'status' => 'draft']);
                $submission = $this->db->table('questionnaire_submissions')->where('id', $request->submission_id)->first();
                $this->db->table('plan_version_context')->insert([
                    'version_id' => $versionId,
                    'assigned_specialist_id' => $request->assigned_specialist_id,
                    'questionnaire_schema_version' => $submission->schema_version ?? 1,
                    'questionnaire_snapshot' => $submission->answers ?? '{}',
                ]);
                $this->writeDays($versionId, $days ?? array_fill(0, 7, ['meals' => []]));
            } else {
                $versionId = $draft->id ?? null;
            }
            $attempt = (int) $this->db->table('ai_generations')->where('request_id', $requestId)->count() + 1;
            $generation = Crypto::uuid();
            $started = $this->db->table('ai_execution_claims')->where('request_id', $requestId)->value('started_at');
            $usage = $this->db->table('ai_usage_ledger')->where('request_id', $requestId)->where('created_at', '>=', $started)->get();
            $latest = $usage->last();
            $this->db->table('ai_generations')->insert([
                'id' => $generation,
                'request_id' => $requestId,
                'provider' => $status === 'skipped' ? 'none' : $provider,
                'status' => $status === 'drafted' ? 'drafted' : ($status === 'failed' ? 'failed' : 'skipped'),
                'skipped_reason' => $status === 'drafted' ? null : $reason,
                'attempt_no' => $attempt,
                'model' => $latest->model ?? '',
                'pool_code' => $latest->pool_code ?? null,
                'cost_micros' => $usage->sum('cost_micros'),
                'tokens' => $usage->sum(fn ($u) => $u->tokens_in + $u->tokens_out),
                'warnings' => '[]',
            ]);
            if ($versionId !== null) {
                $this->db->table('plan_version_context')->where('version_id', $versionId)->update(['generation_id' => $generation]);
            }
            $this->db->table('plan_requests')->where('id', $requestId)->update(['status' => 'in_review', 'updated_at' => $this->db->raw('current_timestamp(6)')]);
            $this->db->table('ai_execution_claims')->where('request_id', $requestId)->update(['status' => $status === 'failed' ? 'failed' : 'completed', 'finished_at' => $this->db->raw('current_timestamp(6)'), 'error_code' => $status === 'drafted' ? null : $reason]);
            $this->db->table('request_events')->insert(['id' => Crypto::uuid(), 'request_id' => $requestId, 'kind' => $status === 'drafted' ? 'ai_drafted' : 'ai_skipped', 'detail' => json_encode(['status' => $status], JSON_THROW_ON_ERROR)]);
            if (is_string($request->assigned_specialist_id) && $request->assigned_specialist_id !== '') {
                $kind = $status === 'failed' || $reason === 'high_risk' ? 'specialist_required' : 'draft_ready';
                $this->db->table('notifications')->insert(['id' => Crypto::uuid(), 'user_id' => $request->assigned_specialist_id, 'kind' => $kind, 'payload' => json_encode(['requestId' => $requestId, 'reason' => $reason], JSON_THROW_ON_ERROR)]);
            }
        });
    }

    public function abandon(string $requestId): void
    {
        $this->db->table('plan_requests')->where('id', $requestId)->where('status', 'generating')->update(['status' => 'in_review', 'updated_at' => $this->db->raw('current_timestamp(6)')]);
    }

    public function regenerate(string $specialist, string $requestId, int $lock): array
    {
        return $this->db->transaction(function () use ($specialist, $requestId, $lock) {
            $request = $this->db->selectOne('select id,user_id,status,assigned_specialist_id from plan_requests where id=? for update', [$requestId]);
            if ($request === null || $request->assigned_specialist_id !== $specialist) {
                throw new Problem(404, 'not_found', 'درخواست پیدا نشد');
            }
            if ($request->status !== 'in_review') {
                throw new Problem(409, 'not_ready', 'فقط پیش‌نویس در حال بررسی را می‌توان دوباره ساخت');
            }
            $draft = $this->db->table('plan_versions')->where('request_id', $requestId)->where('status', 'draft')->first();
            if ($draft === null) {
                throw new Problem(409, 'not_ready', 'پیش‌نویسی برای ساخت دوباره نیست');
            }
            if ((int) $draft->lock_version !== $lock) {
                throw new Problem(409, 'lock_conflict', 'نسخهٔ برنامه تغییر کرده است');
            }
            $flags = json_decode((string) $this->db->table('questionnaire_submissions')->where('id', $this->db->table('plan_requests')->where('id', $requestId)->value('submission_id'))->value('risk_flags'), true);
            if (is_array($flags) && array_intersect(self::SKIP_FLAGS, $flags) !== []) {
                throw new Problem(409, 'high_risk', 'این پرونده پرخطر است و باید کامل توسط متخصص نوشته شود');
            }
            if ($this->budgetBlock($request->user_id) !== null) {
                throw new Problem(409, 'ai_budget_blocked', 'سقف هزینهٔ هوش مصنوعی اجازهٔ ساخت دوباره نمی‌دهد');
            }
            $this->db->table('ai_execution_claims')->where('request_id', $requestId)->delete();
            $this->db->table('plan_requests')->where('id', $requestId)->update(['status' => 'generating', 'updated_at' => $this->db->raw('current_timestamp(6)')]);
            $this->db->table('request_events')->insert(['id' => Crypto::uuid(), 'request_id' => $requestId, 'actor_id' => $specialist, 'kind' => 'draft_regenerate_requested', 'detail' => '{}']);
            $this->db->table('outbox_events')->insert(['id' => Crypto::uuid(), 'topic' => 'plan.generate', 'aggregate_id' => $requestId, 'payload' => json_encode(['requestId' => $requestId, 'regenerate' => true], JSON_THROW_ON_ERROR)]);

            return ['status' => 'generating'];
        });
    }

    private function budgetBlock(string $user): ?string
    {
        $controls = $this->db->table('ai_controls')->where('id', 1)->first();
        if ($controls === null) {
            return null;
        }
        if ((int) $controls->kill_switch === 1) {
            return 'kill_switch';
        }
        $spent = (int) $this->db->table('ai_generations')->where('created_at', '>=', $this->db->raw("date(convert_tz(current_timestamp(6),'+00:00','+03:30'))"))->sum('cost_micros');
        if ($controls->daily_cost_cap_micros !== null && $spent >= (int) $controls->daily_cost_cap_micros) {
            return 'cost_cap';
        }
        $own = (int) $this->db->table('ai_generations as g')->join('plan_requests as r', 'r.id', '=', 'g.request_id')->where('r.user_id', $user)->where('g.created_at', '>=', $this->db->raw("date(convert_tz(current_timestamp(6),'+00:00','+03:30'))"))->count();
        if ($own >= (int) $controls->per_user_daily_drafts) {
            return 'user_daily_drafts';
        }

        return null;
    }

    private function clearDays(string $version): void
    {
        $days = $this->db->table('plan_days')->where('plan_version_id', $version)->pluck('id');
        $meals = $this->db->table('plan_meals')->whereIn('plan_day_id', $days)->pluck('id');
        $this->db->table('plan_meal_items')->whereIn('meal_id', $meals)->delete();
        $this->db->table('plan_meal_options')->whereIn('meal_id', $meals)->delete();
        $this->db->table('plan_meals')->whereIn('id', $meals)->delete();
        $this->db->table('plan_days')->whereIn('id', $days)->delete();
    }

    private function writeDays(string $version, array $days): void
    {
        foreach (array_values($days) as $index => $day) {
            if ($index > 6) {
                break;
            }
            $dayId = Crypto::uuid();
            $this->db->table('plan_days')->insert(['id' => $dayId, 'plan_version_id' => $version, 'day_index' => $index]);
            foreach (array_values($day['meals'] ?? []) as $position => $meal) {
                $mealId = Crypto::uuid();
                $this->db->table('plan_meals')->insert([
                    'id' => $mealId,
                    'plan_day_id' => $dayId,
                    'meal_uid' => Crypto::uuid(),
                    'position' => $position,
                    'meal_type' => in_array($meal['mealType'] ?? '', ['breakfast', 'lunch', 'dinner', 'snack'], true) ? $meal['mealType'] : 'lunch',
                    'suggested_time' => $meal['suggestedTime'] ?? null,
                    'title' => $meal['title'],
                    'calories' => (int) $meal['calories'],
                    'notes' => (string) ($meal['notes'] ?? ''),
                ]);
                $option = Crypto::uuid();
                foreach ($meal['options'] ?? [['optionId' => $option, 'kind' => 'primary', 'title' => $meal['title'], 'calories' => (int) $meal['calories'], 'approved' => false]] as $document) {
                    $document['approved'] = false;
                    $this->db->table('plan_meal_options')->insert(['meal_id' => $mealId, 'option_uid' => $document['optionId'], 'kind' => $document['kind'], 'document' => json_encode($document, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR)]);
                }
                foreach (array_values($meal['items'] ?? []) as $itemPosition => $item) {
                    $this->db->table('plan_meal_items')->insert(['id' => Crypto::uuid(), 'meal_id' => $mealId, 'position' => $itemPosition, 'name' => $item['name'], 'quantity' => $item['quantity'] ?? null, 'unit' => $item['unit'] ?? null]);
                }
            }
        }
    }

    public function publishLocal(string $requestId): void
    {
        if (! app()->environment('local')) {
            return;
        }
        $request = $this->db->table('plan_requests')->where('id', $requestId)->first();
        $version = $this->db->table('plan_versions')->where('request_id', $requestId)->where('status', 'draft')->first();
        if ($request === null || $version === null) {
            return;
        }
        $today = CivilDates::today();
        $week = CivilDates::saturday($today);
        $actor = is_string($request->assigned_specialist_id) && $request->assigned_specialist_id !== ''
            ? $request->assigned_specialist_id
            : $request->user_id;
        $this->db->transaction(function () use ($requestId, $version, $request, $actor, $week, $today): void {
            $options = $this->db->table('plan_meal_options as o')
                ->join('plan_meals as m', 'm.id', '=', 'o.meal_id')
                ->join('plan_days as d', 'd.id', '=', 'm.plan_day_id')
                ->where('d.plan_version_id', $version->id)
                ->get(['o.meal_id', 'o.option_uid', 'o.document']);
            foreach ($options as $option) {
                $document = json_decode($option->document, true, 512, JSON_THROW_ON_ERROR);
                $document['approved'] = true;
                $this->db->table('plan_meal_options')->where('meal_id', $option->meal_id)->where('option_uid', $option->option_uid)->update([
                    'document' => json_encode($document, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR),
                    'approved_by' => $actor,
                    'approved_at' => $this->db->raw('current_timestamp(6)'),
                ]);
            }
            app(MySqlPlanEditor::class)->publish($requestId, $version->id, $request->user_id, $actor, $week, $today);
        });
    }
}
