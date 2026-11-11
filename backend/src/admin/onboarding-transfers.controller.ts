import { Body, Controller, Get, Header, Inject, Param, Post, Req } from '@nestjs/common';
import { createHmac, randomInt, randomUUID } from 'node:crypto';
import type { Request } from 'express';
import type { Pool } from 'pg';
import { actor, Roles } from '../common/auth.js';
import { ApiError } from '../common/errors.js';
import { requiredUuid } from '../common/parse.js';
import { audit, withTransaction } from '../common/sql.js';
import { ENV, type Env } from '../config/env.js';
import { PG_POOL } from '../database/database.js';
import { MelipayamakSmsProvider } from '../adapters/melipayamak.js';

const prices = new Map([['weekly', 1290000], ['monthly', 1990000], ['quarterly', 8990000]]);
const fields = 'id, plan, amount_toman, expires_at, confirmed_at';

@Controller('v1')
export class OnboardingTransfersController {
  constructor(@Inject(PG_POOL) private readonly pool: Pool, @Inject(ENV) private readonly env: Env) {}

  @Header('Cache-Control', 'private, no-store')
  @Roles('user')
  @Post('me/onboarding-transfers')
  async create(@Req() req: Request, @Body() body: { plan?: string; submissionId?: string }) {
    const userId = actor(req).id;
    const plan = body?.plan ?? '';
    const price = prices.get(plan);
    if (!price) throw new ApiError(400, 'validation', 'پلن معتبر نیست');
    const submissionId = requiredUuid(body.submissionId ?? '');
    return withTransaction(this.pool, async client => {
      const user = (await client.query('select phone_e164 from users where id=$1 for update', [userId])).rows[0];
      if (!user) throw new ApiError(401, 'unauthorized', 'نشست معتبر نیست');
      const hash = createHmac('sha256', this.env.FIELD_KEY).update(user.phone_e164).digest('hex');
      const verified = await client.query('select 1 from demo_lead_submissions where id=$1 and phone_hash=$2 and phone_verified', [submissionId, hash]);
      if (!verified.rowCount) throw new ApiError(403, 'forbidden', 'ابتدا شماره را تأیید کنید');
      const existing = (await client.query(
        'select '+fields+' from onboarding_transfers where user_id=$1 and submission_id=$2 and plan=$3 and (confirmed_at is not null or expires_at>now()) order by created_at desc limit 1',
        [userId, submissionId, plan],
      )).rows[0];
      if (existing) return existing;
      for (let attempt = 0; attempt < 25; attempt++) {
        const row = (await client.query(
          'insert into onboarding_transfers(id,user_id,submission_id,plan,amount_toman,expires_at) values($1,$2,$3,$4,$5,now()+interval \'30 minutes\') on conflict(amount_toman) do nothing returning '+fields,
          [randomUUID(), userId, submissionId, plan, price + randomInt(1, 10001)],
        )).rows[0];
        if (row) return row;
      }
      throw new ApiError(503, 'unavailable', 'ساخت مبلغ یکتا ممکن نشد. دوباره تلاش کنید.');
    });
  }

  @Header('Cache-Control', 'private, no-store')
  @Roles('user')
  @Get('me/onboarding-transfers/:id')
  async status(@Req() req: Request, @Param('id') id: string) {
    const row = (await this.pool.query('select '+fields+' from onboarding_transfers where id=$1 and user_id=$2', [requiredUuid(id), actor(req).id])).rows[0];
    if (!row) throw new ApiError(404, 'not_found', 'درخواست پرداخت پیدا نشد');
    return row;
  }

  @Roles('admin')
  @Get('admin/onboarding-transfers')
  async list() {
    return (await this.pool.query('select t.*, u.phone_e164 from onboarding_transfers t join users u on u.id=t.user_id order by t.created_at desc limit 200')).rows;
  }

  @Roles('admin')
  @Post('admin/onboarding-transfers/:id/confirm')
  async confirm(@Req() req: Request, @Param('id') id: string, @Body() body: { reference?: string; amountToman?: number }) {
    const reference = body?.reference?.trim();
    if (!Number.isSafeInteger(body?.amountToman) || !reference || !/^[a-zA-Z0-9-]{4,80}$/.test(reference)) throw new ApiError(400, 'validation', 'شناسه پیگیری بانکی معتبر نیست');
    const row = await withTransaction(this.pool, async client => {
      await client.query('select pg_advisory_xact_lock(hashtext($1))', [reference]);
      const duplicate = await client.query('select 1 from onboarding_transfers where bank_reference=$1 and id<>$2', [reference, requiredUuid(id)]);
      if (duplicate.rowCount) throw new ApiError(409, 'conflict', 'این تراکنش قبلاً ثبت شده است');
      const updated = (await client.query(
        "update onboarding_transfers t set confirmed_at=now(),bank_reference=$2,sms_status='sending' from users u where t.id=$1 and t.user_id=u.id and t.confirmed_at is null and t.amount_toman=$3 returning t.amount_toman,u.phone_e164",
        [id, reference, body.amountToman],
      )).rows[0];
      if (!updated) throw new ApiError(409, 'conflict', 'مبلغ با سفارش مطابق نیست یا درخواست قبلاً تأیید شده است');
      await audit(client, actor(req).id, 'onboarding_transfer_confirmed', 'onboarding_transfer', id, { reference, amountToman: updated.amount_toman });
      return updated;
    });
    let smsStatus = 'sent';
    try {
      await new MelipayamakSmsProvider(this.env).sendPurchaseConfirmation(row.phone_e164);
    } catch {
      smsStatus = 'failed';
    }
    await this.pool.query('update onboarding_transfers set sms_status=$2 where id=$1', [id, smsStatus]);
    return { confirmed: true, smsStatus };
  }
}
