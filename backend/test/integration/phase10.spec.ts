import { mkdtemp, rm } from 'fs/promises';
import net from 'net';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import os from 'os';
import path from 'path';
import type { INestApplication } from '@nestjs/common';
import type { Pool } from 'pg';
import request from 'supertest';
import { normalizeIranianMobile } from '../../src/common/phone.js';
import { uuidv7 } from '../../src/common/id.js';

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => resolve(typeof address === 'object' && address ? address.port : 0));
    });
  });
}

function assertOk(res: { status: number; body: unknown }): void {
  assert.ok(res.status === 200 || res.status === 201, `${res.status} ${JSON.stringify(res.body)}`);
}

describe('phase 10 product', { concurrency: 1, timeout: 180_000 }, () => {
  let directory = '';
  let stopDatabase: (() => Promise<void>) | undefined;
  let api: INestApplication;
  let pool: Pool;
  let remembered: (phone: string) => string | undefined;
  let userToken = '';
  let otherToken = '';
  let specialistToken = '';
  let pendingId = '';

  before(async () => {
    const { default: EmbeddedPostgres } = await import('embedded-postgres');
    directory = await mkdtemp(path.join(os.tmpdir(), 'sabzine-pg-'));
    const port = await freePort();
    const database = new EmbeddedPostgres({
      databaseDir: directory,
      user: 'sabzine',
      password: 'sabzine',
      port,
      persistent: false,
      initdbFlags: ['--encoding=UTF8', '--locale=C'],
    });
    await database.initialise();
    await database.start();
    await database.createDatabase('sabzine');
    const databaseUrl = `postgres://sabzine:sabzine@127.0.0.1:${port}/sabzine`;
    stopDatabase = () => database.stop();
    process.env.NODE_ENV = 'test';
    process.env.APP_ROLE = 'api';
    process.env.DATABASE_URL = databaseUrl;
    process.env.SMS_PROVIDER = 'console';
    process.env.PAYMENT_GATEWAY = 'sandbox';
    process.env.AI_PROVIDER = 'fake';
    process.env.LOG_LEVEL = 'error';
    process.env.RUN_MIGRATIONS = 'false';
    process.env.SENTRY_DSN = '';
    const { migrateUp } = await import('../../dist/database/migrate.js');
    await migrateUp(databaseUrl);
    const { createApp } = await import('../../dist/bootstrap.js');
    api = (await createApp()).app;
    await api.listen(0);
    const { PG_POOL } = await import('../../dist/database/database.js');
    pool = api.get(PG_POOL);
    remembered = (await import('../../dist/adapters/sms.js')).rememberedOtp;

    const patientId = uuidv7();
    const otherId = uuidv7();
    const specialistId = uuidv7();
    await pool.query(
      `insert into users (id, phone_e164, role, display_name) values
       ($1, '+989133000001', 'user', 'کاربر دهم'),
       ($2, '+989133000002', 'user', 'کاربر دیگر'),
       ($3, '+989133000003', 'specialist', 'دکتر دهم')`,
      [patientId, otherId, specialistId],
    );
    await pool.query(
      `insert into wallets (user_id, cash_toman, promo_toman) values ($1, 0, 200000), ($2, 0, 0), ($3, 0, 0)`,
      [patientId, otherId, specialistId],
    );
    const submissionId = uuidv7();
    await pool.query(
      `insert into questionnaire_submissions (id, user_id, schema_version, answers) values ($1, $2, 1, '{}'::jsonb)`,
      [submissionId, patientId],
    );
    const orderId = uuidv7();
    const requestId = uuidv7();
    await pool.query(
      `insert into orders (id, user_id, service_code, price_toman, cash_toman, promo_toman, status, idempotency_key)
       values ($1, $2, 'new_plan', 500000, 0, 0, 'paid', 'phase10')`,
      [orderId, patientId],
    );
    await pool.query(
      `insert into plan_requests (id, user_id, order_id, kind, status, submission_id, price_toman)
       values ($1, $2, $3, 'new_plan', 'published', $4, 500000)`,
      [requestId, patientId, orderId, submissionId],
    );
    pendingId = uuidv7();
    await pool.query(
      `insert into weekly_rewards (id, user_id, request_id, week_start, amount_toman) values
       ($1, $2, $3, '2026-10-24', 200000),
       ($4, $2, $3, '2026-10-17', 200000)`,
      [pendingId, patientId, requestId, uuidv7()],
    );
    await pool.query(`update weekly_rewards set acknowledged_at = now() where week_start = '2026-10-17'`);
    userToken = (await login('09133000001')).accessToken;
    otherToken = (await login('09133000002')).accessToken;
    specialistToken = (await login('09133000003')).accessToken;
  });

  after(async () => {
    await api?.close().catch(() => undefined);
    try {
      if (stopDatabase) await stopDatabase();
    } catch {
      // Windows can keep the data directory locked briefly after stop.
    }
    if (directory) await rm(directory, { recursive: true, force: true }).catch(() => undefined);
  });

  it('dismisses a pending reward once and leaves the credited amount', async () => {
    const denied = await request(api.getHttpServer())
      .get('/v1/me/rewards/pending')
      .set('Authorization', `Bearer ${specialistToken}`);
    assert.equal(denied.status, 403);
    const pending = await request(api.getHttpServer())
      .get('/v1/me/rewards/pending')
      .set('Authorization', `Bearer ${userToken}`);
    assert.equal(pending.status, 200);
    assert.equal(pending.body.length, 1);
    assert.equal(pending.body[0].id, pendingId);
    assert.equal(pending.body[0].amountToman, 200000);
    assert.equal(pending.body[0].weekStart, '2026-10-24');
    assert.equal(pending.body[0].acknowledgedAt, null);
    assert.equal(JSON.stringify(pending.body).includes('+989133'), false);

    const changed = await request(api.getHttpServer())
      .post(`/v1/me/rewards/${pendingId}/acknowledge`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ amountToman: 1 });
    assert.equal(changed.status, 400);

    const first = await request(api.getHttpServer())
      .post(`/v1/me/rewards/${pendingId}/acknowledge`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({});
    assertOk(first);
    assert.equal(first.body.amountToman, 200000);
    assert.equal(typeof first.body.acknowledgedAt, 'string');

    const second = await request(api.getHttpServer())
      .post(`/v1/me/rewards/${pendingId}/acknowledge`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({});
    assertOk(second);
    assert.equal(second.body.acknowledgedAt, first.body.acknowledgedAt);
    assert.equal(second.body.amountToman, 200000);

    const hidden = await request(api.getHttpServer())
      .post(`/v1/me/rewards/${pendingId}/acknowledge`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({});
    assert.equal(hidden.status, 404);

    const left = await request(api.getHttpServer())
      .get('/v1/me/rewards/pending')
      .set('Authorization', `Bearer ${userToken}`);
    assert.deepEqual(left.body, []);
    const wallet = await pool.query<{ promo_toman: string }>(
      `select promo_toman from wallets where user_id = (select user_id from weekly_rewards where id = $1)`,
      [pendingId],
    );
    assert.equal(Number(wallet.rows[0]?.promo_toman), 200000);
    const ledger = await pool.query(`select id from wallet_ledger where reference_id = $1`, [pendingId]);
    assert.equal(ledger.rowCount, 0);
    await assert.rejects(pool.query(`update weekly_rewards set amount_toman = 1 where id = $1`, [pendingId]));
    await assert.rejects(pool.query(`delete from weekly_rewards where id = $1`, [pendingId]));
  });

  async function login(phone: string): Promise<{ accessToken: string }> {
    const requested = await request(api.getHttpServer()).post('/v1/auth/otp/request').send({ phone });
    assertOk(requested);
    const code = remembered(normalizeIranianMobile(phone));
    assert.ok(code);
    const verified = await request(api.getHttpServer()).post('/v1/auth/otp/verify').send({ phone, code });
    assertOk(verified);
    return { accessToken: verified.body.accessToken as string };
  }
});
