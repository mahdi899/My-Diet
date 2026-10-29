import { Inject, Injectable } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import {
  PLAN_DRAFT_PROVIDER,
  type MealDraft,
  type PlanDraft,
  type PlanDraftProvider,
} from '../adapters/plan-draft.js';
import type { Role } from '../common/auth.js';
import { ApiError } from '../common/errors.js';
import { uuidv7 } from '../common/id.js';
import { audit, notify, withTransaction } from '../common/sql.js';
import { addCivilDays, tehranDayStartUtc, tehranToday, weekStartSaturday } from '../common/time.js';
import { PROMPT_VERSION, manualDraftReason, usageCount } from '../ai/cost.js';
import { aiAttempts, aiCostCapHits } from '../metrics/metrics.js';
import { ENV, type Env } from '../config/env.js';
import { PG_POOL } from '../database/database.js';
import { AI_SKIP_FLAGS, type StoredAnswers } from '../questionnaire/schema.js';
import { decryptText, encryptText, openAnswers } from '../common/field-crypto.js';
import { minimizeForModel } from '../ai/minimize.js';
import { draftWarnings } from '../ai/warnings.js';
import { bucketSql, type QueueBucket } from './queue.js';

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
  ) {}

  async generate(requestId: string): Promise<void> {
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
      if ((existing.rowCount ?? 0) > 0) {
        await client.query(
          `update plan_requests set status = 'in_review', updated_at = now() where id = $1 and status <> 'cancelled'`,
          [requestId],
        );
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
    const blocked = highRisk ? null : await this.manualBlock();
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
    const opened = openAnswers(claimed.answers, this.env.FIELD_KEY);
    const minimized = minimizeForModel(opened, requestId, {
      userId: claimed.user_id,
      phone: claimed.phone_e164,
      name: opened.name,
    });
    if (!skipReason) {
      const started = Date.now();
      try {
        const produced = await this.provider.draft(minimized);
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
      } catch {
        latencyMs = Math.max(0, Date.now() - started);
        aiStatus = 'failed';
        reason = 'provider_error';
      }
    }
    const warnings = aiStatus === 'drafted' ? draftWarnings(draft, opened.allergies ?? '', opened.dislikes ?? '') : [];

    await withTransaction(this.pool, async (client) => {
      const current = await client.query<{ status: string }>(
        `select status from plan_requests where id = $1 for update`,
        [requestId],
      );
      if (current.rows[0]?.status !== 'generating') return;
      const existing = await client.query(`select id from plan_versions where request_id = $1 limit 1`, [requestId]);
      if ((existing.rowCount ?? 0) > 0) return;
      await insertDays(client, requestId, 1, null, draft);
      await client.query(
        `update plan_requests set status = 'in_review', updated_at = now() where id = $1`,
        [requestId],
      );
      const attempt = await client.query<{ n: number }>(
        `select coalesce(max(attempt_no), 0) + 1 as n from ai_generations where request_id = $1`,
        [requestId],
      );
      await client.query(
        `insert into ai_generations
           (id, request_id, provider, status, skipped_reason, raw_output, attempt_no, model,
            prompt_version, schema_version, tokens, latency_ms, cost_micros, warnings)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb)`,
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
        ],
      );
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

  private async manualBlock(): Promise<{ reason: 'kill_switch' | 'cost_cap'; spentMicros: number; capMicros: number } | null> {
    const controls = await this.pool.query<{ kill_switch: boolean; daily_cost_cap_micros: string | null }>(
      `select kill_switch, daily_cost_cap_micros from ai_controls where id = true`,
    );
    const row = controls.rows[0];
    const capMicros = row?.daily_cost_cap_micros == null ? null : Number(row.daily_cost_cap_micros);
    const spent = await this.pool.query<{ spent: string }>(
      `select coalesce(sum(cost_micros), 0)::text as spent from ai_generations where created_at >= $1`,
      [tehranDayStartUtc()],
    );
    const spentMicros = Number(spent.rows[0]?.spent ?? 0);
    const reason = manualDraftReason({
      killSwitch: row?.kill_switch ?? false,
      spentMicros,
      capMicros,
    });
    if (!reason) return null;
    return { reason, spentMicros, capMicros: capMicros ?? 0 };
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
      days.map((day) => day.meals.map((meal) => ({ ...meal, mealUid: uuidv7() }))),
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
      if (draft) await insertDayContents(client, draft.id, days);
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

  async publish(actorId: string, role: Role, requestId: string, lock: number) {
    return withTransaction(this.pool, async (client) => {
      const request = await this.lockRequest(client, actorId, role, requestId);
      if (request.status !== 'in_review') {
        throw new ApiError(409, 'info_required', 'تا بسته شدن سؤال‌ها نمی‌توان برنامه را تأیید کرد');
      }
      const blocking = await client.query(
        `select id from info_questions
         where request_id = $1 and required = true and status <> 'acknowledged'`,
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
      const days = await readDays(client, version.id);
      assertPublishable(days);
      const today = tehranToday();
      const weekStart = request.week_start ?? weekStartSaturday(today);
      const effectiveFrom = request.effective_from ?? today;
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
        `update plan_versions set status = 'published', published_at = now() where id = $1`,
        [version.id],
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
      return { status: 'published' as const };
    });
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
      if (row.status !== 'open') throw new ApiError(409, 'already_answered', 'به این سؤال قبلاً پاسخ داده شده است');
      await client.query(
        `insert into info_answers (id, question_id, author_id, body) values ($1, $2, $3, $4)`,
        [uuidv7(), questionId, userId, encryptText(body, this.env.FIELD_KEY)],
      );
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
         where request_id = $1 and required = true and status <> 'acknowledged'`,
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
       order by v.published_at desc
       limit 1`,
      [userId],
    );
    const request = found.rows[0];
    if (!request) return null;
    const today = tehranToday();
    const friday = addCivilDays(request.week_start, 6);
    const days = await readDays(this.pool, request.version_id);
    const logs = await this.pool.query<{ meal_uid: string; scheduled_date: string; eaten: boolean }>(
      `select meal_uid, scheduled_date, eaten from meal_logs where user_id = $1 and request_id = $2`,
      [userId, request.id],
    );
    const eaten = new Map(logs.rows.map((row) => [`${row.scheduled_date}|${row.meal_uid}`, row.eaten]));
    return {
      requestId: request.id,
      weekStart: request.week_start,
      effectiveFrom: request.effective_from,
      expired: today > friday,
      days: days.map((day) => {
        const date = addCivilDays(request.week_start, day.dayIndex);
        return {
          dayIndex: day.dayIndex,
          date,
          meals: day.meals.map((meal) => ({
            mealUid: meal.mealUid,
            mealType: meal.mealType,
            suggestedTime: meal.suggestedTime,
            title: meal.title,
            calories: meal.calories,
            notes: meal.notes,
            items: meal.items,
            eaten: eaten.get(`${date}|${meal.mealUid}`) === true,
            loggable: date === today && date >= request.effective_from && today <= friday,
          })),
        };
      }),
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
    let version: { status: string; lockVersion: number; days: DayInput[] } | null = null;
    let warnings: unknown[] = [];
    if (includeDraft) {
      const draft = await this.pool.query<{ id: string; status: string; lock_version: number }>(
        `select id, status, lock_version from plan_versions
         where request_id = $1 and status in ('draft', 'published')
         order by case when status = 'draft' then 0 else 1 end, version_number desc
         limit 1`,
        [requestId],
      );
      if (draft.rows[0]) {
        const days = await readDays(this.pool, draft.rows[0].id);
        version = {
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
      ...(includeDraft ? { warnings } : {}),
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
  await insertDayContents(client, versionId, days);
  return versionId;
}

async function insertDayContents(client: PoolClient, versionId: string, days: MealInput[][]): Promise<void> {
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
    }
  }
}

async function deleteDays(client: PoolClient, versionId: string): Promise<void> {
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
  return days.map((day) => {
    if (!day || typeof day !== 'object' || !Array.isArray((day as { meals?: unknown }).meals)) {
      throw new ApiError(400, 'validation', 'وعده‌های روز درست نیست');
    }
    const meals = (day as { meals: unknown[] }).meals;
    if (meals.length > 12) throw new ApiError(400, 'validation', 'تعداد وعده‌های یک روز زیاد است');
    return meals.map((meal) => parseMeal(meal));
  });
}

function parseMeal(value: unknown): MealInput {
  if (!value || typeof value !== 'object') throw new ApiError(400, 'validation', 'وعده درست نیست');
  const meal = value as Record<string, unknown>;
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
  if (suggestedTime && !/^\d{2}:\d{2}$/.test(suggestedTime)) {
    throw new ApiError(400, 'validation', 'ساعت وعده درست نیست');
  }
  if (!Array.isArray(meal.items) || meal.items.length === 0 || meal.items.length > 20) {
    throw new ApiError(400, 'validation', 'هر وعده باید مادهٔ غذایی داشته باشد');
  }
  const mealUid = typeof meal.mealUid === 'string' && /^[0-9a-f-]{36}$/i.test(meal.mealUid) ? meal.mealUid : uuidv7();
  return {
    mealUid,
    mealType,
    suggestedTime,
    title,
    calories,
    notes,
    items: meal.items.map((item) => {
      if (!item || typeof item !== 'object') throw new ApiError(400, 'validation', 'مادهٔ غذایی درست نیست');
      const record = item as Record<string, unknown>;
      const name = typeof record.name === 'string' ? record.name.trim() : '';
      if (!name || name.length > 120) throw new ApiError(400, 'validation', 'نام مادهٔ غذایی درست نیست');
      const quantity = record.quantity == null ? null : Number(record.quantity);
      if (quantity != null && (!Number.isFinite(quantity) || quantity < 0)) {
        throw new ApiError(400, 'validation', 'مقدار مادهٔ غذایی درست نیست');
      }
      const unit = record.unit == null ? null : String(record.unit).trim();
      if (unit && unit.length > 16) throw new ApiError(400, 'validation', 'واحد مادهٔ غذایی درست نیست');
      return { name, quantity, unit: unit || null };
    }),
  };
}
