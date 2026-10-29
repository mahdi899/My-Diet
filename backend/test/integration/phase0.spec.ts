import { mkdtemp, rm } from 'fs/promises';
import net from 'net';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import os from 'os';
import path from 'path';
import type { INestApplication } from '@nestjs/common';
import type { Pool } from 'pg';
import request from 'supertest';
import { uuidv7 } from '../../src/common/id.js';

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Could not allocate a port'));
        return;
      }
      const { port } = address;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

describe('phase 0 runtime', () => {
  let directory = '';
  let stopDatabase: (() => Promise<void>) | undefined;
  let api: INestApplication;

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
    await migrateUp(databaseUrl);

    const { createApp } = await import('../../dist/bootstrap.js');
    api = (await createApp()).app;
    await api.listen(0);
  });

  after(async () => {
    await api?.close();
    try {
      if (stopDatabase) await stopDatabase();
    } catch {
      // Windows can keep the data directory locked briefly after shutdown.
    }
    if (!directory) return;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        await rm(directory, { recursive: true, force: true });
        return;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }
  });

  it('serves liveness, readiness, metrics, and the OpenAPI document', async () => {
    await request(api.getHttpServer()).get('/health/live').expect(200, { status: 'ok' });
    await request(api.getHttpServer())
      .get('/health/ready')
      .expect(200, { status: 'ok', database: 'up' });
    const metrics = await request(api.getHttpServer()).get('/metrics').expect(200);
    assert.equal(metrics.text.includes('sabzine_outbox_dispatched_total'), true);
    const spec = await request(api.getHttpServer()).get('/docs-json').expect(200);
    assert.ok(spec.body.paths['/health/ready']);
  });

  it('keeps the seeded settings and dispatches an outbox event once', async () => {
    const { PG_POOL } = await import('../../dist/database/database.js');
    const pool = api.get<Pool>(PG_POOL);
    const settings = await pool.query<{ key: string; value: number }>(
      'select key, value from app_settings order by key',
    );
    assert.deepEqual(settings.rows, [
      { key: 'meal_log.grace_minutes', value: 0 },
      { key: 'reward.weekly_completion_toman', value: 200000 },
    ]);

    process.env.APP_ROLE = 'worker';
    const { createApp } = await import('../../dist/bootstrap.js');
    const worker = (await createApp()).app;
    try {
      const eventId = uuidv7();
      const aggregateId = uuidv7();
      await pool.query(
        `insert into outbox_events (id, topic, aggregate_id, payload)
         values ($1, 'health.ping', $2, $3::jsonb)`,
        [eventId, aggregateId, JSON.stringify({ ok: true })],
      );
      const { OutboxRelay } = await import('../../dist/jobs/outbox-relay.js');
      const relay = worker.get(OutboxRelay);
      const delivered = await relay.dispatchOnce();
      assert.equal(delivered, 1, relay.lastFailure);
      assert.equal(await relay.dispatchOnce(), 0);
      assert.equal(await relay.dispatchOnce(), 0);
      const stored = await pool.query<{ dispatched_at: Date | null; attempts: number }>(
        'select dispatched_at, attempts from outbox_events where id = $1',
        [eventId],
      );
      assert.equal(stored.rows[0]?.attempts, 1);
      assert.ok(stored.rows[0]?.dispatched_at);
      const jobs = await pool.query(
        'select id from pgboss.job where singleton_key = $1',
        [eventId],
      );
      assert.equal(jobs.rowCount, 1);
    } finally {
      await worker.close();
    }
  });
});
