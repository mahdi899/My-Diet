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
import { uuidv7 } from '../../src/common/id.js';
import { normalizeIranianMobile } from '../../src/common/phone.js';
import { addCivilDays } from '../../src/common/time.js';

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

describe('phase 15 product', { concurrency: 1, timeout: 180_000 }, () => {
  let directory = '';
  let stopDatabase: (() => Promise<void>) | undefined;
  let api: INestApplication;
  let pool: Pool;
  let remembered: (phone: string) => string | undefined;
  let userToken = '';
  let otherToken = '';
  let specialistToken = '';
  let otherSpecialistToken = '';
  let adminToken = '';
  let userId = '';
  let specialistId = '';
  let requestId = '';
  let cancelRequestId = '';
  let openRequestId = '';
  let orderId = '';
  let paymentId = '';
  let publishedVersionId = '';

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

    userId = uuidv7();
    const otherId = uuidv7();
    specialistId = uuidv7();
    const otherSpecialistId = uuidv7();
    const adminId = uuidv7();
    await pool.query(
      `insert into users (id, phone_e164, role, display_name) values
       ($1, '+989138000001', 'user', 'کاربر پانزدهم'),
       ($2, '+989138000002', 'user', 'کاربر دیگر'),
       ($3, '+989138000003', 'specialist', 'دکتر پانزدهم'),
       ($4, '+989138000004', 'specialist', 'دکتر دیگر'),
       ($5, '+989138000000', 'admin', 'مدیر پانزدهم')`,
      [userId, otherId, specialistId, otherSpecialistId, adminId],
    );
    await pool.query(`insert into wallets (user_id) values ($1), ($2), ($3), ($4), ($5)`, [
      userId,
      otherId,
      specialistId,
      otherSpecialistId,
      adminId,
    ]);
    await pool.query(
      `insert into specialist_profiles (user_id, display_name, credential, bio, verification_status) values
       ($1, 'دکتر پانزدهم', 'تغذیه', '', 'verified'),
       ($2, 'دکتر دیگر', 'تغذیه', '', 'verified')`,
      [specialistId, otherSpecialistId],
    );
    const submissionId = uuidv7();
    await pool.query(
      `insert into questionnaire_submissions (id, user_id, schema_version, answers) values ($1, $2, 1, '{}'::jsonb)`,
      [submissionId, userId],
    );
    orderId = uuidv7();
    requestId = uuidv7();
    await pool.query(
      `insert into orders (id, user_id, service_code, price_toman, cash_toman, promo_toman, status, idempotency_key)
       values ($1, $2, 'new_plan', 500000, 0, 500000, 'paid', 'phase15-plan')`,
      [orderId, userId],
    );
    await pool.query(
      `insert into plan_requests
         (id, user_id, order_id, kind, status, submission_id, assigned_specialist_id, price_toman, week_start, effective_from)
       values ($1, $2, $3, 'new_plan', 'published', $4, $5, 500000, '2026-10-24', '2026-10-24')`,
      [requestId, userId, orderId, submissionId, specialistId],
    );
    const early = await seedVersion(1, 'قدیمی', '2026-10-24T04:30:00.000Z');
    publishedVersionId = await seedVersion(2, 'جدید', '2026-10-28T04:30:00.000Z');
    await pool.query(`update plan_versions set status = 'superseded' where id = $1`, [early]);
    await pool.query(
      `insert into request_events (id, request_id, actor_id, kind) values ($1, $2, $3, 'published')`,
      [uuidv7(), requestId, specialistId],
    );
    await pool.query(
      `insert into ai_generations (id, request_id, provider, status) values ($1, $2, 'fake', 'drafted')`,
      [uuidv7(), requestId],
    );
    await pool.query(
      `insert into program_reviews (id, user_id, request_id, week_start, rating, body, status)
       values ($1, $2, $3, '2026-10-24', 5, 'عالی بود', 'pending')`,
      [uuidv7(), userId, requestId],
    );
    const cancelOrder = uuidv7();
    cancelRequestId = uuidv7();
    await pool.query(
      `insert into orders (id, user_id, service_code, price_toman, cash_toman, promo_toman, status, idempotency_key)
       values ($1, $2, 'new_plan', 500000, 0, 500000, 'paid', 'phase15-cancel')`,
      [cancelOrder, userId],
    );
    await pool.query(
      `insert into plan_requests (id, user_id, order_id, kind, status, submission_id, assigned_specialist_id, price_toman)
       values ($1, $2, $3, 'new_plan', 'queued', $4, $5, 500000)`,
      [cancelRequestId, userId, cancelOrder, submissionId, specialistId],
    );
    const openOrder = uuidv7();
    openRequestId = uuidv7();
    await pool.query(
      `insert into orders (id, user_id, service_code, price_toman, cash_toman, promo_toman, status, idempotency_key)
       values ($1, $2, 'new_plan', 500000, 0, 0, 'paid', 'phase15-open')`,
      [openOrder, userId],
    );
    await pool.query(
      `insert into plan_requests (id, user_id, order_id, kind, status, submission_id, assigned_specialist_id, price_toman)
       values ($1, $2, $3, 'new_plan', 'queued', $4, $5, 500000)`,
      [openRequestId, userId, openOrder, submissionId, specialistId],
    );
    paymentId = uuidv7();
    await pool.query(
      `insert into payments (id, user_id, package_code, amount_toman, amount_rial, status, gateway)
       values ($1, $2, 'p50', 200000, 2000000, 'pending', 'sandbox')`,
      [paymentId, userId],
    );
    await pool.query(
      `insert into wallet_ledger (id, user_id, bucket, amount_toman, kind, reference_id)
       values ($1, $2, 'cash', 1000, 'adjustment', $3), ($4, $5, 'cash', 9999, 'adjustment', $6)`,
      [uuidv7(), userId, uuidv7(), uuidv7(), otherId, uuidv7()],
    );

    userToken = (await login('09138000001')).accessToken;
    otherToken = (await login('09138000002')).accessToken;
    specialistToken = (await login('09138000003')).accessToken;
    otherSpecialistToken = (await login('09138000004')).accessToken;
    adminToken = (await loginAdmin(api, pool, '09138000000')).accessToken;
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

  it('backfills legacy published versions without inventing options or changing content', async () => {
    const before = (await pool.query('select id,title,calories from plan_meals order by id')).rows;
    await pool.query("update plan_requests set status='generating' where id=$1",[openRequestId]);
    const { runner } = await import('node-pg-migrate');
    await runner({databaseUrl:process.env.DATABASE_URL!,dir:path.resolve('migrations'),
      direction:'down',count:2,migrationsTable:'pgmigrations',log:()=>undefined});
    const { migrateUp } = await import('../../dist/database/migrate.js');
    await migrateUp(process.env.DATABASE_URL!);
    await migrateUp(process.env.DATABASE_URL!);
    assert.equal((await pool.query('select status from ai_execution_claims where request_id=$1',[openRequestId])).rows[0].status,'started');
    await pool.query("update plan_requests set status='queued' where id=$1",[openRequestId]);
    assert.deepEqual((await pool.query('select id,title,calories from plan_meals order by id')).rows,before);
    assert.equal((await pool.query('select count(*)::int as n from plan_meal_options')).rows[0].n,0);
    assert.equal((await pool.query('select version_id from active_plan_versions where user_id=$1',[userId])).rows[0].version_id,publishedVersionId);
    assert.ok((await pool.query('select questionnaire_snapshot from plan_version_context where version_id=$1',[publishedVersionId])).rowCount);
  });

  it('shows the published week, keeps a correction off the user plan, and serves the remaining reads', async () => {
    const week = await request(api.getHttpServer())
      .get('/v1/me/plan/week')
      .query({ weekStart: '2026-10-24' })
      .set('Authorization', `Bearer ${userToken}`);
    assert.equal(week.status, 200);
    assert.equal(week.body.days[2].date, '2026-10-26');
    assert.equal(week.body.days[2].versionStatus, 'superseded');
    assert.equal(week.body.days[2].meals[0].title, 'قدیمی');
    assert.equal(week.body.days[4].date, '2026-10-28');
    assert.equal(week.body.days[4].versionStatus, 'published');
    assert.equal(week.body.days[4].meals[0].title, 'جدید');
    assert.equal(JSON.stringify(week.body).includes('draft'), false);
    assert.equal(JSON.stringify(week.body).includes('+989138'), false);

    const early = await request(api.getHttpServer())
      .get('/v1/me/plan/day/2026-10-26')
      .set('Authorization', `Bearer ${userToken}`);
    assert.equal(early.body.meals[0].title, 'قدیمی');
    const later = await request(api.getHttpServer())
      .get('/v1/me/plan/day/2026-10-28')
      .set('Authorization', `Bearer ${userToken}`);
    assert.equal(later.body.versionStatus, 'published');
    const hidden = await request(api.getHttpServer())
      .get('/v1/me/plan/day/2026-10-26')
      .set('Authorization', `Bearer ${otherToken}`);
    assert.equal(hidden.body.meals.length, 0);
    const badWeek = await request(api.getHttpServer())
      .get('/v1/me/plan/week')
      .query({ weekStart: '2026-10-25' })
      .set('Authorization', `Bearer ${userToken}`);
    assert.equal(badWeek.status, 400);

    process.env.SABZINE_NOW = '2026-10-31T08:00:00.000Z';
    const closed = await request(api.getHttpServer())
      .post(`/v1/specialist/requests/${requestId}/corrections`)
      .set('Authorization', `Bearer ${specialistToken}`);
    assert.equal(closed.status, 409);
    process.env.SABZINE_NOW = '2026-10-28T08:00:00.000Z';
    const denied = await request(api.getHttpServer())
      .post(`/v1/specialist/requests/${requestId}/corrections`)
      .set('Authorization', `Bearer ${userToken}`);
    assert.equal(denied.status, 403);
    const stranger = await request(api.getHttpServer())
      .post(`/v1/specialist/requests/${requestId}/corrections`)
      .set('Authorization', `Bearer ${otherSpecialistToken}`);
    assert.equal(stranger.status, 404);
    const corrected = await request(api.getHttpServer())
      .post(`/v1/specialist/requests/${requestId}/corrections`)
      .set('Authorization', `Bearer ${specialistToken}`);
    assertOk(corrected);
    const still = await request(api.getHttpServer())
      .get('/v1/me/plan/day/2026-10-28')
      .set('Authorization', `Bearer ${userToken}`);
    assert.equal(still.body.versionStatus, 'published');
    assert.equal(still.body.meals[0].title, 'جدید');

    const versions = await request(api.getHttpServer())
      .get(`/v1/specialist/patients/${userId}/plan-versions`)
      .set('Authorization', `Bearer ${specialistToken}`);
    assert.equal(versions.status, 200);
    assert.equal(versions.body.length, 2);
    assert.equal(versions.body.some((row: { status: string }) => row.status === 'draft'), false);
    const noPatient = await request(api.getHttpServer())
      .get(`/v1/specialist/patients/${userId}/plan-versions`)
      .set('Authorization', `Bearer ${otherSpecialistToken}`);
    assert.equal(noPatient.status, 404);

    const list = await request(api.getHttpServer())
      .get('/v1/me/requests')
      .set('Authorization', `Bearer ${userToken}`);
    assert.equal(list.body.some((row: { id: string }) => row.id === requestId), true);
    const timeline = await request(api.getHttpServer())
      .get(`/v1/me/requests/${requestId}`)
      .set('Authorization', `Bearer ${userToken}`);
    assert.equal(timeline.status, 200);
    assert.equal(timeline.body.events.some((event: { kind: string }) => event.kind === 'correction'), true);
    assert.equal(JSON.stringify(timeline.body).includes('+989138'), false);
    const otherTimeline = await request(api.getHttpServer())
      .get(`/v1/me/requests/${requestId}`)
      .set('Authorization', `Bearer ${otherToken}`);
    assert.equal(otherTimeline.status, 404);

    const ledger = await request(api.getHttpServer())
      .get('/v1/me/wallet/ledger')
      .set('Authorization', `Bearer ${userToken}`);
    assert.equal(ledger.body.length, 1);
    assert.equal(ledger.body[0].amountToman, 1000);
    const order = await request(api.getHttpServer())
      .get(`/v1/me/orders/${orderId}`)
      .set('Authorization', `Bearer ${userToken}`);
    assert.equal(order.body.serviceCode, 'new_plan');
    const hiddenOrder = await request(api.getHttpServer())
      .get(`/v1/me/orders/${orderId}`)
      .set('Authorization', `Bearer ${otherToken}`);
    assert.equal(hiddenOrder.status, 404);
    const topup = await request(api.getHttpServer())
      .get(`/v1/me/topups/${paymentId}`)
      .set('Authorization', `Bearer ${userToken}`);
    assert.equal(topup.body.status, 'pending');
    assert.equal(topup.body.amountRial, 2000000);

    const renamed = await request(api.getHttpServer())
      .patch('/v1/me')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ displayName: 'نگار تازه' });
    assertOk(renamed);
    assert.equal(renamed.body.displayName, 'نگار تازه');
    assert.equal(renamed.body.phone, undefined);

    const support = await request(api.getHttpServer())
      .post('/v1/me/support-conversation')
      .set('Authorization', `Bearer ${userToken}`);
    assertOk(support);
    const again = await request(api.getHttpServer())
      .post('/v1/me/support-conversation')
      .set('Authorization', `Bearer ${userToken}`);
    assert.equal(again.body.id, support.body.id);

    const sync = await request(api.getHttpServer())
      .get('/v1/me/sync')
      .set('Authorization', `Bearer ${userToken}`);
    assert.equal(sync.status, 200);
    assert.equal(typeof sync.body.unreadNotifications, 'number');
    assert.equal(sync.body.request.id.length > 0, true);

    const config = await request(api.getHttpServer()).get('/v1/public/config');
    assert.equal(config.status, 200);
    assert.equal(config.body.minAppVersion, '1.0.0');
    assert.equal(config.body.services.length >= 3, true);
    const saved = await request(api.getHttpServer())
      .put('/v1/admin/daily-messages')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ date: '2026-10-28', body: 'آب را فراموش نکن' });
    assertOk(saved);
    const message = await request(api.getHttpServer())
      .get('/v1/public/daily-message')
      .query({ date: '2026-10-28' });
    assert.equal(message.body.body, 'آب را فراموش نکن');
    const emptyMessage = await request(api.getHttpServer())
      .get('/v1/public/daily-message')
      .query({ date: '2026-10-27' });
    assert.equal(emptyMessage.body.body, null);

    const reviews = await request(api.getHttpServer())
      .get('/v1/admin/reviews')
      .query({ status: 'pending' })
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(reviews.status, 200);
    assert.equal(reviews.body.some((row: { body: string }) => row.body === 'عالی بود'), true);
    assert.equal(JSON.stringify(reviews.body).includes('+989138'), false);
    const userReviews = await request(api.getHttpServer())
      .get('/v1/admin/reviews')
      .query({ status: 'pending' })
      .set('Authorization', `Bearer ${userToken}`);
    assert.equal(userReviews.status, 403);
    const logs = await request(api.getHttpServer())
      .get('/v1/admin/audit-logs')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(logs.body.some((row: { action: string }) => row.action === 'daily_message'), true);
    const generated = await request(api.getHttpServer())
      .get('/v1/admin/ai-generations')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(generated.body.some((row: { provider: string }) => row.provider === 'fake'), true);
    assert.equal(generated.body[0].rawOutput, undefined);
    const detail = await request(api.getHttpServer())
      .get(`/v1/admin/users/${userId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(detail.body.displayName, 'نگار تازه');
    assert.equal(detail.body.phone, undefined);
    const adminRequests = await request(api.getHttpServer())
      .get('/v1/admin/requests')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(adminRequests.body.some((row: { id: string }) => row.id === requestId), true);
    const threads = await request(api.getHttpServer())
      .get('/v1/admin/support-conversations')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(threads.body.some((row: { id: string }) => row.id === support.body.id), true);
    assert.equal(threads.body[0].body, undefined);
    const version = await request(api.getHttpServer())
      .get(`/v1/admin/plan-versions/${publishedVersionId}`)
      .query({ reason: 'بررسی بالینی' })
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(version.status, 200);
    assert.equal(version.body.status, 'published');
    const noReason = await request(api.getHttpServer())
      .get(`/v1/admin/plan-versions/${publishedVersionId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(noReason.status, 400);

    const cancelled = await request(api.getHttpServer())
      .post(`/v1/me/requests/${cancelRequestId}/cancel`)
      .set('Authorization', `Bearer ${userToken}`);
    assertOk(cancelled);
    assert.equal(cancelled.body.promoToman, 500000);
    const callback = await request(api.getHttpServer()).get(`/v1/payments/callback/sandbox`).query({ paymentId });
    assertOk(callback);
    assert.equal(callback.body.cashToman, 200000);
    const unavailable = await request(api.getHttpServer()).get('/v1/payments/callback/zarinpal').query({ paymentId });
    assert.equal(unavailable.status, 503);

    const deactivated = await request(api.getHttpServer())
      .patch(`/v1/admin/specialists/${specialistId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ active: false });
    assertOk(deactivated);
    const open = await pool.query<{ assigned_specialist_id: string | null }>(
      `select assigned_specialist_id from plan_requests where id = $1`,
      [openRequestId],
    );
    assert.equal(open.rows[0]?.assigned_specialist_id, null);
  });

  async function seedVersion(versionNumber: number, title: string, publishedAt: string): Promise<string> {
    const versionId = uuidv7();
    await pool.query(
      `insert into plan_versions (id, request_id, version_number, status, created_by)
       values ($1, $2, $3, 'draft', $4)`,
      [versionId, requestId, versionNumber, specialistId],
    );
    for (let index = 0; index < 7; index += 1) {
      const dayId = uuidv7();
      await pool.query(
        `insert into plan_days (id, plan_version_id, day_index, civil_date) values ($1, $2, $3, $4)`,
        [dayId, versionId, index, addCivilDays('2026-10-24', index)],
      );
      const mealId = uuidv7();
      await pool.query(
        `insert into plan_meals (id, plan_day_id, meal_uid, position, meal_type, suggested_time, title, calories, notes)
         values ($1, $2, $3, 0, 'breakfast', '08:00', $4, 400, '')`,
        [mealId, dayId, uuidv7(), title],
      );
      await pool.query(
        `insert into plan_meal_items (id, meal_id, position, name, quantity, unit)
         values ($1, $2, 0, 'نان', 1, 'piece')`,
        [uuidv7(), mealId],
      );
    }
    await pool.query(
      `update plan_versions set status = 'published', published_at = $2 where id = $1`,
      [versionId, publishedAt],
    );
    return versionId;
  }

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
