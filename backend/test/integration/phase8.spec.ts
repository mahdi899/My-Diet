import { mkdtemp, rm } from 'fs/promises';
import { installGracefulStop } from '../helpers/postgres-stop.js';
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
import { questionnaireView } from '../../src/questionnaire/schema.js';

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

const answers = {
  name: 'تست کاربر',
  age: 30,
  sex: 'female',
  heightCm: 170,
  weightKg: 80,
  goal: 'weight_loss',
  lifeStage: 'none',
  targetWeightKg: 70,
  previousDiet: 'none',
  health: ['none'],
  activity: 'light',
  exercise: '1_2',
  sleep: '7_to_9',
  mealPattern: 'regular',
  water: '4_to_6',
  preference: 'iranian',
  budget: 'medium',
  cooking: '30_to_60',
};

describe('phase 8 product', { concurrency: 1, timeout: 180_000 }, () => {
  let directory = '';
  let stopDatabase: (() => Promise<void>) | undefined;
  let api: INestApplication;
  let pool: Pool;
  let remembered: (phone: string) => string | undefined;
  let userToken = '';
  let userId = '';
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
    delete process.env.SABZINE_NOW;
    const { migrateUp } = await import('../../dist/database/migrate.js');
    await migrateUp(databaseUrl);
    const { createApp } = await import('../../dist/bootstrap.js');
    api = (await createApp()).app;
    await api.listen(0);
    const { PG_POOL } = await import('../../dist/database/database.js');
    pool = api.get(PG_POOL);
    remembered = (await import('../../dist/adapters/sms.js')).rememberedOtp;
    const user = await login('09131000001');
    userToken = user.accessToken;
    userId = user.userId;
    const adminId = uuidv7();
    await pool.query(
      `insert into users (id, phone_e164, role, display_name) values ($1, '+989131000000', 'admin', 'مدیر')`,
      [adminId],
    );
    await pool.query(`insert into wallets (user_id) values ($1)`, [adminId]);
    adminToken = (await loginAdmin(api, pool, '09131000000')).accessToken;
  });

  after(async () => {
    delete process.env.SABZINE_NOW;
    await api?.close().catch(() => undefined);
    try {
      if (stopDatabase) await stopDatabase();
    } catch {
      // Windows can keep the data directory locked briefly after stop.
    }
    if (directory) await rm(directory, { recursive: true, force: true }).catch(() => undefined);
  });

  it('moves a current user back to the questionnaire when a required question is published', async () => {
    const guest = await request(api.getHttpServer()).get('/v1/me/acquisition-state');
    assert.equal(guest.status, 401);
    const missing = await request(api.getHttpServer())
      .get('/v1/me/acquisition-state')
      .set('Authorization', `Bearer ${userToken}`);
    assert.equal(missing.status, 200);
    assert.equal(missing.body.questionnaire, 'missing');
    assert.equal(missing.body.nextStep, 'questionnaire');
    assert.deepEqual(missing.body.wallet, { cashToman: 0, promoToman: 0 });

    const saved = await request(api.getHttpServer())
      .post('/v1/me/questionnaire/submissions')
      .set('Authorization', `Bearer ${userToken}`)
      .send(answers);
    assertOk(saved);
    const ready = await request(api.getHttpServer())
      .get('/v1/me/acquisition-state')
      .set('Authorization', `Bearer ${userToken}`);
    assert.equal(ready.status, 200);
    assert.equal(ready.body.questionnaire, 'complete');
    assert.equal(ready.body.nextStep, 'select_service');
    assert.equal(ready.body.pregnancyWeek, null);

    const orderId = uuidv7();
    const requestId = uuidv7();
    await pool.query(
      `insert into orders (id, user_id, service_code, price_toman, cash_toman, promo_toman, status, idempotency_key)
       values ($1, $2, 'new_plan', 500000, 0, 0, 'paid', 'phase8')`,
      [orderId, userId],
    );
    await pool.query(
      `insert into plan_requests (id, user_id, order_id, kind, status, submission_id, price_toman)
       values ($1, $2, $3, 'new_plan', 'in_review', $4, 500000)`,
      [requestId, userId, orderId, saved.body.id],
    );
    const before = await pool.query<{ status: string; updated_at: Date }>(
      `select status, updated_at from plan_requests where id = $1`,
      [requestId],
    );

    const questions = questionnaireView().questions.map((question) => ({
      id: question.id,
      title: question.id === 'name' ? 'نام' : question.title,
      kind: question.kind,
      options: question.options,
    }));
    const draft = await request(api.getHttpServer())
      .post('/v1/admin/questionnaire/schemas')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ questions: [...questions, { id: 'custom_note', title: 'یادداشت', kind: 'text', required: true }] });
    assertOk(draft);
    const published = await request(api.getHttpServer())
      .post(`/v1/admin/questionnaire/schemas/${draft.body.version}/publish`)
      .set('Authorization', `Bearer ${adminToken}`);
    assertOk(published);

    const review = await request(api.getHttpServer())
      .get('/v1/me/acquisition-state')
      .set('Authorization', `Bearer ${userToken}`);
    assert.equal(review.status, 200);
    assert.equal(review.body.questionnaire, 'needs_review');
    assert.deepEqual(review.body.reasons, ['schema_required_question_added']);
    assert.equal(review.body.nextStep, 'questionnaire');
    assert.equal(review.body.openRequest.id, requestId);
    assert.equal(review.body.openRequest.status, 'in_review');

    const afterPlan = await pool.query<{ status: string; updated_at: Date }>(
      `select status, updated_at from plan_requests where id = $1`,
      [requestId],
    );
    assert.equal(afterPlan.rows[0]?.status, before.rows[0]?.status);
    assert.equal(afterPlan.rows[0]?.updated_at.getTime(), before.rows[0]?.updated_at.getTime());

    const denied = await request(api.getHttpServer())
      .get('/v1/me/acquisition-state')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(denied.status, 403);
  });

  it('derives a pregnancy week five weeks later and asks for review', async () => {
    process.env.SABZINE_NOW = '2026-09-01T08:00:00.000Z';
    const pregnant = await login('09131000002');
    const saved = await request(api.getHttpServer())
      .post('/v1/me/questionnaire/submissions')
      .set('Authorization', `Bearer ${pregnant.accessToken}`)
      .send({
        ...answers,
        goal: 'weight_maintenance',
        lifeStage: 'pregnant',
        pregnancyWeek: 10,
        prePregnancyWeightKg: 70,
        babies: 'singleton',
        targetWeightKg: undefined,
        custom_note: 'ندارم',
      });
    assertOk(saved);
    process.env.SABZINE_NOW = '2026-10-06T08:00:00.000Z';
    const state = await request(api.getHttpServer())
      .get('/v1/me/acquisition-state')
      .set('Authorization', `Bearer ${pregnant.accessToken}`);
    assert.equal(state.status, 200);
    assert.equal(state.body.pregnancyWeek, 15);
    assert.deepEqual(state.body.reasons, ['pregnancy_stale']);
    assert.equal(state.body.nextStep, 'questionnaire');
    delete process.env.SABZINE_NOW;
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
