import { mkdtemp, rm } from 'fs/promises';
import { loginAdmin } from '../helpers/admin-login.js';
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

describe('phase 13 product', { concurrency: 1, timeout: 180_000 }, () => {
  let directory = '';
  let stopDatabase: (() => Promise<void>) | undefined;
  let api: INestApplication;
  let pool: Pool;
  let remembered: (phone: string) => string | undefined;
  let userToken = '';
  let specialistToken = '';
  let otherToken = '';
  let adminToken = '';
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
    specialistId = uuidv7();
    const otherId = uuidv7();
    const adminId = uuidv7();
    await pool.query(
      `insert into users (id, phone_e164, role, display_name) values
       ($1, '+989136000001', 'user', 'کاربر سیزدهم'),
       ($2, '+989136000002', 'specialist', 'دکتر سیزدهم'),
       ($3, '+989136000003', 'specialist', 'دکتر دیگر'),
       ($4, '+989136000000', 'admin', 'مدیر سیزدهم')`,
      [patientId, specialistId, otherId, adminId],
    );
    await pool.query(`insert into wallets (user_id) values ($1), ($2), ($3), ($4)`, [
      patientId,
      specialistId,
      otherId,
      adminId,
    ]);
    await pool.query(
      `insert into specialist_profiles (user_id, display_name, credential, bio, medical_council_no, verification_status) values
       ($1, 'دکتر سیزدهم', 'تغذیه', 'بیو', '12345', 'verified'),
       ($2, 'دکتر دیگر', 'تغذیه', 'بیو', '67890', 'verified')`,
      [specialistId, otherId],
    );
    const submissionId = uuidv7();
    const orderId = uuidv7();
    const requestId = uuidv7();
    await pool.query(
      `insert into questionnaire_submissions (id, user_id, schema_version, answers) values ($1, $2, 1, '{}'::jsonb)`,
      [submissionId, patientId],
    );
    await pool.query(
      `insert into orders (id, user_id, service_code, price_toman, cash_toman, promo_toman, status, idempotency_key)
       values ($1, $2, 'new_plan', 500000, 0, 0, 'paid', 'phase13')`,
      [orderId, patientId],
    );
    await pool.query(
      `insert into plan_requests (id, user_id, order_id, kind, status, submission_id, assigned_specialist_id, price_toman)
       values ($1, $2, $3, 'new_plan', 'in_review', $4, $5, 500000)`,
      [requestId, patientId, orderId, submissionId, specialistId],
    );
    userToken = (await login('09136000001')).accessToken;
    specialistToken = (await login('09136000002')).accessToken;
    otherToken = (await login('09136000003')).accessToken;
    adminToken = (await loginAdmin(api, pool, '09136000000')).accessToken;
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

  it('keeps verification until the council number changes, and hides that number from patients', async () => {
    const denied = await request(api.getHttpServer())
      .get('/v1/specialist/profile')
      .set('Authorization', `Bearer ${userToken}`);
    assert.equal(denied.status, 403);

    const own = await request(api.getHttpServer())
      .get('/v1/specialist/profile')
      .set('Authorization', `Bearer ${specialistToken}`);
    assert.equal(own.status, 200);
    assert.equal(own.body.councilNo, '12345');
    assert.equal(own.body.verificationStatus, 'verified');
    assert.equal(JSON.stringify(own.body).includes('+989136'), false);
    assert.equal(own.body.phone, undefined);

    const same = await request(api.getHttpServer())
      .put('/v1/specialist/profile')
      .set('Authorization', `Bearer ${specialistToken}`)
      .send({ bio: 'بیو تازه', councilNo: '۱۲۳۴۵' });
    assertOk(same);
    assert.equal(same.body.bio, 'بیو تازه');
    assert.equal(same.body.councilNo, '12345');
    assert.equal(same.body.verificationStatus, 'verified');

    const taken = await request(api.getHttpServer())
      .put('/v1/specialist/profile')
      .set('Authorization', `Bearer ${specialistToken}`)
      .send({ councilNo: '67890' });
    assert.equal(taken.status, 409);

    const changed = await request(api.getHttpServer())
      .put('/v1/specialist/profile')
      .set('Authorization', `Bearer ${specialistToken}`)
      .send({ councilNo: '54321' });
    assertOk(changed);
    assert.equal(changed.body.councilNo, '54321');
    assert.equal(changed.body.verificationStatus, 'pending');

    const selfVerify = await request(api.getHttpServer())
      .post(`/v1/admin/specialists/${specialistId}/verification`)
      .set('Authorization', `Bearer ${specialistToken}`)
      .send({ status: 'verified' });
    assert.equal(selfVerify.status, 403);
    const verified = await request(api.getHttpServer())
      .post(`/v1/admin/specialists/${specialistId}/verification`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'verified' });
    assertOk(verified);
    assert.equal(verified.body.verificationStatus, 'verified');

    const listed = await request(api.getHttpServer()).get('/v1/specialists');
    assert.equal(listed.status, 200);
    assert.equal(JSON.stringify(listed.body).includes('54321'), false);
    assert.equal(JSON.stringify(listed.body).includes('councilNo'), false);

    const assigned = await request(api.getHttpServer())
      .get('/v1/me/specialist')
      .set('Authorization', `Bearer ${userToken}`);
    assert.equal(assigned.status, 200);
    assert.equal(assigned.body.displayName, 'دکتر سیزدهم');
    assert.equal(assigned.body.councilNo, undefined);
    assert.equal(assigned.body.verificationStatus, undefined);
    assert.equal(otherToken.length > 0, true);
  });

  async function login(phone: string): Promise<{ accessToken: string }> {
    const requested = await request(api.getHttpServer()).post('/v1/auth/otp/request').send({ phone });
    assertOk(requested);
    const code = remembered(normalizeIranianMobile(phone));
    assert.ok(code);
    const verified = await request(api.getHttpServer()).post('/v1/auth/otp/verify').send({ phone, code });
    assertOk(verified);
    return verified.body as { accessToken: string };
  }
});
