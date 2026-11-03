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
import { encryptText } from '../../src/common/field-crypto.js';
import { uuidv7 } from '../../src/common/id.js';
import { normalizeIranianMobile } from '../../src/common/phone.js';
import { questionnaireView } from '../../src/questionnaire/schema.js';

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

describe('phase 14 product', { concurrency: 1, timeout: 180_000 }, () => {
  let directory = '';
  let stopDatabase: (() => Promise<void>) | undefined;
  let api: INestApplication;
  let pool: Pool;
  let remembered: (phone: string) => string | undefined;
  let userToken = '';
  let otherToken = '';
  let specialistToken = '';
  let adminToken = '';
  let submissionId = '';

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

    const patientId = uuidv7();
    const otherId = uuidv7();
    const specialistId = uuidv7();
    const adminId = uuidv7();
    await pool.query(
      `insert into users (id, phone_e164, role, display_name) values
       ($1, '+989137000001', 'user', 'کاربر چهاردهم'),
       ($2, '+989137000002', 'user', 'کاربر دیگر'),
       ($3, '+989137000003', 'specialist', 'دکتر چهاردهم'),
       ($4, '+989137000000', 'admin', 'مدیر چهاردهم')`,
      [patientId, otherId, specialistId, adminId],
    );
    await pool.query(`insert into wallets (user_id) values ($1), ($2), ($3), ($4)`, [
      patientId,
      otherId,
      specialistId,
      adminId,
    ]);
    submissionId = uuidv7();
    const allergies = encryptText('پنیر', 'dev-only-field-key-not-for-production');
    await pool.query(
      `insert into questionnaire_submissions
         (id, user_id, schema_version, answers, risk_flags, bmi, pregnancy_as_of, submitted_at)
       values ($1, $2, 1, $3::jsonb, '{}', 22.5, '2026-09-01', '2026-09-01T08:00:00Z')`,
      [
        submissionId,
        patientId,
        JSON.stringify({
          name: 'نگار تستی',
          lifeStage: 'pregnant',
          pregnancyWeek: 10,
          allergies,
        }),
      ],
    );
    userToken = (await login('09137000001')).accessToken;
    otherToken = (await login('09137000002')).accessToken;
    specialistToken = (await login('09137000003')).accessToken;
    adminToken = (await loginAdmin(api, pool, '09137000000')).accessToken;
  });

  after(async () => {
    delete process.env.SABZINE_NOW;
    await api?.close().catch(() => undefined);
    try {
      if (stopDatabase) await stopDatabase();
    } catch {
      // Windows can keep the data directory locked briefly after stop.
    }
    if (directory) await rm(directory, { recursive: true, force: true }).catch(() => undefined);
  });

  it('keeps an old submission valid against its own schema after a required question is published', async () => {
    const denied = await request(api.getHttpServer())
      .get('/v1/me/questionnaire/current')
      .set('Authorization', `Bearer ${specialistToken}`);
    assert.equal(denied.status, 403);

    const empty = await request(api.getHttpServer())
      .get('/v1/me/questionnaire/current')
      .set('Authorization', `Bearer ${otherToken}`);
    assert.equal(empty.status, 200);
    assert.equal(empty.body.submission, null);

    process.env.SABZINE_NOW = '2026-10-06T08:00:00.000Z';
    const current = await request(api.getHttpServer())
      .get('/v1/me/questionnaire/current')
      .set('Authorization', `Bearer ${userToken}`);
    assert.equal(current.status, 200);
    assert.equal(current.body.submission.id, submissionId);
    assert.equal(current.body.submission.schemaVersion, 1);
    assert.equal(current.body.submission.valid, true);
    assert.equal(current.body.submission.answers.allergies, 'پنیر');
    assert.equal(current.body.submission.answers.name, 'نگار تستی');
    assert.equal(current.body.submission.pregnancyWeek, 15);
    assert.equal(current.body.submission.bmi, 22.5);
    assert.equal(JSON.stringify(current.body).includes('enc1:'), false);
    assert.equal(JSON.stringify(current.body).includes('+989137'), false);

    const questions = questionnaireView().questions.map((question) => ({
      id: question.id,
      title: question.title,
      kind: question.kind,
      options: question.options,
    }));
    const draft = await request(api.getHttpServer())
      .post('/v1/admin/questionnaire/schemas')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ questions: [...questions, { id: 'custom_note', title: 'یادداشت', kind: 'text', required: true }] });
    assertOk(draft);
    const published = await request(api.getHttpServer())
      .post(`/v1/admin/questionnaire/schemas/${draft.body.version}/publish`)
      .set('Authorization', `Bearer ${adminToken}`);
    assertOk(published);

    const still = await request(api.getHttpServer())
      .get('/v1/me/questionnaire/current')
      .set('Authorization', `Bearer ${userToken}`);
    assert.equal(still.status, 200);
    assert.equal(still.body.submission.schemaVersion, 1);
    assert.equal(still.body.submission.valid, true);
    assert.equal(still.body.submission.answers.custom_note, undefined);

    const review = await request(api.getHttpServer())
      .get('/v1/me/acquisition-state')
      .set('Authorization', `Bearer ${userToken}`);
    assert.equal(review.status, 200);
    assert.equal(review.body.questionnaire, 'needs_review');
    assert.deepEqual(review.body.reasons, ['schema_required_question_added', 'pregnancy_stale']);
  });

  async function login(phone: string): Promise<{ accessToken: string }> {
    const requested = await request(api.getHttpServer()).post('/v1/auth/otp/request').send({ phone });
    assertOk(requested);
    const code = remembered(normalizeIranianMobile(phone));
    assert.ok(code);
    const verified = await request(api.getHttpServer()).post('/v1/auth/otp/verify').send({ phone, code });
    assertOk(verified);
    return verified.body as { accessToken: string };
  }
});
