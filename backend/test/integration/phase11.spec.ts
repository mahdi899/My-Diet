import { mkdtemp, rm } from 'fs/promises';
import { installGracefulStop } from '../helpers/postgres-stop.js';
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

describe('phase 11 product', { concurrency: 1, timeout: 180_000 }, () => {
  let directory = '';
  let stopDatabase: (() => Promise<void>) | undefined;
  let api: INestApplication;
  let pool: Pool;
  let remembered: (phone: string) => string | undefined;
  let userToken = '';
  let otherToken = '';
  let specialistId = '';

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
      initdbFlags: ['--encoding=UTF8', '--locale=C', '--no-sync', '-c', 'io_method=sync'],
    });
    installGracefulStop(database,directory);
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
    specialistId = uuidv7();
    await pool.query(
      `insert into users (id, phone_e164, role, display_name) values
       ($1, '+989134000001', 'user', 'نگار تستی'),
       ($2, '+989134000002', 'user', 'کاربر دیگر'),
       ($3, '+989134000003', 'specialist', 'دکتر یازدهم')`,
      [patientId, otherId, specialistId],
    );
    await pool.query(`insert into wallets (user_id) values ($1), ($2), ($3)`, [patientId, otherId, specialistId]);
    await pool.query(
      `insert into specialist_profiles (user_id, display_name, credential, bio, active)
       values ($1, 'دکتر یازدهم', 'تغذیه', 'برنامهٔ هفتگی', false)`,
      [specialistId],
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
       values ($1, $2, 'new_plan', 500000, 0, 0, 'paid', 'phase11')`,
      [orderId, patientId],
    );
    await pool.query(
      `insert into plan_requests (id, user_id, order_id, kind, status, submission_id, assigned_specialist_id, price_toman)
       values ($1, $2, $3, 'new_plan', 'published', $4, $5, 500000)`,
      [requestId, patientId, orderId, submissionId, specialistId],
    );
    await pool.query(
      `insert into program_reviews (id, user_id, request_id, week_start, rating, body, status) values
       ($1, $2, $3, '2026-10-24', 5, 'عالی بود', 'approved'),
       ($4, $2, $3, '2026-10-17', 1, 'هنوز نه', 'pending'),
       ($5, $6, $3, '2026-10-10', 2, 'رد شد', 'rejected')`,
      [uuidv7(), patientId, requestId, uuidv7(), uuidv7(), otherId],
    );
    userToken = (await login('09134000001')).accessToken;
    otherToken = (await login('09134000002')).accessToken;
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

  it('publishes approved reviews and the assigned specialist without a phone', async () => {
    const reviews = await request(api.getHttpServer()).get('/v1/public/reviews');
    assert.equal(reviews.status, 200);
    assert.equal(reviews.body.length, 1);
    assert.equal(reviews.body[0].rating, 5);
    assert.equal(reviews.body[0].reviewerName, 'نگار ت.');
    assert.equal(reviews.body[0].specialistId, specialistId);
    const packed = JSON.stringify(reviews.body);
    assert.equal(packed.includes('تستی'), false);
    assert.equal(packed.includes('+989134'), false);
    assert.equal(packed.includes('هنوز نه'), false);
    assert.equal(packed.includes('رد شد'), false);

    const mine = await request(api.getHttpServer())
      .get('/v1/me/specialist')
      .set('Authorization', `Bearer ${userToken}`);
    assert.equal(mine.status, 200);
    assert.equal(mine.body.id, specialistId);
    assert.equal(mine.body.displayName, 'دکتر یازدهم');
    assert.equal(mine.body.averageRating, 5);
    assert.equal(mine.body.reviewCount, 1);
    assert.equal(JSON.stringify(mine.body).includes('+989134'), false);
    assert.equal(mine.body.phone, undefined);

    const directoryList = await request(api.getHttpServer()).get('/v1/specialists');
    assert.equal(directoryList.status, 200);
    assert.equal(
      (directoryList.body as Array<{ id: string }>).some((row) => row.id === specialistId),
      false,
    );

    const empty = await request(api.getHttpServer())
      .get('/v1/me/specialist')
      .set('Authorization', `Bearer ${otherToken}`);
    assert.equal(empty.status, 200);
    assert.equal(empty.body?.id, undefined);
    assert.equal(empty.body?.displayName, undefined);

    const guest = await request(api.getHttpServer()).get('/v1/me/specialist');
    assert.equal(guest.status, 401);
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
