import type { Pool, PoolClient } from 'pg';
import type { StoredAnswers } from '../../questionnaire/schema.js';
import { audit, insertOutbox, notify, withTransaction, type Queryable } from '../../common/sql.js';
import { uuidv7 } from '../../common/id.js';
import { GenerationError } from '../application/draft-provider.js';
import { bucketSql } from './queue-sql.js';
import type { QueueBucket } from '../domain/queue.js';
import type { MealOption } from '../options.js';
import type { MealInput } from '../domain/draft.js';
import type { PlanSession, PlanRepository, PlanRecords } from '../application/ports.js';

class PostgresPlanSession implements PlanSession {
  constructor(protected readonly client: Queryable) {}
  async claimableRequest(values: readonly [string]): Promise<PlanRecords<{
        status: string;
        flags: string[];
        answers: StoredAnswers;
        specialist_id: string | null;
        schema_version: number;
        user_id: string;
        phone_e164: string;
      }>> {
    const { rows, rowCount } = await this.client.query<{
        status: string;
        flags: string[];
        answers: StoredAnswers;
        specialist_id: string | null;
        schema_version: number;
        user_id: string;
        phone_e164: string;
      }>(
      `select r.status, s.risk_flags as flags, s.answers, r.assigned_specialist_id as specialist_id,
                s.schema_version, r.user_id, u.phone_e164
         from plan_requests r
         join questionnaire_submissions s on s.id = r.submission_id
         join users u on u.id = r.user_id
         where r.id = $1
         for update of r`, [...values],
    );
    return { items: rows.map(row => ({ status: row.status, flags: row.flags, answers: row.answers, specialist_id: row.specialist_id, schema_version: row.schema_version, user_id: row.user_id, phone_e164: row.phone_e164 })), count: rowCount ?? 0 };
  }

  async existingVersion(values: readonly [string]): Promise<PlanRecords<{ id: string }>> {
    const { rows, rowCount } = await this.client.query<{ id: string }>(
      `select id from plan_versions where request_id = $1 limit 1`, [...values],
    );
    return { items: rows.map(row => ({ id: row.id })), count: rowCount ?? 0 };
  }

  async recoverExistingDraft(values: readonly [string]): Promise<PlanRecords<never>> {
    const { rowCount } = await this.client.query<Record<string, never>>(
      `update plan_requests set status = 'in_review', updated_at = now() where id = $1 and status <> 'cancelled'`, [...values],
    );
    return { items: [], count: rowCount ?? 0 };
  }

  async claimGeneration(values: readonly [string]): Promise<PlanRecords<{ request_id: string }>> {
    const { rows, rowCount } = await this.client.query<{ request_id: string }>(
      `insert into ai_execution_claims(request_id,status) values($1,'started')
        on conflict(request_id) do nothing returning request_id`, [...values],
    );
    return { items: rows.map(row => ({ request_id: row.request_id })), count: rowCount ?? 0 };
  }

  async finishRecoveredRequest(values: readonly [string]): Promise<PlanRecords<never>> {
    const { rowCount } = await this.client.query<Record<string, never>>(
      "update plan_requests set status='in_review',updated_at=now() where id=$1", [...values],
    );
    return { items: [], count: rowCount ?? 0 };
  }

  async failUncertainClaim(values: readonly [string]): Promise<PlanRecords<never>> {
    const { rowCount } = await this.client.query<Record<string, never>>(
      "update ai_execution_claims set status='failed',finished_at=now(),error_code='provider_outcome_unknown' where request_id=$1", [...values],
    );
    return { items: [], count: rowCount ?? 0 };
  }

  async recordUncertainGeneration(values: readonly [string, string]): Promise<PlanRecords<never>> {
    const { rowCount } = await this.client.query<Record<string, never>>(
      `insert into ai_generations(id,request_id,provider,status,skipped_reason)
            values($1,$2,'unknown','failed','provider_outcome_unknown')`, [...values],
    );
    return { items: [], count: rowCount ?? 0 };
  }

  async startGeneration(values: readonly [string]): Promise<PlanRecords<never>> {
    const { rowCount } = await this.client.query<Record<string, never>>(
      `update plan_requests set status = 'generating', updated_at = now() where id = $1`, [...values],
    );
    return { items: [], count: rowCount ?? 0 };
  }

  async mealHistory(values: readonly [string, string]): Promise<PlanRecords<{ recorded: number; eaten: number; days: number }>> {
    const { rows, rowCount } = await this.client.query<{ recorded: number; eaten: number; days: number }>(
      `select count(*)::int as recorded,
      count(*) filter(where eaten)::int as eaten,count(distinct scheduled_date)::int as days
      from meal_logs where user_id=$1 and scheduled_date>=$2::date-7 and scheduled_date<$2::date`, [...values],
    );
    return { items: rows.map(row => ({ recorded: row.recorded, eaten: row.eaten, days: row.days })), count: rowCount ?? 0 };
  }

  async lockGenerationStatus(values: readonly [string]): Promise<PlanRecords<{ status: string }>> {
    const { rows, rowCount } = await this.client.query<{ status: string }>(
      `select status from plan_requests where id = $1 for update`, [...values],
    );
    return { items: rows.map(row => ({ status: row.status })), count: rowCount ?? 0 };
  }

  async failCancelledClaim(values: readonly [string]): Promise<PlanRecords<never>> {
    const { rowCount } = await this.client.query<Record<string, never>>(
      "update ai_execution_claims set status='failed',finished_at=now(),error_code='provider_outcome_unknown' where request_id=$1", [...values],
    );
    return { items: [], count: rowCount ?? 0 };
  }

  async recordCancelledGeneration(values: readonly [string, string, string, number, number, string]): Promise<PlanRecords<never>> {
    const { rowCount } = await this.client.query<Record<string, never>>(
      `insert into ai_generations(id,request_id,provider,status,skipped_reason,cost_micros,tokens,model)
          values($1,$2,$3,'failed','cancelled_after_generation',$4,$5,$6)`, [...values],
    );
    return { items: [], count: rowCount ?? 0 };
  }

  async generationTarget(values: readonly [string, boolean]): Promise<PlanRecords<{ id: string }>> {
    const { rows, rowCount } = await this.client.query<{ id: string }>(
      `select id from plan_versions where request_id = $1 and ($2::boolean = false or status = 'draft') limit 1`, [...values],
    );
    return { items: rows.map(row => ({ id: row.id })), count: rowCount ?? 0 };
  }

