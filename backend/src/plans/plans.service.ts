import { Inject, Injectable } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import {
  PLAN_DRAFT_PROVIDER,
  type DraftNotes,
  type MealDraft,
  type PlanDraft,
  type PlanDraftProvider,
} from '../adapters/plan-draft.js';
import type { Role } from '../common/auth.js';
import { ApiError } from '../common/errors.js';
import { requiredUuid } from '../common/parse.js';
import { uuidv7 } from '../common/id.js';
import { audit, insertOutbox, notify, withTransaction } from '../common/sql.js';
import { addCivilDays, civilNow, fridayOfWeek, tehranDayStartUtc, tehranToday, weekStartSaturday } from '../common/time.js';
import { PROMPT_VERSION, usageCount } from '../ai/cost.js';
import { aiAttempts, aiCostCapHits } from '../metrics/metrics.js';
import { ENV, type Env } from '../config/env.js';
import { PG_POOL } from '../database/database.js';
import { AI_SKIP_FLAGS, type StoredAnswers } from '../questionnaire/schema.js';
import { decryptText, encryptText, openAnswers } from '../common/field-crypto.js';
import { minimizeForModel } from '../ai/minimize.js';
import { draftWarnings } from '../ai/warnings.js';
import { acceptsAnotherAnswer, canWithdrawQuestion, type InfoQuestionStatus } from './questions.js';
import { bucketSql, type QueueBucket } from './queue.js';
import { parseCivilDate, versionForDate, type DatedVersion } from './views.js';
import { parseOptions, requireApprovedOptions, type MealOption } from './options.js';
import { GenerationError } from '../ai/provider-request.js';
import { BudgetService } from '../ai/budget.service.js';
import { loadModelProfile } from '../ai/draft/model-profile.js';
import { OnboardingService } from '../onboarding/onboarding.service.js';

const MEAL_TYPES = new Set(['breakfast', 'lunch', 'dinner', 'snack']);
const MEAL_ALIASES: Record<string, string> = {
  breakfast: 'breakfast',
  lunch: 'lunch',
  dinner: 'dinner',
  snack: 'snack',
  صبحانه: 'breakfast',
  ناهار: 'lunch',
  شام: 'dinner',
  'میان‌وعده': 'snack',
};

interface DayInput {
  meals: MealInput[];
}
interface MealInput {
  options?: MealOption[];
  mealUid: string;
  mealType: string;
  suggestedTime: string | null;
  title: string;
  calories: number;
  notes: string;
  items: Array<{ name: string; quantity: number | null; unit: string | null }>;
}

