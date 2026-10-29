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
import { tehranToday } from '../../src/common/time.js';
import { uuidv7 } from '../../src/common/id.js';

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

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Could not allocate a port'));
        return;
      }
      const { port } = address;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

function assertOk(res: { status: number; body: unknown }): void {
  assert.ok(res.status === 200 || res.status === 201, `${res.status} ${JSON.stringify(res.body)}`);
}

describe('phase 1 product', { concurrency: 1, timeout: 180_000 }, () => {
  let directory = '';
  let stopDatabase: (() => Promise<void>) | undefined;
  let api: INestApplication;
  let worker: INestApplication;
  let pool: Pool;
  let remembered: (phone: string) => string | undefined;
  let adminToken = '';
  let specialistToken = '';
  let specialistId = '';

  before(async () => {
    process.env.SABZINE_NOW = '2026-10-30T08:30:00.000Z';
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

    process.env.APP_ROLE = 'worker';
    worker = (await createApp()).app;
    process.env.APP_ROLE = 'api';

    const adminId = uuidv7();
    await pool.query(
      `insert into users (id, phone_e164, role, display_name) values ($1, '+989120000001', 'admin', 'مدیر')`,
      [adminId],
    );
    await pool.query(`insert into wallets (user_id) values ($1)`, [adminId]);
    adminToken = (await login('09120000001')).accessToken;
    const created = await request(api.getHttpServer())
      .post('/v1/admin/specialists')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ phone: '09120000002', displayName: 'دکتر تست', credential: 'تغذیه' });
    assertOk(created);
    specialistId = created.body.id as string;
    specialistToken = (await login('09120000002')).accessToken;
  });

  after(async () => {
    await worker?.close().catch(() => undefined);
    await api?.close().catch(() => undefined);
    try {
      if (stopDatabase) await stopDatabase();
    } catch {
      // Windows can keep the data directory locked briefly after shutdown.
    }
    if (!directory) return;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        await rm(directory, { recursive: true, force: true });
        return;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }
  });

  it('has no demo login and does not expose the development OTP route', async () => {
    const demo = await request(api.getHttpServer())
      .post('/v1/auth/otp/verify')
      .send({ phone: '09120000000', code: '123456' });
    assert.equal(demo.status, 401);
    const latest = await request(api.getHttpServer()).get('/v1/auth/otp/latest').query({ phone: '09120000001' });
    assert.equal(latest.status, 404);
  });

  it('rejects card fields and starts from an empty wallet', async () => {
    const session = await login('09120000003');
    const wallet = await request(api.getHttpServer())
      .get('/v1/me/wallet')
      .set('Authorization', `Bearer ${session.accessToken}`);
    assert.equal(wallet.status, 200);
    assert.deepEqual(wallet.body, { cashToman: 0, promoToman: 0 });
    const card = await request(api.getHttpServer())
      .post('/v1/me/topups')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ packageCode: 'p50', cardNumber: '6219', cvv: '123' });
    assert.equal(card.status, 400);
    assert.equal(card.body.code, 'validation');
  });

  it('does not extend a session when the refresh token rotates, and reuse revokes it', async () => {
    const first = await login('09120000009');
    const rotated = await request(api.getHttpServer())
      .post('/v1/auth/refresh')
      .send({ refreshToken: first.refreshToken });
    assertOk(rotated);
    assert.equal(rotated.body.sessionExpiresAt, first.sessionExpiresAt);
    assert.notEqual(rotated.body.refreshToken, first.refreshToken);
    const reused = await request(api.getHttpServer())
      .post('/v1/auth/refresh')
      .send({ refreshToken: first.refreshToken });
    assert.equal(reused.status, 401);
    const after = await request(api.getHttpServer())
      .post('/v1/auth/refresh')
      .send({ refreshToken: rotated.body.refreshToken });
    assert.equal(after.status, 401);
  });

  it('debits once for a repeated order and refuses a second open request', async () => {
    const session = await login('09120000004');
    await submit(session.accessToken);
    await credit(session.accessToken, 'p200');
    const key = `order-${uuidv7()}`;
    const [left, right] = await Promise.all([
      order(session.accessToken, key),
      order(session.accessToken, key),
    ]);
    assertOk(left);
    assertOk(right);
    assert.equal(left.body.orderId, right.body.orderId);
    const wallet = await request(api.getHttpServer())
      .get('/v1/me/wallet')
      .set('Authorization', `Bearer ${session.accessToken}`);
    assert.deepEqual(wallet.body, { cashToman: 0, promoToman: 0 });
    const again = await order(session.accessToken, `order-${uuidv7()}`);
    assert.equal(again.status, 409);
    assert.equal(again.body.code, 'request_in_progress');
  });

  it('refuses an order the wallet cannot pay and a stale price', async () => {
    const broke = await login('09120000005');
    await submit(broke.accessToken);
    const denied = await order(broke.accessToken, `order-${uuidv7()}`);
    assert.equal(denied.status, 409);
    assert.equal(denied.body.code, 'insufficient_balance');

    const priced = await login('09120000006');
    await submit(priced.accessToken);
    await request(api.getHttpServer())
      .put('/v1/admin/prices')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ serviceCode: 'new_plan', amountToman: 600000 })
      .expect(200);
    try {
      const changed = await order(priced.accessToken, `order-${uuidv7()}`);
      assert.equal(changed.status, 409);
      assert.equal(changed.body.code, 'price_changed');
    } finally {
      await request(api.getHttpServer())
        .put('/v1/admin/prices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ serviceCode: 'new_plan', amountToman: 500000 })
        .expect(200);
    }
  });

  it('refunds a paid order before the specialist edits it', async () => {
    const session = await login('09120000007');
    await submit(session.accessToken);
    await credit(session.accessToken, 'p200');
    const placed = await order(session.accessToken, `order-${uuidv7()}`);
    assertOk(placed);
    const cancelled = await request(api.getHttpServer())
      .post(`/v1/me/orders/${placed.body.orderId}/cancel`)
      .set('Authorization', `Bearer ${session.accessToken}`);
    assertOk(cancelled);
    assert.deepEqual(cancelled.body, { cashToman: 500000, promoToman: 0 });
  });

  it('runs the review path and pays the weekly reward once', async () => {
    const session = await login('09120000011');
    const token = session.accessToken;
    await submit(token);
    await credit(token, 'p200');
    const placed = await order(token, `order-${uuidv7()}`);
    assertOk(placed);
    const queued = await pool.query<{ topic: string }>(
      `select topic from outbox_events where aggregate_id = $1`,
      [placed.body.requestId],
    );
    assert.equal(queued.rows[0]?.topic, 'plan.generate');
    const { PlanDraftService } = await import('../../dist/plans/plans.service.js');
    await api.get(PlanDraftService).generate(placed.body.requestId as string);

    const detail = await request(api.getHttpServer())
      .get(`/v1/specialist/requests/${placed.body.requestId}`)
      .set('Authorization', `Bearer ${specialistToken}`);
    assert.equal(detail.status, 200);
    assert.equal(JSON.stringify(detail.body).includes('+98912'), false);
    const lock = detail.body.version.lockVersion as number;
    const blocked = await request(api.getHttpServer())
      .post(`/v1/specialist/requests/${placed.body.requestId}/questions`)
      .set('Authorization', `Bearer ${specialistToken}`)
      .send({ prompt: 'قند ناشتا چند است؟' });
    assertOk(blocked);
    const early = await request(api.getHttpServer())
      .post(`/v1/specialist/requests/${placed.body.requestId}/publish`)
      .set('Authorization', `Bearer ${specialistToken}`)
      .set('If-Match', String(lock));
    assert.equal(early.status, 409);
    assert.equal(early.body.code, 'info_required');

    const current = await request(api.getHttpServer())
      .get('/v1/me/request')
      .set('Authorization', `Bearer ${token}`);
    assert.equal(current.body.status, 'awaiting_user');
    const chat = await request(api.getHttpServer())
      .post(`/v1/conversations/${current.body.conversationId}/messages`)
      .set('Authorization', `Bearer ${token}`)
      .send({ body: 'سلام' });
    assertOk(chat);
    const afterChat = await request(api.getHttpServer())
      .get('/v1/me/request')
      .set('Authorization', `Bearer ${token}`);
    assert.equal(afterChat.body.status, 'awaiting_user');

    const questionId = afterChat.body.questions[0].id as string;
    const answered = await request(api.getHttpServer())
      .post(`/v1/me/info-questions/${questionId}/answers`)
      .set('Authorization', `Bearer ${token}`)
      .send({ body: '۹۵' });
    assertOk(answered);
    const still = await request(api.getHttpServer())
      .post(`/v1/specialist/requests/${placed.body.requestId}/publish`)
      .set('Authorization', `Bearer ${specialistToken}`)
      .set('If-Match', String(lock));
    assert.equal(still.status, 409);
    const acknowledged = await request(api.getHttpServer())
      .post(`/v1/specialist/info-questions/${questionId}/acknowledge`)
      .set('Authorization', `Bearer ${specialistToken}`);
    assertOk(acknowledged);
    const published = await request(api.getHttpServer())
      .post(`/v1/specialist/requests/${placed.body.requestId}/publish`)
      .set('Authorization', `Bearer ${specialistToken}`)
      .set('If-Match', String(lock));
    assertOk(published);

    const plan = await request(api.getHttpServer()).get('/v1/me/plan').set('Authorization', `Bearer ${token}`);
    assert.equal(plan.status, 200);
    const today = tehranToday();
    const friday = plan.body.days.find((day: { date: string }) => day.date === today);
    assert.equal(friday.meals.length, 4);
    assert.equal(friday.meals.every((meal: { loggable: boolean }) => meal.loggable), true);
    let reward: { amountToman: number } | null = null;
    for (const meal of friday.meals as Array<{ mealUid: string }>) {
      const logged = await request(api.getHttpServer())
        .post('/v1/me/meal-logs')
        .set('Authorization', `Bearer ${token}`)
        .send({ mealUid: meal.mealUid, eaten: true });
      assertOk(logged);
      if (logged.body.reward) reward = logged.body.reward;
    }
    assert.deepEqual(reward, { amountToman: 200000 });
    const undone = await request(api.getHttpServer())
      .post('/v1/me/meal-logs')
      .set('Authorization', `Bearer ${token}`)
      .send({ mealUid: friday.meals[0].mealUid, eaten: false });
    assertOk(undone);
    assert.equal(undone.body.reward, null);
    const wallet = await request(api.getHttpServer()).get('/v1/me/wallet').set('Authorization', `Bearer ${token}`);
    assert.deepEqual(wallet.body, { cashToman: 0, promoToman: 200000 });

    const reviewed = await request(api.getHttpServer())
      .post('/v1/me/reviews')
      .set('Authorization', `Bearer ${token}`)
      .send({ requestId: plan.body.requestId, weekStart: plan.body.weekStart, rating: 5, body: 'خوب بود' });
    assertOk(reviewed);
    const hidden = await request(api.getHttpServer()).get('/v1/specialists');
    const doctor = hidden.body.find((row: { id: string }) => row.id === specialistId);
    assert.equal(doctor.averageRating, null);
    assert.equal(Object.hasOwn(doctor, 'phone'), false);
    const approved = await request(api.getHttpServer())
      .post(`/v1/admin/reviews/${reviewed.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'approved' });
    assertOk(approved);
    const shown = await request(api.getHttpServer()).get('/v1/specialists');
    const rated = shown.body.find((row: { id: string }) => row.id === specialistId);
    assert.equal(rated.averageRating, 5);
    assert.equal(rated.reviewCount, 1);

    await assert.rejects(pool.query(`update plan_meals set title = 'x' where meal_uid = $1`, [friday.meals[0].mealUid]));
    const me = await request(api.getHttpServer()).get('/v1/me').set('Authorization', `Bearer ${token}`);
    await assert.rejects(pool.query(`update wallet_ledger set amount_toman = 1 where user_id = $1`, [me.body.id]));
  });

  async function login(phone: string): Promise<{ accessToken: string; refreshToken: string; sessionExpiresAt: string }> {
    const requested = await request(api.getHttpServer()).post('/v1/auth/otp/request').send({ phone });
    assertOk(requested);
    const code = remembered(normalizeIranianMobile(phone));
    assert.ok(code && code !== '123456');
    const wrong = await request(api.getHttpServer()).post('/v1/auth/otp/verify').send({ phone, code: '123456' });
    assert.equal(wrong.status, 401);
    const verified = await request(api.getHttpServer()).post('/v1/auth/otp/verify').send({ phone, code });
    assertOk(verified);
    return verified.body;
  }

  async function submit(token: string, health: string[] = ['none'], healthDetails = ''): Promise<void> {
    const saved = await request(api.getHttpServer())
      .post('/v1/me/questionnaire/submissions')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...answers, health, healthDetails });
    assertOk(saved);
  }

  async function credit(token: string, packageCode: string): Promise<void> {
    const started = await request(api.getHttpServer())
      .post('/v1/me/topups')
      .set('Authorization', `Bearer ${token}`)
      .send({ packageCode });
    assertOk(started);
    const done = await request(api.getHttpServer())
      .post('/v1/payments/sandbox/complete')
      .send({ paymentId: started.body.paymentId });
    assertOk(done);
  }

  function order(token: string, key: string) {
    return request(api.getHttpServer())
      .post('/v1/me/orders')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', key)
      .send({ serviceCode: 'new_plan', expectedPriceToman: 500000 });
  }
});