  async advanceDraftLock(values: readonly [string]): Promise<PlanRecords<never>> {
    const { rowCount } = await this.client.query<Record<string, never>>(
      'update plan_versions set lock_version = lock_version + 1 where id = $1', [...values],
    );
    return { items: [], count: rowCount ?? 0 };
  }

  async finishGenerationClaim(values: readonly [string, string, string | null]): Promise<PlanRecords<never>> {
    const { rowCount } = await this.client.query<Record<string, never>>(
      `update ai_execution_claims set status=$2,finished_at=now(),error_code=$3 where request_id=$1`, [...values],
    );
    return { items: [], count: rowCount ?? 0 };
  }

  async finishGenerationRequest(values: readonly [string]): Promise<PlanRecords<never>> {
    const { rowCount } = await this.client.query<Record<string, never>>(
      `update plan_requests set status = 'in_review', updated_at = now() where id = $1`, [...values],
    );
    return { items: [], count: rowCount ?? 0 };
  }

  async nextAttempt(values: readonly [string]): Promise<PlanRecords<{ n: number }>> {
    const { rows, rowCount } = await this.client.query<{ n: number }>(
      `select coalesce(max(attempt_no), 0) + 1 as n from ai_generations where request_id = $1`, [...values],
    );
    return { items: rows.map(row => ({ n: row.n })), count: rowCount ?? 0 };
  }

  async recordGeneration(values: readonly [string, string, string, string, string | null, string | null, number, string, string, number, number, number, number, string, string | null, string | null, string | null]): Promise<PlanRecords<{id:string}>> {
    const { rows, rowCount } = await this.client.query<{id:string}>(
      `insert into ai_generations
           (id, request_id, provider, status, skipped_reason, raw_output, attempt_no, model,
            prompt_version, schema_version, tokens, latency_ms, cost_micros, warnings,
            pool_code, attempt_chain, ai_notes)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, $15, $16::jsonb, $17::jsonb) returning id`, [...values],
    );
    return { items: rows.map(row => ({ id: row.id })), count: rowCount ?? 0 };
  }

  async attachGeneration(values: readonly [string, string]): Promise<PlanRecords<never>> {
    const { rowCount } = await this.client.query<Record<string, never>>(
      `update plan_version_context set generation_id=$2 where version_id in
        (select id from plan_versions where request_id=$1 and status='draft')`, [...values],
    );
    return { items: [], count: rowCount ?? 0 };
  }

  async costCapWarning(values: readonly [Date]): Promise<PlanRecords<{ id: string }>> {
    const { rows, rowCount } = await this.client.query<{ id: string }>(
      `select id from audit_logs where action = 'ai_cost_cap' and created_at >= $1 limit 1`, [...values],
    );
    return { items: rows.map(row => ({ id: row.id })), count: rowCount ?? 0 };
  }

  async recordGenerationEvent(values: readonly [string, string, string, string]): Promise<PlanRecords<never>> {
    const { rowCount } = await this.client.query<Record<string, never>>(
      `insert into request_events (id, request_id, kind, detail) values ($1, $2, $3, $4::jsonb)`, [...values],
    );
    return { items: [], count: rowCount ?? 0 };
  }

  async publishedVersion(values: readonly [string]): Promise<PlanRecords<{ id: string }>> {
    const { rows, rowCount } = await this.client.query<{ id: string }>(
      `select id from plan_versions where request_id = $1 and status = 'published'`, [...values],
    );
    return { items: rows.map(row => ({ id: row.id })), count: rowCount ?? 0 };
  }

  async specialistQueue(values: readonly [string, QueueBucket | null]): Promise<PlanRecords<{
      id: string;
      status: string;
      kind: string;
      created_at: Date;
      display_name: string | null;
    }>> {
    const filter = values[1] ? `and ${bucketSql(values[1])}` : '';
    const { rows, rowCount } = await this.client.query<{
      id: string;
      status: string;
      kind: string;
      created_at: Date;
      display_name: string | null;
    }>(
      `select r.id, r.status, r.kind, r.created_at, u.display_name
       from plan_requests r
       join users u on u.id = r.user_id
       where r.assigned_specialist_id = $1
       ${filter}
       order by r.created_at desc
       limit 100`, [values[0]],
    );
    return { items: rows.map(row => ({ id: row.id, status: row.status, kind: row.kind, created_at: row.created_at, display_name: row.display_name })), count: rowCount ?? 0 };
  }

  async latestUserRequest(values: readonly [string]): Promise<PlanRecords<{ id: string }>> {
    const { rows, rowCount } = await this.client.query<{ id: string }>(
      `select id from plan_requests where user_id = $1 order by created_at desc limit 1`, [...values],
    );
    return { items: rows.map(row => ({ id: row.id })), count: rowCount ?? 0 };
  }

  async requestAssignment(values: readonly [string]): Promise<PlanRecords<{ assigned_specialist_id: string | null }>> {
    const { rows, rowCount } = await this.client.query<{ assigned_specialist_id: string | null }>(
      `select assigned_specialist_id from plan_requests where id = $1`, [...values],
    );
    return { items: rows.map(row => ({ assigned_specialist_id: row.assigned_specialist_id })), count: rowCount ?? 0 };
  }

  async recordHealthAccess(values: readonly [string, string, string, string | null]): Promise<PlanRecords<never>> {
    const { rowCount } = await this.client.query<Record<string, never>>(
      `insert into health_access_logs (id, actor_id, request_id, reason) values ($1, $2, $3, $4)`, [...values],
    );
    return { items: [], count: rowCount ?? 0 };
  }

  async editableVersions(values: readonly [string]): Promise<PlanRecords<{ id: string; status: string; lock_version: number; version_number: number }>> {
    const { rows, rowCount } = await this.client.query<{ id: string; status: string; lock_version: number; version_number: number }>(
      `select id, status, lock_version, version_number
         from plan_versions where request_id = $1 order by version_number desc`, [...values],
    );
    return { items: rows.map(row => ({ id: row.id, status: row.status, lock_version: row.lock_version, version_number: row.version_number })), count: rowCount ?? 0 };
  }

  async advanceExpectedDraftLock(values: readonly [string, number]): Promise<PlanRecords<never>> {
    const { rowCount } = await this.client.query<Record<string, never>>(
      `update plan_versions set lock_version = lock_version + 1 where id = $1 and lock_version = $2`, [...values],
    );
    return { items: [], count: rowCount ?? 0 };
  }

