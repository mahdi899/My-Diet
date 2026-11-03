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

describe('phase 4 product', { concurrency: 1, timeout: 180_000 }, () => {
  let directory = '';
  let stopDatabase: (() => Promise<void>) | undefined;
  let api: INestApplication;
  let pool: Pool;
  let remembered: (phone: string) => string | undefined;
  let adminToken = '';

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
    const adminId = uuidv7();
    await pool.query(
      `insert into users (id, phone_e164, role, display_name) values ($1, '+989127000000', 'admin', 'مدیر')`,
      [adminId],
    );
    await pool.query(`insert into wallets (user_id) values ($1)`, [adminId]);
    adminToken = (await loginAdmin(api, pool, '09127000000')).accessToken;
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

  it('expires an old pending payment and leaves a fresh one to be credited once', async () => {
    const user = await login('09127000001');
    const denied = await request(api.getHttpServer())
      .post('/v1/admin/maintenance')
      .set('Authorization', `Bearer ${user.accessToken}`);
    assert.equal(denied.status, 403);
    const stale = await request(api.getHttpServer())
      .post('/v1/me/topups')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ packageCode: 'p50' });
    assertOk(stale);
    const waiting = await request(api.getHttpServer())
      .post('/v1/me/topups')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ packageCode: 'p50' });
    assertOk(waiting);
    const fresh = await request(api.getHttpServer())
      .post('/v1/me/topups')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ packageCode: 'p50' });
    assertOk(fresh);
    await pool.query(`update payments set created_at = now() - interval '31 minutes' where id = $1`, [stale.body.paymentId]);
    await pool.query(`update payments set created_at = now() - interval '20 minutes' where id = $1`, [waiting.body.paymentId]);
    const report = await request(api.getHttpServer())
      .post('/v1/admin/maintenance')
      .set('Authorization', `Bearer ${adminToken}`);
    assertOk(report);
    assert.equal(report.body.expiredPayments, 1);
    assert.equal(report.body.inquiredPayments, 1);
    assert.equal(JSON.stringify(report.body).includes('+989'), false);
    const closed = await request(api.getHttpServer())
      .post('/v1/payments/sandbox/complete')
      .send({ paymentId: stale.body.paymentId });
    assert.equal(closed.status, 409);
    const done = await request(api.getHttpServer())
      .post('/v1/payments/sandbox/complete')
      .send({ paymentId: fresh.body.paymentId });
    assertOk(done);
    assert.equal(done.body.cashToman, 200000);
    const again = await request(api.getHttpServer())
      .post('/v1/payments/sandbox/complete')
      .send({ paymentId: fresh.body.paymentId });
    assertOk(again);
    assert.equal(again.body.cashToman, 200000);
    const rows = await pool.query<{ status: string }>(
      `select status from payments where id = any($1::uuid[]) order by created_at`,
      [[stale.body.paymentId, waiting.body.paymentId, fresh.body.paymentId]],
    );
    assert.deepEqual(rows.rows.map((row) => row.status), ['failed', 'pending', 'credited']);
  });

  it('requeues a stuck draft, clears old secrets, and reports a ledger mismatch', async () => {
    const patient = uuidv7();
    await pool.query(`insert into users (id, phone_e164, role) values ($1, '+989127000099', 'user')`, [patient]);
    await pool.query(`insert into wallets (user_id) values ($1)`, [patient]);
    const mismatch = uuidv7();
    await pool.query(`insert into users (id, phone_e164, role) values ($1, '+989127000088', 'user')`, [mismatch]);
    await pool.query(`insert into wallets (user_id, cash_toman) values ($1, 50)`, [mismatch]);
    const submission = uuidv7();
    await pool.query(
      `insert into questionnaire_submissions (id, user_id, schema_version, answers) values ($1, $2, 1, '{}'::jsonb)`,
      [submission, patient],
    );
    const stuckOrder = uuidv7();
    const savedOrder = uuidv7();
    await pool.query(
      `insert into orders (id, user_id, service_code, price_toman, cash_toman, promo_toman, status, idempotency_key)
       values ($1, $2, 'new_plan', 500000, 500000, 0, 'paid', $3), ($4, $2, 'new_plan', 500000, 500000, 0, 'paid', $5)`,
      [stuckOrder, patient, `stuck-${stuckOrder}`, savedOrder, `saved-${savedOrder}`],
    );
    const stuck = uuidv7();
    const saved = uuidv7();
    await pool.query(
      `insert into plan_requests (id, user_id, order_id, kind, status, submission_id, price_toman, updated_at)
       values
         ($1, $2, $3, 'new_plan', 'generating', $4, 500000, now() - interval '20 minutes'),
         ($5, $2, $6, 'new_plan', 'generating', $4, 500000, now() - interval '20 minutes')`,
      [stuck, patient, stuckOrder, submission, saved, savedOrder],
    );
    await pool.query(
      `insert into plan_versions (id, request_id, version_number, status) values ($1, $2, 1, 'draft')`,
      [uuidv7(), saved],
    );
    await pool.query(
      `insert into ai_generations (id, request_id, provider, status, raw_output, created_at)
       values ($1, $2, 'fake', 'drafted', 'enc1:old', now() - interval '31 days'),
              ($3, $4, 'fake', 'drafted', 'enc1:new', now() - interval '1 day')`,
      [uuidv7(), stuck, uuidv7(), saved],
    );
    const oldOtp = uuidv7();
    const newOtp = uuidv7();
    await pool.query(
      `insert into otp_challenges (id, phone_e164, code_hmac, ip, expires_at, created_at)
       values ($1, '+989127000077', 'old', '127.0.0.1', now(), now() - interval '8 days'),
              ($2, '+989127000077', 'new', '127.0.0.1', now(), now() - interval '1 hour')`,
      [oldOtp, newOtp],
    );
    const admin = await pool.query<{ id: string }>(`select id from users where phone_e164 = '+989127000000'`);
    const oldTotp = uuidv7();
    await pool.query(
      `insert into totp_challenges (id, user_id, token_hash, expires_at, created_at)
       values ($1, $2, $3, now(), now() - interval '8 days')`,
      [oldTotp, admin.rows[0]!.id, `totp-${oldTotp}`],
    );

    const report = await request(api.getHttpServer())
      .post('/v1/admin/maintenance')
      .set('Authorization', `Bearer ${adminToken}`);
    assertOk(report);
    assert.equal(report.body.requeuedDrafts, 1);
    assert.equal(report.body.resumedDrafts, 1);
    assert.equal(report.body.purgedOtpChallenges, 1);
    assert.equal(report.body.purgedTotpChallenges, 1);
    assert.equal(report.body.clearedAiOutputs, 1);
    assert.equal(report.body.ledgerMismatches, 1);
    assert.deepEqual(report.body.ledgerMismatchUserIds, [mismatch]);
    const stuckRow = await pool.query<{ status: string }>(`select status from plan_requests where id = $1`, [stuck]);
    assert.equal(stuckRow.rows[0]?.status, 'queued');
    const savedRow = await pool.query<{ status: string }>(`select status from plan_requests where id = $1`, [saved]);
    assert.equal(savedRow.rows[0]?.status, 'in_review');
    const outbox = await pool.query(
      `select id from outbox_events where topic = 'plan.generate' and aggregate_id = $1 and dispatched_at is null`,
      [stuck],
    );
    assert.equal(outbox.rowCount, 1);
    const raw = await pool.query<{ raw_output: string | null }>(
      `select raw_output from ai_generations where request_id = any($1::uuid[]) order by created_at`,
      [[stuck, saved]],
    );
    assert.deepEqual(raw.rows.map((row) => row.raw_output), [null, 'enc1:new']);
    const otp = await pool.query(`select id from otp_challenges where id = any($1::uuid[])`, [[oldOtp, newOtp]]);
    assert.deepEqual(otp.rows.map((row) => row.id), [newOtp]);
    const second = await request(api.getHttpServer())
      .post('/v1/admin/maintenance')
      .set('Authorization', `Bearer ${adminToken}`);
    assertOk(second);
    assert.equal(second.body.requeuedDrafts, 0);
    const outboxAgain = await pool.query(
      `select id from outbox_events where topic = 'plan.generate' and aggregate_id = $1`,
      [stuck],
    );
    assert.equal(outboxAgain.rowCount, 1);
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
