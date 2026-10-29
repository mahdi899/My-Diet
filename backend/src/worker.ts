import * as Sentry from '@sentry/node';
import { createApp } from './bootstrap.js';
import { loadEnv } from './config/env.js';
import { OutboxRelay } from './jobs/outbox-relay.js';
import { MaintenanceService } from './maintenance/maintenance.service.js';

async function start(): Promise<void> {
  const env = loadEnv();
  if (env.SENTRY_DSN) {
    Sentry.init({
      dsn: env.SENTRY_DSN,
      environment: env.NODE_ENV,
      tracesSampleRate: 0,
    });
  }
  if (env.APP_ROLE !== 'worker') {
    throw new Error('src/worker.ts only starts the worker. Use src/main.ts for the API.');
  }
  const { app } = await createApp();
  app.get(OutboxRelay).start();
  app.get(MaintenanceService).start();
  await app.listen(env.WORKER_PORT);
}

void start();
