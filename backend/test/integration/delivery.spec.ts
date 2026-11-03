import { mkdtemp, rm } from 'node:fs/promises';
import net from 'node:net';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import os from 'node:os';
import path from 'node:path';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { installGracefulStop } from '../helpers/postgres-stop.js';

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

describe('phase 13 delivery', { concurrency: 1, timeout: 180_000 }, () => {
  let directory = '';
  let stopDatabase: (() => Promise<void>) | undefined;
  let api: INestApplication;

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
  });

  after(async () => {
    await api?.close();
    await stopDatabase?.();
    if (directory) await rm(directory, { recursive: true, force: true }).catch(() => undefined);
  });

  it('serves live and ready, and marks a validation error as not retryable', async () => {
    await request(api.getHttpServer()).get('/health/live').expect(200, { status: 'ok' });
    await request(api.getHttpServer()).get('/health/ready').expect(200, { status: 'ok', database: 'up' });
    const invalid = await request(api.getHttpServer()).get('/v1/public/daily-message?date=today');
    assert.equal(invalid.status, 400);
    assert.equal(invalid.body.code, 'validation');
    assert.equal(invalid.body.retryable, false);
    const spec = await request(api.getHttpServer()).get('/docs-json');
    assert.equal(spec.body.info.version, '0.17.0');
  });
});