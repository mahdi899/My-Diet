import { mkdtemp, rm } from 'node:fs/promises';
import net from 'node:net';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import os from 'node:os';
import path from 'node:path';
import type { INestApplication } from '@nestjs/common';
import type { Pool } from 'pg';
import { installGracefulStop } from '../helpers/postgres-stop.js';
import { uuidv7 } from '../../src/common/id.js';
import { addCivilDays } from '../../src/common/time.js';

const start = '2026-10-24';

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

async function member(pool: Pool, phone: string) {
  const userId = uuidv7();
  await pool.query(`insert into users (id, phone_e164, role) values ($1,$2,'user')`, [userId, phone]);
  await pool.query(`insert into wallets (user_id) values ($1)`, [userId]);
  const submission = uuidv7();
  await pool.query(`insert into questionnaire_submissions (id, user_id, schema_version, answers) values ($1,$2,1,'{}'::jsonb)`, [submission, userId]);
  const order = uuidv7();
  await pool.query(
    `insert into orders (id, user_id, service_code, price_toman, cash_toman, promo_toman, status, idempotency_key)
     values ($1,$2,'new_plan',500000,500000,0,'paid',$3)`,
    [order, userId, uuidv7()],
  );
  const requestId = uuidv7();
  const versionId = uuidv7();
  await pool.query(
    `insert into plan_requests (id, user_id, order_id, kind, status, submission_id, week_start, price_toman)
     values ($1,$2,$3,'new_plan','published',$4,$5,500000)`,
    [requestId, userId, order, submission, start],
  );
  await pool.query(`insert into plan_versions (id, request_id, version_number, status) values ($1,$2,1,'draft')`, [versionId, requestId]);
  const meals = new Map<string, string>();
  for (let day = 0; day < 7; day += 1) {
    const date = addCivilDays(start, day);
    const dayId = uuidv7();
    const mealId = uuidv7();
    const mealUid = uuidv7();
    meals.set(date, mealUid);
    await pool.query(`insert into plan_days (id, plan_version_id, day_index, civil_date) values ($1,$2,$3,$4)`, [dayId, versionId, day, date]);
    await pool.query(
      `insert into plan_meals (id, plan_day_id, meal_uid, position, meal_type, title, calories) values ($1,$2,$3,0,'breakfast','غذا',400)`,
      [mealId, dayId, mealUid],
    );
  }
  await pool.query(`update plan_versions set status='published', published_at=now() where id=$1`, [versionId]);
  await pool.query(`insert into active_plan_versions (user_id, version_id) values ($1,$2)`, [userId, versionId]);
  return { userId, requestId, orderId: order, meals };
}

async function eat(pool: Pool, userId: string, requestId: string, meals: Map<string, string>, dates: string[]) {
  for (const date of dates) {
    await pool.query(
      `insert into meal_logs (id, user_id, request_id, scheduled_date, meal_uid, eaten) values ($1,$2,$3,$4,$5,true)`,
      [uuidv7(), userId, requestId, date, meals.get(date)],
    );
  }
}

