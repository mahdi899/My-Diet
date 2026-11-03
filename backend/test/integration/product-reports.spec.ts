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

describe('phase 10 product reports', { concurrency: 1, timeout: 180_000 }, () => {
  let directory = '';
  let stopDatabase: (() => Promise<void>) | undefined;
  let api: INestApplication;
  let pool: Pool;
  let rated = '';
  let quiet = '';

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
    const { migrateUp } = await import('../../dist/database/migrate.js');
    await migrateUp(databaseUrl);
    const { createApp } = await import('../../dist/bootstrap.js');
    api = (await createApp()).app;
    const { PG_POOL } = await import('../../dist/database/database.js');
    pool = api.get(PG_POOL);
    const active = uuidv7();
    quiet = uuidv7();
    const recent = uuidv7();
    rated = uuidv7();
    const blank = uuidv7();
    await pool.query(
      `insert into users (id, phone_e164, role) values
       ($1,'+989160000001','user'),($2,'+989160000002','user'),($3,'+989160000003','user'),
       ($4,'+989160000004','specialist'),($5,'+989160000005','specialist')`,
      [active, quiet, recent, rated, blank],
    );
    await pool.query(
      `insert into specialist_profiles (user_id, display_name) values ($1,'الف'),($2,'ب')`,
      [rated, blank],
    );
    const submission = uuidv7();
    await pool.query(`insert into questionnaire_submissions (id, user_id, schema_version, answers) values ($1,$2,1,'{}'::jsonb)`, [submission, active]);
    const first = uuidv7();
    const second = uuidv7();
    const quietOrder = uuidv7();
    const recentOrder = uuidv7();
    await pool.query(
      `insert into orders (id, user_id, service_code, price_toman, cash_toman, promo_toman, status, idempotency_key, created_at) values
       ($1,$2,'new_plan',500000,500000,0,'paid','first',$3),
       ($4,$2,'new_plan',500000,500000,0,'paid','second',$5),
       ($6,$7,'new_plan',500000,500000,0,'paid','quiet',$8),
       ($9,$10,'new_plan',500000,500000,0,'paid','recent',$11)`,
      [first, active, '2026-09-03T00:00:00Z', second, '2026-09-15T00:00:00Z', quietOrder, quiet, '2026-08-01T00:00:00Z', recentOrder, recent, '2026-10-28T00:00:00Z'],
    );
    const requestId = uuidv7();
    const versionId = uuidv7();
    await pool.query(
      `insert into plan_requests (id, user_id, order_id, kind, status, submission_id, assigned_specialist_id, week_start, price_toman)
       values ($1,$2,$3,'new_plan','published',$4,$5,'2026-10-24',500000)`,
      [requestId, active, first, submission, rated],
    );
    await pool.query(`insert into plan_versions (id, request_id, version_number, status) values ($1,$2,1,'draft')`, [versionId, requestId]);
    const dayId = uuidv7();
    const mealId = uuidv7();
    const mealUid = uuidv7();
    const soup = uuidv7();
    const short = uuidv7();
    await pool.query(`insert into plan_days (id, plan_version_id, day_index, civil_date) values ($1,$2,0,'2026-10-04')`, [dayId, versionId]);
    await pool.query(
      `insert into plan_meals (id, plan_day_id, meal_uid, position, meal_type, title, calories) values ($1,$2,$3,0,'lunch','سوپ جو',300)`,
      [mealId, dayId, mealUid],
    );
    for (const [id, kind, title] of [[soup, 'primary', 'سوپ جو'], [short, 'ai_alternative', 'سوپ']] as const) {
      await pool.query(
        `insert into plan_meal_options (meal_id, option_uid, kind, document, approved_by, approved_at)
         values ($1,$2,$3,$4::jsonb,$5,now())`,
        [mealId, id, kind, JSON.stringify({ title }), rated],
      );
    }
    await pool.query(`update plan_versions set status='published', published_at=now() where id=$1`, [versionId]);
    await pool.query(
      `insert into sessions (id, user_id, created_at, absolute_expires_at, last_seen_at)
       values ($1,$2,'2026-09-10T00:00:00Z','2026-09-10T00:00:00Z'::timestamptz + interval '30 days','2026-09-10T00:00:00Z')`,
      [uuidv7(), active],
    );
    await pool.query(
      `insert into meal_logs (id, user_id, request_id, scheduled_date, meal_uid, eaten) values ($1,$2,$3,'2026-09-08',$4,true)`,
      [uuidv7(), active, requestId, mealUid],
    );
    await pool.query(
      `insert into meal_selections (user_id, civil_date, meal_uid, version_id, meal_id, option_uid, reason_id, reason_label) values
       ($1,'2026-10-04',$2,$3,$4,$5,'time','زمان آماده‌سازی'),
       ($1,'2026-10-06',$2,$3,$4,$5,'time','زمان آماده‌سازی'),
       ($1,'2026-10-08',$2,$3,$4,$6,null,null)`,
      [active, mealUid, versionId, mealId, soup, short],
    );
    await pool.query(
      `insert into weekly_feedback (user_id, week_start, dislikes) values ($1,'2026-10-24',$2::jsonb)`,
      [active, JSON.stringify([soup])],
    );
    await pool.query(
      `insert into program_reviews (id, user_id, request_id, week_start, rating, body, status)
       values ($1,$2,$3,'2026-10-24',2,'کم بود','rejected')`,
      [uuidv7(), active, requestId],
    );
    const answered = uuidv7();
    const waiting = uuidv7();
    await pool.query(
      `insert into conversations (id, kind, user_id, request_id) values ($1,'care',$2,$3),($4,'care',$2,$3)`,
      [answered, active, requestId, waiting],
    );
    await pool.query(
      `insert into messages (id, conversation_id, author_id, body, kind, created_at) values
       ($1,$2,$3,'سؤال','text','2026-10-01T10:00:00Z'),
       ($4,$2,$3,'سیستم','system','2026-10-01T10:01:00Z'),
       ($5,$2,$6,'پاسخ','text','2026-10-01T10:30:00Z'),
       ($7,$8,$3,'بی‌پاسخ','text','2026-10-02T10:00:00Z')`,
      [uuidv7(), answered, active, uuidv7(), uuidv7(), rated, uuidv7(), waiting],
    );
    await pool.query(
      `insert into plan_change_requests
         (id, user_id, plan_request_id, version_id, command_id, status, rejection_explanation, created_at, updated_at, first_responded_at)
       values ($1,$2,$3,$4,$5,'rejected','نه','2026-10-01T08:00:00Z','2026-10-01T11:00:00Z','2026-10-01T09:00:00Z')`,
      [uuidv7(), active, requestId, versionId, uuidv7()],
    );
  });

  after(async () => {
    await api?.close().catch(() => undefined);
    if (stopDatabase) await stopDatabase().catch(() => undefined);
    if (directory) await rm(directory, { recursive: true, force: true }).catch(() => undefined);
  });

  it('keeps unfinished cohorts unknown and separates the three retention events', async () => {
    const { ProductReportsService } = await import('../../dist/reports/product-reports.service.js');
    const reports = api.get(ProductReportsService);
    const activity = await reports.retention('2026-08-01', '2026-10-30', 'activity');
    assert.equal(activity.status, 'ready');
    const byDate = Object.fromEntries(activity.rows.map((row) => [row.id, row]));
    assert.equal(byDate['2026-10-28']?.cells.week1.state, 'not_yet_measurable');
    assert.equal(byDate['2026-08-01']?.cells.week4.state, 'measured');
    assert.equal(byDate['2026-08-01']?.cells.week4.count, 0);
    assert.equal(byDate['2026-09-03']?.cells.week1.count, 1);
    const tracking = await reports.retention('2026-08-01', '2026-10-30', 'tracking');
    const purchase = await reports.retention('2026-08-01', '2026-10-30', 'purchase');
    assert.equal(tracking.rows.find((row) => row.id === '2026-09-03')?.cells.week1.count, 1);
    assert.equal(purchase.rows.find((row) => row.id === '2026-09-03')?.cells.week1.count, 0);
    assert.equal(purchase.rows.find((row) => row.id === '2026-09-03')?.cells.week2.count, 1);
    assert.equal(byDate['2026-08-01']?.cells.week1.count, 0);
    assert.equal((await reports.retention('2026-11-01', '2026-11-02', 'activity')).status, 'empty');
    assert.equal((await reports.retention('2026-10-30', '2026-10-01', 'activity')).status, 'invalid');
  });

  it('ranks exact food labels and keeps a rejected rating in the specialist board', async () => {
    const { ProductReportsService } = await import('../../dist/reports/product-reports.service.js');
    const reports = api.get(ProductReportsService);
    const selected = await reports.foods('2026-10-01', '2026-10-30', 'selected');
    assert.equal(selected.rows[0]?.label, 'سوپ جو');
    assert.equal(selected.rows[0]?.count, 2);
    assert.equal(selected.rows.find((row) => row.label === 'سوپ')?.count, 1);
    const alternatives = await reports.foods('2026-10-01', '2026-10-30', 'alternative');
    assert.deepEqual(alternatives.rows.map((row) => row.label), ['سوپ']);
    const disliked = await reports.foods('2026-10-01', '2026-10-30', 'disliked');
    assert.equal(disliked.rows[0]?.label, 'سوپ جو');
    const reasons = await reports.foods('2026-10-01', '2026-10-30', 'reason');
    assert.equal(reasons.rows[0]?.id, 'time');
    assert.equal(reasons.rows[0]?.count, 2);
    const feedback = await reports.feedback('2026-09-01', '2026-10-30');
    assert.equal(feedback.status, 'ready');
    if (feedback.status === 'ready') {
      assert.equal(feedback.participation.count, 1);
      assert.equal(feedback.continuation.count, 1);
    }
    const board = await reports.specialists('rating');
    assert.equal(board.rows.length, 2);
    assert.equal(board.rows[0]?.id, rated);
    assert.equal(board.rows[0]?.ratingAverage, 2);
    assert.equal(board.rows[0]?.smallSample, true);
    assert.equal(board.rows[0]?.messageResponse, 30);
    assert.equal(board.rows[0]?.messageSamples, 1);
    assert.equal(board.rows[0]?.pendingMessages, 1);
    assert.equal(board.rows[0]?.changeResponse, 60);
    assert.equal(board.rows[0]?.reviewTime, 180);
    assert.equal(board.rows.at(-1)?.ratingAverage, null);
    assert.equal((await reports.specialists('workload')).rows.length, 2);
    assert.equal(quiet.length > 0, true);
  });
});
