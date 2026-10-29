import * as Sentry from '@sentry/node';
import { createApp } from './bootstrap.js';
import { loadEnv } from './config/env.js';
import { migrateUp } from './database/migrate.js';

async function start(): Promise<void> {
  const env = loadEnv();
  if (env.SENTRY_DSN) {
    Sentry.init({
      dsn: env.SENTRY_DSN,
      environment: env.NODE_ENV,
      tracesSampleRate: 0,
    });
  }
  if (env.APP_ROLE !== 'api') {
    throw new Error('src/main.ts only starts the API. Use src/worker.ts for the worker.');
  }
  if (env.RUN_MIGRATIONS) await migrateUp(env.DATABASE_URL);
  const { app } = await createApp();
  await app.listen(env.PORT);
}

void start();
