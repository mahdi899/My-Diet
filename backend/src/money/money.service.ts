import { createHash } from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import { ENV, type Env } from '../config/env.js';
import { ApiError } from '../common/errors.js';
import { uuidv7 } from '../common/id.js';
import { audit, insertOutbox, toman, withTransaction } from '../common/sql.js';
import { PG_POOL } from '../database/database.js';
import { GATEWAY_SET, type GatewaySet } from '../adapters/payment.js';
import { PlanDraftService } from '../plans/plans.service.js';

const OPEN_STATUSES = ['queued', 'generating', 'in_review', 'awaiting_user', 'response_received'];

const SERVICES: Record<string, 'new_plan' | 'ai_revision' | 'specialist_revision'> = {
  new_plan: 'new_plan',
  'new-plan': 'new_plan',
  ai_revision: 'ai_revision',
  'ai-change': 'ai_revision',
  specialist_revision: 'specialist_revision',
  'expert-change': 'specialist_revision',
};

export interface WalletBalance {
  cashToman: number;
  promoToman: number;
}

export interface OrderResult {
  orderId: string;
  requestId: string;
  priceToman: number;
  cashToman: number;
  promoToman: number;
  wallet: WalletBalance;
}

@Injectable()
export class MoneyService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    @Inject(ENV) private readonly env: Env,
    @Inject(GATEWAY_SET) private readonly gateways: GatewaySet,
    private readonly plans: PlanDraftService,
  ) {}

  async catalog() {
    const services = await this.pool.query<{ code: string; title_fa: string; amount_toman: string }>(
      `select distinct on (s.code) s.code, s.title_fa, p.amount_toman
       from services s
       join service_prices p on p.service_code = s.code and p.effective_from <= now()
       order by s.code, p.effective_from desc`,
    );
    const topups = await this.pool.query<{ code: string; amount_toman: string }>(
      `select code, amount_toman from topup_packages where active order by amount_toman`,
    );
    const reward = await this.pool.query<{ amount_toman: string }>(
      `select amount_toman from reward_policies where kind = 'weekly_completion' and active`,
    );
    return {
      services: services.rows.map((row) => ({
        code: row.code,
        titleFa: row.title_fa,
        priceToman: toman(row.amount_toman),
      })),
      topups: topups.rows.map((row) => {
        const amountToman = toman(row.amount_toman);
        return { code: row.code, amountToman, amountRial: amountToman * 10 };
      }),
      weeklyRewardToman: toman(reward.rows[0]?.amount_toman ?? 0),
    };
  }

  async ledgerForUser(userId: string) {
    const rows = await this.pool.query<{
      id: string;
      bucket: string;
      amount_toman: string;
      kind: string;
      reference_id: string;
      created_at: Date;
    }>(
      `select id, bucket, amount_toman, kind, reference_id, created_at
       from wallet_ledger where user_id = $1
       order by created_at desc
       limit 100`,
      [userId],
    );
    return rows.rows.map((row) => ({
      id: row.id,
      bucket: row.bucket,
      amountToman: toman(row.amount_toman),
      kind: row.kind,
      referenceId: row.reference_id,
      createdAt: row.created_at.toISOString(),
    }));
  }

  async orderForUser(userId: string, orderId: string) {
    const rows = await this.pool.query<{
      id: string;
      service_code: string;
      price_toman: string;
      cash_toman: string;
      promo_toman: string;
      status: string;
      created_at: Date;
    }>(
      `select id, service_code, price_toman, cash_toman, promo_toman, status, created_at
       from orders where id = $1 and user_id = $2`,
      [orderId, userId],
    );
    const order = rows.rows[0];
    if (!order) throw new ApiError(404, 'not_found', 'سفارش پیدا نشد');
    return {
      id: order.id,
      serviceCode: order.service_code,
      priceToman: toman(order.price_toman),
      cashToman: toman(order.cash_toman),
      promoToman: toman(order.promo_toman),
      status: order.status,
      createdAt: order.created_at.toISOString(),
    };
  }

  async topupForUser(userId: string, paymentId: string) {
    const rows = await this.pool.query<{
      id: string;
      package_code: string;
      amount_toman: string;
      amount_rial: string;
      status: string;
      gateway: string;
      created_at: Date;
    }>(
      `select id, package_code, amount_toman, amount_rial, status, gateway, created_at
       from payments where id = $1 and user_id = $2`,
      [paymentId, userId],
    );
    const payment = rows.rows[0];
    if (!payment) throw new ApiError(404, 'not_found', 'پرداخت پیدا نشد');
    return {
      id: payment.id,
      packageCode: payment.package_code,
      amountToman: toman(payment.amount_toman),
      amountRial: toman(payment.amount_rial),
      status: payment.status,
      gateway: payment.gateway,
      createdAt: payment.created_at.toISOString(),
    };
  }

  async cancelRequest(userId: string, requestId: string): Promise<WalletBalance> {
    const found = await this.pool.query<{ order_id: string }>(
      `select order_id from plan_requests where id = $1 and user_id = $2`,
      [requestId, userId],
    );
    const request = found.rows[0];
    if (!request) throw new ApiError(404, 'not_found', 'درخواست پیدا نشد');
    return this.cancel(userId, request.order_id);
  }

  async wallet(userId: string): Promise<WalletBalance> {
    const row = await this.pool.query<{ cash_toman: string; promo_toman: string }>(
      `select cash_toman, promo_toman from wallets where user_id = $1`,
      [userId],
    );
    if (!row.rows[0]) throw new ApiError(404, 'not_found', 'کیف پول پیدا نشد');
    return { cashToman: toman(row.rows[0].cash_toman), promoToman: toman(row.rows[0].promo_toman) };
  }

  gatewayList() {
    return this.gateways.list();
  }

  async startTopup(userId: string, packageCode: string, gatewayName: string | null) {
    const name = gatewayName ?? this.env.PAYMENT_GATEWAY;
    const gateway = this.gateways.get(name);
    if (!gateway) throw new ApiError(400, 'unknown_gateway', 'درگاه پرداخت شناخته نشد');
    if (gateway.callsExternalNetwork) {
      throw new ApiError(503, 'payment_unavailable', 'درگاه پرداخت در دسترس نیست');
    }
    const pkg = await this.pool.query<{ amount_toman: string }>(
      `select amount_toman from topup_packages where code = $1 and active = true`,
      [packageCode],
    );
    if (!pkg.rows[0]) throw new ApiError(404, 'not_found', 'بستهٔ شارژ پیدا نشد');
    const amountToman = toman(pkg.rows[0].amount_toman);
    const paymentId = uuidv7();
    await this.pool.query(
      `insert into payments (id, user_id, package_code, amount_toman, amount_rial, status, gateway)
       values ($1, $2, $3, $4, $5, 'pending', $6)`,
      [paymentId, userId, packageCode, amountToman, amountToman * 10, gateway.name],
    );
    return { paymentId, amountToman, amountRial: amountToman * 10, status: 'pending' as const, gateway: gateway.name };
  }

  async completeSandbox(paymentId: string): Promise<WalletBalance> {
    if (!this.gateways.get('sandbox')) {
      throw new ApiError(404, 'not_found', 'یافت نشد');
    }
    return withTransaction(this.pool, async (client) => {
      const found = await client.query<{
        user_id: string;
        amount_toman: string;
        status: string;
        gateway: string;
      }>(`select user_id, amount_toman, status, gateway from payments where id = $1 for update`, [paymentId]);
      const payment = found.rows[0];
      if (!payment || payment.gateway !== 'sandbox') throw new ApiError(404, 'not_found', 'پرداخت پیدا نشد');
      if (payment.status === 'credited') return this.balance(client, payment.user_id);
      if (payment.status !== 'pending') throw new ApiError(409, 'payment_closed', 'این پرداخت بسته شده است');
      const amount = toman(payment.amount_toman);
      await client.query(`select user_id from wallets where user_id = $1 for update`, [payment.user_id]);
      await client.query(
        `update wallets set cash_toman = cash_toman + $2, version = version + 1 where user_id = $1`,
        [payment.user_id, amount],
      );
      await client.query(
        `insert into wallet_ledger (id, user_id, bucket, amount_toman, kind, reference_id)
         values ($1, $2, 'cash', $3, 'topup', $4)`,
        [uuidv7(), payment.user_id, amount, paymentId],
      );
      await client.query(
        `update payments set status = 'credited', credited_at = now() where id = $1`,
        [paymentId],
      );
      return this.balance(client, payment.user_id);
    });
  }

  async placeOrder(
    userId: string,
    idempotencyKey: string,
    serviceInput: string,
    expectedPriceToman: number,
    parentRequestId: string | null,
  ): Promise<OrderResult> {
    const serviceCode = SERVICES[serviceInput];
    if (!serviceCode) throw new ApiError(400, 'validation', 'خدمت شناخته نشد');
    if (serviceCode === 'new_plan' && parentRequestId) {
      throw new ApiError(400, 'validation', 'برنامهٔ جدید درخواست والد ندارد');
    }
    if (serviceCode !== 'new_plan' && !parentRequestId) {
      throw new ApiError(400, 'validation', 'اصلاح برنامه به برنامهٔ فعلی نیاز دارد');
    }
    const requestHash = createHash('sha256')
      .update(JSON.stringify({ serviceCode, expectedPriceToman, parentRequestId }))
      .digest('hex');

    return withTransaction(this.pool, async (client) => {
      const inserted = await client.query(
        `insert into idempotency_records (id, user_id, idempotency_key, request_hash)
         values ($1, $2, $3, $4)
         on conflict (user_id, idempotency_key) do nothing
         returning id`,
        [uuidv7(), userId, idempotencyKey, requestHash],
      );
      if ((inserted.rowCount ?? 0) === 0) {
        const existing = await client.query<{ request_hash: string; response: OrderResult | null }>(
          `select request_hash, response from idempotency_records
           where user_id = $1 and idempotency_key = $2
           for update`,
          [userId, idempotencyKey],
        );
        const prior = existing.rows[0];
        if (!prior) throw new ApiError(409, 'idempotency_pending', 'درخواست قبلی هنوز تمام نشده است');
        if (prior.request_hash !== requestHash) {
          throw new ApiError(422, 'idempotency_conflict', 'این کلید قبلاً برای درخواست دیگری استفاده شده است');
        }
        if (!prior.response) throw new ApiError(409, 'idempotency_pending', 'درخواست قبلی هنوز تمام نشده است');
        return prior.response;
      }

      await client.query(`select user_id from wallets where user_id = $1 for update`, [userId]);
      const open = await client.query(
        `select id from plan_requests where user_id = $1 and status = any($2::text[]) for update`,
        [userId, OPEN_STATUSES],
      );
      if ((open.rowCount ?? 0) > 0) {
        throw new ApiError(409, 'request_in_progress', 'یک درخواست باز دارید');
      }
      const submission = await client.query<{ id: string }>(
        `select id from questionnaire_submissions
         where user_id = $1 order by submitted_at desc limit 1`,
        [userId],
      );
      if (!submission.rows[0]) throw new ApiError(409, 'questionnaire_required', 'اول پرسشنامه را کامل کن');
      if (parentRequestId) {
        const parent = await client.query(
          `select r.id from plan_requests r
           join plan_versions v on v.request_id = r.id and v.status = 'published'
           where r.id = $1 and r.user_id = $2`,
          [parentRequestId, userId],
        );
        if ((parent.rowCount ?? 0) === 0) {
          throw new ApiError(404, 'not_found', 'برنامهٔ فعلی پیدا نشد');
        }
      }
      const priceRow = await client.query<{ amount_toman: string }>(
        `select amount_toman from service_prices
         where service_code = $1 and effective_from <= now()
         order by effective_from desc limit 1`,
        [serviceCode],
      );
      const price = toman(priceRow.rows[0]?.amount_toman ?? 0);
      if (price !== expectedPriceToman) {
        throw new ApiError(409, 'price_changed', 'قیمت تغییر کرده است');
      }
      const wallet = await this.balance(client, userId);
      const promoToman = Math.min(wallet.promoToman, price);
      const cashToman = price - promoToman;
      if (wallet.cashToman < cashToman) {
        throw new ApiError(409, 'insufficient_balance', 'موجودی کیف پول کافی نیست');
      }

      const orderId = uuidv7();
      const requestId = uuidv7();
      await client.query(
        `insert into orders (id, user_id, service_code, price_toman, cash_toman, promo_toman, status, idempotency_key)
         values ($1, $2, $3, $4, $5, $6, 'paid', $7)`,
        [orderId, userId, serviceCode, price, cashToman, promoToman, idempotencyKey],
      );
      await client.query(
        `update wallets
         set cash_toman = cash_toman - $2, promo_toman = promo_toman - $3, version = version + 1
         where user_id = $1`,
        [userId, cashToman, promoToman],
      );
      if (promoToman > 0) {
        await client.query(
          `insert into wallet_ledger (id, user_id, bucket, amount_toman, kind, reference_id)
           values ($1, $2, 'promo', $3, 'order_debit', $4)`,
          [uuidv7(), userId, -promoToman, orderId],
        );
      }
      if (cashToman > 0) {
        await client.query(
          `insert into wallet_ledger (id, user_id, bucket, amount_toman, kind, reference_id)
           values ($1, $2, 'cash', $3, 'order_debit', $4)`,
          [uuidv7(), userId, -cashToman, orderId],
        );
      }
      const specialistId = await this.assign(client);
      const status = serviceCode === 'specialist_revision' ? 'in_review' : 'queued';
      await client.query(
        `insert into plan_requests
           (id, user_id, order_id, kind, status, submission_id, assigned_specialist_id, parent_request_id, price_toman)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [requestId, userId, orderId, serviceCode, status, submission.rows[0].id, specialistId, parentRequestId, price],
      );
      if (serviceCode === 'specialist_revision' && parentRequestId) {
        await this.plans.copyPublishedDraft(client, parentRequestId, requestId);
      } else {
        await insertOutbox(client, 'plan.generate', requestId, { requestId });
      }
      const conversationId = uuidv7();
      await client.query(
        `insert into conversations (id, kind, user_id, request_id) values ($1, 'care', $2, $3)`,
        [conversationId, userId, requestId],
      );
      await client.query(
        `insert into conversation_participants (conversation_id, user_id) values ($1, $2)`,
        [conversationId, userId],
      );
      if (specialistId) {
        await client.query(
          `insert into conversation_participants (conversation_id, user_id) values ($1, $2)`,
          [conversationId, specialistId],
        );
      }
      await client.query(
        `insert into request_events (id, request_id, actor_id, kind) values ($1, $2, $3, 'ordered')`,
        [uuidv7(), requestId, userId],
      );
      const result: OrderResult = {
        orderId,
        requestId,
        priceToman: price,
        cashToman,
        promoToman,
        wallet: await this.balance(client, userId),
      };
      await client.query(`update idempotency_records set response = $2::jsonb where user_id = $1 and idempotency_key = $3`, [
        userId,
        JSON.stringify(result),
        idempotencyKey,
      ]);
      return result;
    });
  }

  async cancel(userId: string, orderId: string): Promise<WalletBalance> {
    return withTransaction(this.pool, async (client) => {
      await client.query(`select user_id from wallets where user_id = $1 for update`, [userId]);
      const found = await client.query<{
        status: string;
        cash_toman: string;
        promo_toman: string;
      }>(
        `select status, cash_toman, promo_toman from orders where id = $1 and user_id = $2 for update`,
        [orderId, userId],
      );
      const order = found.rows[0];
      if (!order) throw new ApiError(404, 'not_found', 'سفارش پیدا نشد');
      if (order.status !== 'paid') throw new ApiError(409, 'refund_not_allowed', 'این سفارش قابل بازگشت نیست');
      const request = await client.query<{ id: string; status: string }>(
        `select id, status from plan_requests where order_id = $1 for update`,
        [orderId],
      );
      const plan = request.rows[0];
      if (!plan || !['queued', 'generating', 'in_review'].includes(plan.status)) {
        throw new ApiError(409, 'refund_not_allowed', 'این سفارش دیگر قابل بازگشت نیست');
      }
      const edited = await client.query(
        `select id from request_events where request_id = $1 and kind = 'draft_edited'`,
        [plan.id],
      );
      const asked = await client.query(`select id from info_questions where request_id = $1`, [plan.id]);
      if ((edited.rowCount ?? 0) > 0 || (asked.rowCount ?? 0) > 0) {
        throw new ApiError(409, 'refund_not_allowed', 'پس از دخالت متخصص، مبلغ برنمی‌گردد');
      }
      const cash = toman(order.cash_toman);
      const promo = toman(order.promo_toman);
      if (cash > 0) {
        await client.query(
          `insert into wallet_ledger (id, user_id, bucket, amount_toman, kind, reference_id)
           values ($1, $2, 'cash', $3, 'refund', $4)`,
          [uuidv7(), userId, cash, orderId],
        );
      }
      if (promo > 0) {
        await client.query(
          `insert into wallet_ledger (id, user_id, bucket, amount_toman, kind, reference_id)
           values ($1, $2, 'promo', $3, 'refund', $4)`,
          [uuidv7(), userId, promo, orderId],
        );
      }
      await client.query(
        `update wallets
         set cash_toman = cash_toman + $2, promo_toman = promo_toman + $3, version = version + 1
         where user_id = $1`,
        [userId, cash, promo],
      );
      await client.query(`update orders set status = 'refunded' where id = $1`, [orderId]);
      await client.query(
        `update plan_requests set status = 'cancelled', updated_at = now() where id = $1`,
        [plan.id],
      );
      return this.balance(client, userId);
    });
  }

  async compensatePermanentFailure(actorId: string, orderId: string): Promise<WalletBalance> {
    return withTransaction(this.pool, async (client) => {
      const found = await client.query<{ user_id: string; status: string; cash_toman: string; promo_toman: string }>(
        `select user_id, status, cash_toman, promo_toman from orders where id=$1 for update`,
        [orderId],
      );
      const order = found.rows[0];
      if (!order) throw new ApiError(404, 'not_found', 'سفارش پیدا نشد');
      await client.query(`select user_id from wallets where user_id=$1 for update`, [order.user_id]);
      if (order.status === 'refunded') return this.balance(client, order.user_id);
      if (order.status !== 'paid') throw new ApiError(409, 'refund_not_allowed', 'این سفارش قابل بازگشت نیست');
      const request = await client.query<{ id: string; status: string }>(
        `select id, status from plan_requests where order_id=$1 for update`,
        [orderId],
      );
      const plan = request.rows[0];
      if (!plan || !['queued', 'generating'].includes(plan.status)) {
        throw new ApiError(409, 'refund_not_allowed', 'فقط شکست دائمی پیش از بررسی متخصص قابل جبران است');
      }
      const failed = await client.query(
        `select 1 from ai_execution_claims where request_id=$1 and status='failed'`,
        [plan.id],
      );
      if ((failed.rowCount ?? 0) === 0) throw new ApiError(409, 'not_failed', 'شکست دائمی خدمت ثبت نشده است');
      const cash = toman(order.cash_toman);
      const promo = toman(order.promo_toman);
      if (cash > 0) {
        await client.query(
          `insert into wallet_ledger (id, user_id, bucket, amount_toman, kind, reference_id) values ($1,$2,'cash',$3,'refund',$4)`,
          [uuidv7(), order.user_id, cash, orderId],
        );
      }
      if (promo > 0) {
        await client.query(
          `insert into wallet_ledger (id, user_id, bucket, amount_toman, kind, reference_id) values ($1,$2,'promo',$3,'refund',$4)`,
          [uuidv7(), order.user_id, promo, orderId],
        );
      }
      await client.query(
        `update wallets set cash_toman = cash_toman + $2, promo_toman = promo_toman + $3, version = version + 1 where user_id=$1`,
        [order.user_id, cash, promo],
      );
      await client.query(`update orders set status='refunded' where id=$1`, [orderId]);
      await client.query(`update plan_requests set status='cancelled', updated_at=now() where id=$1`, [plan.id]);
      await audit(client, actorId, 'order_compensated', 'order', orderId, { cashToman: cash, promoToman: promo });
      return this.balance(client, order.user_id);
    });
  }

  private async assign(client: PoolClient): Promise<string | null> {
    const specialists = await client.query<{ user_id: string; capacity: number }>(
      `select user_id, capacity from specialist_profiles where active = true order by user_id for update`,
    );
    let chosen: string | null = null;
    let least = Number.POSITIVE_INFINITY;
    for (const specialist of specialists.rows) {
      const load = await client.query<{ n: number }>(
        `select count(*)::int as n from plan_requests
         where assigned_specialist_id = $1 and status = any($2::text[])`,
        [specialist.user_id, OPEN_STATUSES],
      );
      const count = load.rows[0]?.n ?? 0;
      if (count < specialist.capacity && count < least) {
        least = count;
        chosen = specialist.user_id;
      }
    }
    return chosen;
  }

  private async balance(client: PoolClient, userId: string): Promise<WalletBalance> {
    const row = await client.query<{ cash_toman: string; promo_toman: string }>(
      `select cash_toman, promo_toman from wallets where user_id = $1`,
      [userId],
    );
    return {
      cashToman: toman(row.rows[0]?.cash_toman ?? 0),
      promoToman: toman(row.rows[0]?.promo_toman ?? 0),
    };
  }
}
