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

describe('phase 12 product', { concurrency: 1, timeout: 180_000 }, () => {
  let directory = '';
  let stopDatabase: (() => Promise<void>) | undefined;
  let api: INestApplication;
  let pool: Pool;
  let remembered: (phone: string) => string | undefined;
  let userToken = '';
  let otherToken = '';
  let specialistToken = '';
  let questionId = '';
  let requestId = '';

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
       ($1, '+989135000001', 'user', 'کاربر دوازدهم'),
       ($2, '+989135000002', 'user', 'کاربر دیگر'),
       ($3, '+989135000003', 'specialist', 'دکتر دوازدهم')`,
      [patientId, otherId, specialistId],
    );
    await pool.query(`insert into wallets (user_id) values ($1), ($2), ($3)`, [patientId, otherId, specialistId]);
    await pool.query(`insert into specialist_profiles(user_id,display_name,credential,verification_status)
      values($1,'Test specialist','nutrition','verified')`, [specialistId]);
    const submissionId = uuidv7();
    const otherSubmission = uuidv7();
    await pool.query(
      `insert into questionnaire_submissions (id, user_id, schema_version, answers) values
       ($1, $2, 1, '{}'::jsonb), ($3, $4, 1, '{}'::jsonb)`,
      [submissionId, patientId, otherSubmission, otherId],
    );
    const orderId = uuidv7();
    const otherOrder = uuidv7();
    requestId = uuidv7();
    const otherRequest = uuidv7();
    await pool.query(
      `insert into orders (id, user_id, service_code, price_toman, cash_toman, promo_toman, status, idempotency_key) values
       ($1, $2, 'new_plan', 500000, 0, 0, 'paid', 'phase12a'),
       ($3, $4, 'new_plan', 500000, 0, 0, 'paid', 'phase12b')`,
      [orderId, patientId, otherOrder, otherId],
    );
    await pool.query(
      `insert into plan_requests (id, user_id, order_id, kind, status, submission_id, assigned_specialist_id, price_toman) values
       ($1, $2, $3, 'new_plan', 'awaiting_user', $4, $5, 500000),
       ($6, $7, $8, 'new_plan', 'awaiting_user', $9, $5, 500000)`,
      [requestId, patientId, orderId, submissionId, specialistId, otherRequest, otherId, otherOrder, otherSubmission],
    );
    questionId = uuidv7();
    await pool.query(
      `insert into info_questions (id, request_id, specialist_id, prompt, required, status) values
       ($1, $2, $3, 'قند ناشتا چند است؟', true, 'open'),
       ($4, $5, $3, 'سؤال شخص دیگر', true, 'open')`,
      [questionId, requestId, specialistId, uuidv7(), otherRequest],
    );
    userToken = (await login('09135000001')).accessToken;
    otherToken = (await login('09135000002')).accessToken;
    specialistToken = (await login('09135000003')).accessToken;
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

  it('lists only the owner open questions, keeps a revised answer, and lets the specialist withdraw', async () => {
    const denied = await request(api.getHttpServer())
      .get('/v1/me/info-questions')
      .set('Authorization', `Bearer ${specialistToken}`);
    assert.equal(denied.status, 403);
    const unknown = await request(api.getHttpServer())
      .get('/v1/me/info-questions')
      .query({ status: 'closed' })
      .set('Authorization', `Bearer ${userToken}`);
    assert.equal(unknown.status, 400);

    const open = await request(api.getHttpServer())
      .get('/v1/me/info-questions')
      .set('Authorization', `Bearer ${userToken}`);
    assert.equal(open.status, 200);
    assert.equal(open.body.length, 1);
    assert.equal(open.body[0].id, questionId);
    assert.equal(open.body[0].prompt, 'قند ناشتا چند است؟');
    assert.equal(JSON.stringify(open.body).includes('+989135'), false);
    assert.equal(JSON.stringify(open.body).includes('سؤال شخص دیگر'), false);

    const hidden = await request(api.getHttpServer())
      .get('/v1/me/info-questions')
      .set('Authorization', `Bearer ${otherToken}`);
    assert.equal(hidden.body.length, 1);
    assert.equal(hidden.body[0].prompt, 'سؤال شخص دیگر');

    const first = await request(api.getHttpServer())
      .post(`/v1/me/info-questions/${questionId}/answers`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ body: '۱۱۰' });
    assertOk(first);
    const second = await request(api.getHttpServer())
      .post(`/v1/me/info-questions/${questionId}/answers`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ body: '۱۲۰' });
    assertOk(second);
    const answers = await pool.query(`select id from info_answers where question_id = $1`, [questionId]);
    assert.equal(answers.rowCount, 2);
    const afterAnswer = await pool.query<{ status: string }>(`select status from plan_requests where id = $1`, [requestId]);
    assert.equal(afterAnswer.rows[0]?.status, 'response_received');

    const userWithdraw = await request(api.getHttpServer())
      .post(`/v1/specialist/info-questions/${questionId}/withdraw`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ reason: 'دیگر لازم نیست' });
    assert.equal(userWithdraw.status, 403);
    const withdrawn = await request(api.getHttpServer())
      .post(`/v1/specialist/info-questions/${questionId}/withdraw`)
      .set('Authorization', `Bearer ${specialistToken}`)
      .send({ reason: 'دیگر لازم نیست' });
    assertOk(withdrawn);
    assert.equal(withdrawn.body.status, 'withdrawn');
    const again = await request(api.getHttpServer())
      .post(`/v1/specialist/info-questions/${questionId}/withdraw`)
      .set('Authorization', `Bearer ${specialistToken}`)
      .send({ reason: 'دوباره' });
    assert.equal(again.status, 409);

    const left = await request(api.getHttpServer())
      .get('/v1/me/info-questions')
      .query({ status: 'withdrawn' })
      .set('Authorization', `Bearer ${userToken}`);
    assert.equal(left.body.length, 1);
    assert.equal(left.body[0].reason, undefined);
    const requestRow = await pool.query<{ status: string }>(`select status from plan_requests where id = $1`, [requestId]);
    assert.equal(requestRow.rows[0]?.status, 'in_review');
    const event = await pool.query<{ detail: { reason?: string } }>(
      `select detail from request_events where request_id = $1 and kind = 'info_withdrawn'`,
      [requestId],
    );
    assert.equal(event.rows[0]?.detail.reason, 'دیگر لازم نیست');
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