  async reopenPublishedRequest(values: readonly [string]): Promise<PlanRecords<never>> {
    const { rowCount } = await this.client.query<Record<string, never>>(
      `update plan_requests set status = 'in_review', updated_at = now() where id = $1 and status = 'published'`, [...values],
    );
    return { items: [], count: rowCount ?? 0 };
  }

  async recordDraftEdit(values: readonly [string, string, string]): Promise<PlanRecords<never>> {
    const { rowCount } = await this.client.query<Record<string, never>>(
      `insert into request_events (id, request_id, actor_id, kind) values ($1, $2, $3, 'draft_edited')`, [...values],
    );
    return { items: [], count: rowCount ?? 0 };
  }

  async versionLock(values: readonly [string | undefined]): Promise<PlanRecords<{ lock_version: number }>> {
    const { rows, rowCount } = await this.client.query<{ lock_version: number }>(
      `select lock_version from plan_versions where id = $1`, [...values],
    );
    return { items: rows.map(row => ({ lock_version: row.lock_version })), count: rowCount ?? 0 };
  }

  async redraftVersions(values: readonly [string]): Promise<PlanRecords<{ id: string; status: string; lock_version: number }>> {
    const { rows, rowCount } = await this.client.query<{ id: string; status: string; lock_version: number }>(
      `select id, status, lock_version from plan_versions where request_id = $1 order by version_number desc`, [...values],
    );
    return { items: rows.map(row => ({ id: row.id, status: row.status, lock_version: row.lock_version })), count: rowCount ?? 0 };
  }

  async redraftRiskFlags(values: readonly [string]): Promise<PlanRecords<{ flags: string[] }>> {
    const { rows, rowCount } = await this.client.query<{ flags: string[] }>(
      `select s.risk_flags as flags from plan_requests r join questionnaire_submissions s on s.id = r.submission_id where r.id = $1`, [...values],
    );
    return { items: rows.map(row => ({ flags: row.flags })), count: rowCount ?? 0 };
  }

  async clearGenerationClaim(values: readonly [string]): Promise<PlanRecords<never>> {
    const { rowCount } = await this.client.query<Record<string, never>>(
      `delete from ai_execution_claims where request_id = $1`, [...values],
    );
    return { items: [], count: rowCount ?? 0 };
  }

  async startRedraft(values: readonly [string]): Promise<PlanRecords<never>> {
    const { rowCount } = await this.client.query<Record<string, never>>(
      `update plan_requests set status = 'generating', updated_at = now() where id = $1`, [...values],
    );
    return { items: [], count: rowCount ?? 0 };
  }

  async recordRedraftRequest(values: readonly [string, string, string]): Promise<PlanRecords<never>> {
    const { rowCount } = await this.client.query<Record<string, never>>(
      `insert into request_events (id, request_id, actor_id, kind) values ($1, $2, $3, 'draft_regenerate_requested')`, [...values],
    );
    return { items: [], count: rowCount ?? 0 };
  }

  async recoverFailedRedraft(values: readonly [string]): Promise<PlanRecords<never>> {
    const { rowCount } = await this.client.query<Record<string, never>>(
      `update plan_requests set status = 'in_review', updated_at = now() where id = $1 and status = 'generating'`, [...values],
    );
    return { items: [], count: rowCount ?? 0 };
  }

  async specialistVerification(values: readonly [string]): Promise<PlanRecords<{ active: boolean; verification_status: string }>> {
    const { rows, rowCount } = await this.client.query<{ active: boolean; verification_status: string }>(
      `select active, verification_status from specialist_profiles where user_id = $1`, [...values],
    );
    return { items: rows.map(row => ({ active: row.active, verification_status: row.verification_status })), count: rowCount ?? 0 };
  }

  async lockOwner(values: readonly [string]): Promise<PlanRecords<never>> {
    const { rowCount } = await this.client.query<Record<string, never>>(
      'select id from users where id=$1 for update', [...values],
    );
    return { items: [], count: rowCount ?? 0 };
  }

  async blockingQuestions(values: readonly [string]): Promise<PlanRecords<{ id: string }>> {
    const { rows, rowCount } = await this.client.query<{ id: string }>(
      `select id from info_questions
         where request_id = $1 and required = true and status in ('open', 'answered')`, [...values],
    );
    return { items: rows.map(row => ({ id: row.id })), count: rowCount ?? 0 };
  }

  async latestDraftVersion(values: readonly [string]): Promise<PlanRecords<{ id: string; lock_version: number }>> {
    const { rows, rowCount } = await this.client.query<{ id: string; lock_version: number }>(
      `select id, lock_version from plan_versions
         where request_id = $1 and status = 'draft'
         order by version_number desc limit 1`, [...values],
    );
    return { items: rows.map(row => ({ id: row.id, lock_version: row.lock_version })), count: rowCount ?? 0 };
  }

  async unchangedActiveBase(values: readonly [string, string]): Promise<PlanRecords<{ present: number }>> {
    const { rows, rowCount } = await this.client.query<{ present: number }>(
      `select 1 from plan_version_context c join plan_requests r on r.id=$2
        left join active_plan_versions a on a.user_id=r.user_id where c.version_id=$1
        and c.replaces_version_id is not distinct from a.version_id`, [...values],
    );
    return { items: rows.map(() => ({ present: 1 })), count: rowCount ?? 0 };
  }

  async recordReviewCompletion(values: readonly [string, string]): Promise<PlanRecords<never>> {
    const { rowCount } = await this.client.query<Record<string, never>>(
      `update plan_version_context set assigned_specialist_id=$2,review_completed_at=now()
        where version_id=$1`, [...values],
    );
    return { items: [], count: rowCount ?? 0 };
  }

  async datePlanDay(values: readonly [string, string]): Promise<PlanRecords<never>> {
    const { rowCount } = await this.client.query<Record<string, never>>(
      `update plan_days set civil_date = $2 where id = $1`, [...values],
    );
    return { items: [], count: rowCount ?? 0 };
  }

  async supersedePublishedVersion(values: readonly [string]): Promise<PlanRecords<never>> {
    const { rowCount } = await this.client.query<Record<string, never>>(
      `update plan_versions set status = 'superseded'
         where request_id = $1 and status = 'published'`, [...values],
    );
    return { items: [], count: rowCount ?? 0 };
  }

