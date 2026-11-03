import { Inject, Injectable } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import { ApiError } from '../common/errors.js';
import { uuidv7 } from '../common/id.js';
import { notify, withTransaction } from '../common/sql.js';
import { fridayOfWeek, tehranToday } from '../common/time.js';
import { PG_POOL } from '../database/database.js';
import { PlanDraftService } from './plans.service.js';

export interface ChangeTarget {
  dayIndex: number;
  mealUid?: string;
}

export interface SubmitChange {
  commandId: string;
  versionId: string;
  reasonIds: string[];
  explanation?: string;
  targets?: ChangeTarget[];
}

type ChangeStatus = 'awaiting_review' | 'under_review' | 'rejected' | 'approved';
type ChangeSubstate = 'none' | 'awaiting_clarification';

interface ChangeRow {
  id: string;
  user_id: string;
  plan_request_id: string;
  version_id: string;
  command_id: string;
  explanation: string;
  status: ChangeStatus;
  substate: ChangeSubstate;
  rejection_explanation: string | null;
  published_version_id: string | null;
  created_at: Date;
}

@Injectable()
export class PlanChangeService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly plans: PlanDraftService,
  ) {}

  reasons(activeOnly: boolean) {
    return this.pool.query<{ id: string; label: string; active: boolean }>(
      `select id, label, active from plan_change_reasons where $1::boolean = false or active = true order by id`,
      [activeOnly],
    ).then((result) => result.rows.map((row) => ({ id: row.id, label: row.label, active: row.active })));
  }

  async updateReason(id: string, label: string, active: boolean) {
    const updated = await this.pool.query(
      `update plan_change_reasons set label=$2, active=$3 where id=$1`,
      [id, label.trim(), active],
    );
    if (updated.rowCount === 0) throw new ApiError(404, 'not_found', 'دلیل تغییر پیدا نشد');
    return { id, label: label.trim(), active };
  }

  async submit(userId: string, input: SubmitChange) {
    const explanation = input.explanation?.trim() ?? '';
    const reasonIds = [...new Set(input.reasonIds)];
    const targets = input.targets ?? [];
    if (reasonIds.length !== input.reasonIds.length) throw new ApiError(400, 'validation', 'دلیل تکراری است');
    try {
      return await withTransaction(this.pool, async (client) => {
        await client.query('select id from users where id=$1 for update', [userId]);
        const prior = await this.byCommand(client, userId, input.commandId);
        if (prior) {
          if (!sameSubmission(prior, input.versionId, explanation, reasonIds, targets)) {
            throw new ApiError(409, 'idempotency_conflict', 'این شناسه برای درخواست دیگری استفاده شده است');
          }
          return { ...(await this.present(client, prior, false)), duplicate: true };
        }
        const active = await client.query<{
          id: string; request_id: string; status: string; specialist_id: string | null; week_start: string | null;
        }>(
          `select v.id, v.request_id, r.status, r.assigned_specialist_id as specialist_id, r.week_start::text as week_start
           from active_plan_versions a
           join plan_versions v on v.id=a.version_id and v.status='published'
           join plan_requests r on r.id=v.request_id
           where a.user_id=$1`,
          [userId],
        );
        const plan = active.rows[0];
        if (!plan || plan.id !== input.versionId || plan.status === 'cancelled') {
          throw new ApiError(409, 'plan_changed', 'این نسخه دیگر برنامهٔ فعال نیست');
        }
        if (!plan.specialist_id) throw new ApiError(409, 'no_specialist', 'متخصص فعالی برای این برنامه تعیین نشده است');
        if (plan.week_start && tehranToday() > fridayOfWeek(plan.week_start.slice(0, 10))) {
          throw new ApiError(409, 'week_closed', 'هفتهٔ این برنامه پایان یافته است');
        }
        const configured = await client.query<{ id: string; label: string }>(
          `select id, label from plan_change_reasons where id = any($1::text[]) and active = true`,
          [reasonIds],
        );
        if (configured.rowCount !== reasonIds.length) throw new ApiError(400, 'validation', 'دلیل تغییر فعال نیست');
        for (const target of targets) {
          const found = await client.query(
            `select 1 from plan_days d
             left join plan_meals m on m.plan_day_id=d.id and m.meal_uid=$3
             where d.plan_version_id=$1 and d.day_index=$2 and ($3::uuid is null or m.id is not null)`,
            [plan.id, target.dayIndex, target.mealUid ?? null],
          );
          if ((found.rowCount ?? 0) === 0) throw new ApiError(400, 'validation', 'روز یا وعدهٔ انتخاب‌شده در این نسخه نیست');
        }
        const id = uuidv7();
        await client.query(
          `insert into plan_change_requests
             (id, user_id, plan_request_id, version_id, command_id, explanation, status)
           values ($1,$2,$3,$4,$5,$6,'awaiting_review')`,
          [id, userId, plan.request_id, plan.id, input.commandId, explanation],
        );
        for (const reason of configured.rows) {
          await client.query(
            `insert into plan_change_reason_snapshots (request_id, reason_id, label) values ($1,$2,$3)`,
            [id, reason.id, reason.label],
          );
        }
        for (const target of targets) {
          await client.query(
            `insert into plan_change_targets (id, request_id, day_index, meal_uid) values ($1,$2,$3,$4)`,
            [uuidv7(), id, target.dayIndex, target.mealUid ?? null],
          );
        }
        await this.systemMessage(client, userId, plan.specialist_id, plan.request_id, id, 'درخواست تغییر برنامه ثبت شد');
        await notify(client, plan.specialist_id, 'plan_change', { changeRequestId: id });
        const stored = await this.must(client, id);
        return { ...(await this.present(client, stored, false)), duplicate: false };
      });
    } catch (error) {
      if (!isUnique(error)) throw error;
      const again = await this.byCommand(this.pool, userId, input.commandId);
      if (again && sameSubmission(again, input.versionId, explanation, reasonIds, targets)) {
        return { ...(await this.present(this.pool, again, false)), duplicate: true };
      }
      const constraint = (error as { constraint?: string }).constraint ?? '';
      if (constraint.includes('command')) throw new ApiError(409, 'idempotency_conflict', 'این شناسه برای درخواست دیگری استفاده شده است');
      throw new ApiError(409, 'open_request', 'یک درخواست تغییر باز وجود دارد');
    }
  }

  async mine(userId: string) {
    const rows = await this.pool.query<ChangeRow>(
      `select ${COLUMNS} from plan_change_requests where user_id=$1 order by created_at desc`,
      [userId],
    );
    return Promise.all(rows.rows.map((row) => this.present(this.pool, row, false)));
  }

  async forCustomer(userId: string, id: string) {
    const row = await this.must(this.pool, id);
    if (row.user_id !== userId) throw new ApiError(404, 'not_found', 'درخواست تغییر پیدا نشد');
    return this.present(this.pool, row, false);
  }

  async reply(userId: string, id: string, body: string) {
    return withTransaction(this.pool, async (client) => {
      const row = await this.lockChange(client, id);
      if (row.user_id !== userId) throw new ApiError(404, 'not_found', 'درخواست تغییر پیدا نشد');
      if (row.substate !== 'awaiting_clarification') throw new ApiError(409, 'not_waiting', 'سؤالی در انتظار پاسخ نیست');
      const question = await client.query<{ id: string }>(
        `select id from plan_change_questions where request_id=$1 and status='open' for update`,
        [id],
      );
      const open = question.rows[0];
      if (!open) throw new ApiError(409, 'not_waiting', 'سؤالی در انتظار پاسخ نیست');
      await client.query(`update plan_change_questions set status='answered', answer=$2 where id=$1`, [open.id, body.trim()]);
      await client.query(
        `update plan_change_requests set status='awaiting_review', substate='none', updated_at=now() where id=$1`,
        [id],
      );
      const specialist = await this.specialistOf(client, row.plan_request_id);
      await this.systemMessage(client, userId, specialist, row.plan_request_id, id, 'پاسخ سؤال تغییر برنامه ثبت شد');
      await notify(client, specialist, 'plan_change', { changeRequestId: id });
      return this.present(client, await this.must(client, id), false);
    });
  }

  async queue(specialistId: string) {
    const rows = await this.pool.query<ChangeRow>(
      `select c.id, c.user_id, c.plan_request_id, c.version_id, c.command_id, c.explanation, c.status, c.substate,
              c.rejection_explanation, c.published_version_id, c.created_at
       from plan_change_requests c
       join plan_requests r on r.id=c.plan_request_id
       where r.assigned_specialist_id=$1 and c.status in ('awaiting_review','under_review')
       order by c.created_at`,
      [specialistId],
    );
    return Promise.all(rows.rows.map((row) => this.present(this.pool, row, true)));
  }

  async forSpecialist(specialistId: string, id: string) {
    const row = await this.must(this.pool, id);
    await this.assertAssigned(this.pool, specialistId, row.plan_request_id);
    return this.present(this.pool, row, true);
  }

  review(specialistId: string, id: string) {
    return this.transition(specialistId, id, async (client, row) => {
      if (row.status !== 'awaiting_review' || row.substate !== 'none') {
        throw new ApiError(409, 'not_actionable', 'این درخواست الان در صف بررسی نیست');
      }
      await client.query(`update plan_change_requests set status='under_review', updated_at=now() where id=$1`, [id]);
    });
  }

  reject(specialistId: string, id: string, explanation: string) {
    const text = explanation.trim();
    if (!text) throw new ApiError(400, 'validation', 'رد درخواست نیاز به توضیح دارد');
    return this.transition(specialistId, id, async (client, row) => {
      this.assertOpen(row);
      const before = await client.query<{ version_id: string }>(
        `select version_id from active_plan_versions where user_id=$1`,
        [row.user_id],
      );
      await client.query(
        `update plan_change_requests
         set status='rejected', substate='none', rejection_explanation=$2, updated_at=now()
         where id=$1`,
        [id, text],
      );
      const after = await client.query<{ version_id: string }>(
        `select version_id from active_plan_versions where user_id=$1`,
        [row.user_id],
      );
      if (before.rows[0]?.version_id !== after.rows[0]?.version_id) {
        throw new ApiError(409, 'plan_changed', 'برنامهٔ فعال هنگام رد درخواست عوض شد');
      }
      await this.systemMessage(client, row.user_id, specialistId, row.plan_request_id, id, 'درخواست تغییر برنامه رد شد');
      await notify(client, row.user_id, 'plan_change', { changeRequestId: id });
    });
  }

  clarify(specialistId: string, id: string, prompt: string) {
    const text = prompt.trim();
    if (!text) throw new ApiError(400, 'validation', 'متن سؤال لازم است');
    return this.transition(specialistId, id, async (client, row) => {
      this.assertOpen(row);
      if (row.substate === 'awaiting_clarification') throw new ApiError(409, 'clarification_open', 'یک سؤال باز وجود دارد');
      await client.query(
        `insert into plan_change_questions (id, request_id, prompt, status) values ($1,$2,$3,'open')`,
        [uuidv7(), id, text],
      );
      await client.query(
        `update plan_change_requests set status='under_review', substate='awaiting_clarification', updated_at=now() where id=$1`,
        [id],
      );
      await notify(client, row.user_id, 'plan_change', { changeRequestId: id });
    });
  }

  approve(specialistId: string, id: string, lock: number) {
    return withTransaction(this.pool, async (client) => {
      const peek = await client.query<{ plan_request_id: string; user_id: string }>(
        `select plan_request_id, user_id from plan_change_requests where id=$1`,
        [id],
      );
      const ids = peek.rows[0];
      if (!ids) throw new ApiError(404, 'not_found', 'درخواست تغییر پیدا نشد');
      await client.query('select id from plan_requests where id=$1 for update', [ids.plan_request_id]);
      await client.query('select id from users where id=$1 for update', [ids.user_id]);
      const row = await this.lockChange(client, id);
      await this.assertAssigned(client, specialistId, row.plan_request_id);
      this.assertOpen(row);
      if (row.substate === 'awaiting_clarification') {
        throw new ApiError(409, 'clarification_required', 'تا پاسخ سؤال نمی‌توان تغییر را منتشر کرد');
      }
      const open = await client.query(
        `select id from plan_change_questions where request_id=$1 and status='open'`,
        [id],
      );
      if ((open.rowCount ?? 0) > 0) throw new ApiError(409, 'clarification_required', 'تا پاسخ سؤال نمی‌توان تغییر را منتشر کرد');
      const active = await client.query<{ version_id: string }>(
        `select version_id from active_plan_versions where user_id=$1`,
        [row.user_id],
      );
      if (active.rows[0]?.version_id !== row.version_id) {
        throw new ApiError(409, 'plan_changed', 'برنامهٔ فعال با نسخهٔ این درخواست یکی نیست');
      }
      const published = await this.plans.publish(specialistId, 'specialist', row.plan_request_id, lock, client);
      await client.query(
        `update plan_change_requests
         set status='approved', substate='none', published_version_id=$2, updated_at=now()
         where id=$1`,
        [id, published.versionId],
      );
      await this.systemMessage(client, row.user_id, specialistId, row.plan_request_id, id, 'برنامهٔ جدید آماده است');
      return this.present(client, await this.must(client, id), true);
    });
  }

  private async transition(
    specialistId: string,
    id: string,
    apply: (client: PoolClient, row: ChangeRow) => Promise<void>,
  ) {
    return withTransaction(this.pool, async (client) => {
      const row = await this.lockChange(client, id);
      await this.assertAssigned(client, specialistId, row.plan_request_id);
      await apply(client, row);
      return this.present(client, await this.must(client, id), true);
    });
  }

  private assertOpen(row: ChangeRow): void {
    if (row.status === 'approved' || row.status === 'rejected') {
      throw new ApiError(409, 'already_resolved', 'این درخواست قبلاً بسته شده است');
    }
  }

  private async assertAssigned(db: Pool | PoolClient, specialistId: string, planRequestId: string) {
    const assigned = await db.query(
      `select 1 from plan_requests where id=$1 and assigned_specialist_id=$2`,
      [planRequestId, specialistId],
    );
    if ((assigned.rowCount ?? 0) === 0) throw new ApiError(404, 'not_found', 'درخواست تغییر پیدا نشد');
  }

  private async specialistOf(db: Pool | PoolClient, planRequestId: string): Promise<string> {
    const row = await db.query<{ assigned_specialist_id: string | null }>(
      `select assigned_specialist_id from plan_requests where id=$1`,
      [planRequestId],
    );
    const specialistId = row.rows[0]?.assigned_specialist_id;
    if (!specialistId) throw new ApiError(409, 'no_specialist', 'متخصص فعالی برای این برنامه تعیین نشده است');
    return specialistId;
  }

  private async lockChange(client: PoolClient, id: string): Promise<ChangeRow> {
    const row = await client.query<ChangeRow>(
      `select ${COLUMNS} from plan_change_requests where id=$1 for update`,
      [id],
    );
    const found = row.rows[0];
    if (!found) throw new ApiError(404, 'not_found', 'درخواست تغییر پیدا نشد');
    return found;
  }

  private async must(db: Pool | PoolClient, id: string): Promise<ChangeRow> {
    const row = await db.query<ChangeRow>(`select ${COLUMNS} from plan_change_requests where id=$1`, [id]);
    const found = row.rows[0];
    if (!found) throw new ApiError(404, 'not_found', 'درخواست تغییر پیدا نشد');
    return found;
  }

  private async byCommand(db: Pool | PoolClient, userId: string, commandId: string): Promise<LoadedChange | null> {
    const row = await db.query<ChangeRow>(
      `select ${COLUMNS} from plan_change_requests where user_id=$1 and command_id=$2`,
      [userId, commandId],
    );
    const found = row.rows[0];
    if (!found) return null;
    const reasons = await db.query<{ reason_id: string }>(
      `select reason_id from plan_change_reason_snapshots where request_id=$1`,
      [found.id],
    );
    const targets = await db.query<{ day_index: number; meal_uid: string | null }>(
      `select day_index, meal_uid from plan_change_targets where request_id=$1`,
      [found.id],
    );
    return {
      ...found,
      reasonIds: reasons.rows.map((reason) => reason.reason_id),
      targets: targets.rows.map((target) => ({ dayIndex: target.day_index, mealUid: target.meal_uid })),
    };
  }

  private async present(db: Pool | PoolClient, row: ChangeRow, forSpecialist: boolean) {
    const reasons = await db.query<{ reason_id: string; label: string }>(
      `select reason_id, label from plan_change_reason_snapshots where request_id=$1 order by reason_id`,
      [row.id],
    );
    const targets = await db.query<{ day_index: number; meal_uid: string | null }>(
      `select day_index, meal_uid from plan_change_targets where request_id=$1 order by day_index`,
      [row.id],
    );
    const question = await db.query<{ id: string; prompt: string; answer: string | null; status: string }>(
      `select id, prompt, answer, status from plan_change_questions where request_id=$1 order by created_at desc limit 1`,
      [row.id],
    );
    const latest = question.rows[0];
    return {
      id: row.id,
      userId: forSpecialist ? row.user_id : undefined,
      planRequestId: row.plan_request_id,
      versionId: row.version_id,
      status: row.status,
      substate: row.substate,
      explanation: row.explanation,
      reasons: reasons.rows.map((reason) => ({ id: reason.reason_id, label: reason.label })),
      targets: targets.rows.map((target) => ({ dayIndex: target.day_index, mealUid: target.meal_uid })),
      rejectionExplanation: row.rejection_explanation,
      publishedVersionId: row.published_version_id,
      question: latest ? { id: latest.id, prompt: latest.prompt, answer: latest.answer, status: latest.status } : null,
      createdAt: row.created_at.toISOString(),
    };
  }

  private async systemMessage(
    client: PoolClient,
    userId: string,
    specialistId: string,
    planRequestId: string,
    changeId: string,
    body: string,
  ) {
    const existing = await client.query<{ id: string }>(
      `select id from conversations where request_id=$1 and kind='care' limit 1`,
      [planRequestId],
    );
    let conversationId = existing.rows[0]?.id;
    if (!conversationId) {
      conversationId = uuidv7();
      await client.query(
        `insert into conversations (id, kind, user_id, request_id) values ($1,'care',$2,$3)`,
        [conversationId, userId, planRequestId],
      );
      await client.query(
        `insert into conversation_participants (conversation_id, user_id) values ($1,$2),($1,$3)`,
        [conversationId, userId, specialistId],
      );
    }
    await client.query(
      `insert into messages (id, conversation_id, author_id, body, kind, change_request_id)
       values ($1,$2,$3,$4,'system',$5)`,
      [uuidv7(), conversationId, userId, body, changeId],
    );
  }
}

const COLUMNS = `id, user_id, plan_request_id, version_id, command_id, explanation, status, substate,
  rejection_explanation, published_version_id, created_at`;

interface LoadedChange extends ChangeRow {
  reasonIds: string[];
  targets: Array<{ dayIndex: number; mealUid: string | null }>;
}

function sameSubmission(
  stored: LoadedChange,
  versionId: string,
  explanation: string,
  reasonIds: string[],
  targets: ChangeTarget[],
): boolean {
  const storedTargets = stored.targets.map((target) => `${target.dayIndex}:${target.mealUid ?? ''}`).sort();
  const nextTargets = targets.map((target) => `${target.dayIndex}:${target.mealUid ?? ''}`).sort();
  return stored.version_id === versionId
    && stored.explanation === explanation
    && stored.reasonIds.slice().sort().join() === reasonIds.slice().sort().join()
    && storedTargets.join() === nextTargets.join();
}

function isUnique(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === '23505';
}
