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

describe('phase 7 conversation media', { concurrency: 1, timeout: 180_000 }, () => {
  let directory = '';
  let stopDatabase: (() => Promise<void>) | undefined;
  let api: INestApplication;
  let pool: Pool;
  let patient = '';
  let specialist = '';
  let other = '';
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0x00]);

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
      `insert into users (id, phone_e164, role) values ($1,'+989130000001','user'),($2,'+989130000002','specialist'),($3,'+989130000003','specialist')`,
      [patient, specialist, other],
    );
    const submission = uuidv7();
    await pool.query(`insert into questionnaire_submissions (id, user_id, schema_version, answers) values ($1,$2,1,'{}'::jsonb)`, [submission, patient]);
    const order = uuidv7();
    await pool.query(
      `insert into orders (id, user_id, service_code, price_toman, cash_toman, promo_toman, status, idempotency_key)
       values ($1,$2,'new_plan',500000,500000,0,'paid',$3)`,
      [order, patient, uuidv7()],
    );
    await pool.query(
      `insert into plan_requests (id, user_id, order_id, kind, status, submission_id, assigned_specialist_id, price_toman)
       values ($1,$2,$3,'new_plan','in_review',$4,$5,500000)`,
      [uuidv7(), patient, order, submission, specialist],
    );
  });

  after(async () => {
    await api?.close().catch(() => undefined);
    if (stopDatabase) await stopDatabase().catch(() => undefined);
    if (directory) await rm(directory, { recursive: true, force: true }).catch(() => undefined);
  });

  it('keeps care media private, idempotent, and unavailable to an unassigned specialist', async () => {
    const { MessagingService } = await import('../../dist/messaging/messaging.service.js');
    const { RealtimeService } = await import('../../dist/realtime/realtime.service.js');
    const messaging = api.get(MessagingService);
    const realtime = api.get(RealtimeService);
    const care = await messaging.openCare(patient);
    const again = await messaging.openCare(patient);
    assert.equal(again.id, care.id);
    const requestId = uuidv7();
    const sent = await messaging.postRich(patient, care.id, { body: 'سلام خصوصی', clientRequestId: requestId });
    const retry = await messaging.postRich(patient, care.id, { body: 'سلام خصوصی', clientRequestId: requestId });
    assert.equal(retry.id, sent.id);
    assert.equal(retry.duplicate, true);
    const notes = await pool.query(`select payload from notifications where user_id=$1 and kind='message'`, [specialist]);
    assert.equal(notes.rowCount, 1);
    assert.equal(JSON.stringify(notes.rows[0].payload).includes('سلام'), false);
    const started = await messaging.beginMedia(patient, care.id, 'image', 'image/jpeg', null);
    assert.equal('storageKey' in started, false);
    const ready = await messaging.finishMedia(patient, started.id, jpeg, 'image/jpeg');
    assert.equal(ready.detectedType, 'image/jpeg');
    const bad = await messaging.beginMedia(patient, care.id, 'image', 'image/png', null);
    await assert.rejects(() => messaging.finishMedia(patient, bad.id, jpeg, 'image/png'), (error: unknown) => codeOf(error) === 'invalid_media');
    const attached = await messaging.postRich(patient, care.id, { mediaId: ready.id, clientRequestId: uuidv7() });
    assert.equal(attached.persisted, true);
    await assert.rejects(() => messaging.messages(other, care.id), (error: unknown) => codeOf(error) === 'not_found');
    await assert.rejects(() => messaging.beginMedia(other, care.id, 'image', 'image/jpeg', null), (error: unknown) => codeOf(error) === 'not_found');
    const grant = await messaging.grantMedia(specialist, ready.id);
    assert.equal(JSON.stringify(grant).includes('media/'), false);
    await assert.rejects(() => messaging.readMedia(other, ready.id, grant.grant), (error: unknown) => codeOf(error) === 'not_found');
    const downloaded = await messaging.readMedia(specialist, ready.id, grant.grant);
    assert.equal(downloaded.detectedType, 'image/jpeg');
    await pool.query(`update plan_requests set assigned_specialist_id=$2 where user_id=$1`, [patient, other]);
    await assert.rejects(() => messaging.messages(specialist, care.id), (error: unknown) => codeOf(error) === 'not_found');
    const events = await realtime.since(specialist, '1970-01-01T00:00:00.000Z');
    assert.equal(events.some((event) => event.type === 'message' && JSON.stringify(event.data).includes(care.id)), false);
    const status = await pool.query(`select status from plan_requests where user_id=$1`, [patient]);
    assert.equal(status.rows[0].status, 'in_review');
  });

  it('pages in server order and expires an unfinished upload', async () => {
    const { MessagingService } = await import('../../dist/messaging/messaging.service.js');
    const messaging = api.get(MessagingService);
    const care = await messaging.openCare(patient);
    const first = await messaging.postRich(other, care.id, { body: 'اول', clientRequestId: uuidv7() });
    await messaging.postRich(other, care.id, { body: 'دوم', clientRequestId: uuidv7() });
    await assert.rejects(() => messaging.receipt(other, care.id, first.id, 'delivered'), (error: unknown) => codeOf(error) === 'not_recipient');
    const received = await messaging.receipt(patient, care.id, first.id, 'delivered');
    assert.equal(received.state, 'delivered');
    const page = await messaging.timeline(patient, care.id, null, 1);
    assert.equal(page.messages.length, 1);
    assert.ok(page.nextCursor);
    const rest = await messaging.timeline(patient, care.id, page.nextCursor, 20);
    assert.ok(rest.messages.every((message) => message.position > page.messages[0]!.position));
    const pending = await messaging.beginMedia(patient, care.id, 'voice', 'audio/ogg', 1000);
    await pool.query(`update media_objects set expires_at=now() - interval '1 minute' where id=$1`, [pending.id]);
    assert.equal((await messaging.expireMedia()).expired >= 1, true);
    await assert.rejects(() => messaging.finishMedia(patient, pending.id, Buffer.from('OggSxxxx'), 'audio/ogg'), (error: unknown) => codeOf(error) === 'upload_expired');
  });
});