  async publishVersion(values: readonly [string, Date]): Promise<PlanRecords<never>> {
    const { rowCount } = await this.client.query<Record<string, never>>(
      `update plan_versions set status = 'published', published_at = $2 where id = $1`, [...values],
    );
    return { items: [], count: rowCount ?? 0 };
  }

  async publishRequest(values: readonly [string, string, string]): Promise<PlanRecords<never>> {
    const { rowCount } = await this.client.query<Record<string, never>>(
      `update plan_requests
         set status = 'published', week_start = coalesce(week_start, $2::date),
             effective_from = coalesce(effective_from, $3::date), updated_at = now()
         where id = $1`, [...values],
    );
    return { items: [], count: rowCount ?? 0 };
  }

  async recordPublication(values: readonly [string, string, string]): Promise<PlanRecords<never>> {
    const { rowCount } = await this.client.query<Record<string, never>>(
      `insert into request_events (id, request_id, actor_id, kind) values ($1, $2, $3, 'published')`, [...values],
    );
    return { items: [], count: rowCount ?? 0 };
  }

  async activateVersion(values: readonly [string, string]): Promise<PlanRecords<never>> {
    const { rowCount } = await this.client.query<Record<string, never>>(
      `insert into active_plan_versions(user_id,version_id) values($1,$2)
        on conflict(user_id) do update set version_id=excluded.version_id,updated_at=now()`, [...values],
    );
    return { items: [], count: rowCount ?? 0 };
  }

  async createQuestion(values: readonly [string, string, string, string, boolean]): Promise<PlanRecords<never>> {
    const { rowCount } = await this.client.query<Record<string, never>>(
      `insert into info_questions (id, request_id, specialist_id, prompt, required, status)
         values ($1, $2, $3, $4, $5, 'open')`, [...values],
    );
    return { items: [], count: rowCount ?? 0 };
  }

  async awaitUser(values: readonly [string]): Promise<PlanRecords<never>> {
    const { rowCount } = await this.client.query<Record<string, never>>(
      `update plan_requests set status = 'awaiting_user', updated_at = now() where id = $1`, [...values],
    );
    return { items: [], count: rowCount ?? 0 };
  }

  async recordQuestionEvent(values: readonly [string, string, string]): Promise<PlanRecords<never>> {
    const { rowCount } = await this.client.query<Record<string, never>>(
      `insert into request_events (id, request_id, actor_id, kind) values ($1, $2, $3, 'info_question')`, [...values],
    );
    return { items: [], count: rowCount ?? 0 };
  }

  async lockAnswerQuestion(values: readonly [string]): Promise<PlanRecords<{
        id: string;
        request_id: string;
        status: string;
        required: boolean;
        user_id: string;
        specialist_id: string | null;
      }>> {
    const { rows, rowCount } = await this.client.query<{
        id: string;
        request_id: string;
        status: string;
        required: boolean;
        user_id: string;
        specialist_id: string | null;
      }>(
      `select q.id, q.request_id, q.status, q.required, r.user_id, r.assigned_specialist_id as specialist_id
         from info_questions q
         join plan_requests r on r.id = q.request_id
         where q.id = $1
         for update of q`, [...values],
    );
    return { items: rows.map(row => ({ id: row.id, request_id: row.request_id, status: row.status, required: row.required, user_id: row.user_id, specialist_id: row.specialist_id })), count: rowCount ?? 0 };
  }

  async createAnswer(values: readonly [string, string, string, string]): Promise<PlanRecords<never>> {
    const { rowCount } = await this.client.query<Record<string, never>>(
      `insert into info_answers (id, question_id, author_id, body) values ($1, $2, $3, $4)`, [...values],
    );
    return { items: [], count: rowCount ?? 0 };
  }

  async markAnswered(values: readonly [string]): Promise<PlanRecords<never>> {
    const { rowCount } = await this.client.query<Record<string, never>>(
      `update info_questions set status = 'answered' where id = $1`, [...values],
    );
    return { items: [], count: rowCount ?? 0 };
  }

  async openRequiredQuestions(values: readonly [string]): Promise<PlanRecords<{ id: string }>> {
    const { rows, rowCount } = await this.client.query<{ id: string }>(
      `select id from info_questions where request_id = $1 and required = true and status = 'open'`, [...values],
    );
    return { items: rows.map(row => ({ id: row.id })), count: rowCount ?? 0 };
  }

  async markResponseReceived(values: readonly [string]): Promise<PlanRecords<never>> {
    const { rowCount } = await this.client.query<Record<string, never>>(
      `update plan_requests set status = 'response_received', updated_at = now() where id = $1`, [...values],
    );
    return { items: [], count: rowCount ?? 0 };
  }

  async lockAcknowledgementQuestion(values: readonly [string]): Promise<PlanRecords<{
        request_id: string;
        status: string;
        assigned_specialist_id: string | null;
      }>> {
    const { rows, rowCount } = await this.client.query<{
        request_id: string;
        status: string;
        assigned_specialist_id: string | null;
      }>(
      `select q.request_id, q.status, r.assigned_specialist_id
         from info_questions q
         join plan_requests r on r.id = q.request_id
         where q.id = $1
         for update of q`, [...values],
    );
    return { items: rows.map(row => ({ request_id: row.request_id, status: row.status, assigned_specialist_id: row.assigned_specialist_id })), count: rowCount ?? 0 };
  }

  async acknowledgeQuestion(values: readonly [string]): Promise<PlanRecords<never>> {
    const { rowCount } = await this.client.query<Record<string, never>>(
      `update info_questions set status = 'acknowledged' where id = $1`, [...values],
    );
    return { items: [], count: rowCount ?? 0 };
  }

  async remainingRequiredQuestions(values: readonly [string]): Promise<PlanRecords<{ id: string }>> {
    const { rows, rowCount } = await this.client.query<{ id: string }>(
      `select id from info_questions
         where request_id = $1 and required = true and status in ('open', 'answered')`, [...values],
    );
    return { items: rows.map(row => ({ id: row.id })), count: rowCount ?? 0 };
  }

  async finishQuestionReview(values: readonly [string]): Promise<PlanRecords<never>> {
    const { rowCount } = await this.client.query<Record<string, never>>(
      `update plan_requests set status = 'in_review', updated_at = now() where id = $1`, [...values],
    );
    return { items: [], count: rowCount ?? 0 };
  }