describe('phase 9 streak campaigns', { concurrency: 1, timeout: 180_000 }, () => {
  let directory = '';
  let stopDatabase: (() => Promise<void>) | undefined;
  let api: INestApplication;
  let pool: Pool;
  const previousNow = process.env.SABZINE_NOW;

  before(async () => {
    const { default: EmbeddedPostgres } = await import('embedded-postgres');
    directory = await mkdtemp(path.join(os.tmpdir(), 'sabzine-pg-'));
    const port = await freePort();
    const database = new EmbeddedPostgres({
      databaseDir: directory, user: 'sabzine', password: 'sabzine', port, persistent: false,
      initdbFlags: ['--encoding=UTF8', '--locale=C', '--no-sync', '-c', 'io_method=sync'],
    });
    installGracefulStop(database, directory);
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
    process.env.SABZINE_NOW = '2026-10-30T08:00:00.000Z';
    const { migrateUp } = await import('../../dist/database/migrate.js');
    await migrateUp(databaseUrl);
    const { createApp } = await import('../../dist/bootstrap.js');
    api = (await createApp()).app;
    const { PG_POOL } = await import('../../dist/database/database.js');
    pool = api.get(PG_POOL);
  });

  after(async () => {
    if (previousNow == null) delete process.env.SABZINE_NOW;
    else process.env.SABZINE_NOW = previousNow;
    await api?.close().catch(() => undefined);
    if (stopDatabase) await stopDatabase().catch(() => undefined);
    if (directory) await rm(directory, { recursive: true, force: true }).catch(() => undefined);
  });

  it('pays one milestone for concurrent claims and retries', async () => {
    const { StreakService } = await import('../../dist/rewards/streak.service.js');
    const streaks = api.get(StreakService);
    const person = await member(pool, '+989150000001');
    const idle = await streaks.snapshot(person.userId);
    assert.equal(idle.wallet, 0);
    assert.equal(idle.days.some((day) => day.state === 'qualified'), false);
    const dates = Array.from({ length: 7 }, (_, index) => addCivilDays(start, index));
    await eat(pool, person.userId, person.requestId, person.meals, dates);
    const command = uuidv7();
    const [first, second] = await Promise.all([
      streaks.claim(person.userId, command),
      streaks.claim(person.userId, uuidv7()),
    ]);
    const paid = [first, second].filter((row) => row.claimState === 'confirmed');
    assert.equal(paid.length, 1);
    assert.equal(paid[0]?.grants[0]?.amountToman, 200000);
    assert.equal([first, second].some((row) => row.claimState === 'duplicate'), true);
    const retried = await streaks.claim(person.userId, command);
    assert.equal(retried.retried, true);
    assert.equal(retried.wallet, 200000);
    const credits = await pool.query(
      `select count(*)::int as n from wallet_ledger where user_id=$1 and kind='campaign_reward'`,
      [person.userId],
    );
    assert.equal(credits.rows[0].n, 1);
  });

  it('keeps an open cycle on its original campaign version', async () => {
    const { StreakService } = await import('../../dist/rewards/streak.service.js');
    const streaks = api.get(StreakService);
    const started = await member(pool, '+989150000002');
    await eat(pool, started.userId, started.requestId, started.meals, [start]);
    const locked = await streaks.snapshot(started.userId);
    assert.equal(locked.version, 1);
    assert.equal(locked.wallet, 0);
    await streaks.publish({
      consecutiveDays: 7,
      milestones: [{ day: 7, amountToman: 50000 }],
      startsOn: start, endsOn: null, effectiveOn: start, repeat: 'cycle',
    });
    const dates = Array.from({ length: 7 }, (_, index) => addCivilDays(start, index));
    await eat(pool, started.userId, started.requestId, started.meals, dates.slice(1));
    const kept = await streaks.claim(started.userId, uuidv7());
    assert.equal(kept.version, 1);
    assert.equal(kept.wallet, 200000);
    const fresh = await member(pool, '+989150000003');
    await eat(pool, fresh.userId, fresh.requestId, fresh.meals, dates);
    const next = await streaks.claim(fresh.userId, uuidv7());
    assert.equal(next.version, 2);
    assert.equal(next.wallet, 50000);
  });

  it('does not qualify the next Tehran day or pay a corrected run twice', async () => {
    const { StreakService } = await import('../../dist/rewards/streak.service.js');
    const streaks = api.get(StreakService);
    const person = await member(pool, '+989150000004');
    await eat(pool, person.userId, person.requestId, person.meals, ['2026-10-30']);
    process.env.SABZINE_NOW = '2026-10-30T20:30:00.000Z';
    const crossed = await streaks.snapshot(person.userId);
    assert.equal(crossed.days[0]?.date, '2026-10-31');
    assert.equal(crossed.days[0]?.state, 'pending');
    assert.equal(crossed.wallet, 0);
    process.env.SABZINE_NOW = '2026-10-30T08:00:00.000Z';
    const corrected = await member(pool, '+989150000005');
    const dates = Array.from({ length: 7 }, (_, index) => addCivilDays(start, index));
    await eat(pool, corrected.userId, corrected.requestId, corrected.meals, dates);
    const paid = await streaks.claim(corrected.userId, uuidv7());
    assert.equal(paid.wallet, 50000);
    await pool.query(
      `update meal_logs set eaten=false, details='{"state":"skipped"}'::jsonb where user_id=$1 and scheduled_date=$2`,
      [corrected.userId, '2026-10-30'],
    );
    const reversed = await streaks.claim(corrected.userId, uuidv7());
    assert.equal(reversed.wallet, 0);
    const rows = await pool.query<{ kind: string }>(
      `select kind from wallet_ledger where user_id=$1 and kind in ('campaign_reward','campaign_reversal') order by created_at`,
      [corrected.userId],
    );
    assert.deepEqual(rows.rows.map((row) => row.kind), ['campaign_reward', 'campaign_reversal']);
  });

  it('holds an anomalous run and compensates a failed order once', async () => {
    const { StreakService } = await import('../../dist/rewards/streak.service.js');
    const { MoneyService } = await import('../../dist/money/money.service.js');
    const streaks = api.get(StreakService);
    const money = api.get(MoneyService);
    const person = await member(pool, '+989150000006');
    const dates = Array.from({ length: 7 }, (_, index) => addCivilDays(start, index));
    await eat(pool, person.userId, person.requestId, person.meals, dates);
    await pool.query(
      `insert into meal_log_anomalies (id, user_id, scheduled_date, kind) values ($1,$2,$3,'late_bulk_log')`,
      [uuidv7(), person.userId, '2026-10-30'],
    );
    const held = await streaks.claim(person.userId, uuidv7());
    assert.equal(held.claimState, 'held');
    assert.equal(held.wallet, 0);
    const again = await streaks.claim(person.userId, uuidv7());
    assert.equal(again.claimState, 'held');
    assert.equal(again.wallet, 0);
    const failed = await member(pool, '+989150000007');
    await pool.query(`update plan_requests set status='generating' where id=$1`, [failed.requestId]);
    await pool.query(`insert into ai_execution_claims (request_id, status) values ($1,'failed')`, [failed.requestId]);
    await pool.query(`update wallets set cash_toman=0 where user_id=$1`, [failed.userId]);
    const admin = uuidv7();
    await pool.query(`insert into users (id, phone_e164, role) values ($1,'+989150000099','admin')`, [admin]);
    const refunded = await money.compensatePermanentFailure(admin, failed.orderId);
    assert.equal(refunded.cashToman, 500000);
    const repeat = await money.compensatePermanentFailure(admin, failed.orderId);
    assert.equal(repeat.cashToman, 500000);
    const ledger = await pool.query(
      `select count(*)::int as n from wallet_ledger where user_id=$1 and kind='refund'`,
      [failed.userId],
    );
    assert.equal(ledger.rows[0].n, 1);
  });
});
