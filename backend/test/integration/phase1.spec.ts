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

    process.env.APP_ROLE = 'worker';
    worker = (await createApp()).app;
    process.env.APP_ROLE = 'api';

    const adminId = uuidv7();
    await pool.query(
      `insert into users (id, phone_e164, role, display_name) values ($1, '+989120000001', 'admin', 'مدیر')`,
      [adminId],
    );
    await pool.query(`insert into wallets (user_id) values ($1)`, [adminId]);
    adminToken = (await loginAdmin(api, pool, '09120000001')).accessToken;
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
    await Promise.allSettled([1,2].map(()=>api.get(PlanDraftService).generate(placed.body.requestId as string)));
    assert.equal((await pool.query('select count(*)::int as n from ai_generations where request_id=$1',[placed.body.requestId])).rows[0].n,1);

    const detail = await request(api.getHttpServer())
      .get(`/v1/specialist/requests/${placed.body.requestId}`)
      .set('Authorization', `Bearer ${specialistToken}`);
    assert.equal(detail.status, 200);
    assert.equal(JSON.stringify(detail.body).includes('+98912'), false);
    let lock = detail.body.version.lockVersion as number;
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
    const incomplete = await request(api.getHttpServer())
      .post(`/v1/specialist/requests/${placed.body.requestId}/publish`)
      .set('Authorization', `Bearer ${specialistToken}`).set('If-Match',String(lock));
    assert.equal(incomplete.status,409);
    assert.equal(incomplete.body.code,'options_required');
    const fullDays = detail.body.version.days.map((day: {meals:Array<{title:string;calories:number}>})=>({meals:day.meals.map(meal=>({...meal,
      options:['primary','ai_alternative','specialist_alternative'].map(kind=>({
        optionId:uuidv7(),kind,title:meal.title,calories:meal.calories,
        portion:{quantity:1,unit:'serving',basis:'as_served'},preparationMinutes:15,
        instructions:'Test fixture preparation',ingredients:[{name:'Test ingredient',quantity:100,unit:'g',basis:'raw'}],approved:true,
      })),
    }))}));
    const saved = await request(api.getHttpServer()).put(`/v1/specialist/requests/${placed.body.requestId}/draft`)
      .set('Authorization', `Bearer ${specialistToken}`).set('If-Match',String(lock)).send({days:fullDays});
    assertOk(saved);
    lock=saved.body.lockVersion;
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

  it('publishes corrections atomically, rejects stale edits and preserves exact consumption history', async () => {
    const { PlanDraftService } = await import('../../dist/plans/plans.service.js');
    const plans = api.get(PlanDraftService);
    const active = (await pool.query(`select a.user_id,a.version_id,v.request_id from active_plan_versions a
      join plan_versions v on v.id=a.version_id limit 1`)).rows[0];
    assert.ok(active);
    const beforeLogs = (await pool.query('select plan_version_id,option_uid from meal_logs where user_id=$1 order by id',[active.user_id])).rows;
    assert.ok(beforeLogs.length>0 && beforeLogs.every(l=>l.plan_version_id===active.version_id && l.option_uid));
    const snapshot = (await pool.query('select * from plan_version_context where version_id=$1',[active.version_id])).rows[0];
    assert.ok(snapshot.generation_id);
    await assert.rejects(pool.query(`update plan_meal_options set document='{}' where meal_id in
      (select m.id from plan_meals m join plan_days d on d.id=m.plan_day_id where d.plan_version_id=$1)`,[active.version_id]));
    await plans.correct(specialistId,active.request_id);
    const draft = await plans.staffRequest(specialistId,'specialist',active.request_id,null);
    assert.ok(draft.version);
    const lock=draft.version.lockVersion;
    await assert.rejects(plans.publish(specialistId,'specialist',active.request_id,lock));
    assert.equal((await pool.query('select version_id from active_plan_versions where user_id=$1',[active.user_id])).rows[0].version_id,active.version_id);
    const days=draft.version.days.map(d=>({meals:d.meals.map(m=>({...m,options:m.options?.map(o=>({...o,approved:true}))}))}));
    await assert.rejects(plans.replaceDraft(specialistId,'admin',active.request_id,lock,{days}));
    const saved=await plans.replaceDraft(specialistId,'specialist',active.request_id,lock,{days});
    await assert.rejects(plans.replaceDraft(specialistId,'specialist',active.request_id,lock,{days}));
    const outcomes=await Promise.allSettled([1,2].map(()=>plans.publish(specialistId,'specialist',active.request_id,saved.lockVersion)));
    assert.equal(outcomes.filter(o=>o.status==='fulfilled').length,1);
    assert.equal(outcomes.filter(o=>o.status==='rejected').length,1);
    const current=(await pool.query('select version_id from active_plan_versions where user_id=$1',[active.user_id])).rows[0].version_id;
    assert.notEqual(current,active.version_id);
    assert.equal((await pool.query('select status from plan_versions where id=$1',[active.version_id])).rows[0].status,'superseded');
    assert.deepEqual((await pool.query('select plan_version_id,option_uid from meal_logs where user_id=$1 order by id',[active.user_id])).rows,beforeLogs);
    const day=await plans.planDay(active.user_id,tehranToday());
    assert.ok(day.meals.every(m=>m.consumption?.versionId===active.version_id));
  });

  it('records idempotent detailed consumption, approved substitutions and unknown calories with audit history',async()=>{
    const {MealActivityService}=await import('../../dist/tracking/meal-activity.service.js');
    const service=api.get(MealActivityService);
    const row=(await pool.query(`select a.user_id,a.version_id,m.meal_uid,o.option_uid,o.document from active_plan_versions a
      join plan_days d on d.plan_version_id=a.version_id join plan_meals m on m.plan_day_id=d.id
      join plan_meal_options o on o.meal_id=m.id where d.civil_date=$1 and o.kind='ai_alternative' limit 1`,[tehranToday()])).rows[0];
    assert.ok(row);
    const old=(await pool.query('select * from meal_logs where user_id=$1 and meal_uid=$2 and scheduled_date=$3',[row.user_id,row.meal_uid,tehranToday()])).rows[0];
    const base={date:tehranToday(),mealUid:row.meal_uid,versionId:row.version_id,optionId:row.option_uid};
    const cleared=await service.record(row.user_id,{...base,versionId:old.plan_version_id,optionId:old.option_uid,state:'unrecorded',expectedRevision:old.revision,commandId:uuidv7()});
    await assert.rejects(service.select(row.user_id,{...base,commandId:uuidv7(),expectedRevision:0}));
    const selection={...base,commandId:uuidv7(),expectedRevision:0,reasonId:'unavailable'};
    const selected=await service.select(row.user_id,selection);
    assert.deepEqual(await service.select(row.user_id,selection),selected);
    const command={...base,commandId:uuidv7(),expectedRevision:cleared.revision,state:'less' as const,actual:{quantity:0.5,unit:'serving' as const}};
    const logged=await service.record(row.user_id,command);
    assert.equal(logged.consumedCalories,row.document.calories/2);
    assert.deepEqual(await service.record(row.user_id,command),logged);
    await assert.rejects(service.record(row.user_id,{...command,state:'more'}));
    await assert.rejects(service.record(row.user_id,{...command,commandId:uuidv7()}));
    await assert.rejects(service.select(row.user_id,{...selection,commandId:uuidv7(),expectedRevision:selected.revision}));
    const different=await service.record(row.user_id,{...base,commandId:uuidv7(),expectedRevision:logged.revision,state:'different',foodName:'غذای دیگر',actual:{quantity:100,unit:'g'}});
    assert.equal(different.consumedCalories,null);
    const unknown=await service.record(row.user_id,{...base,commandId:uuidv7(),expectedRevision:different.revision,state:'less',actual:{quantity:100,unit:'g'}});
    assert.equal(unknown.consumedCalories,null);
    const repeated={...base,commandId:uuidv7(),expectedRevision:unknown.revision,state:'as_planned' as const};
    const parallel=await Promise.all([service.record(row.user_id,repeated),service.record(row.user_id,repeated)]);
    assert.equal(parallel[0].revision,parallel[1].revision);
    const reset=await service.record(row.user_id,{...base,commandId:uuidv7(),expectedRevision:parallel[0].revision,state:'unrecorded'});
    const primary=(await pool.query(`select o.option_uid from plan_meal_options o join plan_meals m on m.id=o.meal_id
      join plan_days d on d.id=m.plan_day_id where d.plan_version_id=$1 and m.meal_uid=$2 and o.kind='primary'`,[row.version_id,row.meal_uid])).rows[0].option_uid;
    const previousClock=process.env.SABZINE_NOW;
    try {
      process.env.SABZINE_NOW='2026-10-29T08:30:00.000Z';
      await service.select(row.user_id,{...base,optionId:primary,commandId:uuidv7(),expectedRevision:selected.revision});
      assert.equal((await pool.query('select revision from meal_logs where id=$1',[old.id])).rows[0].revision,reset.revision);
    } finally {process.env.SABZINE_NOW=previousClock;}
    const summary=await service.day(row.user_id,base.date);
    assert.equal(summary.calories.consumed.total,null);
    assert.ok(summary.calories.consumed.unknownCount>0);
    const {PlanDraftService}=await import('../../dist/plans/plans.service.js');
    const plans=api.get(PlanDraftService);
    const requestId=(await pool.query('select request_id from plan_versions where id=$1',[row.version_id])).rows[0].request_id;
    await plans.correct(specialistId,requestId);
    const next=await plans.staffRequest(specialistId,'specialist',requestId,null);
    assert.ok(next.version);
    const saved=await plans.replaceDraft(specialistId,'specialist',requestId,next.version.lockVersion,{days:next.version.days.map(d=>({meals:d.meals.map(m=>({...m,options:m.options?.map(o=>({...o,approved:true}))}))}))});
    await plans.publish(specialistId,'specialist',requestId,saved.lockVersion);
    const projected=await plans.planDay(row.user_id,base.date);
    const slot=projected.meals.find(m=>m.mealUid===base.mealUid)!;
    assert.equal(slot.selectionRevision,selected.revision+1);
    await service.select(row.user_id,{...base,versionId:projected.versionId!,optionId:primary,commandId:uuidv7(),expectedRevision:slot.selectionRevision,reasonId:'preference'});
    await assert.rejects(service.record(row.user_id,{...base,commandId:uuidv7(),expectedRevision:reset.revision,optionId:uuidv7(),state:'as_planned'}));
    assert.ok((await pool.query('select count(*)::int as n from meal_log_history where log_id=$1',[old.id])).rows[0].n>=4);
    await assert.rejects(pool.query('delete from meal_log_history where log_id=$1',[old.id]));
    await assert.rejects(service.record(row.user_id,{...command,commandId:uuidv7(),date:'2026-10-29'}));
    await assert.rejects(service.select(uuidv7(),{...selection,commandId:uuidv7()}));
    assert.ok((await pool.query("select 1 from outbox_events where topic='shopping.invalidate' and aggregate_id=$1",[row.user_id])).rowCount);
  });

  it('recovers uncertain AI execution to manual review without a second charge and audits reconciliation',async()=>{
    const { PlanDraftService }=await import('../../dist/plans/plans.service.js');
    const { AdminService }=await import('../../dist/admin/admin.service.js');
    const row=(await pool.query(`select id from plan_requests r where status='cancelled'
      and not exists(select 1 from plan_versions v where v.request_id=r.id) limit 1`)).rows[0];
    assert.ok(row);
    await pool.query("update plan_requests set status='queued' where id=$1",[row.id]);
    await pool.query("insert into ai_execution_claims(request_id,status) values($1,'started')",[row.id]);
    const service=api.get(PlanDraftService);
    await service.generate(row.id);await service.generate(row.id);
    assert.equal((await pool.query('select count(*)::int as n from plan_versions where request_id=$1',[row.id])).rows[0].n,1);
    const attempt=(await pool.query('select provider,skipped_reason from ai_generations where request_id=$1',[row.id])).rows[0];
    assert.equal(attempt.provider,'unknown');assert.equal(attempt.skipped_reason,'provider_outcome_unknown');
    const admin=(await pool.query("select id from users where role='admin' limit 1")).rows[0].id;
    await assert.rejects(api.get(AdminService).reconcileAi(admin,row.id,-1,'bad cost'));
    await api.get(AdminService).reconcileAi(admin,row.id,0,'Confirmed no charge in provider account');
    await assert.rejects(api.get(AdminService).reconcileAi(admin,row.id,100,'duplicate'));
    assert.equal((await pool.query("select count(*)::int as n from audit_logs where action='ai_cost_reconciled' and target_id=$1",[row.id])).rows[0].n,1);
  });

  it('serializes concurrent OTP requests and enforces verification lockout', async () => {
    const phone = '09120000081';
    const responses = await Promise.all(Array.from({ length: 8 }, () =>
      request(api.getHttpServer()).post('/v1/auth/otp/request').send({ phone })));
    assert.equal(responses.filter(r => r.status === 201).length, 1);
    assert.equal(responses.filter(r => r.status === 429).length, 7);
    const code = remembered(normalizeIranianMobile(phone))!;
    const wrong = code === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) {
      await request(api.getHttpServer()).post('/v1/auth/otp/verify').send({ phone, code: wrong }).expect(401);
    }
    await request(api.getHttpServer()).post('/v1/auth/otp/verify').send({ phone, code }).expect(401);
  });

  it('revokes concurrent refresh reuse, enforces expiry/logout, and keeps web refresh private', async () => {
    const first = await login('09120000082');
    const results = await Promise.all([1, 2].map(() => request(api.getHttpServer())
      .post('/v1/auth/refresh').send({ refreshToken: first.refreshToken })));
    assert.deepEqual(results.map(r => r.status).sort(), [201, 401]);
    const winner = results.find(r => r.status === 201)!;
    await request(api.getHttpServer()).get('/v1/me').set('Authorization', `Bearer ${winner.body.accessToken}`).expect(401);
    const web = await request(api.getHttpServer()).post('/v1/auth/refresh')
      .set('x-sabzine-client', 'web').send({ refreshToken: (await login('09120000083')).refreshToken });
    assert.equal(web.status, 201);
    assert.equal(web.body.refreshToken, undefined);
    assert.match(String(web.headers['set-cookie']), /HttpOnly; SameSite=Strict; Path=\/v1\/auth/);
    await request(api.getHttpServer()).post('/v1/auth/logout').set('Authorization', `Bearer ${web.body.accessToken}`).expect(201);
    await request(api.getHttpServer()).get('/v1/me').set('Authorization', `Bearer ${web.body.accessToken}`).expect(401);
    const expired = await login('09120000084');
    // Move the entire interval, preserving the schema's maximum lifetime constraint.
    await pool.query(`update sessions set created_at=created_at-interval '31 days',
      absolute_expires_at=absolute_expires_at-interval '31 days' where id in
      (select session_id from refresh_tokens where token_hash=encode(sha256($1::bytea),'hex'))`, [expired.refreshToken]);
    await request(api.getHttpServer()).post('/v1/auth/refresh').send({ refreshToken: expired.refreshToken }).expect(401);
  });

  it('removes the old specialist from care chat and realtime after reassignment', async () => {
    const { AdminService } = await import('../../dist/admin/admin.service.js');
    const { MessagingService } = await import('../../dist/messaging/messaging.service.js');
    const { RealtimeService } = await import('../../dist/realtime/realtime.service.js');
    const row = (await pool.query(`select id,user_id from plan_requests where assigned_specialist_id=$1 limit 1`, [specialistId])).rows[0];
    assert.ok(row);
    const admin = (await pool.query("select id from users where role='admin' limit 1")).rows[0].id;
    const next = uuidv7(), conversation = uuidv7();
    await pool.query("insert into users(id,phone_e164,role) values($1,'+989120000085','specialist')", [next]);
    await pool.query("insert into specialist_profiles(user_id,display_name,credential,verification_status) values($1,'next','test','verified')", [next]);
    const nextSession = await login('09120000085');
    await pool.query("insert into conversations(id,kind,user_id,request_id) values($1,'care',$2,$3)", [conversation,row.user_id,row.id]);
    await pool.query('insert into conversation_participants(conversation_id,user_id) values($1,$2),($1,$3)', [conversation,row.user_id,specialistId]);
    const messaging = api.get(MessagingService);
    await messaging.post(row.user_id, conversation, 'private message');
    await api.get(AdminService).assign(admin,row.id,next,'care handover');
    await assert.rejects(messaging.messages(specialistId,conversation));
    await assert.rejects(messaging.post(specialistId,conversation,'denied'));
    // Legacy memberships must not grant access even before physical cleanup.
    await pool.query('insert into conversation_participants(conversation_id,user_id) values($1,$2)',[conversation,specialistId]);
    await assert.rejects(messaging.messages(specialistId,conversation));
    await assert.rejects(messaging.markRead(specialistId,conversation));
    assert.equal((await messaging.list(specialistId)).some(c => c.id===conversation),false);
    assert.equal((await messaging.messages(next,conversation)).length,1);
    assert.equal((await messaging.messages(row.user_id,conversation)).length,1);
    assert.equal((await api.get(RealtimeService).since(specialistId,'2000-01-01T00:00:00Z'))
      .some(e => e.type==='message' && (e.data as { conversationId?: string }).conversationId===conversation),false);
    const audit = (await pool.query("select detail from audit_logs where action='request_assigned' and target_id=$1 order by created_at desc limit 1",[row.id])).rows[0];
    assert.equal(audit.detail.previousSpecialistId,specialistId);
    await api.get(AdminService).updateSpecialist(admin,next,{active:false});
    await assert.rejects(messaging.messages(next,conversation));
    await request(api.getHttpServer()).get('/v1/me').set('Authorization', `Bearer ${nextSession.accessToken}`).expect(403);
    await assert.rejects(api.get(AdminService).assign(admin,row.id,next,'inactive target'));
  });

  it('keeps public access but refuses private ownership and client role escalation', async () => {
    await request(api.getHttpServer()).get('/v1/public/config').expect(200);
    await request(api.getHttpServer()).get('/v1/me/wallet').expect(401);
    await request(api.getHttpServer()).post('/v1/auth/otp/request').send({ phone:'09120000086', role:'admin' }).expect(400);
    const user = await login('09120000086');
    const sessions = await request(api.getHttpServer()).get('/v1/auth/sessions')
      .set('Authorization', `Bearer ${user.accessToken}`).expect(200);
    const ownSessionId = sessions.body.find((s: { current: boolean }) => s.current).id;
    const outsider = (await loginAdmin(api,pool,'09120000001')).accessToken;
    await request(api.getHttpServer()).delete(`/v1/auth/sessions/${ownSessionId}`)
      .set('Authorization', `Bearer ${outsider}`).expect(404);
    await request(api.getHttpServer()).delete('/v1/auth/sessions/not-a-uuid')
      .set('Authorization', `Bearer ${user.accessToken}`).expect(400);
    await request(api.getHttpServer()).get('/v1/admin/users').set('Authorization', `Bearer ${user.accessToken}`).expect(403);
    const another = (await pool.query("select id from plan_requests where user_id<>(select user_id from sessions where id=(select session_id from refresh_tokens where token_hash=encode(sha256($1::bytea),'hex'))) limit 1",[user.refreshToken])).rows[0];
    assert.ok(another);
    await request(api.getHttpServer()).get(`/v1/me/requests/${another.id}`).set('Authorization', `Bearer ${user.accessToken}`).expect(404);
    await request(api.getHttpServer()).delete(`/v1/auth/sessions/${ownSessionId}`)
      .set('Authorization', `Bearer ${user.accessToken}`).expect(200);
    await request(api.getHttpServer()).post('/v1/auth/refresh').send({refreshToken:user.refreshToken}).expect(401);
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