  async userQuestions(values: readonly [string, string]): Promise<PlanRecords<{
      id: string;
      request_id: string;
      prompt: string;
      required: boolean;
      status: string;
      created_at: Date;
    }>> {
    const { rows, rowCount } = await this.client.query<{
      id: string;
      request_id: string;
      prompt: string;
      required: boolean;
      status: string;
      created_at: Date;
    }>(
      `select q.id, q.request_id, q.prompt, q.required, q.status, q.created_at
       from info_questions q
       join plan_requests r on r.id = q.request_id
       where r.user_id = $1 and q.status = $2
       order by q.created_at
       limit 100`, [...values],
    );
    return { items: rows.map(row => ({ id: row.id, request_id: row.request_id, prompt: row.prompt, required: row.required, status: row.status, created_at: row.created_at })), count: rowCount ?? 0 };
  }

  async lockWithdrawalQuestion(values: readonly [string]): Promise<PlanRecords<{
        request_id: string;
        status: string;
        assigned_specialist_id: string | null;
      }>> {
    const { rows, rowCount } = await this.client.query<{
        request_id: string;
        status: string;
        assigned_specialist_id: string | null;
      }>(
      `select q.request_id, q.status, r.assigned_specialist_id
         from info_questions q
         join plan_requests r on r.id = q.request_id
         where q.id = $1
         for update of q`, [...values],
    );
    return { items: rows.map(row => ({ request_id: row.request_id, status: row.status, assigned_specialist_id: row.assigned_specialist_id })), count: rowCount ?? 0 };
  }

  async withdrawQuestion(values: readonly [string]): Promise<PlanRecords<never>> {
    const { rowCount } = await this.client.query<Record<string, never>>(
      `update info_questions set status = 'withdrawn' where id = $1`, [...values],
    );
    return { items: [], count: rowCount ?? 0 };
  }

  async remainingWithdrawalQuestions(values: readonly [string]): Promise<PlanRecords<{ id: string }>> {
    const { rows, rowCount } = await this.client.query<{ id: string }>(
      `select id from info_questions
         where request_id = $1 and required = true and status in ('open', 'answered')`, [...values],
    );
    return { items: rows.map(row => ({ id: row.id })), count: rowCount ?? 0 };
  }

  async finishWithdrawalReview(values: readonly [string]): Promise<PlanRecords<never>> {
    const { rowCount } = await this.client.query<Record<string, never>>(
      `update plan_requests set status = 'in_review', updated_at = now()
           where id = $1 and status in ('awaiting_user', 'response_received')`, [...values],
    );
    return { items: [], count: rowCount ?? 0 };
  }

  async recordWithdrawal(values: readonly [string, string, string, string]): Promise<PlanRecords<never>> {
    const { rowCount } = await this.client.query<Record<string, never>>(
      `insert into request_events (id, request_id, actor_id, kind, detail)
         values ($1, $2, $3, 'info_withdrawn', $4::jsonb)`, [...values],
    );
    return { items: [], count: rowCount ?? 0 };
  }

  async activePublishedPlan(values: readonly [string]): Promise<PlanRecords<{
      id: string;
      version_id: string;
      week_start: string;
      effective_from: string;
    }>> {
    const { rows, rowCount } = await this.client.query<{
      id: string;
      version_id: string;
      week_start: string;
      effective_from: string;
    }>(
      `select r.id, v.id as version_id, r.week_start, r.effective_from
       from plan_versions v
       join plan_requests r on r.id = v.request_id
       where r.user_id = $1 and v.status = 'published' and r.week_start is not null
         and (not exists(select 1 from active_plan_versions a where a.user_id=r.user_id)
           or exists(select 1 from active_plan_versions a where a.user_id=r.user_id and a.version_id=v.id))
       order by v.published_at desc
       limit 1`, [...values],
    );
    return { items: rows.map(row => ({ id: row.id, version_id: row.version_id, week_start: row.week_start, effective_from: row.effective_from })), count: rowCount ?? 0 };
  }

  async userRequests(values: readonly [string]): Promise<PlanRecords<{
      id: string;
      status: string;
      kind: string;
      price_toman: string;
      created_at: Date;
    }>> {
    const { rows, rowCount } = await this.client.query<{
      id: string;
      status: string;
      kind: string;
      price_toman: string;
      created_at: Date;
    }>(
      `select id, status, kind, price_toman, created_at
       from plan_requests where user_id = $1
       order by created_at desc
       limit 50`, [...values],
    );
    return { items: rows.map(row => ({ id: row.id, status: row.status, kind: row.kind, price_toman: row.price_toman, created_at: row.created_at })), count: rowCount ?? 0 };
  }

  async ownedTimelineRequest(values: readonly [string, string]): Promise<PlanRecords<{
      id: string;
      status: string;
      kind: string;
      price_toman: string;
      created_at: Date;
    }>> {
    const { rows, rowCount } = await this.client.query<{
      id: string;
      status: string;
      kind: string;
      price_toman: string;
      created_at: Date;
    }>(
      `select id, status, kind, price_toman, created_at
       from plan_requests where id = $1 and user_id = $2`, [...values],
    );
    return { items: rows.map(row => ({ id: row.id, status: row.status, kind: row.kind, price_toman: row.price_toman, created_at: row.created_at })), count: rowCount ?? 0 };
  }

  async requestEvents(values: readonly [string]): Promise<PlanRecords<{ kind: string; created_at: Date }>> {
    const { rows, rowCount } = await this.client.query<{ kind: string; created_at: Date }>(
      `select kind, created_at from request_events where request_id = $1 order by created_at`, [...values],
    );
    return { items: rows.map(row => ({ kind: row.kind, created_at: row.created_at })), count: rowCount ?? 0 };
  }

  async timelineQuestions(values: readonly [string]): Promise<PlanRecords<{
      id: string;
      prompt: string;
      required: boolean;
      status: string;
    }>> {
    const { rows, rowCount } = await this.client.query<{
      id: string;
      prompt: string;
      required: boolean;
      status: string;
    }>(
      `select id, prompt, required, status from info_questions
       where request_id = $1 and status in ('open', 'answered')
       order by created_at`, [...values],
    );
    return { items: rows.map(row => ({ id: row.id, prompt: row.prompt, required: row.required, status: row.status })), count: rowCount ?? 0 };
  }

  async correctionDraft(values: readonly [string]): Promise<PlanRecords<never>> {
    const { rowCount } = await this.client.query<Record<string, never>>(
      `select id from plan_versions where request_id = $1 and status = 'draft'`, [...values],
    );
    return { items: [], count: rowCount ?? 0 };
  }

