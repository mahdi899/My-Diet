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
import { base32Decode, totpCode } from '../../src/common/totp.js';
import { normalizeIranianMobile } from '../../src/common/phone.js';
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
  dislikes: 'بادام',
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
      server.close(() => resolve(typeof address === 'object' && address ? address.port : 0));
    });
  });
}

function assertOk(res: { status: number; body: unknown }): void {
  assert.ok(res.status === 200 || res.status === 201, `${res.status} ${JSON.stringify(res.body)}`);
}

describe('phase 2 product', { concurrency: 1, timeout: 180_000 }, () => {
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
    process.env.AI_FAILOVER_PROVIDER = 'none';
    process.env.PUSH_PROVIDER = 'console';
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
      `insert into users (id, phone_e164, role, display_name) values ($1, '+989125000000', 'admin', 'مدیر')`,
      [adminId],
    );
    await pool.query(`insert into wallets (user_id) values ($1)`, [adminId]);
    adminToken = (await loginAdmin(api, pool, '09125000000')).accessToken;
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

  it('stores clinical text encrypted and returns it in the export', async () => {
    const session = await login('09125000001');
    const submitted = await request(api.getHttpServer())
      .post('/v1/me/questionnaire/submissions')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send(answers);
    assertOk(submitted);
    const stored = await pool.query<{ dislikes: string }>(
      `select answers->>'dislikes' as dislikes from questionnaire_submissions where user_id = $1`,
      [session.userId],
    );
    assert.equal(stored.rows[0]?.dislikes.startsWith('enc1:'), true);
    const exported = await request(api.getHttpServer())
      .get('/v1/me/export')
      .set('Authorization', `Bearer ${session.accessToken}`);
    assert.equal(exported.status, 200);
    assert.equal(exported.body.questionnaire[0].answers.dislikes, 'بادام');
  });

  it('blocks a schema that drops a built-in question and publishes a renamed label', async () => {
    const current = await request(api.getHttpServer()).get('/v1/questionnaire/schema');
    assert.equal(current.status, 200);
    const questions = current.body.questions as Array<{ id: string; title: string }>;
    const broken = await request(api.getHttpServer())
      .post('/v1/admin/questionnaire/compatibility')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ questions: questions.filter((question) => question.id !== 'health') });
    assertOk(broken);
    assert.equal(broken.body.errors.some((error: string) => error.includes('health')), true);
    const renamed = questions.map((question) => (question.id === 'name' ? { ...question, title: 'نام' } : question));
    const draft = await request(api.getHttpServer())
      .post('/v1/admin/questionnaire/schemas')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ questions: renamed });
    assertOk(draft);
    const published = await request(api.getHttpServer())
      .post(`/v1/admin/questionnaire/schemas/${draft.body.version}/publish`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    assertOk(published);
    const editor = await request(api.getHttpServer()).get('/questionnaire-editor');
    assert.equal(editor.status, 200);
    assert.equal(editor.text.includes('بررسی سازگاری'), true);
    const next = await request(api.getHttpServer()).get('/v1/questionnaire/schema');
    const name = next.body.questions.find((question: { id: string }) => question.id === 'name');
    assert.equal(name.title, 'نام');
  });

  it('asks for an authenticator code after a specialist enrolls one', async () => {
    const created = await request(api.getHttpServer())
      .post('/v1/admin/specialists')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ phone: '09125000002', displayName: 'دکتر دوم', credential: 'تغذیه' });
    assertOk(created);
    const first = await login('09125000002');
    const setup = await request(api.getHttpServer())
      .post('/v1/me/totp/setup')
      .set('Authorization', `Bearer ${first.accessToken}`);
    assertOk(setup);
    const code = totpCode(base32Decode(setup.body.secret as string));
    const confirmed = await request(api.getHttpServer())
      .post('/v1/me/totp/confirm')
      .set('Authorization', `Bearer ${first.accessToken}`)
      .send({ code });
    assertOk(confirmed);
    await request(api.getHttpServer()).post('/v1/auth/logout').set('Authorization', `Bearer ${first.accessToken}`);
    await pool.query(
      `update otp_challenges set created_at = now() - interval '2 minutes' where phone_e164 = $1`,
      [normalizeIranianMobile('09125000002')],
    );
    const requested = await request(api.getHttpServer()).post('/v1/auth/otp/request').send({ phone: '09125000002' });
    assertOk(requested);
    const otp = remembered(normalizeIranianMobile('09125000002'));
    const challenge = await request(api.getHttpServer())
      .post('/v1/auth/otp/verify')
      .send({ phone: '09125000002', code: otp });
    assertOk(challenge);
    assert.equal(challenge.body.totpRequired, true);
    assert.equal(challenge.body.accessToken, undefined);
    const wrong = await request(api.getHttpServer())
      .post('/v1/auth/totp')
      .send({ totpToken: challenge.body.totpToken, code: '000000' });
    assert.equal(wrong.status, 401);
    const session = await request(api.getHttpServer())
      .post('/v1/auth/totp')
      .send({ totpToken: challenge.body.totpToken, code: totpCode(base32Decode(setup.body.secret as string)) });
    assertOk(session);
    assert.equal(typeof session.body.accessToken, 'string');
  });

  it('streams a new chat message and delivers a push to the registered device', async () => {
    const user = await login('09125000003');
    const specialist = await request(api.getHttpServer())
      .post('/v1/admin/specialists')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ phone: '09125000004', displayName: 'دکتر پیام', credential: 'تغذیه' });
    assertOk(specialist);
    const staff = await login('09125000004');
    const device = await request(api.getHttpServer())
      .post('/v1/me/devices')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ platform: 'android', pushToken: 'device-token-123456', provider: 'console' });
    assertOk(device);
    await pool.query(
      `insert into conversation_participants (conversation_id, user_id)
       select id, $2 from conversations where user_id = $1 and kind = 'support'`,
      [user.userId, specialist.body.id],
    );
    const conversation = await pool.query<{ id: string }>(
      `select id from conversations where user_id = $1 and kind = 'support'`,
      [user.userId],
    );
    const posted = await request(api.getHttpServer())
      .post(`/v1/conversations/${conversation.rows[0]!.id}/messages`)
      .set('Authorization', `Bearer ${staff.accessToken}`)
      .send({ body: 'سلام' });
    assertOk(posted);
    const stream = await request(api.getHttpServer())
      .get('/v1/events?once=1')
      .set('Authorization', `Bearer ${user.accessToken}`);
    assert.equal(stream.status, 200);
    assert.equal(stream.text.includes('event: message'), true);
    assert.equal(stream.text.includes('سلام'), false);
    const queued = await pool.query(
      `select id from outbox_events where topic = 'push.send' and payload->>'userId' = $1`,
      [user.userId],
    );
    assert.equal(queued.rowCount, 1);
    const { RealtimeService } = await import('../../dist/realtime/realtime.service.js');
    await api.get(RealtimeService).deliver(user.userId, 'message');
    const deliveries = await pool.query(`select id from push_deliveries where device_id = $1`, [device.body.id]);
    assert.equal(deliveries.rowCount, 1);
  });

  it('deletes the account, keeps the ledger row, and frees the phone', async () => {
    const session = await login('09125000005');
    const me = await request(api.getHttpServer()).get('/v1/me').set('Authorization', `Bearer ${session.accessToken}`);
    await pool.query(
      `insert into wallet_ledger (id, user_id, bucket, amount_toman, kind, reference_id)
       values ($1, $2, 'promo', 10, 'adjustment', $3)`,
      [uuidv7(), me.body.id, uuidv7()],
    );
    const removed = await request(api.getHttpServer())
      .post('/v1/me/account/delete')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ confirmation: 'حذف حساب' });
    assertOk(removed);
    assert.equal(removed.body.ledgerRetained, true);
    const closed = await request(api.getHttpServer()).get('/v1/me').set('Authorization', `Bearer ${session.accessToken}`);
    assert.equal(closed.status, 401);
    const ledger = await pool.query(`select id from wallet_ledger where user_id = $1`, [me.body.id]);
    assert.equal(ledger.rowCount, 1);
    await pool.query(
      `update otp_challenges set created_at = now() - interval '2 minutes' where phone_e164 = $1`,
      [normalizeIranianMobile('09125000005')],
    );
    const again = await login('09125000005');
    assert.notEqual(again.userId, me.body.id);
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
