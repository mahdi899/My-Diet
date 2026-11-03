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
import { withReadOnly } from '../../src/database/read-only.js';
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

describe('phase 3 product', { concurrency: 1, timeout: 180_000 }, () => {
  let directory = '';
  let stopDatabase: (() => Promise<void>) | undefined;
  let api: INestApplication;
  let pool: Pool;
  let remembered: (phone: string) => string | undefined;
  let adminToken = '';
  let previousGateways: string | undefined;
  let previousReplica: string | undefined;

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
    previousGateways = process.env.PAYMENT_GATEWAYS;
    previousReplica = process.env.DATABASE_REPLICA_URL;
    process.env.NODE_ENV = 'test';
    process.env.APP_ROLE = 'api';
    process.env.DATABASE_URL = databaseUrl;
    process.env.DATABASE_REPLICA_URL = databaseUrl;
    process.env.SMS_PROVIDER = 'console';
    process.env.PAYMENT_GATEWAY = 'sandbox';
    process.env.PAYMENT_GATEWAYS = 'sandbox,idpay';
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
      `insert into users (id, phone_e164, role, display_name) values ($1, '+989126000000', 'admin', 'مدیر')`,
      [adminId],
    );
    await pool.query(`insert into wallets (user_id) values ($1)`, [adminId]);
    adminToken = (await loginAdmin(api, pool, '09126000000')).accessToken;
  });

  after(async () => {
    await api?.close().catch(() => undefined);
    if (previousGateways === undefined) delete process.env.PAYMENT_GATEWAYS;
    else process.env.PAYMENT_GATEWAYS = previousGateways;
    if (previousReplica === undefined) delete process.env.DATABASE_REPLICA_URL;
    else process.env.DATABASE_REPLICA_URL = previousReplica;
    try {
      if (stopDatabase) await stopDatabase();
    } catch {
      // Windows can keep the data directory locked briefly after stop.
    }
    if (directory) await rm(directory, { recursive: true, force: true }).catch(() => undefined);
  });

  it('lists enabled gateways and refuses one that has no adapter', async () => {
    const listed = await request(api.getHttpServer()).get('/v1/payments/gateways');
    assert.equal(listed.status, 200);
    assert.deepEqual(
      listed.body.map((gateway: { name: string }) => gateway.name),
      ['sandbox', 'idpay'],
    );
    assert.equal(listed.body.every((gateway: { collectsCardData: boolean }) => gateway.collectsCardData === false), true);
    assert.equal(JSON.stringify(listed.body).includes('api'), false);
    const user = await login('09126000003');
    const blocked = await request(api.getHttpServer())
      .post('/v1/me/topups')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ packageCode: 'p50', gateway: 'idpay' });
    assert.equal(blocked.status, 503);
    const unknown = await request(api.getHttpServer())
      .post('/v1/me/topups')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ packageCode: 'p50', gateway: 'card' });
    assert.equal(unknown.status, 400);
    const started = await request(api.getHttpServer())
      .post('/v1/me/topups')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ packageCode: 'p50', gateway: 'sandbox' });
    assertOk(started);
    assert.equal(started.body.gateway, 'sandbox');
    const done = await request(api.getHttpServer())
      .post('/v1/payments/sandbox/complete')
      .send({ paymentId: started.body.paymentId });
    assertOk(done);
    const rows = await pool.query(`select gateway from payments where user_id = $1`, [user.userId]);
    assert.deepEqual(rows.rows.map((row) => row.gateway), ['sandbox']);
  });

  it('reports overdue work from the read-only replica and hides other specialists', async () => {
    const primary = await request(api.getHttpServer())
      .post('/v1/admin/specialists')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ phone: '09126000001', displayName: 'دکتر اول', credential: 'تغذیه' });
    assertOk(primary);
    const other = await request(api.getHttpServer())
      .post('/v1/admin/specialists')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ phone: '09126000002', displayName: 'دکتر دوم', credential: 'تغذیه' });
    assertOk(other);
    const staff = await login('09126000001');
    const patient = uuidv7();
    await pool.query(`insert into users (id, phone_e164, role) values ($1, '+989126000099', 'user')`, [patient]);
    await pool.query(`insert into wallets (user_id) values ($1)`, [patient]);
    const submission = uuidv7();
    await pool.query(
      `insert into questionnaire_submissions (id, user_id, schema_version, answers) values ($1, $2, 1, '{}'::jsonb)`,
      [submission, patient],
    );
    const lateOrder = uuidv7();
    const answeredOrder = uuidv7();
    await pool.query(
      `insert into orders (id, user_id, service_code, price_toman, cash_toman, promo_toman, status, idempotency_key)
       values ($1, $2, 'new_plan', 500000, 500000, 0, 'paid', $3), ($4, $2, 'new_plan', 500000, 500000, 0, 'paid', $5)`,
      [lateOrder, patient, `late-${lateOrder}`, answeredOrder, `answered-${answeredOrder}`],
    );
    const lateRequest = uuidv7();
    const answeredRequest = uuidv7();
    await pool.query(
      `insert into plan_requests
         (id, user_id, order_id, kind, status, submission_id, assigned_specialist_id, price_toman, created_at)
       values
         ($1, $2, $3, 'new_plan', 'in_review', $4, $5, 500000, now() - interval '25 hours'),
         ($6, $2, $7, 'new_plan', 'in_review', $4, $5, 500000, now() - interval '2 hours')`,
      [lateRequest, patient, lateOrder, submission, primary.body.id, answeredRequest, answeredOrder],
    );
    await pool.query(
      `insert into request_events (id, request_id, actor_id, kind, created_at)
       values ($1, $2, $3, 'draft_edited', now() - interval '90 minutes')`,
      [uuidv7(), answeredRequest, primary.body.id],
    );

    const { PG_REPLICA } = await import('../../dist/database/database.js');
    await assert.rejects(
      withReadOnly(api.get(PG_REPLICA), (client) =>
        client.query(`insert into app_settings (key, value) values ('phase3_probe', '1'::jsonb)`),
      ),
    );
    const report = await request(api.getHttpServer())
      .get('/v1/admin/reports/sla')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(report.status, 200);
    assert.equal(JSON.stringify(report.body).includes('+989'), false);
    const row = report.body.specialists.find((item: { specialistId: string }) => item.specialistId === primary.body.id);
    assert.equal(row.overdue, 1);
    assert.equal(row.requests, 2);
    assert.equal(row.medianResponseMinutes, 30);
    const own = await request(api.getHttpServer())
      .get('/v1/specialist/sla')
      .set('Authorization', `Bearer ${staff.accessToken}`);
    assert.equal(own.status, 200);
    assert.equal(own.body.overdue, 1);
    const second = await login('09126000002');
    const hidden = await request(api.getHttpServer())
      .get('/v1/specialist/sla')
      .set('Authorization', `Bearer ${second.accessToken}`);
    assert.equal(hidden.body.requests, 0);
    assert.equal(hidden.body.overdue, 0);
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
