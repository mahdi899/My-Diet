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
import { signAccessToken } from '../../src/common/jwt.js';

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

function at(iso: string, step: number): string {
  return new Date(new Date(iso).getTime() + step * 1000).toISOString();
}

function codeOf(error: unknown): string {
  if (!error || typeof error !== 'object' || !('getResponse' in error)) return '';
  const response = (error as { getResponse: () => { code?: string } }).getResponse();
  return response.code ?? '';
}

describe('phase 11 journey events', { concurrency: 1, timeout: 180_000 }, () => {
  let directory = '';
  let stopDatabase: (() => Promise<void>) | undefined;
  let api: INestApplication;
  let pool: Pool;
  let secret = '';

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
    process.env.SABZINE_NOW = '2026-10-24T06:30:00.000Z';
    const { migrateUp } = await import('../../dist/database/migrate.js');
    await migrateUp(databaseUrl);
    const { createApp } = await import('../../dist/bootstrap.js');
    api = (await createApp()).app;
    const { PG_POOL } = await import('../../dist/database/database.js');
    const { ENV } = await import('../../dist/config/env.js');
    pool = api.get(PG_POOL);
    secret = api.get<{ JWT_SECRET: string }>(ENV).JWT_SECRET;
  });

  after(async () => {
    await api?.close();
    await stopDatabase?.();
    if (directory) await rm(directory, { recursive: true, force: true }).catch(() => undefined);
  });

  it('drops duplicates, sensitive fields, and cross-account relinking', async () => {
    const { JourneyService } = await import('../../dist/reports/journey.service.js');
    const journeys = api.get(JourneyService);
    const now = '2026-10-24T06:30:00.000Z';
    process.env.SABZINE_NOW = now;
    const installId = uuidv7();
    const sessionId = uuidv7();
    const ids = [uuidv7(), uuidv7(), uuidv7(), uuidv7(), uuidv7()];
    const body = {
      installId,
      sessionId,
      events: [
        { id: ids[0], type: 'session_started', occurredAt: at(now, 0), properties: { platform: 'android', appVersion: '1.0.0', sessionType: 'returning', firstAuthenticated: true } },
        { id: ids[1], type: 'screen_viewed', occurredAt: at(now, 1), properties: { screenId: 'home', activeMs: 1000 } },
        { id: ids[2], type: 'navigation', occurredAt: at(now, 2), properties: { fromScreenId: 'home', toScreenId: 'login' } },
        { id: ids[3], type: 'screen_viewed', occurredAt: at(now, 3), properties: { screenId: 'login', activeMs: 500 } },
        { id: ids[4], type: 'plan_purchase_completed', occurredAt: at(now, 4), properties: { serviceId: 'plan' } },
      ],
    };
    const first = await journeys.ingest(body);
    assert.equal(first.sessionType, 'first_visit');
    assert.equal(first.firstAuthenticated, false);
    assert.equal(first.link, 'anonymous');
    assert.equal(first.accepted, 5);
    const retry = await journeys.ingest(body);
    assert.equal(retry.accepted, 0);
    assert.equal(retry.duplicates, 5);
    await assert.rejects(
      () => journeys.ingest({
        installId,
        sessionId,
        events: [{ id: ids[2], type: 'navigation', occurredAt: at(now, 2), properties: { fromScreenId: 'home', toScreenId: 'feedback' } }],
      }),
      (error: unknown) => codeOf(error) === 'idempotency_conflict',
    );
    await assert.rejects(
      () => journeys.ingest({
        installId: uuidv7(),
        sessionId: uuidv7(),
        events: [{ id: uuidv7(), type: 'screen_viewed', occurredAt: now, properties: { screenId: 'home', text: 'سردرد دارم' } }],
      }),
      (error: unknown) => codeOf(error) === 'sensitive_property',
    );
    const stored = await pool.query<{ n: number }>(`select count(*)::int as n from journey_events where properties::text like '%سردرد%'`);
    assert.equal(stored.rows[0]?.n, 0);
    const orders = await pool.query<{ n: number }>(`select count(*)::int as n from orders`);
    assert.equal(orders.rows[0]?.n, 0);

    const later = '2026-10-24T07:01:00.000Z';
    process.env.SABZINE_NOW = later;
    const gap = await journeys.ingest({
      installId,
      sessionId,
      events: [{ id: uuidv7(), type: 'screen_viewed', occurredAt: later, properties: { screenId: 'home', activeMs: 50 } }],
    });
    assert.equal(gap.gapped, true);

    const owner = uuidv7();
    const other = uuidv7();
    await pool.query(
      `insert into users (id, phone_e164, role) values ($1,'+989170000011','user'),($2,'+989170000012','user')`,
      [owner, other],
    );
    const ownerSession = uuidv7();
    const otherSession = uuidv7();
    await pool.query(
      `insert into sessions (id, user_id, created_at, absolute_expires_at, platform)
       values ($1,$2,now(),now() + interval '30 days','android'),
              ($3,$4,now(),now() + interval '30 days','android')`,
      [ownerSession, owner, otherSession, other],
    );
    const ownerToken = signAccessToken({ sub: owner, sid: ownerSession, role: 'user', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600 }, secret);
    const otherToken = signAccessToken({ sub: other, sid: otherSession, role: 'user', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600 }, secret);
    process.env.SABZINE_NOW = later;
    const linked = await journeys.ingest({
      installId,
      sessionId: uuidv7(),
      events: [{ id: uuidv7(), type: 'session_started', occurredAt: later, properties: { platform: 'android', appVersion: '1.0.0', sessionType: 'first_visit', firstAuthenticated: false } }],
    }, `Bearer ${ownerToken}`);
    assert.equal(linked.sessionType, 'returning');
    assert.equal(linked.firstAuthenticated, true);
    assert.equal(linked.link, 'linked');
    const kept = await journeys.ingest({
      installId,
      sessionId: uuidv7(),
      events: [{ id: uuidv7(), type: 'session_started', occurredAt: later, properties: { platform: 'android', appVersion: '1.0.0' } }],
    }, `Bearer ${otherToken}`);
    assert.equal(kept.link, 'kept_previous');
    assert.equal(kept.firstAuthenticated, false);
    const linkRow = await pool.query<{ linked_user_id: string }>(`select linked_user_id from journey_installs where id = $1`, [installId]);
    assert.equal(linkRow.rows[0]?.linked_user_id, owner);

    const report = await journeys.report('2026-10-01', '2026-10-31', 'all', 'all', 'first_visit');
    assert.equal(report.status, 'ready');
    if (report.status !== 'ready') return;
    assert.equal(report.active.find((row) => row.screenId === 'home')?.milliseconds, 1050);
    assert.equal(report.signals.planPurchaseCompleted, 1);
    assert.equal(report.signals.authoritative, false);
    assert.equal(report.comparison.returningSessions, 2);
    const encoded = JSON.stringify(report);
    assert.equal(encoded.includes(installId), false);
    assert.equal(encoded.includes(owner), false);
    assert.equal(encoded.includes('+989170000011'), false);
    assert.equal((await journeys.report('2026-12-02', '2026-12-03', 'all', 'all', 'first_visit')).status, 'empty');
    assert.equal((await journeys.report('2026-10-31', '2026-10-01', 'all', 'all', 'first_visit')).status, 'invalid');
  });

  it('keeps first visits and later visits on separate graphs', async () => {
    const { JourneyService } = await import('../../dist/reports/journey.service.js');
    const journeys = api.get(JourneyService);
    const prior = '2026-09-01T06:30:00.000Z';
    const days = ['2026-11-01', '2026-11-01', '2026-11-02', '2026-11-03', '2026-11-05', '2026-11-06'];
    const scripts = [
      [['home', 8000], ['home', 'plan_purchase'], ['plan_purchase', 20000], ['plan_purchase', 'questionnaire'], ['questionnaire', 40000]],
      [['home', 6000], ['home', 'plan_purchase'], ['plan_purchase', 15000], ['plan_purchase', 'questionnaire'], ['questionnaire', 30000]],
      [['home', 5000], ['home', 'plan_purchase'], ['plan_purchase', 9000]],
      [['home', 4000], ['home', 'questionnaire'], ['questionnaire', 12000]],
      [['home', 7000], ['home', 'plan_day'], ['plan_day', 25000], ['plan_day', 'feedback'], ['feedback', 11000]],
      [['home', 3000], ['home', 'plan_day'], ['plan_day', 18000]],
    ];
    for (const [index, script] of scripts.entries()) {
      const installId = uuidv7();
      const day = days[index]!;
      if (index >= 4) {
        process.env.SABZINE_NOW = prior;
        await journeys.ingest({
          installId,
          sessionId: uuidv7(),
          events: [{ id: uuidv7(), type: 'session_started', occurredAt: prior, properties: { platform: 'android', appVersion: '1.0.0' } }],
        });
      }
      const stamp = `${day}T06:30:00.000Z`;
      process.env.SABZINE_NOW = stamp;
      const events = [
        { id: uuidv7(), type: 'session_started', occurredAt: at(stamp, 0), properties: { platform: index === 3 ? 'ios' : 'android', appVersion: index === 3 ? '1.1.0' : '1.0.0' } },
      ];
      script!.forEach((step, stepIndex) => {
        const occurredAt = at(stamp, stepIndex + 1);
        if (typeof step[1] === 'number') {
          events.push({ id: uuidv7(), type: 'screen_viewed', occurredAt, properties: { screenId: step[0], activeMs: step[1] } });
        } else {
          events.push({ id: uuidv7(), type: 'navigation', occurredAt, properties: { fromScreenId: step[0], toScreenId: step[1] } });
        }
      });
      await journeys.ingest({ installId, sessionId: uuidv7(), events });
    }
    const first = await journeys.report('2026-11-01', '2026-11-07', 'all', 'all', 'first_visit');
    assert.equal(first.status, 'ready');
    if (first.status !== 'ready') return;
    assert.equal(first.sessions, 4);
    assert.equal(first.journeys[0]?.path, 'home → plan_purchase → questionnaire');
    assert.equal(first.journeys[0]?.count, 2);
    assert.equal(first.edges.find((edge) => edge.fromScreenId === 'home' && edge.toScreenId === 'plan_purchase')?.percent, 75);
    assert.equal(first.active.find((row) => row.screenId === 'home')?.milliseconds, 23000);
    const returning = await journeys.report('2026-11-01', '2026-11-07', 'all', 'all', 'returning');
    assert.equal(returning.status, 'ready');
    if (returning.status !== 'ready') return;
    assert.equal(returning.edges.some((edge) => edge.toScreenId === 'questionnaire'), false);
    assert.equal(returning.edges.find((edge) => edge.toScreenId === 'plan_day')?.count, 2);
    const ios = await journeys.report('2026-11-01', '2026-11-07', 'ios', '1.1.0', 'first_visit');
    assert.equal(ios.status, 'ready');
    if (ios.status !== 'ready') return;
    assert.equal(ios.sessions, 1);
    assert.equal(ios.journeys[0]?.path, 'home → questionnaire');
  });

  it('stops an install that sends more batches than the minute allows', async () => {
    const { JourneyService } = await import('../../dist/reports/journey.service.js');
    const journeys = api.get(JourneyService);
    const stamp = '2026-12-01T06:30:00.000Z';
    process.env.SABZINE_NOW = stamp;
    const installId = uuidv7();
    for (let index = 0; index < 20; index += 1) {
      await journeys.ingest({
        installId,
        sessionId: uuidv7(),
        events: [{ id: uuidv7(), type: 'session_started', occurredAt: stamp, properties: { platform: 'web', appVersion: '1.0.0' } }],
      });
    }
    await assert.rejects(
      () => journeys.ingest({
        installId,
        sessionId: uuidv7(),
        events: [{ id: uuidv7(), type: 'session_started', occurredAt: stamp, properties: { platform: 'web', appVersion: '1.0.0' } }],
      }),
      (error: unknown) => codeOf(error) === 'rate_limited',
    );
  });
});
