import { mkdtemp, rm } from 'node:fs/promises';
import net from 'node:net';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import os from 'node:os';
import path from 'node:path';
import type { INestApplication } from '@nestjs/common';
import type { Pool } from 'pg';
import request from 'supertest';
import { installGracefulStop } from '../helpers/postgres-stop.js';
import { loginAdmin } from '../helpers/admin-login.js';
import { loginAdmin } from '../helpers/admin-login.js';
import { uuidv7 } from '../../src/common/id.js';
import { normalizeIranianMobile } from '../../src/common/phone.js';
import { activeQuestions, missingRequired, type AnswerValue, type CanonicalAnswers, type SpecQuestion } from '../../src/onboarding/spec.js';

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

const BASE: CanonicalAnswers = {
  name: 'نگار',
  age: 33,
  sex: 'female',
  height_cm: 166,
  weight_kg: 79,
  target_weight_kg: 68,
  sleep_wake: { sleep: 23, wake: 7 },
};

/** A valid answer for any question, preferring harmless options. */
function sample(question: SpecQuestion, answers: CanonicalAnswers): AnswerValue {
  if (BASE[question.key] != null) return BASE[question.key]!;
  const options = question.options ?? [];
  if (question.kind === 'text') return 'توضیح';
  if (question.kind === 'number' || question.kind === 'age') return question.default ?? question.min ?? 1;
  if (question.kind === 'single') return (options.find((option) => option.code !== 'yes') ?? options[0])!.code;
  const none = options.find((option) => option.code === 'none');
  void answers;
  return [(none ?? options[0])!.code];
}

function answerAll(track: 'weight_loss', only?: (question: SpecQuestion) => boolean): CanonicalAnswers {
  const answers: CanonicalAnswers = {};
  for (let round = 0; round < 5; round += 1) {
    for (const question of activeQuestions(track, answers)) {
      if (answers[question.key] != null || (only && !only(question))) continue;
      answers[question.key] = sample(question, answers);
      if (question.followUp) {
        const value = answers[question.key];
        const codes = Array.isArray(value) ? value : [String(value)];
        if (codes.some((code) => question.followUp!.whenCodes.includes(code))) answers[question.followUp.key] = 'توضیح';
      }
    }
  }
  return answers;
}

/** The way the web demo stores an answer: label text. */
function demoLabel(question: SpecQuestion, value: AnswerValue): string {
  const options = question.options ?? [];
  if (question.kind === 'single') return options.find((option) => option.code === value)?.label ?? '';
  if (question.kind === 'multi' || question.kind === 'dish_picker') {
    return (value as string[]).map((code) => options.find((option) => option.code === code)?.label ?? code).join('، ');
  }
  if (question.kind === 'age') return options.find((option) => option.code === '30_40')?.label ?? '';
  if (question.kind === 'sleep_wake') {
    const record = value as { sleep: number; wake: number };
    return `خواب ${record.sleep} — بیداری ${record.wake}`;
  }
  return String(value);
}

