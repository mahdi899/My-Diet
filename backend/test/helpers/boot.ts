import { mkdtemp, rm } from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import type { INestApplication } from '@nestjs/common';
import type { Pool } from 'pg';
import request from 'supertest';
import { installGracefulStop } from './postgres-stop.js';
import { normalizeIranianMobile } from '../../src/common/phone.js';

export interface Booted {
  api: INestApplication;
  pool: Pool;
  databaseUrl: string;
  /** Real OTP login through the public endpoints; returns the bearer header. */
  login(phone: string): Promise<{ Authorization: string }>;
  stop(): Promise<void>;
}

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

/** Boots the compiled API against a throw-away embedded Postgres with every migration applied. */
export async function bootApp(extraEnv: Record<string, string> = {}): Promise<Booted> {
  const { default: EmbeddedPostgres } = await import('embedded-postgres');
  const directory = await mkdtemp(path.join(os.tmpdir(), 'sabzine-pg-'));
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
  Object.assign(process.env, {
    NODE_ENV: 'test', APP_ROLE: 'api', DATABASE_URL: databaseUrl, SMS_PROVIDER: 'console', PAYMENT_GATEWAY: 'sandbox',
    AI_PROVIDER: 'fake', LOG_LEVEL: 'error', RUN_MIGRATIONS: 'false', SENTRY_DSN: '', ...extraEnv,
  });
  const { migrateUp } = await import('../../dist/database/migrate.js');
  await migrateUp(databaseUrl);
  const { createApp } = await import('../../dist/bootstrap.js');
  const api = (await createApp()).app;
  await api.init();
  const { PG_POOL } = await import('../../dist/database/database.js');
  const pool = api.get<Pool>(PG_POOL);
  const remembered = (await import('../../dist/adapters/sms.js')).rememberedOtp as (phone: string) => string | undefined;
  return {
    api,
    pool,
    databaseUrl,
    async login(phone: string) {
      const server = api.getHttpServer();
      const requested = await request(server).post('/v1/auth/otp/request').send({ phone });
      if (requested.status !== 200 && requested.status !== 201) throw new Error(`otp request ${requested.status}`);
      const code = remembered(normalizeIranianMobile(phone));
      const verified = await request(server).post('/v1/auth/otp/verify').send({ phone, code });
      if (verified.status !== 200 && verified.status !== 201) throw new Error(`otp verify ${verified.status}`);
      return { Authorization: `Bearer ${verified.body.accessToken as string}` };
    },
    async stop() {
      await api.close();
      await database.stop();
      await rm(directory, { recursive: true, force: true }).catch(() => undefined);
    },
  };
}