  async correctionBase(values: readonly [string]): Promise<PlanRecords<{ id: string; version_number: number }>> {
    const { rows, rowCount } = await this.client.query<{ id: string; version_number: number }>(
      `select id, version_number from plan_versions
         where request_id = $1 and status = 'published'
         order by version_number desc limit 1`, [...values],
    );
    return { items: rows.map(row => ({ id: row.id, version_number: row.version_number })), count: rowCount ?? 0 };
  }

  async startCorrection(values: readonly [string]): Promise<PlanRecords<never>> {
    const { rowCount } = await this.client.query<Record<string, never>>(
      `update plan_requests set status = 'in_review', updated_at = now() where id = $1`, [...values],
    );
    return { items: [], count: rowCount ?? 0 };
  }

  async recordCorrection(values: readonly [string, string, string]): Promise<PlanRecords<never>> {
    const { rowCount } = await this.client.query<Record<string, never>>(
      `insert into request_events (id, request_id, actor_id, kind) values ($1, $2, $3, 'correction')`, [...values],
    );
    return { items: [], count: rowCount ?? 0 };
  }

  async patientAssignment(values: readonly [string, string]): Promise<PlanRecords<never>> {
    const { rowCount } = await this.client.query<Record<string, never>>(
      `select id from plan_requests where user_id = $1 and assigned_specialist_id = $2 limit 1`, [...values],
    );
    return { items: [], count: rowCount ?? 0 };
  }

  async patientVersions(values: readonly [string]): Promise<PlanRecords<{
      id: string;
      request_id: string;
      status: string;
      version_number: number;
      published_at: Date | null;
      week_start: string | null;
    }>> {
    const { rows, rowCount } = await this.client.query<{
      id: string;
      request_id: string;
      status: string;
      version_number: number;
      published_at: Date | null;
      week_start: string | null;
    }>(
      `select v.id, v.request_id, v.status, v.version_number, v.published_at, r.week_start::text as week_start
       from plan_versions v
       join plan_requests r on r.id = v.request_id
       where r.user_id = $1 and v.status in ('published', 'superseded')
       order by v.published_at desc nulls last
       limit 50`, [...values],
    );
    return { items: rows.map(row => ({ id: row.id, request_id: row.request_id, status: row.status, version_number: row.version_number, published_at: row.published_at, week_start: row.week_start })), count: rowCount ?? 0 };
  }

  async adminVersion(values: readonly [string]): Promise<PlanRecords<{ id: string; request_id: string; status: string }>> {
    const { rows, rowCount } = await this.client.query<{ id: string; request_id: string; status: string }>(
      `select id, request_id, status from plan_versions where id = $1`, [...values],
    );
    return { items: rows.map(row => ({ id: row.id, request_id: row.request_id, status: row.status })), count: rowCount ?? 0 };
  }

  async recordVersionAccess(values: readonly [string, string, string, string]): Promise<PlanRecords<never>> {
    const { rowCount } = await this.client.query<Record<string, never>>(
      `insert into health_access_logs (id, actor_id, request_id, reason) values ($1, $2, $3, $4)`, [...values],
    );
    return { items: [], count: rowCount ?? 0 };
  }

  async datedVersions(values: readonly [string, string, string]): Promise<PlanRecords<{
      version_id: string;
      request_id: string;
      status: 'published' | 'superseded';
      published_at: Date;
      civil_date: string;
      day_index: number;
    }>> {
    const { rows, rowCount } = await this.client.query<{
      version_id: string;
      request_id: string;
      status: 'published' | 'superseded';
      published_at: Date;
      civil_date: string;
      day_index: number;
    }>(
      `select v.id as version_id, r.id as request_id, v.status, v.published_at,
              d.civil_date::text as civil_date, d.day_index
       from plan_days d
       join plan_versions v on v.id = d.plan_version_id
       join plan_requests r on r.id = v.request_id
       where r.user_id = $1
         and v.status in ('published', 'superseded')
         and v.published_at is not null
         and d.civil_date between $2::date and $3::date`, [...values],
    );
    return { items: rows.map(row => ({ version_id: row.version_id, request_id: row.request_id, status: row.status, published_at: row.published_at, civil_date: row.civil_date, day_index: row.day_index })), count: rowCount ?? 0 };
  }

  async dayMealLogs(values: readonly [string, string, string]): Promise<PlanRecords<{ meal_uid: string; eaten: boolean;plan_version_id:string|null;option_uid:string|null;details:Record<string,unknown>;revision:number }>> {
    const { rows, rowCount } = await this.client.query<{ meal_uid: string; eaten: boolean;plan_version_id:string|null;option_uid:string|null;details:Record<string,unknown>;revision:number }>(
      `select meal_uid, eaten,plan_version_id,option_uid,details,revision from meal_logs
       where user_id = $1 and request_id = $2 and scheduled_date = $3::date`, [...values],
    );
    return { items: rows.map(row => ({ meal_uid: row.meal_uid, eaten: row.eaten, plan_version_id: row.plan_version_id, option_uid: row.option_uid, details: row.details, revision: row.revision })), count: rowCount ?? 0 };
  }

  async dayMealSelections(values: readonly [string, string]): Promise<PlanRecords<{meal_uid:string;option_uid:string;revision:number;version_id:string}>> {
    const { rows, rowCount } = await this.client.query<{meal_uid:string;option_uid:string;revision:number;version_id:string}>(
      `select meal_uid,option_uid,revision,version_id from meal_selections
      where user_id=$1 and civil_date=$2`, [...values],
    );
    return { items: rows.map(row => ({ meal_uid: row.meal_uid, option_uid: row.option_uid, revision: row.revision, version_id: row.version_id })), count: rowCount ?? 0 };
  }

  async lockRequest(values: readonly [string]): Promise<PlanRecords<{
      user_id: string;
      status: string;
      assigned_specialist_id: string | null;
      week_start: string | null;
      effective_from: string | null;
    }>> {
    const { rows, rowCount } = await this.client.query<{
      user_id: string;
      status: string;
      assigned_specialist_id: string | null;
      week_start: string | null;
      effective_from: string | null;
    }>(
      `select user_id, status, assigned_specialist_id, week_start, effective_from
       from plan_requests where id = $1 for update`, [...values],
    );
    return { items: rows.map(row => ({ user_id: row.user_id, status: row.status, assigned_specialist_id: row.assigned_specialist_id, week_start: row.week_start, effective_from: row.effective_from })), count: rowCount ?? 0 };
  }