describe('onboarding', { concurrency: 1, timeout: 240_000 }, () => {
  let directory = '';
  let stopDatabase: (() => Promise<void>) | undefined;
  let api: INestApplication;
  let pool: Pool;
  let remembered: (phone: string) => string | undefined;

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
    await api.init();
    const { PG_POOL } = await import('../../dist/database/database.js');
    pool = api.get(PG_POOL);
    remembered = (await import('../../dist/adapters/sms.js')).rememberedOtp;
  });

  after(async () => {
    await api?.close();
    await stopDatabase?.();
    if (directory) await rm(directory, { recursive: true, force: true }).catch(() => undefined);
  });

  async function login(phone: string): Promise<string> {
    const requested = await request(api.getHttpServer()).post('/v1/auth/otp/request').send({ phone });
    assert.ok(requested.status === 200 || requested.status === 201, JSON.stringify(requested.body));
    const code = remembered(normalizeIranianMobile(phone));
    assert.ok(code);
    const verified = await request(api.getHttpServer()).post('/v1/auth/otp/verify').send({ phone, code });
    assert.ok(verified.status === 200 || verified.status === 201, JSON.stringify(verified.body));
    return verified.body.accessToken as string;
  }

  it('serves the public spec', async () => {
    const response = await request(api.getHttpServer()).get('/v1/public/onboarding-spec');
    assert.equal(response.status, 200);
    assert.equal(response.body.version, 2);
    assert.equal(response.body.tracks.length, 4);
    assert.ok(response.body.questions.length > 30);
    assert.ok(Array.isArray(response.body.insights));
    assert.ok(response.body.groups.basics);
  });

  it('imports a verified demo lead, asks only the gaps and stores a typed profile', async () => {
    const phone = '09125550101';
    const demoOnly = answerAll('weight_loss', (question) => question.demo === 'all' || (Array.isArray(question.demo) && question.demo.includes('weight_loss')));
    const rows = activeQuestions('weight_loss', demoOnly)
      .filter((question) => demoOnly[question.key] != null)
      .map((question) => ({
        question: question.demoTitles?.[0] ?? question.title,
        answer: demoLabel(question, demoOnly[question.key]!),
      }))
      .filter((row) => row.answer !== '');
    const saved = await request(api.getHttpServer()).post('/v1/onboarding/submissions').send({
      id: uuidv7().replace(/^(.{14})7/, '$14'), phone, goal: 'weight_loss', answers: rows,
    });
    assert.equal(saved.status, 201, JSON.stringify(saved.body));

    const token = await login(phone);
    const auth = { Authorization: `Bearer ${token}` };
    const state = await request(api.getHttpServer()).get('/v1/me/onboarding').set(auth);
    assert.equal(state.status, 200, JSON.stringify(state.body));
    assert.equal(state.body.claimedFromDemo, true);
    assert.equal(state.body.track, 'weight_loss');

    const everything = answerAll('weight_loss');
    const missing: string[] = state.body.missing;
    const patch: CanonicalAnswers = {};
    for (const key of missing) patch[key] = everything[key] ?? null;
    if (missing.length === 0) {
      assert.equal(state.body.status, 'complete');
      assert.equal(state.body.draft, null);
      assert.equal(state.body.nextStep, 'consent');
      const consent = await request(api.getHttpServer()).post('/v1/me/onboarding/consent').set(auth);
      assert.equal(consent.status, 201, JSON.stringify(consent.body));
    } else {
      assert.equal(state.body.draft.answers.name, 'نگار');
      const early = await request(api.getHttpServer()).post('/v1/me/onboarding/submit').set(auth).send({ consent: true });
      assert.equal(early.status, 422);
      assert.equal(early.body.code, 'onboarding_incomplete');
      const drafted = await request(api.getHttpServer()).put('/v1/me/onboarding/draft').set(auth)
        .send({ patch, baseVersion: state.body.draft.version });
      assert.equal(drafted.status, 200, JSON.stringify(drafted.body));
      const stale = await request(api.getHttpServer()).put('/v1/me/onboarding/draft').set(auth)
        .send({ patch: {}, baseVersion: state.body.draft.version });
      assert.equal(stale.status, 409);
      const noConsent = await request(api.getHttpServer()).post('/v1/me/onboarding/submit').set(auth).send({});
      assert.equal(noConsent.status, 422);
      assert.equal(noConsent.body.code, 'consent_required');
      const done = await request(api.getHttpServer()).post('/v1/me/onboarding/submit').set(auth).send({ consent: true });
      assert.equal(done.status, 201, JSON.stringify(done.body));
      assert.ok(done.body.profile.targetKcal >= 1200);
    }

    const after = await request(api.getHttpServer()).get('/v1/me/onboarding').set(auth);
    assert.equal(after.body.status, 'complete');
    assert.equal(after.body.nextStep, 'enter_app');
    const profile = await pool.query(`select source, track, target_kcal, consented_at from nutrition_profiles`);
    assert.equal(profile.rowCount, 1);
    assert.equal(profile.rows[0].track, 'weight_loss');
    const claimed = await pool.query(`select claimed_user_id from demo_lead_submissions`);
    assert.ok(claimed.rows[0].claimed_user_id);
    const facts = await pool.query(`select count(*)::int as n from onboarding_answer_facts`);
    assert.ok(facts.rows[0].n > 10);
    const free = await pool.query(`select 1 from onboarding_answer_facts where question_key = 'name'`);
    assert.equal(free.rowCount, 0);
  });

  it('shows demo registration in admin user detail and hard-deletes from the list', async () => {
    const adminPhone = '09125550999';
    const adminId = uuidv7();
    await pool.query(
      `insert into users (id, phone_e164, role, status) values ($1, $2, 'admin', 'active')`,
      [adminId, normalizeIranianMobile(adminPhone)],
    );
    const admin = await loginAdmin(api, pool, adminPhone);

    const phone = '09125550188';
    const demoOnly = answerAll('weight_loss', (question) => question.demo === 'all' || (Array.isArray(question.demo) && question.demo.includes('weight_loss')));
    const rows = activeQuestions('weight_loss', demoOnly)
      .filter((question) => demoOnly[question.key] != null)
      .map((question) => ({
        question: question.demoTitles?.[0] ?? question.title,
        answer: demoLabel(question, demoOnly[question.key]!),
      }))
      .filter((row) => row.answer !== '');
    const saved = await request(api.getHttpServer()).post('/v1/onboarding/submissions').send({
      id: uuidv7().replace(/^(.{14})7/, '$14'), phone, goal: 'weight_loss', answers: rows,
    });
    assert.equal(saved.status, 201, JSON.stringify(saved.body));

    await login(phone);
    const userId = (await pool.query<{ id: string }>(
      `select id from users where phone_e164 = $1`,
      [normalizeIranianMobile(phone)],
    )).rows[0]!.id;
    const status = await pool.query<{ status: string }>(`select status from users where id = $1`, [userId]);
    assert.equal(status.rows[0]!.status, 'pending');

    const detail = await request(api.getHttpServer())
      .get(`/v1/admin/users/${userId}`)
      .set('Authorization', `Bearer ${admin.accessToken}`);
    assert.equal(detail.status, 200, JSON.stringify(detail.body));
    assert.equal(detail.body.intake.trackId, 'weight_loss');
    assert.ok(detail.body.intake.answers.length > 5);
    assert.ok(detail.body.intake.answers.some((row: { question: string }) => row.question.includes('اسم')));

    const removed = await request(api.getHttpServer())
      .post(`/v1/admin/users/${userId}/delete`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ confirmation: 'حذف حساب' });
    assert.equal(removed.status, 201, JSON.stringify(removed.body));

    const list = await request(api.getHttpServer())
      .get('/v1/admin/users')
      .set('Authorization', `Bearer ${admin.accessToken}`);
    assert.ok(!list.body.some((row: { id: string }) => row.id === userId));
    const gone = await pool.query(`select 1 from users where id = $1`, [userId]);
    assert.equal(gone.rowCount, 0);
  });

  it('runs the full flow for a user without a demo lead and rejects tampered answers', async () => {
    const token = await login('09125550102');
    const auth = { Authorization: `Bearer ${token}` };
    const fresh = await request(api.getHttpServer()).get('/v1/me/onboarding').set(auth);
    assert.equal(fresh.body.status, 'none');
    assert.equal(fresh.body.nextStep, 'start');

    const bad = await request(api.getHttpServer()).put('/v1/me/onboarding/draft').set(auth)
      .send({ track: 'weight_loss', patch: { age: 7, nonsense: 1 } });
    assert.equal(bad.status, 400);
    const badOption = await request(api.getHttpServer()).put('/v1/me/onboarding/draft').set(auth)
      .send({ track: 'weight_loss', patch: { sex: 'robot' } });
    assert.equal(badOption.status, 400);

    const all = answerAll('weight_loss');
    const saved = await request(api.getHttpServer()).put('/v1/me/onboarding/draft').set(auth)
      .send({ track: 'weight_loss', patch: all, stepKey: 'review', progress: 90 });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    const resumed = await request(api.getHttpServer()).get('/v1/me/onboarding').set(auth);
    assert.equal(resumed.body.nextStep, 'resume');
    assert.deepEqual(resumed.body.missing, missingRequired('weight_loss', all));
    const stored = await pool.query<{ answers: Record<string, unknown> }>(`select answers from onboarding_drafts`);
    assert.notEqual(stored.rows[0]?.answers.name, 'نگار', 'free text must be sealed at rest');

    const done = await request(api.getHttpServer()).post('/v1/me/onboarding/submit').set(auth).send({ consent: true });
    assert.equal(done.status, 201, JSON.stringify(done.body));
    assert.equal((await request(api.getHttpServer()).get('/v1/me/onboarding').set(auth)).body.nextStep, 'enter_app');
  });

  it('lets an admin filter, read and audit profiles', async () => {
    const adminId = uuidv7();
    await pool.query(
      `insert into users (id, phone_e164, role, status) values ($1,'+989180000099','admin','active')`,
      [adminId],
    );
    const session = await loginAdmin(api, pool, '09180000099');
    const auth = { Authorization: `Bearer ${session.accessToken}` };
    const list = await request(api.getHttpServer()).get('/v1/admin/onboarding/profiles?track=weight_loss&limit=1').set(auth);
    assert.equal(list.status, 200, JSON.stringify(list.body));
    assert.equal(list.body.items.length, 1);
    assert.ok(list.body.nextCursor);
    assert.match(list.body.items[0].phone, /\*\*\*/);
    const next = await request(api.getHttpServer()).get(`/v1/admin/onboarding/profiles?limit=1&cursor=${list.body.nextCursor}`).set(auth);
    assert.equal(next.body.items.length, 1);
    assert.notEqual(next.body.items[0].userId, list.body.items[0].userId);
    const detail = await request(api.getHttpServer()).get(`/v1/admin/onboarding/profiles/${list.body.items[0].userId}`).set(auth);
    assert.equal(detail.status, 200);
    assert.ok(detail.body.submission.answers.name);
    const audited = await pool.query(`select 1 from audit_logs where action = 'onboarding_profile_viewed'`);
    assert.equal(audited.rowCount, 1);
    const funnel = await request(api.getHttpServer()).get('/v1/admin/onboarding/funnel').set(auth);
    assert.equal(funnel.body.stages.profiles, 2);
    assert.equal(funnel.body.stages.onboardingClaimed, 1);
    assert.equal((await request(api.getHttpServer()).post('/v1/admin/onboarding/funnel/refresh').set(auth)).status, 201);
    const noAuth = await request(api.getHttpServer()).get('/v1/admin/onboarding/profiles');
    assert.equal(noAuth.status, 401);
  });
});
