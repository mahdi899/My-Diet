import { Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import { ApiError } from '../common/errors.js';
import { uuidv7 } from '../common/id.js';
import { audit, toman, withTransaction } from '../common/sql.js';
import { tehranDayStartUtc, tehranToday } from '../common/time.js';
import { PG_POOL } from '../database/database.js';
import { OUTBOX_MAX_ATTEMPTS } from '../jobs/outbox-policy.js';
import { debitFits, signedAdjustment } from './adjustment.js';

@Injectable()
export class AdminService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async createSpecialist(actorId: string, input: {
    phoneE164: string;
    displayName: string;
    credential: string;
    bio: string;
    capacity: number;
  }) {
    const existing = await this.pool.query(`select id from users where phone_e164 = $1`, [input.phoneE164]);
    if ((existing.rowCount ?? 0) > 0) {
      throw new ApiError(409, 'phone_taken', 'این شماره قبلاً ثبت شده است');
    }
    const id = uuidv7();
    const conversationId = uuidv7();
    await withTransaction(this.pool, async (client) => {
      await client.query(
        `insert into users (id, phone_e164, role, display_name) values ($1, $2, 'specialist', $3)`,
        [id, input.phoneE164, input.displayName],
      );
      await client.query(`insert into wallets (user_id) values ($1)`, [id]);
      await client.query(
        `insert into specialist_profiles (user_id, display_name, credential, bio, capacity)
         values ($1, $2, $3, $4, $5)`,
        [id, input.displayName, input.credential, input.bio, input.capacity],
      );
      await client.query(
        `insert into conversations (id, kind, user_id) values ($1, 'support', $2)`,
        [conversationId, id],
      );
      await client.query(
        `insert into conversation_participants (conversation_id, user_id) values ($1, $2)`,
        [conversationId, id],
      );
      await audit(client, actorId, 'specialist_created', 'user', id, { capacity: input.capacity });
    });
    return { id };
  }

  async updateSpecialist(actorId: string, specialistId: string, input: {
    active?: boolean;
    capacity?: number;
    displayName?: string;
    credential?: string;
    bio?: string;
  }) {
    const current = await this.pool.query(`select user_id from specialist_profiles where user_id = $1`, [specialistId]);
    if (current.rowCount === 0) throw new ApiError(404, 'not_found', 'متخصص پیدا نشد');
    await this.pool.query(
      `update specialist_profiles
       set active = coalesce($2, active),
           capacity = coalesce($3, capacity),
           display_name = coalesce($4, display_name),
           credential = coalesce($5, credential),
           bio = coalesce($6, bio)
       where user_id = $1`,
      [specialistId, input.active ?? null, input.capacity ?? null, input.displayName ?? null, input.credential ?? null, input.bio ?? null],
    );
    await audit(this.pool, actorId, 'specialist_updated', 'user', specialistId, input);
    return { ok: true };
  }

  async assign(actorId: string, requestId: string, specialistId: string, reason: string) {
    const specialist = await this.pool.query(
      `select user_id from specialist_profiles where user_id = $1`,
      [specialistId],
    );
    if (specialist.rowCount === 0) throw new ApiError(404, 'not_found', 'متخصص پیدا نشد');
    const request = await this.pool.query(`select id from plan_requests where id = $1`, [requestId]);
    if (request.rowCount === 0) throw new ApiError(404, 'not_found', 'درخواست پیدا نشد');
    await this.pool.query(
      `update plan_requests set assigned_specialist_id = $2, updated_at = now() where id = $1`,
      [requestId, specialistId],
    );
    await this.pool.query(
      `insert into conversation_participants (conversation_id, user_id)
       select id, $2 from conversations where request_id = $1 and kind = 'care'
       on conflict do nothing`,
      [requestId, specialistId],
    );
    await this.pool.query(
      `insert into health_access_logs (id, actor_id, request_id, reason) values ($1, $2, $3, $4)`,
      [uuidv7(), actorId, requestId, reason],
    );
    await audit(this.pool, actorId, 'request_assigned', 'plan_request', requestId, { specialistId });
    return { ok: true };
  }

  async setPrice(actorId: string, serviceCode: string, amountToman: number) {
    if (!Number.isSafeInteger(amountToman) || amountToman <= 0 || amountToman > 100_000_000) {
      throw new ApiError(400, 'validation', 'مبلغ درست نیست');
    }
    const known = await this.pool.query(`select code from services where code = $1`, [serviceCode]);
    if (known.rowCount === 0) throw new ApiError(404, 'not_found', 'خدمت پیدا نشد');
    await this.pool.query(
      `insert into service_prices (id, service_code, amount_toman) values ($1, $2, $3)`,
      [uuidv7(), serviceCode, amountToman],
    );
    await audit(this.pool, actorId, 'price_changed', 'service', null, { serviceCode, amountToman });
    return { serviceCode, amountToman };
  }

  async setReward(actorId: string, amountToman: number) {
    if (!Number.isSafeInteger(amountToman) || amountToman <= 0 || amountToman > 100_000_000) {
      throw new ApiError(400, 'validation', 'مبلغ درست نیست');
    }
    await this.pool.query(
      `update reward_policies set amount_toman = $1 where kind = 'weekly_completion'`,
      [amountToman],
    );
    await this.pool.query(
      `update app_settings set value = to_jsonb($1::int), version = version + 1, updated_at = now()
       where key = 'reward.weekly_completion_toman'`,
      [amountToman],
    );
    await audit(this.pool, actorId, 'reward_changed', 'reward_policy', null, { amountToman });
    return { amountToman };
  }

  async moderateReview(actorId: string, reviewId: string, status: 'approved' | 'rejected') {
    const result = await this.pool.query(
      `update program_reviews set status = $2 where id = $1 returning id`,
      [reviewId, status],
    );
    if (result.rowCount === 0) throw new ApiError(404, 'not_found', 'نظر پیدا نشد');
    await audit(this.pool, actorId, 'review_moderated', 'program_review', reviewId, { status });
    return { id: reviewId, status };
  }

  async ledger(userId?: string) {
    const rows = await this.pool.query<{
      id: string;
      user_id: string;
      bucket: string;
      amount_toman: string;
      kind: string;
      reference_id: string;
      created_at: Date;
    }>(
      `select id, user_id, bucket, amount_toman, kind, reference_id, created_at
       from wallet_ledger
       where ($1::uuid is null or user_id = $1)
       order by created_at desc
       limit 100`,
      [userId ?? null],
    );
    return rows.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      bucket: row.bucket,
      amountToman: toman(row.amount_toman),
      kind: row.kind,
      referenceId: row.reference_id,
      createdAt: row.created_at.toISOString(),
    }));
  }

  async payments() {
    const rows = await this.pool.query<{
      id: string;
      user_id: string;
      amount_toman: string;
      amount_rial: string;
      status: string;
      created_at: Date;
    }>(
      `select id, user_id, amount_toman, amount_rial, status, created_at
       from payments order by created_at desc limit 100`,
    );
    return rows.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      amountToman: toman(row.amount_toman),
      amountRial: toman(row.amount_rial),
      status: row.status,
      createdAt: row.created_at.toISOString(),
    }));
  }

  async users() {
    const rows = await this.pool.query<{
      id: string;
      phone_e164: string;
      role: string;
      status: string;
      display_name: string | null;
    }>(`select id, phone_e164, role, status, display_name from users order by created_at desc limit 200`);
    return rows.rows.map((row) => ({
      id: row.id,
      phone: row.phone_e164,
      role: row.role,
      status: row.status,
      displayName: row.display_name,
    }));
  }

  async setStatus(actorId: string, userId: string, status: 'active' | 'suspended') {
    const result = await this.pool.query(`update users set status = $2 where id = $1`, [userId, status]);
    if (result.rowCount === 0) throw new ApiError(404, 'not_found', 'کاربر پیدا نشد');
    await audit(this.pool, actorId, 'user_status', 'user', userId, { status });
    return { id: userId, status };
  }

  async publicSpecialists() {
    const rows = await this.pool.query<{
      user_id: string;
      display_name: string;
      credential: string;
      bio: string;
      average: string | null;
      reviews: number;
    }>(
      `select sp.user_id, sp.display_name, sp.credential, sp.bio,
              (select round(avg(pr.rating)::numeric, 2)
               from program_reviews pr
               join plan_requests r on r.id = pr.request_id
               where r.assigned_specialist_id = sp.user_id and pr.status = 'approved') as average,
              (select count(*)::int
               from program_reviews pr
               join plan_requests r on r.id = pr.request_id
               where r.assigned_specialist_id = sp.user_id and pr.status = 'approved') as reviews
       from specialist_profiles sp
       where sp.active = true
       order by sp.display_name`,
    );
    return rows.rows.map((row) => ({
      id: row.user_id,
      displayName: row.display_name,
      credential: row.credential,
      bio: row.bio,
      averageRating: row.average == null ? null : Number(row.average),
      reviewCount: row.reviews,
    }));
  }

  async aiControls() {
    const row = await this.controlRow();
    return {
      killSwitch: row.kill_switch,
      dailyCostCapMicros: row.daily_cost_cap_micros == null ? null : Number(row.daily_cost_cap_micros),
    };
  }

  async setAiControls(
    actorId: string,
    input: { killSwitch?: boolean; dailyCostCapMicros?: number | null },
  ) {
    if (input.killSwitch == null && input.dailyCostCapMicros === undefined) {
      throw new ApiError(400, 'validation', 'اطلاعات واردشده ناقص یا نادرست است');
    }
    if (
      input.dailyCostCapMicros != null &&
      (!Number.isSafeInteger(input.dailyCostCapMicros) || input.dailyCostCapMicros < 0)
    ) {
      throw new ApiError(400, 'validation', 'سقف هزینه درست نیست');
    }
    const current = await this.controlRow();
    const killSwitch = input.killSwitch ?? current.kill_switch;
    const cap = input.dailyCostCapMicros === undefined ? current.daily_cost_cap_micros : input.dailyCostCapMicros;
    await this.pool.query(
      `update ai_controls set kill_switch = $1, daily_cost_cap_micros = $2, updated_at = now() where id = true`,
      [killSwitch, cap],
    );
    await audit(this.pool, actorId, 'ai_controls_updated', 'ai_controls', null, {
      killSwitch,
      dailyCostCapMicros: cap,
    });
    return { killSwitch, dailyCostCapMicros: cap == null ? null : Number(cap) };
  }

  async aiCost() {
    const controls = await this.controlRow();
    const totals = await this.pool.query<{ attempts: number; drafted: number; skipped: number; spent: string }>(
      `select count(*)::int as attempts,
              count(*) filter (where status = 'drafted')::int as drafted,
              count(*) filter (where status = 'skipped')::int as skipped,
              coalesce(sum(cost_micros), 0)::text as spent
       from ai_generations
       where created_at >= $1`,
      [tehranDayStartUtc()],
    );
    const row = totals.rows[0];
    return {
      day: tehranToday(),
      spentMicros: Number(row?.spent ?? 0),
      capMicros: controls.daily_cost_cap_micros == null ? null : Number(controls.daily_cost_cap_micros),
      killSwitch: controls.kill_switch,
      attempts: row?.attempts ?? 0,
      drafted: row?.drafted ?? 0,
      skipped: row?.skipped ?? 0,
    };
  }

  private async controlRow() {
    const rows = await this.pool.query<{ kill_switch: boolean; daily_cost_cap_micros: string | null }>(
      `select kill_switch, daily_cost_cap_micros::text as daily_cost_cap_micros from ai_controls where id = true`,
    );
    const row = rows.rows[0];
    if (!row) throw new ApiError(500, 'ai_controls_missing', 'تنظیم مدل پیدا نشد');
    return row;
  }

  async adjustCash(
    actorId: string,
    input: {
      userId: string;
      amountToman: number;
      direction: 'debit' | 'credit';
      reason: string;
      referenceId: string;
    },
  ) {
    if (!Number.isSafeInteger(input.amountToman) || input.amountToman <= 0 || input.amountToman > 100_000_000) {
      throw new ApiError(400, 'validation', 'مبلغ درست نیست');
    }
    const reason = input.reason.trim();
    if (reason.length < 3 || reason.length > 500) {
      throw new ApiError(400, 'validation', 'دلیل اصلاح را بنویسید');
    }
    const signed = signedAdjustment(input.direction, input.amountToman);
    return withTransaction(this.pool, async (client) => {
      const wallet = await client.query<{ cash_toman: string; promo_toman: string }>(
        `select cash_toman, promo_toman from wallets where user_id = $1 for update`,
        [input.userId],
      );
      const held = wallet.rows[0];
      if (!held) throw new ApiError(404, 'not_found', 'کیف پول پیدا نشد');
      const existing = await client.query<{ user_id: string; amount_toman: string }>(
        `select user_id, amount_toman from wallet_ledger
         where kind = 'adjustment' and reference_id = $1 and bucket = 'cash'`,
        [input.referenceId],
      );
      const prior = existing.rows[0];
      if (prior) {
        if (prior.user_id !== input.userId || Number(prior.amount_toman) !== signed) {
          throw new ApiError(409, 'adjustment_conflict', 'این شناسه قبلاً برای اصلاح دیگری استفاده شده است');
        }
        return this.adjustmentResult(held, input);
      }
      if (input.direction === 'debit' && !debitFits(Number(held.cash_toman), input.amountToman)) {
        throw new ApiError(402, 'insufficient_funds', 'موجودی نقدی کافی نیست');
      }
      await client.query(
        `update wallets set cash_toman = cash_toman + $2, version = version + 1 where user_id = $1`,
        [input.userId, signed],
      );
      await client.query(
        `insert into wallet_ledger (id, user_id, bucket, amount_toman, kind, reference_id)
         values ($1, $2, 'cash', $3, 'adjustment', $4)`,
        [uuidv7(), input.userId, signed, input.referenceId],
      );
      const next = await client.query<{ cash_toman: string; promo_toman: string }>(
        `select cash_toman, promo_toman from wallets where user_id = $1`,
        [input.userId],
      );
      await audit(client, actorId, 'wallet_adjusted', 'wallet', input.userId, {
        direction: input.direction,
        amountToman: input.amountToman,
        referenceId: input.referenceId,
        reason,
      });
      return this.adjustmentResult(next.rows[0] ?? held, input);
    });
  }

  async deadLetters() {
    const rows = await this.pool.query<{ id: string; topic: string; attempts: number; created_at: Date }>(
      `select id, topic, attempts, created_at
       from outbox_events
       where dispatched_at is null and attempts >= $1
       order by created_at
       limit 100`,
      [OUTBOX_MAX_ATTEMPTS],
    );
    return {
      events: rows.rows.map((row) => ({
        id: row.id,
        topic: row.topic,
        attempts: row.attempts,
        createdAt: row.created_at.toISOString(),
      })),
    };
  }

  async retryDeadLetter(actorId: string, id: string) {
    const updated = await this.pool.query(
      `update outbox_events set attempts = 0
       where id = $1 and dispatched_at is null and attempts >= $2
       returning id`,
      [id, OUTBOX_MAX_ATTEMPTS],
    );
    if ((updated.rowCount ?? 0) === 0) throw new ApiError(404, 'not_found', 'رویداد مرده پیدا نشد');
    await audit(this.pool, actorId, 'outbox_retried', 'outbox_event', id, {});
    return { id, attempts: 0 };
  }

  private adjustmentResult(
    wallet: { cash_toman: string; promo_toman: string },
    input: { userId: string; amountToman: number; direction: 'debit' | 'credit'; referenceId: string },
  ) {
    return {
      userId: input.userId,
      direction: input.direction,
      amountToman: input.amountToman,
      referenceId: input.referenceId,
      cashToman: toman(wallet.cash_toman),
      promoToman: toman(wallet.promo_toman),
    };
  }
}