  async requestDetails(values: readonly [string]): Promise<PlanRecords<{
      id: string;
      user_id: string;
      status: string;
      kind: string;
      price_toman: string;
      week_start: string | null;
      effective_from: string | null;
      display_name: string | null;
    }>> {
    const { rows, rowCount } = await this.client.query<{
      id: string;
      user_id: string;
      status: string;
      kind: string;
      price_toman: string;
      week_start: string | null;
      effective_from: string | null;
      display_name: string | null;
    }>(
      `select r.id, r.user_id, r.status, r.kind, r.price_toman, r.week_start, r.effective_from, u.display_name
       from plan_requests r join users u on u.id = r.user_id where r.id = $1`, [...values],
    );
    return { items: rows.map(row => ({ id: row.id, user_id: row.user_id, status: row.status, kind: row.kind, price_toman: row.price_toman, week_start: row.week_start, effective_from: row.effective_from, display_name: row.display_name })), count: rowCount ?? 0 };
  }

  async requestQuestions(values: readonly [string]): Promise<PlanRecords<{
      id: string;
      prompt: string;
      required: boolean;
      status: string;
    }>> {
    const { rows, rowCount } = await this.client.query<{
      id: string;
      prompt: string;
      required: boolean;
      status: string;
    }>(
      `select id, prompt, required, status from info_questions where request_id = $1 order by created_at`, [...values],
    );
    return { items: rows.map(row => ({ id: row.id, prompt: row.prompt, required: row.required, status: row.status })), count: rowCount ?? 0 };
  }

  async requestAnswers(values: readonly [string]): Promise<PlanRecords<{ question_id: string; body: string; created_at: Date }>> {
    const { rows, rowCount } = await this.client.query<{ question_id: string; body: string; created_at: Date }>(
      `select a.question_id, a.body, a.created_at
       from info_answers a
       join info_questions q on q.id = a.question_id
       where q.request_id = $1
       order by a.created_at`, [...values],
    );
    return { items: rows.map(row => ({ question_id: row.question_id, body: row.body, created_at: row.created_at })), count: rowCount ?? 0 };
  }

  async careConversation(values: readonly [string]): Promise<PlanRecords<{ id: string }>> {
    const { rows, rowCount } = await this.client.query<{ id: string }>(
      `select id from conversations where request_id = $1 and kind = 'care' limit 1`, [...values],
    );
    return { items: rows.map(row => ({ id: row.id })), count: rowCount ?? 0 };
  }

  async reviewVersion(values: readonly [string]): Promise<PlanRecords<{ id: string; version_number:number; status: string; lock_version: number }>> {
    const { rows, rowCount } = await this.client.query<{ id: string; version_number:number; status: string; lock_version: number }>(
      `select id, version_number, status, lock_version from plan_versions
         where request_id = $1 and status in ('draft', 'published')
         order by case when status = 'draft' then 0 else 1 end, version_number desc
         limit 1`, [...values],
    );
    return { items: rows.map(row => ({ id: row.id, version_number: row.version_number, status: row.status, lock_version: row.lock_version })), count: rowCount ?? 0 };
  }

  async generationWarnings(values: readonly [string]): Promise<PlanRecords<{ warnings: unknown }>> {
    const { rows, rowCount } = await this.client.query<{ warnings: unknown }>(
      `select warnings from ai_generations where request_id = $1 order by created_at desc limit 1`, [...values],
    );
    return { items: rows.map(row => ({ warnings: row.warnings })), count: rowCount ?? 0 };
  }

  async requestRiskFlags(values: readonly [string]): Promise<PlanRecords<{ flags: string[] | null }>> {
    const { rows, rowCount } = await this.client.query<{ flags: string[] | null }>(
      `select s.risk_flags as flags from plan_requests r join questionnaire_submissions s on s.id = r.submission_id where r.id = $1`, [...values],
    );
    return { items: rows.map(row => ({ flags: row.flags })), count: rowCount ?? 0 };
  }

  async latestGenerationReview(values: readonly [string]): Promise<PlanRecords<{
      id: string; status: string; provider: string; model: string; pool_code: string | null; prompt_version: string;
      cost_micros: string; tokens: number; skipped_reason: string | null; ai_notes: Record<string, unknown> | null;
      attempt_chain: unknown; warnings: unknown; created_at: Date; attempt_no: number;
    }>> {
    const { rows, rowCount } = await this.client.query<{
      id: string; status: string; provider: string; model: string; pool_code: string | null; prompt_version: string;
      cost_micros: string; tokens: number; skipped_reason: string | null; ai_notes: Record<string, unknown> | null;
      attempt_chain: unknown; warnings: unknown; created_at: Date; attempt_no: number;
    }>(
      `select id, status, provider, model, pool_code, prompt_version, cost_micros::text, tokens, skipped_reason,
              ai_notes, attempt_chain, warnings, created_at, attempt_no
       from ai_generations where request_id = $1 order by created_at desc limit 1`, [...values],
    );
    return { items: rows.map(row => ({ id: row.id, status: row.status, provider: row.provider, model: row.model, pool_code: row.pool_code, prompt_version: row.prompt_version, cost_micros: row.cost_micros, tokens: row.tokens, skipped_reason: row.skipped_reason, ai_notes: row.ai_notes, attempt_chain: row.attempt_chain, warnings: row.warnings, created_at: row.created_at, attempt_no: row.attempt_no })), count: rowCount ?? 0 };
  }
  insertDays(requestId: string, version: number, createdBy: string | null, days: MealInput[][]) {
    return insertDays(this.client, requestId, version, createdBy, days);
  }
  insertDayContents(versionId: string, days: MealInput[][], approver: string | null = null) {
    return insertDayContents(this.client, versionId, days, approver);
  }
  deleteDays(versionId: string) { return deleteDays(this.client, versionId); }
  readDays(versionId: string) { return readDays(this.client, versionId); }
  audit(actorId: string | null, action: string, targetType: string, targetId: string | null, detail: object = {}) {
    return audit(this.client, actorId, action, targetType, targetId, detail);
  }
  notify(userId: string, kind: string, payload: object) { return notify(this.client, userId, kind, payload); }
  insertOutbox(topic: string, aggregateId: string, payload: object) { return insertOutbox(this.client, topic, aggregateId, payload); }
}

