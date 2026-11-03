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
import { tehranToday, weekStartSaturday } from '../../src/common/time.js';

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

describe('phase 8 plan changes', { concurrency: 1, timeout: 180_000 }, () => {
  let directory = '';
  let stopDatabase: (() => Promise<void>) | undefined;
  let api: INestApplication;
  let pool: Pool;
  let patient = '';
  let specialist = '';
  let other = '';
  let versionId = '';
  let requestId = '';
  let mealUid = '';
  let mealId = '';
  let optionId = '';

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
    other = uuidv7();
    await pool.query(
      `insert into users (id, phone_e164, role) values ($1,'+989140000001','user'),($2,'+989140000002','specialist'),($3,'+989140000003','specialist')`,
      [patient, specialist, other],
    );
    await pool.query(
      `insert into specialist_profiles (user_id, display_name, active, verification_status) values ($1,'متخصص',true,'verified')`,
      [specialist],
    );
    const submission = uuidv7();
    await pool.query(`insert into questionnaire_submissions (id, user_id, schema_version, answers) values ($1,$2,1,'{}'::jsonb)`, [submission, patient]);
    const order = uuidv7();
    await pool.query(
      `insert into orders (id, user_id, service_code, price_toman, cash_toman, promo_toman, status, idempotency_key)
       values ($1,$2,'new_plan',500000,500000,0,'paid',$3)`,
      [order, patient, uuidv7()],
    );
    requestId = uuidv7();
    versionId = uuidv7();
    await pool.query(
      `insert into plan_requests (id, user_id, order_id, kind, status, submission_id, assigned_specialist_id, week_start, price_toman)
       values ($1,$2,$3,'new_plan','published',$4,$5,$6,500000)`,
      [requestId, patient, order, submission, specialist, weekStartSaturday(tehranToday())],
    );
    await pool.query(
      `insert into plan_versions (id, request_id, version_number, status, created_by) values ($1,$2,1,'draft',$3)`,
      [versionId, requestId, specialist],
    );
    await pool.query(
      `insert into plan_version_context (version_id, assigned_specialist_id, questionnaire_schema_version, questionnaire_snapshot)
       values ($1,$2,1,'{}'::jsonb)`,
      [versionId, specialist],
    );
    mealUid = uuidv7();
    for (let day = 0; day < 7; day += 1) {
      const dayId = uuidv7();
      const currentMeal = uuidv7();
      const currentMealId = uuidv7();
      await pool.query(`insert into plan_days (id, plan_version_id, day_index) values ($1,$2,$3)`, [dayId, versionId, day]);
      await pool.query(
        `insert into plan_meals (id, plan_day_id, meal_uid, position, meal_type, title, calories)
         values ($1,$2,$3,0,'breakfast','غذا',400)`,
        [currentMealId, dayId, day === 0 ? mealUid : currentMeal],
      );
      await pool.query(
        `insert into plan_meal_items (id, meal_id, position, name, quantity, unit) values ($1,$2,0,'برنج',100,'g')`,
        [uuidv7(), currentMealId],
      );
      for (const kind of ['primary', 'ai_alternative', 'specialist_alternative']) {
        const id = uuidv7();
        if (day === 0 && kind === 'primary') optionId = id;
        const document = {
          optionId: id, kind, title: 'غذا', calories: 400,
          portion: { quantity: 1, unit: 'serving', basis: 'as_served' },
          preparationMinutes: 10, instructions: 'آماده کن',
          ingredients: [{ name: 'برنج', quantity: 100, unit: 'g', basis: 'raw' }],
          approved: true,
        };
        await pool.query(
          `insert into plan_meal_options (meal_id, option_uid, kind, document, approved_by, approved_at)
           values ($1,$2,$3,$4::jsonb,$5,now())`,
          [currentMealId, id, kind, JSON.stringify(document), specialist],
        );
      }
      if (day === 0) mealId = currentMealId;
    }
    await pool.query(`update plan_versions set status='published', published_at=now() where id=$1`, [versionId]);
    await pool.query(`insert into active_plan_versions (user_id, version_id) values ($1,$2)`, [patient, versionId]);
  });

  after(async () => {
    await api?.close().catch(() => undefined);
    if (stopDatabase) await stopDatabase().catch(() => undefined);
    if (directory) await rm(directory, { recursive: true, force: true }).catch(() => undefined);
  });

  it('keeps the active plan until publication succeeds and ignores overlapping requests', async () => {
    const { PlanChangeService } = await import('../../dist/plans/plan-changes.service.js');
    const { PlanDraftService } = await import('../../dist/plans/plans.service.js');
    const changes = api.get(PlanChangeService);
    const plans = api.get(PlanDraftService);
    const command = uuidv7();
    const input = {
      commandId: command, versionId, reasonIds: ['budget'], explanation: 'توضیح خصوصی بیمار',
      targets: [{ dayIndex: 0, mealUid }],
    };
    const created = await changes.submit(patient, input);
    assert.equal(created.duplicate, false);
    assert.equal(created.status, 'awaiting_review');
    assert.equal((await changes.submit(patient, input)).duplicate, true);
    await assert.rejects(() => changes.submit(patient, { ...input, commandId: uuidv7() }), (error: unknown) => codeOf(error) === 'open_request');
    await assert.rejects(() => changes.forSpecialist(other, created.id), (error: unknown) => codeOf(error) === 'not_found');
    const asked = await changes.clarify(specialist, created.id, 'کدام روز؟');
    assert.equal(asked.substate, 'awaiting_clarification');
    await assert.rejects(() => changes.approve(specialist, created.id, 1), (error: unknown) => codeOf(error) === 'clarification_required');
    const answered = await changes.reply(patient, created.id, 'شنبه');
    assert.equal(answered.status, 'awaiting_review');
    assert.equal(answered.substate, 'none');
    await changes.updateReason('budget', 'برچسب جدید', true);
    const remembered = await changes.forCustomer(patient, created.id);
    assert.equal(remembered.reasons[0]?.label, 'هزینه برنامه زیاد است');
    assert.equal(remembered.userId, undefined);
    await pool.query(
      `insert into meal_logs (id, user_id, request_id, scheduled_date, meal_uid, eaten, plan_version_id, option_uid, plan_meal_id)
       values ($1,$2,$3,$4,$5,true,$6,$7,$8)`,
      [uuidv7(), patient, requestId, tehranToday(), mealUid, versionId, optionId, mealId],
    );
    await plans.correct(specialist, requestId);
    const draft = await plans.staffRequest(specialist, 'specialist', requestId, null);
    assert.ok(draft.version);
    const saved = await plans.replaceDraft(specialist, 'specialist', requestId, draft.version.lockVersion, {
      days: draft.version.days.map((day) => ({
        meals: day.meals.map((meal) => ({ ...meal, options: meal.options?.map((option) => ({ ...option, approved: true })) })),
      })),
    });
    await assert.rejects(() => changes.approve(specialist, created.id, saved.lockVersion + 9), (error: unknown) => codeOf(error) === 'lock_conflict');
    assert.equal((await changes.forCustomer(patient, created.id)).status, 'awaiting_review');
    assert.equal((await pool.query(`select version_id from active_plan_versions where user_id=$1`, [patient])).rows[0].version_id, versionId);
    const outcomes = await Promise.allSettled([1, 2].map(() => changes.approve(specialist, created.id, saved.lockVersion)));
    assert.equal(outcomes.filter((outcome) => outcome.status === 'fulfilled').length, 1);
    assert.equal(outcomes.filter((outcome) => outcome.status === 'rejected').length, 1);
    const approved = await changes.forSpecialist(specialist, created.id);
    assert.equal(approved.status, 'approved');
    assert.notEqual(approved.publishedVersionId, versionId);
    assert.equal((await pool.query(`select version_id from active_plan_versions where user_id=$1`, [patient])).rows[0].version_id, approved.publishedVersionId);
    assert.equal((await pool.query(`select status from plan_versions where id=$1`, [versionId])).rows[0].status, 'superseded');
    assert.equal((await pool.query(`select plan_version_id from meal_logs where user_id=$1`, [patient])).rows[0].plan_version_id, versionId);
    const messages = await pool.query<{ body: string }>(`select body from messages where change_request_id=$1`, [created.id]);
    assert.ok(messages.rows.some((row) => row.body === 'برنامهٔ جدید آماده است'));
    assert.equal(messages.rows.some((row) => row.body.includes('توضیح خصوصی')), false);
    const notice = await pool.query<{ payload: { changeRequestId?: string } }>(
      `select payload from notifications where user_id=$1 and kind='plan_change'`,
      [specialist],
    );
    assert.equal(JSON.stringify(notice.rows).includes('توضیح خصوصی'), false);
    assert.equal(notice.rows[0]?.payload.changeRequestId, created.id);
    const second = await changes.submit(patient, { commandId: uuidv7(), versionId: approved.publishedVersionId!, reasonIds: ['preference'] });
    const rejected = await changes.reject(specialist, second.id, 'برنامه فعلی مناسب است');
    assert.equal(rejected.status, 'rejected');
    assert.equal((await pool.query(`select version_id from active_plan_versions where user_id=$1`, [patient])).rows[0].version_id, approved.publishedVersionId);
    const queue = await changes.queue(specialist);
    assert.equal(queue.some((row) => row.id === second.id), false);
  });
});
