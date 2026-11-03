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

function codeOf(error: unknown): string {
  const response = (error as { getResponse?: () => { code?: string } }).getResponse?.();
  return response?.code ?? '';
}

describe('phase 6 weekly feedback', { concurrency: 1, timeout: 180_000 }, () => {
  let directory = '';
  let stopDatabase: (() => Promise<void>) | undefined;
  let api: INestApplication;
  let pool: Pool;
  let patient = '';
  let specialist = '';
  let adminId = '';
  const week = '2026-10-24';
  const optionA = '11111111-1111-4111-8111-111111111111';
  const optionB = '22222222-2222-4222-8222-222222222222';

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
    patient = uuidv7();
    specialist = uuidv7();
    adminId = uuidv7();
    await pool.query(`insert into users (id, phone_e164, role) values ($1,'+989120000001','user'),($2,'+989120000002','specialist'),($3,'+989120000003','admin')`, [patient, specialist, adminId]);
    const submission = uuidv7();
    await pool.query(
      `insert into questionnaire_submissions (id, user_id, schema_version, answers) values ($1,$2,1,$3::jsonb)`,
      [submission, patient, JSON.stringify({ preference: 'غذای ایرانی', dislikes: 'بادمجان' })],
    );
    const order = uuidv7();
    await pool.query(
      `insert into orders (id, user_id, service_code, price_toman, cash_toman, promo_toman, status, idempotency_key)
       values ($1,$2,'new_plan',500000,500000,0,'paid',$3)`,
      [order, patient, uuidv7()],
    );
    await pool.query(
      `insert into plan_requests (id, user_id, order_id, kind, status, submission_id, assigned_specialist_id, week_start, price_toman)
       values ($1,$2,$3,'new_plan','published',$4,$5,$6,500000)`,
      [uuidv7(), patient, order, submission, specialist, week],
    );
  });

  after(async () => {
    await api?.close().catch(() => undefined);
    if (stopDatabase) await stopDatabase().catch(() => undefined);
    if (directory) await rm(directory, { recursive: true, force: true }).catch(() => undefined);
  });

  it('keeps private feedback after moderation and separates public metrics', async () => {
    const { WeeklyFeedbackService } = await import('../../dist/feedback/weekly-feedback.service.js');
    const { AdminService } = await import('../../dist/admin/admin.service.js');
    const { TrackingService } = await import('../../dist/tracking/tracking.service.js');
    const feedback = api.get(WeeklyFeedbackService);
    const body = {
      weekStart: week, favorites: [optionA], dislikes: [optionB], preparationDifficulty: 'hard' as const,
      ingredientAvailability: 'partial' as const, affordability: 'tight' as const, portionSatisfaction: 'right' as const,
      serviceRating: 2, comment: 'خصوصی', publishPermission: false,
    };
    const first = await feedback.save(patient, body);
    const repeat = await feedback.save(patient, body);
    assert.equal(repeat.revision, first.revision);
    await assert.rejects(() => feedback.publish(patient, week), (error: unknown) => codeOf(error) === 'permission_required');
    const queued = await feedback.publish(patient, week).catch(() => null);
    assert.equal(queued, null);
    const allowed = await feedback.save(patient, { ...body, publishPermission: true });
    assert.ok(allowed.revision > first.revision);
    const published = await feedback.publish(patient, week);
    assert.equal(published.status, 'pending');
    assert.equal(published.privatePreserved, true);
    assert.equal(published.approvesNewPlan, false);
    await api.get(AdminService).moderateReview(adminId, published.reviewId, 'rejected');
    const still = await feedback.get(patient, week);
    assert.equal(still.comment, 'خصوصی');
    assert.equal((await api.get(TrackingService).publicReviews()).length, 0);
    const metrics = await feedback.metrics();
    assert.equal(metrics.privateFeedback.count, 1);
    assert.equal(metrics.privateFeedback.average, 2);
    assert.equal(metrics.publicApprovedReviews.count, 0);
    const status = await pool.query(`select status from plan_requests where user_id=$1`, [patient]);
    assert.equal(status.rows[0].status, 'published');
  });

  it('overrides inferred preferences and versions retry-safe reports without approving a plan', async () => {
    const { WeeklyFeedbackService } = await import('../../dist/feedback/weekly-feedback.service.js');
    const feedback = api.get(WeeklyFeedbackService);
    const open = await feedback.preferences(patient);
    assert.equal(open.revision, 0);
    assert.equal(open.overriddenByCustomer, false);
    assert.ok(open.favoriteOptions.includes('غذای ایرانی'));
    const confirmed = await feedback.confirm(patient, 0, [optionA], [], 'اصلاح خودم');
    assert.equal(confirmed.overriddenByCustomer, true);
    assert.deepEqual(confirmed.favoriteOptions, [optionA]);
    await assert.rejects(() => feedback.confirm(patient, 0, [], [], ''), (error: unknown) => codeOf(error) === 'lock_conflict');
    const command = uuidv7();
    const report = await feedback.generate(patient, week, command);
    assert.equal(report.version, 1);
    assert.equal(report.document.approvesNewPlan, false);
    assert.equal(report.document.notADiagnosis, true);
    assert.equal(report.document.consumption.adherenceKnown, false);
    const retried = await feedback.generate(patient, week, command);
    assert.equal(retried.retried, true);
    assert.equal(retried.version, 1);
    const stranger = uuidv7();
    await pool.query(`insert into users (id, phone_e164, role) values ($1,'+989120000099','specialist')`, [stranger]);
    await assert.rejects(() => feedback.forSpecialist(stranger, patient, week), (error: unknown) => codeOf(error) === 'not_found');
    const visible = await feedback.forSpecialist(specialist, patient, week);
    assert.equal(visible.version, 1);
    const plan = await pool.query(`select status from plan_requests where user_id=$1`, [patient]);
    assert.equal(plan.rows[0].status, 'published');
  });
});
