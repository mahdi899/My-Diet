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

describe('phase 7 product', { concurrency: 1, timeout: 180_000 }, () => {
  let directory = '';
  let stopDatabase: (() => Promise<void>) | undefined;
  let api: INestApplication;
  let pool: Pool;
  let remembered: (phone: string) => string | undefined;
  let patientToken = '';
  let patientId = '';
  let specialistToken = '';

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
    const patient = await login('09130000001');
    patientToken = patient.accessToken;
    patientId = patient.userId;
    const specialistId = uuidv7();
    await pool.query(
      `insert into users (id, phone_e164, role, display_name) values ($1, '+989130000002', 'specialist', 'دکتر هفتم')`,
      [specialistId],
    );
    await pool.query(`insert into wallets (user_id) values ($1)`, [specialistId]);
    await pool.query(`insert into specialist_profiles(user_id,display_name,credential,verification_status)
      values($1,'Test specialist','nutrition','verified')`, [specialistId]);
    specialistToken = (await login('09130000002')).accessToken;
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

  it('shows the specialist an allergy warning and hides the phone from that warning', async () => {
    const submission = uuidv7();
    await pool.query(
      `insert into questionnaire_submissions (id, user_id, schema_version, answers)
       values ($1, $2, 1, $3::jsonb)`,
      [
        submission,
        patientId,
        JSON.stringify({
          name: 'نگار تست',
          age: 30,
          sex: 'female',
          heightCm: 170,
          weightKg: 70,
          goal: 'weight_loss',
          lifeStage: 'none',
          health: ['food_allergy'],
          healthDetails: `شناسه ${patientId}`,
          allergies: 'حساسیت به پنیر تماس 09121111111',
          medicines: '',
          dislikes: '',
          preference: 'home',
          budget: 'mid',
          cooking: 'self',
        }),
      ],
    );
    const order = uuidv7();
    const requestId = uuidv7();
    const specialist = await pool.query<{ id: string }>(
      `select id from users where phone_e164 = '+989130000002'`,
    );
    await pool.query(
      `insert into orders (id, user_id, service_code, price_toman, cash_toman, promo_toman, status, idempotency_key)
       values ($1, $2, 'new_plan', 500000, 500000, 0, 'paid', $3)`,
      [order, patientId, `order-${order}`],
    );
    await pool.query(
      `insert into plan_requests (id, user_id, order_id, kind, status, submission_id, assigned_specialist_id, price_toman)
       values ($1, $2, $3, 'new_plan', 'queued', $4, $5, 500000)`,
      [requestId, patientId, order, submission, specialist.rows[0]!.id],
    );
    const { PlanDraftService } = await import('../../dist/plans/plans.service.js');
    await api.get(PlanDraftService).generate(requestId);

    const staff = await request(api.getHttpServer())
      .get(`/v1/specialist/requests/${requestId}`)
      .set('Authorization', `Bearer ${specialistToken}`);
    assert.equal(staff.status, 200);
    const warnings = staff.body.warnings as Array<{ code: string; term?: string }>;
    assert.equal(warnings.some((warning) => warning.code === 'matches_allergy' && warning.term === 'پنیر'), true);
    const packed = JSON.stringify(staff.body.warnings);
    assert.equal(packed.includes('09121111111'), false);
    assert.equal(packed.includes(patientId), false);
    assert.equal(packed.includes('+98913'), false);

    const mine = await request(api.getHttpServer())
      .get('/v1/me/request')
      .set('Authorization', `Bearer ${patientToken}`);
    assert.equal(mine.status, 200);
    assert.equal(mine.body.warnings, undefined);
    assert.equal(JSON.stringify(mine.body).includes('09121111111'), false);
  });

  async function login(phone: string): Promise<{ accessToken: string; userId: string }> {
    const requested = await request(api.getHttpServer()).post('/v1/auth/otp/request').send({ phone });
    assertOk(requested);
    const code = remembered(normalizeIranianMobile(phone));
    assert.ok(code);
    const verified = await request(api.getHttpServer()).post('/v1/auth/otp/verify').send({ phone, code });
    assertOk(verified);
    const me = await request(api.getHttpServer())
      .get('/v1/me')
      .set('Authorization', `Bearer ${verified.body.accessToken}`);
    return { accessToken: verified.body.accessToken as string, userId: me.body.id as string };
  }
});
