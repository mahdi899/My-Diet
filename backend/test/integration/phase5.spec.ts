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

describe('phase 5 product', { concurrency: 1, timeout: 180_000 }, () => {
  let directory = '';
  let stopDatabase: (() => Promise<void>) | undefined;
  let api: INestApplication;
  let pool: Pool;
  let remembered: (phone: string) => string | undefined;
  let adminToken = '';
  let patient = '';
  let submission = '';

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
    const adminId = uuidv7();
    await pool.query(
      `insert into users (id, phone_e164, role, display_name) values ($1, '+989128000000', 'admin', 'مدیر')`,
      [adminId],
    );
    await pool.query(`insert into wallets (user_id) values ($1)`, [adminId]);
    adminToken = (await loginAdmin(api, pool, '09128000000')).accessToken;
    patient = uuidv7();
    await pool.query(`insert into users (id, phone_e164, role) values ($1, '+989128000099', 'user')`, [patient]);
    await pool.query(`insert into wallets (user_id) values ($1)`, [patient]);
    submission = uuidv7();
    await pool.query(
      `insert into questionnaire_submissions (id, user_id, schema_version, answers) values ($1, $2, 1, '{}'::jsonb)`,
      [submission, patient],
    );
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

  it('records one model attempt, then drafts the next week by hand when the cap is reached', async () => {
    const user = await login('09128000001');
    const denied = await request(api.getHttpServer())
      .put('/v1/admin/ai-controls')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ dailyCostCapMicros: 1000 });
    assert.equal(denied.status, 403);
    const first = await queueRequest();
    await generate(first);
    const drafted = await attempt(first);
    assert.equal(drafted.status, 'drafted');
    assert.equal(drafted.provider, 'fake');
    assert.equal(drafted.model, 'fake');
    assert.equal(drafted.prompt_version, 'v1');
    assert.equal(drafted.attempt_no, 1);
    assert.equal(drafted.schema_version, 1);
    assert.equal(Number(drafted.tokens), 12);
    assert.equal(Number(drafted.cost_micros), 1000);
    assert.ok(Number(drafted.latency_ms) >= 0);
    assert.equal(drafted.raw_output?.startsWith('enc1:'), true);
    assert.equal(await mealCount(first), 28);

    const capped = await request(api.getHttpServer())
      .put('/v1/admin/ai-controls')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ dailyCostCapMicros: 1000 });
    assertOk(capped);
    const second = await queueRequest();
    await generate(second);
    const skipped = await attempt(second);
    assert.equal(skipped.status, 'skipped');
    assert.equal(skipped.skipped_reason, 'cost_cap');
    assert.equal(Number(skipped.cost_micros), 0);
    assert.equal(skipped.raw_output, null);
    assert.equal(await mealCount(second), 0);
    const cost = await request(api.getHttpServer())
      .get('/v1/admin/ai-cost')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(cost.status, 200);
    assert.equal(cost.body.spentMicros, 1000);
    assert.equal(cost.body.capMicros, 1000);
    assert.equal(cost.body.drafted, 1);
    assert.equal(cost.body.skipped, 1);
    assert.equal(JSON.stringify(cost.body).includes('enc1:'), false);
    const alerts = await pool.query(`select id from audit_logs where action = 'ai_cost_cap'`);
    assert.equal(alerts.rowCount, 1);

    const stopped = await request(api.getHttpServer())
      .put('/v1/admin/ai-controls')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ killSwitch: true, dailyCostCapMicros: null });
    assertOk(stopped);
    const third = await queueRequest();
    await generate(third);
    const killed = await attempt(third);
    assert.equal(killed.skipped_reason, 'kill_switch');
    assert.equal(await mealCount(third), 0);
    const alertsAgain = await pool.query(`select id from audit_logs where action = 'ai_cost_cap'`);
    assert.equal(alertsAgain.rowCount, 1);
    const negative = await request(api.getHttpServer())
      .put('/v1/admin/ai-controls')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ dailyCostCapMicros: -1 });
    assert.equal(negative.status, 400);
  });

  async function queueRequest(): Promise<string> {
    const order = uuidv7();
    const requestId = uuidv7();
    await pool.query(
      `insert into orders (id, user_id, service_code, price_toman, cash_toman, promo_toman, status, idempotency_key)
       values ($1, $2, 'new_plan', 500000, 500000, 0, 'paid', $3)`,
      [order, patient, `order-${order}`],
    );
    await pool.query(
      `insert into plan_requests (id, user_id, order_id, kind, status, submission_id, price_toman)
       values ($1, $2, $3, 'new_plan', 'queued', $4, 500000)`,
      [requestId, patient, order, submission],
    );
    return requestId;
  }

  async function generate(requestId: string): Promise<void> {
    const { PlanDraftService } = await import('../../dist/plans/plans.service.js');
    await api.get(PlanDraftService).generate(requestId);
  }

  async function attempt(requestId: string) {
    const rows = await pool.query<{
      status: string;
      provider: string;
      model: string;
      prompt_version: string;
      attempt_no: number;
      schema_version: number;
      tokens: string;
      cost_micros: string;
      latency_ms: number;
      raw_output: string | null;
      skipped_reason: string | null;
    }>(
      `select status, provider, model, prompt_version, attempt_no, schema_version, tokens, cost_micros,
              latency_ms, raw_output, skipped_reason
       from ai_generations where request_id = $1`,
      [requestId],
    );
    const row = rows.rows[0];
    assert.ok(row);
    return row;
  }

  async function mealCount(requestId: string): Promise<number> {
    const rows = await pool.query<{ n: number }>(
      `select count(m.id)::int as n
       from plan_versions v
       join plan_days d on d.plan_version_id = v.id
       join plan_meals m on m.plan_day_id = d.id
       where v.request_id = $1`,
      [requestId],
    );
    return rows.rows[0]?.n ?? 0;
  }

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