@Injectable()
export class PlanDraftService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    @Inject(PLAN_DRAFT_PROVIDER) private readonly provider: PlanDraftProvider,
    @Inject(ENV) private readonly env: Env,
    @Inject(BudgetService) private readonly budget: BudgetService,
    @Inject(OnboardingService) private readonly onboarding: OnboardingService,
  ) {}

  async generate(requestId: string, options: { regenerate?: boolean } = {}): Promise<void> {
    const lock=await this.pool.connect();
    try {
      // Keep the cap check, provider call and persisted cost in one serial lane.
      const acquired=await lock.query<{locked:boolean}>('select pg_try_advisory_lock(734821901) as locked');
      if(!acquired.rows[0]?.locked)throw new GenerationError('generation_busy');
      await this.generateClaimed(requestId, options.regenerate === true);
    } finally {
      await lock.query('select pg_advisory_unlock(734821901)').catch(()=>undefined);
      lock.release();
    }
  }

  private async generateClaimed(requestId: string, regenerate = false): Promise<void> {
    const claimed = await withTransaction(this.pool, async (client) => {
      const row = await client.query<{
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
         for update of r`,
        [requestId],
      );
      const request = row.rows[0];
      if (!request || (request.status !== 'queued' && request.status !== 'generating')) return null;
      const existing = await client.query(`select id from plan_versions where request_id = $1 limit 1`, [requestId]);
      if (!regenerate && (existing.rowCount ?? 0) > 0) {
        await client.query(
          `update plan_requests set status = 'in_review', updated_at = now() where id = $1 and status <> 'cancelled'`,
          [requestId],
        );
        return null;
      }
      const claim=await client.query(`insert into ai_execution_claims(request_id,status) values($1,'started')
        on conflict(request_id) do nothing returning request_id`,[requestId]);
      if (!claim.rowCount) {
        // Maintenance may requeue an interrupted job. Never repeat an uncertain
        // paid call; recover an editable blank week for specialist completion.
        if(request.status==='queued') {
          await insertDays(client,requestId,1,null,emptyDraft());
          await client.query("update plan_requests set status='in_review',updated_at=now() where id=$1",[requestId]);
          await client.query("update ai_execution_claims set status='failed',finished_at=now(),error_code='provider_outcome_unknown' where request_id=$1",[requestId]);
          await client.query(`insert into ai_generations(id,request_id,provider,status,skipped_reason)
            values($1,$2,'unknown','failed','provider_outcome_unknown')`,[uuidv7(),requestId]);
        }
        return null;
      }
      await client.query(
        `update plan_requests set status = 'generating', updated_at = now() where id = $1`,
        [requestId],
      );
      return request;
    });
    if (!claimed) return;

    const highRisk = claimed.flags.some((flag) => (AI_SKIP_FLAGS as readonly string[]).includes(flag));
    const blocked = highRisk ? null : await this.budget.preflight(claimed.user_id);
    const skipReason = highRisk ? 'high_risk' : blocked?.reason ?? null;
    let draft = emptyDraft();
    let aiStatus: 'drafted' | 'skipped' | 'failed' = skipReason ? 'skipped' : 'drafted';
    let reason: string | null = skipReason;
    let providerName = skipReason ? 'none' : this.provider.name;
    let rawOutput: string | null = null;
    let model = '';
    let promptVersion = PROMPT_VERSION;
    let tokens = 0;
    let costMicros = 0;
    let latencyMs = 0;
    let poolCode: string | null = null;
    const opened = openAnswers(claimed.answers, this.env.FIELD_KEY);
    const minimized = minimizeForModel(opened, requestId, {
      userId: claimed.user_id,
      phone: claimed.phone_e164,
      name: opened.name,
    });
    const history=(await this.pool.query(`select count(*)::int as recorded,
      count(*) filter(where eaten)::int as eaten,count(distinct scheduled_date)::int as days
      from meal_logs where user_id=$1 and scheduled_date>=$2::date-7 and scheduled_date<$2::date`,
    [claimed.user_id,tehranToday()])).rows[0];
    minimized.history={recordedMeals:history.recorded,eatenMeals:history.eaten,daysWithRecords:history.days,cutoff:civilNow().toISOString()};
    let notes: DraftNotes | null = null;
    if (!skipReason) {
      const started = Date.now();
      try {
        await this.onboarding.ensureProfile(claimed.user_id).catch(() => null);
        const profile = await loadModelProfile(this.pool, claimed.user_id);
        if (profile) minimized.profile = profile;
        const produced = await this.provider.draft({ ...minimized, requestId });
        notes = produced.notes ?? null;
        poolCode = produced.notes?.poolCode ?? null;
        latencyMs = Date.now() - started;
        rawOutput = encryptText(JSON.stringify(produced), this.env.FIELD_KEY);
        providerName = produced.provider ?? providerName;
        model = produced.usage?.model ?? '';
        promptVersion = produced.usage?.promptVersion || PROMPT_VERSION;
        tokens = usageCount(produced.usage?.tokens);
        costMicros = usageCount(produced.usage?.costMicros);
        if (isUsable(produced)) draft = producedToInput(produced);
        else {
          aiStatus = 'failed';
          reason = 'invalid_draft';
        }
      } catch (error) {
        latencyMs = Math.max(0, Date.now() - started);
        aiStatus = 'failed';
        reason = error instanceof GenerationError ? error.code : 'provider_error';
        if (error instanceof GenerationError && error.usage) {
          // Calls that were made are paid for even when no plan came out of them.
          tokens = usageCount(error.usage.tokens);
          costMicros = usageCount(error.usage.costMicros);
          model = error.usage.model || model;
          providerName = error.usage.provider || providerName;
        }
      }
    }
    const warnings = aiStatus === 'drafted' ? draftWarnings(draft, opened.allergies ?? '', opened.dislikes ?? '') : [];

    await withTransaction(this.pool, async (client) => {
      const current = await client.query<{ status: string }>(
        `select status from plan_requests where id = $1 for update`,
        [requestId],
      );
      if (current.rows[0]?.status !== 'generating') {
        await client.query("update ai_execution_claims set status='failed',finished_at=now(),error_code='provider_outcome_unknown' where request_id=$1",[requestId]);
        await client.query(`insert into ai_generations(id,request_id,provider,status,skipped_reason,cost_micros,tokens,model)
          values($1,$2,$3,'failed','cancelled_after_generation',$4,$5,$6)`,[uuidv7(),requestId,providerName,costMicros,tokens,model]);
        return;
      }
      const existing = await client.query<{ id: string }>(
        `select id from plan_versions where request_id = $1 and ($2::boolean = false or status = 'draft') limit 1`,
        [requestId, regenerate],
      );
      if (regenerate) {
        // A doctor asked for a fresh draft: swap the week in place, and keep the old one when this run produced nothing.
        const target = existing.rows[0];
        if (target && aiStatus === 'drafted') {
          await deleteDays(client, target.id);
          await insertDayContents(client, target.id, draft, null);
          await client.query('update plan_versions set lock_version = lock_version + 1 where id = $1', [target.id]);
        }
      } else {
        if ((existing.rowCount ?? 0) > 0) return;
        await insertDays(client, requestId, 1, null, draft);
      }
      await client.query(`update ai_execution_claims set status=$2,finished_at=now(),error_code=$3 where request_id=$1`,
        [requestId,aiStatus==='failed'?'failed':'completed',reason]);
      await client.query(
        `update plan_requests set status = 'in_review', updated_at = now() where id = $1`,
        [requestId],
      );
      const attempt = await client.query<{ n: number }>(
        `select coalesce(max(attempt_no), 0) + 1 as n from ai_generations where request_id = $1`,
        [requestId],
      );
      const generation = await client.query<{id:string}>(
        `insert into ai_generations
           (id, request_id, provider, status, skipped_reason, raw_output, attempt_no, model,
            prompt_version, schema_version, tokens, latency_ms, cost_micros, warnings,
            pool_code, attempt_chain, ai_notes)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, $15, $16::jsonb, $17::jsonb) returning id`,
        [
          uuidv7(),
          requestId,
          providerName,
          aiStatus,
          reason,
          rawOutput,
          attempt.rows[0]?.n ?? 1,
          model,
          promptVersion,
          claimed.schema_version,
          tokens,
          latencyMs,
          costMicros,
          JSON.stringify(warnings),
          poolCode,
          notes ? JSON.stringify(notes.attemptChain) : null,
          notes ? JSON.stringify({ ...notes, attemptChain: undefined }) : null,
        ],
      );
      await client.query(`update plan_version_context set generation_id=$2 where version_id in
        (select id from plan_versions where request_id=$1 and status='draft')`,[requestId,generation.rows[0]!.id]);
      if (reason === 'cost_cap' && blocked) {
        const dayStart = tehranDayStartUtc();
        const prior = await client.query(
          `select id from audit_logs where action = 'ai_cost_cap' and created_at >= $1 limit 1`,
          [dayStart],
        );
        if ((prior.rowCount ?? 0) === 0) {
          await audit(client, null, 'ai_cost_cap', 'ai_controls', null, {
            spentMicros: blocked.spentMicros,
            capMicros: blocked.capMicros,
          });
        }
        aiCostCapHits.inc();
      }
      aiAttempts.inc({ status: aiStatus });
      await client.query(
        `insert into request_events (id, request_id, kind, detail) values ($1, $2, $3, $4::jsonb)`,
        [uuidv7(), requestId, aiStatus === 'drafted' ? 'ai_drafted' : 'ai_skipped', JSON.stringify({ status: aiStatus })],
      );
      if (claimed.specialist_id) {
        await notify(client, claimed.specialist_id, 'draft_ready', { requestId });
      }
    });
  }

  async copyPublishedDraft(client: PoolClient, parentRequestId: string, requestId: string): Promise<void> {
    const version = await client.query<{ id: string }>(
      `select id from plan_versions where request_id = $1 and status = 'published'`,
      [parentRequestId],
    );
    if (!version.rows[0]) throw new ApiError(409, 'no_published_plan', 'برنامهٔ تأییدشده‌ای برای اصلاح نیست');
    const days = await readDays(client, version.rows[0].id);
    await insertDays(
      client,
      requestId,
      1,
      null,
      days.map((day) => day.meals.map((meal) => ({ ...meal, options:meal.options?.map(o=>({...o,approved:false})) }))),
    );
  }

  async queue(specialistId: string, bucket: QueueBucket | null = null) {
    const filter = bucket ? `and ${bucketSql(bucket)}` : '';
    const rows = await this.pool.query<{
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
       limit 100`,
      [specialistId],
    );
    return rows.rows.map((row) => ({
      id: row.id,
      status: row.status,
      kind: row.kind,
      createdAt: row.created_at.toISOString(),
      displayName: row.display_name,
    }));
  }

  async userRequest(userId: string) {
    const row = await this.pool.query<{ id: string }>(
      `select id from plan_requests where user_id = $1 order by created_at desc limit 1`,
      [userId],
    );
    if (!row.rows[0]) return null;
    return this.presentRequest(row.rows[0].id, false);
  }

  async staffRequest(actorId: string, role: Role, requestId: string, reason: string | null) {
    if (role === 'admin' && (!reason || reason.trim().length < 3)) {
      throw new ApiError(400, 'reason_required', 'دلیل مشاهده را بنویسید');
    }
    const access = await this.pool.query<{ assigned_specialist_id: string | null }>(
      `select assigned_specialist_id from plan_requests where id = $1`,
      [requestId],
    );
    const request = access.rows[0];
    if (!request) throw new ApiError(404, 'not_found', 'درخواست پیدا نشد');
    if (role === 'specialist' && request.assigned_specialist_id !== actorId) {
      throw new ApiError(404, 'not_found', 'درخواست پیدا نشد');
    }
    await this.pool.query(
      `insert into health_access_logs (id, actor_id, request_id, reason) values ($1, $2, $3, $4)`,
      [uuidv7(), actorId, requestId, reason],
    );
    return this.presentRequest(requestId, true);
  }

  async replaceDraft(actorId: string, role: Role, requestId: string, lock: number, body: unknown) {
    const days = parseDays(body);
    if (role !== 'specialist' && days.flat().some(m => m.options?.some(o => o.approved))) {
      throw new ApiError(403, 'forbidden', 'تأیید گزینه فقط با متخصص است');
    }
    return withTransaction(this.pool, async (client) => {
      const request = await this.lockRequest(client, actorId, role, requestId);
      if (request.status === 'cancelled' || request.status === 'queued' || request.status === 'generating') {
        throw new ApiError(409, 'not_ready', 'پیش‌نویس هنوز آمادهٔ ویرایش نیست');
      }
      const versions = await client.query<{ id: string; status: string; lock_version: number; version_number: number }>(
        `select id, status, lock_version, version_number
         from plan_versions where request_id = $1 order by version_number desc`,
        [requestId],
      );
      const draft = versions.rows.find((version) => version.status === 'draft');
      const published = versions.rows.find((version) => version.status === 'published');
      let versionId = draft?.id;
      if (draft) {
        if (draft.lock_version !== lock) throw new ApiError(409, 'lock_conflict', 'نسخهٔ برنامه تغییر کرده است');
        await deleteDays(client, draft.id);
        await client.query(
          `update plan_versions set lock_version = lock_version + 1 where id = $1 and lock_version = $2`,
          [draft.id, lock],
        );
      } else if (published) {
        if (published.lock_version !== lock) throw new ApiError(409, 'lock_conflict', 'نسخهٔ برنامه تغییر کرده است');
        versionId = await insertDays(client, requestId, published.version_number + 1, actorId, days);
        await client.query(
          `update plan_requests set status = 'in_review', updated_at = now() where id = $1 and status = 'published'`,
          [requestId],
        );
      } else {
        throw new ApiError(409, 'not_ready', 'پیش‌نویس هنوز آمادهٔ ویرایش نیست');
      }
      if (draft) await insertDayContents(client, draft.id, days, role === 'specialist' ? actorId : null);
      await client.query(
        `insert into request_events (id, request_id, actor_id, kind) values ($1, $2, $3, 'draft_edited')`,
        [uuidv7(), requestId, actorId],
      );
      const current = await client.query<{ lock_version: number }>(
        `select lock_version from plan_versions where id = $1`,
        [versionId],
      );
      return { lockVersion: current.rows[0]?.lock_version ?? lock + 1 };
    });
  }

  /**
   * Doctor-initiated redraft. Validates synchronously, flips the request to `generating`, then runs the
   * pipeline in the background; the editor polls the request until it is back in review.
   */
  async regenerate(actorId: string, requestId: string, lock: number): Promise<{ status: 'generating' }> {
    await withTransaction(this.pool, async (client) => {
      const request = await this.lockRequest(client, actorId, 'specialist', requestId);
      if (request.status !== 'in_review') throw new ApiError(409, 'not_ready', 'فقط پیش‌نویس در حال بررسی را می‌توان دوباره ساخت');
      const versions = await client.query<{ id: string; status: string; lock_version: number }>(
        `select id, status, lock_version from plan_versions where request_id = $1 order by version_number desc`,
        [requestId],
      );
      const draft = versions.rows.find((v) => v.status === 'draft');
      if (!draft) throw new ApiError(409, 'not_ready', 'پیش‌نویسی برای ساخت دوباره نیست');
      if (draft.lock_version !== lock) throw new ApiError(409, 'lock_conflict', 'نسخهٔ برنامه تغییر کرده است');
      const flags = await client.query<{ flags: string[] }>(
        `select s.risk_flags as flags from plan_requests r join questionnaire_submissions s on s.id = r.submission_id where r.id = $1`,
        [requestId],
      );
      if ((flags.rows[0]?.flags ?? []).some((f) => (AI_SKIP_FLAGS as readonly string[]).includes(f))) {
        throw new ApiError(409, 'high_risk', 'این پرونده پرخطر است و باید کامل توسط متخصص نوشته شود');
      }
      const blocked = await this.budget.preflight(request.user_id);
      if (blocked) throw new ApiError(409, 'ai_budget_blocked', 'سقف هزینهٔ هوش مصنوعی اجازهٔ ساخت دوباره نمی‌دهد');
      await client.query(`delete from ai_execution_claims where request_id = $1`, [requestId]);
      await client.query(`update plan_requests set status = 'generating', updated_at = now() where id = $1`, [requestId]);
      await client.query(
        `insert into request_events (id, request_id, actor_id, kind) values ($1, $2, $3, 'draft_regenerate_requested')`,
        [uuidv7(), requestId, actorId],
      );
    });
    void this.generate(requestId, { regenerate: true }).catch(async () => {
      await this.pool.query(`update plan_requests set status = 'in_review', updated_at = now() where id = $1 and status = 'generating'`, [requestId]).catch(() => undefined);
    });
    return { status: 'generating' };
  }

  async publish(actorId: string, role: Role, requestId: string, lock: number, existing?: PoolClient) {
    if (role !== 'specialist') {
      throw new ApiError(403, 'forbidden', 'انتشار برنامه فقط با متخصص است');
    }
    const run = async (client: PoolClient) => {
      const profile = await client.query<{ active: boolean; verification_status: string }>(
        `select active, verification_status from specialist_profiles where user_id = $1`,
        [actorId],
      );
      const specialist = profile.rows[0];
      if (!specialist || !specialist.active || specialist.verification_status !== 'verified') {
        throw new ApiError(403, 'not_verified', 'فقط متخصص تأییدشده و فعال می‌تواند برنامه را منتشر کند');
      }
      const request = await this.lockRequest(client, actorId, role, requestId);
      // Serializes active-pointer replacement across different requests of one owner.
      await client.query('select id from users where id=$1 for update', [request.user_id]);
      if (request.status !== 'in_review') {
        throw new ApiError(409, 'info_required', 'تا بسته شدن سؤال‌ها نمی‌توان برنامه را تأیید کرد');
      }
      const blocking = await client.query(
        `select id from info_questions
         where request_id = $1 and required = true and status in ('open', 'answered')`,
        [requestId],
      );
      if ((blocking.rowCount ?? 0) > 0) {
        throw new ApiError(409, 'info_required', 'تا بسته شدن سؤال‌ها نمی‌توان برنامه را تأیید کرد');
      }
      const draft = await client.query<{ id: string; lock_version: number }>(
        `select id, lock_version from plan_versions
         where request_id = $1 and status = 'draft'
         order by version_number desc limit 1`,
        [requestId],
      );
      const version = draft.rows[0];
      if (!version) throw new ApiError(409, 'plan_incomplete', 'پیش‌نویسی برای تأیید نیست');
      if (version.lock_version !== lock) throw new ApiError(409, 'lock_conflict', 'نسخهٔ برنامه تغییر کرده است');
      const base = await client.query(`select 1 from plan_version_context c join plan_requests r on r.id=$2
        left join active_plan_versions a on a.user_id=r.user_id where c.version_id=$1
        and c.replaces_version_id is not distinct from a.version_id`,[version.id,requestId]);
      if (!base.rowCount) throw new ApiError(409,'lock_conflict','برنامه فعال تغییر کرده است؛ پیش‌نویس باید بازبینی شود');
      const days = await readDays(client, version.id);
      assertPublishable(days);
      for (const day of days) for (const meal of day.meals) requireApprovedOptions(meal.options);
      await client.query(`update plan_version_context set assigned_specialist_id=$2,review_completed_at=now()
        where version_id=$1`, [version.id,actorId]);
      const today = tehranToday();
      const weekStart = request.week_start ?? weekStartSaturday(today);
      const effectiveFrom = request.effective_from ?? today;
      if (today > fridayOfWeek(weekStart)) throw new ApiError(409,'week_closed','هفته این برنامه پایان یافته است');
      for (const day of days) {
        await client.query(`update plan_days set civil_date = $2 where id = $1`, [
          day.id,
          addCivilDays(weekStart, day.dayIndex),
        ]);
      }
      await client.query(
        `update plan_versions set status = 'superseded'
         where request_id = $1 and status = 'published'`,
        [requestId],
      );
      await client.query(
        `update plan_versions set status = 'published', published_at = $2 where id = $1`,
        [version.id,civilNow()],
      );
      await client.query(
        `update plan_requests
         set status = 'published', week_start = coalesce(week_start, $2::date),
             effective_from = coalesce(effective_from, $3::date), updated_at = now()
         where id = $1`,
        [requestId, weekStart, effectiveFrom],
      );
      await client.query(
        `insert into request_events (id, request_id, actor_id, kind) values ($1, $2, $3, 'published')`,
        [uuidv7(), requestId, actorId],
      );
      await notify(client, request.user_id, 'plan_published', { requestId });
      await insertOutbox(client,'shopping.invalidate',request.user_id,{requestId,versionId:version.id});
      await client.query(`insert into active_plan_versions(user_id,version_id) values($1,$2)
        on conflict(user_id) do update set version_id=excluded.version_id,updated_at=now()`, [request.user_id,version.id]);
      return { status: 'published' as const, versionId: version.id };
    };
    return existing ? run(existing) : withTransaction(this.pool, run);
  }

  async ask(actorId: string, role: Role, requestId: string, prompt: string, required: boolean) {
    return withTransaction(this.pool, async (client) => {
      const request = await this.lockRequest(client, actorId, role, requestId);
      if (request.status === 'cancelled' || request.status === 'queued' || request.status === 'generating') {
        throw new ApiError(409, 'not_ready', 'هنوز نمی‌توان سؤال پرسید');
      }
      const id = uuidv7();
      await client.query(
        `insert into info_questions (id, request_id, specialist_id, prompt, required, status)
         values ($1, $2, $3, $4, $5, 'open')`,
        [id, requestId, actorId, encryptText(prompt, this.env.FIELD_KEY), required],
      );
      if (required) {
        await client.query(
          `update plan_requests set status = 'awaiting_user', updated_at = now() where id = $1`,
          [requestId],
        );
      }
      await client.query(
        `insert into request_events (id, request_id, actor_id, kind) values ($1, $2, $3, 'info_question')`,
        [uuidv7(), requestId, actorId],
      );
      await notify(client, request.user_id, 'info_requested', { requestId, questionId: id });
      return { id, status: required ? 'awaiting_user' : request.status };
    });
  }

  async answer(userId: string, questionId: string, body: string) {
    return withTransaction(this.pool, async (client) => {
      const question = await client.query<{
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
         for update of q`,
        [questionId],
      );
      const row = question.rows[0];
      if (!row || row.user_id !== userId) throw new ApiError(404, 'not_found', 'سؤال پیدا نشد');
      if (!acceptsAnotherAnswer(row.status)) {
        throw new ApiError(409, 'already_answered', 'به این سؤال قبلاً پاسخ داده شده است');
      }
      await client.query(
        `insert into info_answers (id, question_id, author_id, body) values ($1, $2, $3, $4)`,
        [uuidv7(), questionId, userId, encryptText(body, this.env.FIELD_KEY)],
      );
      if (row.status === 'open') {
        await client.query(`update info_questions set status = 'answered' where id = $1`, [questionId]);
        const open = await client.query(
          `select id from info_questions where request_id = $1 and required = true and status = 'open'`,
          [row.request_id],
        );
        if ((open.rowCount ?? 0) === 0) {
          await client.query(
            `update plan_requests set status = 'response_received', updated_at = now() where id = $1`,
            [row.request_id],
          );
        }
      }
      if (row.specialist_id) await notify(client, row.specialist_id, 'info_answered', { requestId: row.request_id, questionId });
      return { status: 'answered' as const };
    });
  }

  async acknowledge(actorId: string, role: Role, questionId: string) {
    return withTransaction(this.pool, async (client) => {
      const question = await client.query<{
        request_id: string;
        status: string;
        assigned_specialist_id: string | null;
      }>(
        `select q.request_id, q.status, r.assigned_specialist_id
         from info_questions q
         join plan_requests r on r.id = q.request_id
         where q.id = $1
         for update of q`,
        [questionId],
      );
      const row = question.rows[0];
      if (!row) throw new ApiError(404, 'not_found', 'سؤال پیدا نشد');
      if (role === 'specialist' && row.assigned_specialist_id !== actorId) {
        throw new ApiError(404, 'not_found', 'سؤال پیدا نشد');
      }
      if (row.status !== 'answered') {
        throw new ApiError(409, 'not_answered', 'هنوز پاسخی برای تأیید نیست');
      }
      await client.query(`update info_questions set status = 'acknowledged' where id = $1`, [questionId]);
      const blocking = await client.query(
        `select id from info_questions
         where request_id = $1 and required = true and status in ('open', 'answered')`,
        [row.request_id],
      );
      if ((blocking.rowCount ?? 0) === 0) {
        await client.query(
          `update plan_requests set status = 'in_review', updated_at = now() where id = $1`,
          [row.request_id],
        );
      }
      return { status: 'acknowledged' as const };
    });
  }

  async questionsForUser(userId: string, status: InfoQuestionStatus) {
    const rows = await this.pool.query<{
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
       limit 100`,
      [userId, status],
    );
    return rows.rows.map((row) => ({
      id: row.id,
      requestId: row.request_id,
      prompt: decryptText(row.prompt, this.env.FIELD_KEY),
      required: row.required,
      status: row.status,
      createdAt: row.created_at.toISOString(),
    }));
  }

  async withdraw(actorId: string, role: Role, questionId: string, reason: string) {
    return withTransaction(this.pool, async (client) => {
      const question = await client.query<{
        request_id: string;
        status: string;
        assigned_specialist_id: string | null;
      }>(
        `select q.request_id, q.status, r.assigned_specialist_id
         from info_questions q
         join plan_requests r on r.id = q.request_id
         where q.id = $1
         for update of q`,
        [questionId],
      );
      const row = question.rows[0];
      if (!row) throw new ApiError(404, 'not_found', 'سؤال پیدا نشد');
      if (role === 'specialist' && row.assigned_specialist_id !== actorId) {
        throw new ApiError(404, 'not_found', 'سؤال پیدا نشد');
      }
      if (!canWithdrawQuestion(row.status)) {
        throw new ApiError(409, 'not_open', 'این سؤال دیگر قابل پس‌گرفتن نیست');
      }
      await client.query(`update info_questions set status = 'withdrawn' where id = $1`, [questionId]);
      const blocking = await client.query(
        `select id from info_questions
         where request_id = $1 and required = true and status in ('open', 'answered')`,
        [row.request_id],
      );
      if ((blocking.rowCount ?? 0) === 0) {
        await client.query(
          `update plan_requests set status = 'in_review', updated_at = now()
           where id = $1 and status in ('awaiting_user', 'response_received')`,
          [row.request_id],
        );
      }
      await client.query(
        `insert into request_events (id, request_id, actor_id, kind, detail)
         values ($1, $2, $3, 'info_withdrawn', $4::jsonb)`,
        [uuidv7(), row.request_id, actorId, JSON.stringify({ reason })],
      );
      return { status: 'withdrawn' as const };
    });
  }

  async publishedPlan(userId: string) {
    const found = await this.pool.query<{
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
       limit 1`,
      [userId],
    );
    const request = found.rows[0];
    if (!request) return null;
    const today = tehranToday();
    const friday = addCivilDays(request.week_start, 6);
    const week = await this.planWeek(userId,request.week_start);
    return {
      requestId: request.id,
      versionId: request.version_id,
      weekStart: request.week_start,
      effectiveFrom: request.effective_from,
      expired: today > friday,
      days: week.days.map((day,dayIndex)=>({...day,dayIndex,meals:day.meals.map(meal=>({...meal,
        loggable:day.date===today && day.date>=request.effective_from && today<=friday,
      }))})),
    };
  }

  async planWeek(userId: string, weekStart: string) {
    const date = parseCivilDate(weekStart);
    if (!date || weekStartSaturday(date) !== date) {
      throw new ApiError(400, 'validation', 'هفته باید از شنبه شروع شود');
    }
    const friday = fridayOfWeek(date);
    const rows = await this.datedVersions(userId, date, friday);
    const days = [];
    const loaded = new Map<string, Awaited<ReturnType<typeof readDays>>>();
    for (let index = 0; index < 7; index += 1) {
      days.push(await this.presentCivilDay(userId, addCivilDays(date, index), rows, loaded));
    }
    return { weekStart: date, days };
  }

  async planDay(userId: string, rawDate: string) {
    const date = parseCivilDate(rawDate);
    if (!date) throw new ApiError(400, 'validation', 'تاریخ درست نیست');
    const rows = await this.datedVersions(userId, date, date);
    return this.presentCivilDay(userId, date, rows, new Map());
  }

  async listRequests(userId: string) {
    const rows = await this.pool.query<{
      id: string;
      status: string;
      kind: string;
      price_toman: string;
      created_at: Date;
    }>(
      `select id, status, kind, price_toman, created_at
       from plan_requests where user_id = $1
       order by created_at desc
       limit 50`,
      [userId],
    );
    return rows.rows.map((row) => ({
      id: row.id,
      status: row.status,
      kind: row.kind,
      priceToman: Number(row.price_toman),
      createdAt: row.created_at.toISOString(),
    }));
  }

  async requestTimeline(userId: string, requestId: string) {
    const found = await this.pool.query<{
      id: string;
      status: string;
      kind: string;
      price_toman: string;
      created_at: Date;
    }>(
      `select id, status, kind, price_toman, created_at
       from plan_requests where id = $1 and user_id = $2`,
      [requestId, userId],
    );
    const request = found.rows[0];
    if (!request) throw new ApiError(404, 'not_found', 'درخواست پیدا نشد');
    const events = await this.pool.query<{ kind: string; created_at: Date }>(
      `select kind, created_at from request_events where request_id = $1 order by created_at`,
      [requestId],
    );
    const questions = await this.pool.query<{
      id: string;
      prompt: string;
      required: boolean;
      status: string;
    }>(
      `select id, prompt, required, status from info_questions
       where request_id = $1 and status in ('open', 'answered')
       order by created_at`,
      [requestId],
    );
    return {
      id: request.id,
      status: request.status,
      kind: request.kind,
      priceToman: Number(request.price_toman),
      createdAt: request.created_at.toISOString(),
      events: events.rows.map((event) => ({ kind: event.kind, createdAt: event.created_at.toISOString() })),
      questions: questions.rows.map((question) => ({
        id: question.id,
        prompt: decryptText(question.prompt, this.env.FIELD_KEY),
        required: question.required,
        status: question.status,
      })),
    };
  }

  async correct(actorId: string, requestId: string) {
    return withTransaction(this.pool, async (client) => {
      const request = await this.lockRequest(client, actorId, 'specialist', requestId);
      if (request.status !== 'published' || !request.week_start) {
        throw new ApiError(409, 'not_published', 'فقط برنامهٔ منتشرشدهٔ این هفته اصلاح می‌شود');
      }
      if (tehranToday() > fridayOfWeek(request.week_start)) {
        throw new ApiError(409, 'week_closed', 'هفتهٔ این برنامه تمام شده است');
      }
      const draft = await client.query(
        `select id from plan_versions where request_id = $1 and status = 'draft'`,
        [requestId],
      );
      if ((draft.rowCount ?? 0) > 0) throw new ApiError(409, 'correction_open', 'یک اصلاح باز وجود دارد');
      const published = await client.query<{ id: string; version_number: number }>(
        `select id, version_number from plan_versions
         where request_id = $1 and status = 'published'
         order by version_number desc limit 1`,
        [requestId],
      );
      const version = published.rows[0];
      if (!version) throw new ApiError(409, 'not_published', 'برنامهٔ منتشرشده‌ای نیست');
      const days = await readDays(client, version.id);
      await insertDays(
        client,
        requestId,
        version.version_number + 1,
        actorId,
        days.map((day) => day.meals.map(meal=>({...meal,options:meal.options?.map(o=>({...o,approved:false}))}))),
      );
      await client.query(
        `update plan_requests set status = 'in_review', updated_at = now() where id = $1`,
        [requestId],
      );
      await client.query(
        `insert into request_events (id, request_id, actor_id, kind) values ($1, $2, $3, 'correction')`,
        [uuidv7(), requestId, actorId],
      );
      return { status: 'in_review' as const };
    });
  }

  async patientPlanVersions(actorId: string, patientId: string) {
    const assigned = await this.pool.query(
      `select id from plan_requests where user_id = $1 and assigned_specialist_id = $2 limit 1`,
      [patientId, actorId],
    );
    if ((assigned.rowCount ?? 0) === 0) throw new ApiError(404, 'not_found', 'بیمار پیدا نشد');
    const rows = await this.pool.query<{
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
       limit 50`,
      [patientId],
    );
    return rows.rows.map((row) => ({
      id: row.id,
      requestId: row.request_id,
      status: row.status,
      versionNumber: row.version_number,
      publishedAt: row.published_at ? row.published_at.toISOString() : null,
      weekStart: row.week_start,
    }));
  }

  async adminPlanVersion(actorId: string, versionId: string, reason: string | null) {
    if (!reason || reason.trim().length < 3) {
      throw new ApiError(400, 'reason_required', 'دلیل مشاهده را بنویسید');
    }
    const found = await this.pool.query<{ id: string; request_id: string; status: string }>(
      `select id, request_id, status from plan_versions where id = $1`,
      [versionId],
    );
    const version = found.rows[0];
    if (!version || version.status === 'draft') throw new ApiError(404, 'not_found', 'نسخهٔ برنامه پیدا نشد');
    await this.pool.query(
      `insert into health_access_logs (id, actor_id, request_id, reason) values ($1, $2, $3, $4)`,
      [uuidv7(), actorId, version.request_id, reason.trim()],
    );
    const days = await readDays(this.pool, version.id);
    return {
      id: version.id,
      requestId: version.request_id,
      status: version.status,
      days: days.map((day) => ({ dayIndex: day.dayIndex, meals: day.meals })),
    };
  }

  private async datedVersions(userId: string, from: string, to: string): Promise<DatedVersion[]> {
    const rows = await this.pool.query<{
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
         and d.civil_date between $2::date and $3::date`,
      [userId, from, to],
    );
    return rows.rows.map((row) => ({
      versionId: row.version_id,
      requestId: row.request_id,
      status: row.status,
      publishedAt: row.published_at.toISOString(),
      publishedOn: tehranToday(row.published_at),
      civilDate: row.civil_date.slice(0, 10),
      dayIndex: row.day_index,
    }));
  }

  private async presentCivilDay(
    userId: string,
    date: string,
    rows: DatedVersion[],
    loaded: Map<string, Awaited<ReturnType<typeof readDays>>>,
  ) {
    const chosen = versionForDate(rows, date);
    if (!chosen) {
      return { date, requestId: null, versionId: null, versionStatus: null, meals: [] };
    }
    let days = loaded.get(chosen.versionId);
    if (!days) {
      days = await readDays(this.pool, chosen.versionId);
      loaded.set(chosen.versionId, days);
    }
    const day = days.find((item) => item.dayIndex === chosen.dayIndex);
    const logs = await this.pool.query<{ meal_uid: string; eaten: boolean;plan_version_id:string|null;option_uid:string|null;details:Record<string,unknown>;revision:number }>(
      `select meal_uid, eaten,plan_version_id,option_uid,details,revision from meal_logs
       where user_id = $1 and request_id = $2 and scheduled_date = $3::date`,
      [userId, chosen.requestId, date],
    );
    const eaten = new Map(logs.rows.map((row) => [row.meal_uid, row.eaten]));
    const selections=(await this.pool.query<{meal_uid:string;option_uid:string;revision:number;version_id:string}>(`select meal_uid,option_uid,revision,version_id from meal_selections
      where user_id=$1 and civil_date=$2`,[userId,date])).rows;
    return {
      date,
      requestId: chosen.requestId,
      versionId: chosen.versionId,
      versionStatus: chosen.status,
      meals: (day?.meals ?? []).map((meal) => {
        const selection=selections.find(s=>s.meal_uid===meal.mealUid);
        const selected=meal.options?.find(o=>selection && selection.version_id===chosen.versionId?o.optionId===selection.option_uid:o.kind==='primary');
        const log=logs.rows.find(l=>l.meal_uid===meal.mealUid);
        return ({
        ...meal,
        selectedOptionId:selected?.optionId ?? null,
        selectedOption:selected ?? null,
        selectionRevision:selection?.revision ?? 0,
        plannedCalories:selected?selected.calories:meal.calories,
        consumptionRevision:log?.revision ?? 0,
        consumptionState:log?.details.state ?? (log?.eaten?'as_planned':'unrecorded'),
        eaten: eaten.get(meal.mealUid) === true,
        consumption: logs.rows.filter(l=>l.meal_uid===meal.mealUid)
          .map(l=>({versionId:l.plan_version_id,optionId:l.option_uid,eaten:l.eaten,...l.details,
            consumedCalories:typeof l.details.consumedCalories==='number'?l.details.consumedCalories:null}))[0] ?? null,
      });}),
    };
  }

  private async lockRequest(client: PoolClient, actorId: string, role: Role, requestId: string) {
    const row = await client.query<{
      user_id: string;
      status: string;
      assigned_specialist_id: string | null;
      week_start: string | null;
      effective_from: string | null;
    }>(
      `select user_id, status, assigned_specialist_id, week_start, effective_from
       from plan_requests where id = $1 for update`,
      [requestId],
    );
    const request = row.rows[0];
    if (!request) throw new ApiError(404, 'not_found', 'درخواست پیدا نشد');
    if (role === 'specialist' && request.assigned_specialist_id !== actorId) {
      throw new ApiError(404, 'not_found', 'درخواست پیدا نشد');
    }
    return request;
  }

  private async presentRequest(requestId: string, includeDraft: boolean) {
    const row = await this.pool.query<{
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
       from plan_requests r join users u on u.id = r.user_id where r.id = $1`,
      [requestId],
    );
    const request = row.rows[0];
    if (!request) throw new ApiError(404, 'not_found', 'درخواست پیدا نشد');
    const questions = await this.pool.query<{
      id: string;
      prompt: string;
      required: boolean;
      status: string;
    }>(
      `select id, prompt, required, status from info_questions where request_id = $1 order by created_at`,
      [requestId],
    );
    const answers = await this.pool.query<{ question_id: string; body: string; created_at: Date }>(
      `select a.question_id, a.body, a.created_at
       from info_answers a
       join info_questions q on q.id = a.question_id
       where q.request_id = $1
       order by a.created_at`,
      [requestId],
    );
    const conversation = await this.pool.query<{ id: string }>(
      `select id from conversations where request_id = $1 and kind = 'care' limit 1`,
      [requestId],
    );
    let version: { id:string; versionNumber:number; status: string; lockVersion: number; days: DayInput[] } | null = null;
    let warnings: unknown[] = [];
    let profile: Awaited<ReturnType<typeof loadModelProfile>> = null;
    let aiReview: unknown = null;
    if (includeDraft) {
      const draft = await this.pool.query<{ id: string; version_number:number; status: string; lock_version: number }>(
        `select id, version_number, status, lock_version from plan_versions
         where request_id = $1 and status in ('draft', 'published')
         order by case when status = 'draft' then 0 else 1 end, version_number desc
         limit 1`,
        [requestId],
      );
      if (draft.rows[0]) {
        const days = await readDays(this.pool, draft.rows[0].id);
        version = {
          id:draft.rows[0].id,
          versionNumber:draft.rows[0].version_number,
          status: draft.rows[0].status,
          lockVersion: draft.rows[0].lock_version,
          days: days.map((day) => ({ meals: day.meals })),
        };
      }
      const warningRow = await this.pool.query<{ warnings: unknown }>(
        `select warnings from ai_generations where request_id = $1 order by created_at desc limit 1`,
        [requestId],
      );
      warnings = Array.isArray(warningRow.rows[0]?.warnings) ? warningRow.rows[0].warnings : [];
      [profile, aiReview] = await Promise.all([
        loadModelProfile(this.pool, request.user_id),
        this.loadAiReview(requestId),
      ]);
    }
    return {
      id: request.id,
      status: request.status,
      kind: request.kind,
      priceToman: Number(request.price_toman),
      weekStart: request.week_start,
      effectiveFrom: request.effective_from,
      displayName: request.display_name,
      conversationId: conversation.rows[0]?.id ?? null,
      questions: questions.rows.map((question) => ({
        id: question.id,
        prompt: decryptText(question.prompt, this.env.FIELD_KEY),
        required: question.required,
        status: question.status,
        answers: answers.rows
          .filter((answer) => answer.question_id === question.id)
          .map((answer) => ({ body: decryptText(answer.body, this.env.FIELD_KEY), createdAt: answer.created_at.toISOString() })),
      })),
      version,
      ...(includeDraft ? { warnings, profile, aiReview, riskFlags: await this.riskFlags(requestId) } : {}),
    };
  }

  private async riskFlags(requestId: string): Promise<string[]> {
    const row = await this.pool.query<{ flags: string[] | null }>(
      `select s.risk_flags as flags from plan_requests r join questionnaire_submissions s on s.id = r.submission_id where r.id = $1`,
      [requestId],
    );
    return row.rows[0]?.flags ?? [];
  }

  /** What the doctor needs to judge the draft: who made it, what it cost, and what the checks found. */
  private async loadAiReview(requestId: string) {
    const row = await this.pool.query<{
      id: string; status: string; provider: string; model: string; pool_code: string | null; prompt_version: string;
      cost_micros: string; tokens: number; skipped_reason: string | null; ai_notes: Record<string, unknown> | null;
      attempt_chain: unknown; warnings: unknown; created_at: Date; attempt_no: number;
    }>(
      `select id, status, provider, model, pool_code, prompt_version, cost_micros::text, tokens, skipped_reason,
              ai_notes, attempt_chain, warnings, created_at, attempt_no
       from ai_generations where request_id = $1 order by created_at desc limit 1`,
      [requestId],
    );
    const g = row.rows[0];
    if (!g) return null;
    const chain = Array.isArray(g.attempt_chain) ? (g.attempt_chain as Array<Record<string, unknown>>) : [];
    const notes = g.ai_notes ?? {};
    return {
      generationId: g.id,
      status: g.status,
      skippedReason: g.skipped_reason,
      provider: g.provider,
      model: g.model,
      poolCode: g.pool_code,
      promptVersion: g.prompt_version,
      costMicros: Number(g.cost_micros),
      tokens: g.tokens,
      attemptNo: g.attempt_no,
      createdAt: g.created_at.toISOString(),
      validatorWarnings: Array.isArray(notes.warnings) ? notes.warnings : [],
      critic: notes.critic ?? null,
      dayTotals: Array.isArray(notes.dayTotals) ? notes.dayTotals : [],
      attempts: chain.map((a) => ({
        provider: a.provider ?? null, model: a.model ?? null, outcome: a.outcome ?? a.status ?? null, errorCode: a.errorCode ?? a.code ?? null,
      })),
    };
  }
}

function emptyDraft(): MealInput[][] {
  return Array.from({ length: 7 }, () => []);
}

function isUsable(draft: PlanDraft): boolean {
  return (
    draft.days.length === 7 &&
    draft.days.every((day) =>
      day.meals.length > 0 &&
      day.meals.every((meal) => meal.title.trim() && meal.calories > 0 && meal.items.some((item) => item.name.trim())),
    )
  );
}

function producedToInput(draft: PlanDraft): MealInput[][] {
  return draft.days.map((day) => day.meals.map(mealFromProvider));
}

function mealFromProvider(meal: MealDraft): MealInput {
  return {
    options:meal.options,
    mealUid: uuidv7(),
    mealType: meal.mealType,
    suggestedTime: meal.suggestedTime,
    title: meal.title,
    calories: meal.calories,
    notes: meal.notes,
    items: meal.items.map((item) => ({ name: item.name, quantity: item.quantity, unit: item.unit })),
  };
}

async function insertDays(
  client: PoolClient,
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

async function insertDayContents(client: PoolClient, versionId: string, days: MealInput[][], approver: string | null = null): Promise<void> {
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

async function deleteDays(client: PoolClient, versionId: string): Promise<void> {
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

async function readDays(client: PoolClient | Pool, versionId: string) {
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

function assertPublishable(days: Array<{ meals: MealInput[] }>): void {
  if (days.length !== 7 || days.some((day) => day.meals.length === 0)) {
    throw new ApiError(409, 'plan_incomplete', 'هر روز باید حداقل یک وعده داشته باشد');
  }
  for (const day of days) {
    for (const meal of day.meals) {
      if (!meal.title.trim() || meal.calories <= 0 || meal.items.length === 0 || meal.items.some((item) => !item.name.trim())) {
        throw new ApiError(409, 'plan_incomplete', 'هر وعده باید عنوان، مقدار و کالری داشته باشد');
      }
    }
  }
}

function parseDays(body: unknown): MealInput[][] {
  if (!body || typeof body !== 'object' || !('days' in body) || !Array.isArray((body as { days: unknown }).days)) {
    throw new ApiError(400, 'validation', 'برنامه باید هفت روز داشته باشد');
  }
  const days = (body as { days: unknown[] }).days;
  if (days.length !== 7) throw new ApiError(400, 'validation', 'برنامه باید هفت روز داشته باشد');
  const parsed = days.map((day) => {
    if (!day || typeof day !== 'object' || !Array.isArray((day as { meals?: unknown }).meals)) {
      throw new ApiError(400, 'validation', 'وعده‌های روز درست نیست');
    }
    const meals = (day as { meals: unknown[] }).meals;
    if (meals.length > 12) throw new ApiError(400, 'validation', 'تعداد وعده‌های یک روز زیاد است');
    return meals.map((meal) => parseMeal(meal));
  });
  const ids = parsed.flat().map(m=>m.mealUid);
  const optionIds = parsed.flat().flatMap(m=>m.options?.map(o=>o.optionId) ?? []);
  if (new Set(ids).size!==ids.length || new Set(optionIds).size!==optionIds.length) {
    throw new ApiError(400,'validation','شناسه وعده و گزینه در نسخه باید یکتا باشد');
  }
  return parsed;
}

function parseMeal(value: unknown): MealInput {
  if (!value || typeof value !== 'object') throw new ApiError(400, 'validation', 'وعده درست نیست');
  const meal = value as Record<string, unknown>;
  const options = parseOptions(meal.options);
  const primary = options?.find(o=>o.kind==='primary');
  if (primary && (primary.title!==meal.title || primary.calories!==meal.calories)) {
    throw new ApiError(400,'validation','عنوان و کالری اصلی باید با گزینه اصلی یکسان باشد');
  }
  const mealType = MEAL_ALIASES[String(meal.mealType ?? '')];
  if (!mealType || !MEAL_TYPES.has(mealType)) throw new ApiError(400, 'validation', 'نوع وعده درست نیست');
  const title = typeof meal.title === 'string' ? meal.title.trim() : '';
  const calories = meal.calories;
  if (!title || title.length > 120 || typeof calories !== 'number' || !Number.isInteger(calories) || calories <= 0 || calories > 5000) {
    throw new ApiError(400, 'validation', 'عنوان یا کالری وعده درست نیست');
  }
  const notes = typeof meal.notes === 'string' ? meal.notes.trim() : '';
  if (notes.length > 500) throw new ApiError(400, 'validation', 'توضیح وعده بیش از حد طولانی است');
  const suggested = meal.suggestedTime;
  const suggestedTime = suggested == null || suggested === '' ? null : String(suggested);
  if (suggestedTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(suggestedTime)) {
    throw new ApiError(400, 'validation', 'ساعت وعده درست نیست');
  }
  if (!Array.isArray(meal.items) || meal.items.length === 0 || meal.items.length > 20) {
    throw new ApiError(400, 'validation', 'هر وعده باید مادهٔ غذایی داشته باشد');
  }
  const mealUid = meal.mealUid === undefined ? uuidv7() : requiredUuid(String(meal.mealUid));
  return {
    mealUid,
    options,
    mealType,
    suggestedTime,
    title,
    calories,
    notes,
    items: (primary?.ingredients ?? meal.items).map((item) => {
      if (!item || typeof item !== 'object') throw new ApiError(400, 'validation', 'مادهٔ غذایی درست نیست');
      const record = item as Record<string, unknown>;
      const name = typeof record.name === 'string' ? record.name.trim() : '';
      if (!name || name.length > 120) throw new ApiError(400, 'validation', 'نام مادهٔ غذایی درست نیست');
      const quantity = record.quantity == null ? null : Number(record.quantity);
      if (quantity != null && (!Number.isFinite(quantity) || quantity <= 0)) {
        throw new ApiError(400, 'validation', 'مقدار مادهٔ غذایی درست نیست');
      }
      const unit = record.unit == null ? null : String(record.unit).trim();
      if (unit && unit.length > 16) throw new ApiError(400, 'validation', 'واحد مادهٔ غذایی درست نیست');
      return { name, quantity, unit: unit || null };
    }),
  };
}
