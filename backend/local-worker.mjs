// Dev-only worker next to `local-admin.mjs`: same embedded Postgres and secrets, role = worker.
// It runs the outbox relay and the `plan.generate` job so a paid order really becomes an AI draft.
import { readFileSync } from 'node:fs';

const config = JSON.parse(readFileSync('.env.local-admin.json', 'utf8'));
const url = `postgres://sabzine:${config.databasePassword}@127.0.0.1:54329/sabzine`;
Object.assign(process.env, {
  NODE_ENV: 'development',
  APP_ROLE: 'worker',
  WORKER_PORT: process.env.WORKER_PORT ?? '3010',
  DATABASE_URL: url,
  SMS_PROVIDER: 'console',
  PAYMENT_GATEWAY: 'sandbox',
  AI_PROVIDER: process.env.AI_PROVIDER ?? 'pool',
  PUSH_PROVIDER: 'console',
  LOG_LEVEL: process.env.LOG_LEVEL ?? 'info',
  JWT_SECRET: config.jwtSecret,
  OTP_PEPPER: config.otpPepper,
  FIELD_KEY: config.fieldKey,
});
await import('./dist/worker.js');
console.log('Worker started (plan.generate).');