export class PostgresPlanRepository extends PostgresPlanSession implements PlanRepository {
  constructor(private readonly pool: Pool) { super(pool); }
  using(client: PoolClient): PlanSession { return new PostgresPlanSession(client); }
  transaction<T>(run: (session: PlanSession) => Promise<T>): Promise<T> {
    return withTransaction(this.pool, client => run(this.using(client)));
  }
  async withGenerationLock<T>(run: () => Promise<T>): Promise<T> {
    const lock = await this.pool.connect();
    try {
      const acquired = await lock.query<{locked: boolean}>('select pg_try_advisory_lock(734821901) as locked');
      if (!acquired.rows[0]?.locked) throw new GenerationError('generation_busy');
      return await run();
    } finally {
      await lock.query('select pg_advisory_unlock(734821901)').catch(() => undefined);
      lock.release();
    }
  }
}

async function insertDays(
  client: Queryable,
  requestId: string,
  versionNumber: number,
  createdBy: string | null,
  days: MealInput[][],
): Promise<string> {
  const versionId = uuidv7();
  await client.query(
    `insert into plan_versions (id, request_id, version_number, status, created_by)
     values ($1, $2, $3, 'draft', $4)`,
    [versionId, requestId, versionNumber, createdBy],
  );
  await client.query(`insert into plan_version_context(version_id,assigned_specialist_id,questionnaire_schema_version,questionnaire_snapshot,replaces_version_id,generation_id)
    select $1,r.assigned_specialist_id,s.schema_version,s.answers,a.version_id,
      (select generation_id from plan_version_context where version_id=a.version_id) from plan_requests r
    join questionnaire_submissions s on s.id=r.submission_id
    left join active_plan_versions a on a.user_id=r.user_id where r.id=$2`, [versionId,requestId]);
  await insertDayContents(client, versionId, days, createdBy);
  return versionId;
}

async function insertDayContents(client: Queryable, versionId: string, days: MealInput[][], approver: string | null = null): Promise<void> {
  for (let index = 0; index < days.length; index += 1) {
    const dayId = uuidv7();
    await client.query(
      `insert into plan_days (id, plan_version_id, day_index) values ($1, $2, $3)`,
      [dayId, versionId, index],
    );
    const meals = days[index] ?? [];
    for (let position = 0; position < meals.length; position += 1) {
      const meal = meals[position]!;
      const mealId = uuidv7();
      await client.query(
        `insert into plan_meals
           (id, plan_day_id, meal_uid, position, meal_type, suggested_time, title, calories, notes)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [mealId, dayId, meal.mealUid, position, meal.mealType, meal.suggestedTime, meal.title, meal.calories, meal.notes],
      );
      for (let itemPosition = 0; itemPosition < meal.items.length; itemPosition += 1) {
        const item = meal.items[itemPosition]!;
        await client.query(
          `insert into plan_meal_items (id, meal_id, position, name, quantity, unit)
           values ($1, $2, $3, $4, $5, $6)`,
          [uuidv7(), mealId, itemPosition, item.name, item.quantity, item.unit],
        );
      }
      for (const option of meal.options ?? []) {
        const approved = option.approved && approver !== null;
        await client.query(`insert into plan_meal_options(meal_id,option_uid,kind,document,approved_by,approved_at)
          values($1,$2,$3,$4::jsonb,$5,case when $5::uuid is null then null else now() end)`,
        [mealId,option.optionId,option.kind,JSON.stringify({...option,approved}),approved ? approver : null]);
      }
    }
  }
}

async function deleteDays(client: Queryable, versionId: string): Promise<void> {
  await client.query(`delete from plan_meal_options where meal_id in
    (select m.id from plan_meals m join plan_days d on d.id=m.plan_day_id where d.plan_version_id=$1)`,[versionId]);
  await client.query(
    `delete from plan_meal_items where meal_id in (
       select m.id from plan_meals m
       join plan_days d on d.id = m.plan_day_id
       where d.plan_version_id = $1
     )`,
    [versionId],
  );
  await client.query(
    `delete from plan_meals where plan_day_id in (select id from plan_days where plan_version_id = $1)`,
    [versionId],
  );
  await client.query(`delete from plan_days where plan_version_id = $1`, [versionId]);
}

async function readDays(client: Queryable, versionId: string) {
  const options = await client.query<{meal_id:string;document:MealOption}>(`select o.meal_id,o.document
    from plan_meal_options o join plan_meals m on m.id=o.meal_id join plan_days d on d.id=m.plan_day_id
    where d.plan_version_id=$1 order by o.kind`,[versionId]);
  const days = await client.query<{ id: string; day_index: number }>(
    `select id, day_index from plan_days where plan_version_id = $1 order by day_index`,
    [versionId],
  );
  const meals = await client.query<{
    id: string;
    plan_day_id: string;
    meal_uid: string;
    position: number;
    meal_type: string;
    suggested_time: string | null;
    title: string;
    calories: number;
    notes: string;
  }>(
    `select m.id, m.plan_day_id, m.meal_uid, m.position, m.meal_type, m.suggested_time, m.title, m.calories, m.notes
     from plan_meals m
     join plan_days d on d.id = m.plan_day_id
     where d.plan_version_id = $1
     order by m.position`,
    [versionId],
  );
  const items = await client.query<{
    meal_id: string;
    position: number;
    name: string;
    quantity: string | null;
    unit: string | null;
  }>(
    `select i.meal_id, i.position, i.name, i.quantity, i.unit
     from plan_meal_items i
     join plan_meals m on m.id = i.meal_id
     join plan_days d on d.id = m.plan_day_id
     where d.plan_version_id = $1
     order by i.position`,
    [versionId],
  );
  return days.rows.map((day) => ({
    id: day.id,
    dayIndex: day.day_index,
    meals: meals.rows
      .filter((meal) => meal.plan_day_id === day.id)
      .map((meal) => ({
        mealUid: meal.meal_uid,
        options: options.rows.filter(o => o.meal_id===meal.id).map(o => o.document),
        mealType: meal.meal_type,
        suggestedTime: meal.suggested_time,
        title: meal.title,
        calories: meal.calories,
        notes: meal.notes,
        items: items.rows
          .filter((item) => item.meal_id === meal.id)
          .map((item) => ({
            name: item.name,
            quantity: item.quantity == null ? null : Number(item.quantity),
            unit: item.unit,
          })),
      })),
  }));
}

