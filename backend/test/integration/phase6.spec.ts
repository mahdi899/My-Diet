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

describe('phase 6 product', { concurrency: 1, timeout: 180_000 }, () => {
  let directory = '';
  let stopDatabase: (() => Promise<void>) | undefined;
  let api: INestApplication;
  let pool: Pool;
  let remembered: (phone: string) => string | undefined;
  let adminToken = '';
  let userToken = '';
  let holder = '';

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
    const adminId = uuidv7();
    await pool.query(
      `insert into users (id, phone_e164, role, display_name) values ($1, '+989129000000', 'admin', 'مدیر')`,
      [adminId],
    );
    await pool.query(`insert into wallets (user_id) values ($1)`, [adminId]);
    adminToken = (await login('09129000000')).accessToken;
    userToken = (await login('09129000001')).accessToken;
    holder = uuidv7();
    await pool.query(`insert into users (id, phone_e164, role) values ($1, '+989129000099', 'user')`, [holder]);
    await pool.query(`insert into wallets (user_id, cash_toman, promo_toman) values ($1, 500000, 20000)`, [holder]);
    await pool.query(
      `insert into wallet_ledger (id, user_id, bucket, amount_toman, kind, reference_id)
       values ($1, $2, 'cash', 500000, 'topup', $3), ($4, $2, 'promo', 20000, 'adjustment', $5)`,
      [uuidv7(), holder, uuidv7(), uuidv7(), uuidv7()],
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

  it('records a bank refund once and will not spend cash the wallet does not have', async () => {
    const referenceId = uuidv7();
    const body = {
      userId: holder,
      amountToman: 100000,
      direction: 'debit',
      reason: 'بازگشت به کارت',
      referenceId,
    };
    const denied = await request(api.getHttpServer())
      .post('/v1/admin/wallet-adjustments')
      .set('Authorization', `Bearer ${userToken}`)
      .send(body);
    assert.equal(denied.status, 403);
    const card = await request(api.getHttpServer())
      .post('/v1/admin/wallet-adjustments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...body, cardNumber: '6219' });
    assert.equal(card.status, 400);
    const first = await request(api.getHttpServer())
      .post('/v1/admin/wallet-adjustments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(body);
    assertOk(first);
    assert.equal(first.body.cashToman, 400000);
    assert.equal(first.body.promoToman, 20000);
    assert.equal(JSON.stringify(first.body).includes('+989'), false);
    const again = await request(api.getHttpServer())
      .post('/v1/admin/wallet-adjustments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(body);
    assertOk(again);
    assert.equal(again.body.cashToman, 400000);
    const rows = await pool.query(
      `select amount_toman from wallet_ledger where user_id = $1 and kind = 'adjustment' and bucket = 'cash'`,
      [holder],
    );
    assert.equal(rows.rowCount, 1);
    assert.equal(Number(rows.rows[0]?.amount_toman), -100000);
    const over = await request(api.getHttpServer())
      .post('/v1/admin/wallet-adjustments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...body, amountToman: 500000, referenceId: uuidv7() });
    assert.equal(over.status, 402);
    const cash = await pool.query<{ cash_toman: string }>(`select cash_toman from wallets where user_id = $1`, [holder]);
    assert.equal(Number(cash.rows[0]?.cash_toman), 400000);
  });

  it('lists a stopped outbox event without its payload and lets an admin retry it', async () => {
    const dead = uuidv7();
    const live = uuidv7();
    const done = uuidv7();
    await pool.query(
      `insert into outbox_events (id, topic, aggregate_id, payload, attempts)
       values ($1, 'plan.generate', $2, '{"phone":"+989129000077"}'::jsonb, 10),
              ($3, 'plan.generate', $4, '{}'::jsonb, 1)`,
      [dead, uuidv7(), live, uuidv7()],
    );
    await pool.query(
      `insert into outbox_events (id, topic, aggregate_id, payload, attempts, dispatched_at)
       values ($1, 'plan.generate', $2, '{}'::jsonb, 10, now())`,
      [done, uuidv7()],
    );
    const denied = await request(api.getHttpServer())
      .get('/v1/admin/outbox/dead')
      .set('Authorization', `Bearer ${userToken}`);
    assert.equal(denied.status, 403);
    const listed = await request(api.getHttpServer())
      .get('/v1/admin/outbox/dead')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(listed.status, 200);
    assert.deepEqual(listed.body.events.map((event: { id: string }) => event.id), [dead]);
    assert.equal(JSON.stringify(listed.body).includes('+989'), false);
    assert.equal(JSON.stringify(listed.body).includes('payload'), false);
    const retried = await request(api.getHttpServer())
      .post(`/v1/admin/outbox/${dead}/retry`)
      .set('Authorization', `Bearer ${adminToken}`);
    assertOk(retried);
    assert.equal(retried.body.attempts, 0);
    const after = await request(api.getHttpServer())
      .get('/v1/admin/outbox/dead')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.deepEqual(after.body.events, []);
    const missing = await request(api.getHttpServer())
      .post(`/v1/admin/outbox/${dead}/retry`)
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(missing.status, 404);
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
