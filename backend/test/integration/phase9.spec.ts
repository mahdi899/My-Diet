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

describe('phase 9 product', { concurrency: 1, timeout: 180_000 }, () => {
  let directory = '';
  let stopDatabase: (() => Promise<void>) | undefined;
  let api: INestApplication;
  let pool: Pool;
  let remembered: (phone: string) => string | undefined;
  let userToken = '';
  let specialistToken = '';
  let otherToken = '';
  const ids: Record<string, string> = {};

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
    const specialistId = uuidv7();
    const otherId = uuidv7();
    await pool.query(
      `insert into users (id, phone_e164, role, display_name) values
       ($1, '+989132000001', 'user', 'کاربر نهم'),
       ($2, '+989132000002', 'specialist', 'دکتر نهم'),
       ($3, '+989132000003', 'specialist', 'دکتر دیگر')`,
      [patientId, specialistId, otherId],
    );
    await pool.query(`insert into wallets (user_id) values ($1), ($2), ($3)`, [patientId, specialistId, otherId]);
    await pool.query(`insert into specialist_profiles(user_id,display_name,credential,verification_status)
      values($1,'Test specialist','nutrition','verified'),($2,'Other specialist','nutrition','verified')`, [specialistId, otherId]);
    const submissionId = uuidv7();
    await pool.query(
      `insert into questionnaire_submissions (id, user_id, schema_version, answers) values ($1, $2, 1, '{}'::jsonb)`,
      [submissionId, patientId],
    );
    const rows: Array<[string, string, string, string]> = [
      ['queued', 'new_plan', specialistId, 'queued'],
      ['generating', 'new_plan', specialistId, 'generating'],
      ['review', 'new_plan', specialistId, 'in_review'],
      ['waiting', 'new_plan', specialistId, 'awaiting_user'],
      ['answered', 'new_plan', specialistId, 'response_received'],
      ['revision', 'ai_revision', specialistId, 'in_review'],
      ['published', 'new_plan', specialistId, 'published'],
      ['cancelled', 'new_plan', specialistId, 'cancelled'],
      ['other', 'new_plan', otherId, 'in_review'],
    ];
    for (const [key, kind, specialist, status] of rows) {
      const orderId = uuidv7();
      const requestId = uuidv7();
      ids[key] = requestId;
      await pool.query(
        `insert into orders (id, user_id, service_code, price_toman, cash_toman, promo_toman, status, idempotency_key)
         values ($1, $2, 'new_plan', 500000, 0, 0, 'paid', $3)`,
        [orderId, patientId, key],
      );
      await pool.query(
        `insert into plan_requests (id, user_id, order_id, kind, status, submission_id, assigned_specialist_id, price_toman)
         values ($1, $2, $3, $4, $5, $6, $7, 500000)`,
        [requestId, patientId, orderId, kind, status, submissionId, specialist],
      );
    }
    userToken = (await login('09132000001')).accessToken;
    specialistToken = (await login('09132000002')).accessToken;
    otherToken = (await login('09132000003')).accessToken;
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

  it('filters the assigned queue and hides another specialist and the user', async () => {
    const denied = await request(api.getHttpServer())
      .get('/v1/specialist/queue')
      .set('Authorization', `Bearer ${userToken}`);
    assert.equal(denied.status, 403);
    const unknown = await request(api.getHttpServer())
      .get('/v1/specialist/queue')
      .query({ bucket: 'cancelled' })
      .set('Authorization', `Bearer ${specialistToken}`);
    assert.equal(unknown.status, 400);

    const all = await request(api.getHttpServer())
      .get('/v1/specialist/requests')
      .set('Authorization', `Bearer ${specialistToken}`);
    assert.equal(all.status, 200);
    const allIds = (all.body as Array<{ id: string }>).map((row) => row.id);
    assert.equal(allIds.length, 8);
    assert.equal(allIds.includes(ids.other!), false);
    assert.equal(JSON.stringify(all.body).includes('+989132'), false);

    await expectBucket('generating', [ids.queued!, ids.generating!]);
    await expectBucket('awaiting_review', [ids.review!]);
    await expectBucket('awaiting_user', [ids.waiting!]);
    await expectBucket('response_received', [ids.answered!]);
    await expectBucket('revisions', [ids.revision!]);
    await expectBucket('published', [ids.published!]);

    const other = await request(api.getHttpServer())
      .get('/v1/specialist/queue')
      .query({ bucket: 'awaiting_review' })
      .set('Authorization', `Bearer ${otherToken}`);
    assert.equal(other.status, 200);
    assert.deepEqual(
      (other.body as Array<{ id: string }>).map((row) => row.id),
      [ids.other],
    );
  });

  async function expectBucket(bucket: string, expected: string[]): Promise<void> {
    const response = await request(api.getHttpServer())
      .get('/v1/specialist/queue')
      .query({ bucket })
      .set('Authorization', `Bearer ${specialistToken}`);
    assert.equal(response.status, 200);
    const got = (response.body as Array<{ id: string; displayName: string }>).map((row) => row.id).sort();
    assert.deepEqual(got, [...expected].sort());
    if (bucket === 'awaiting_review') assert.equal(response.body[0].displayName, 'کاربر نهم');
  }

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
