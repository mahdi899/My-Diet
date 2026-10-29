import { z } from 'zod';

const emptyToUndefined = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'staging', 'production'])
    .default('development'),
  APP_ROLE: z.enum(['api', 'worker']).default('api'),
  PORT: z.coerce.number().int().positive().default(3000),
  WORKER_PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().min(1),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .default('info'),
  RUN_MIGRATIONS: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  SENTRY_DSN: z.preprocess(emptyToUndefined, z.string().url().optional()),
  SMS_PROVIDER: z.enum(['console', 'kavenegar']).default('console'),
  PAYMENT_GATEWAY: z.enum(['sandbox', 'zarinpal']).default('sandbox'),
  AI_PROVIDER: z.enum(['fake', 'openai']).default('fake'),
  KAVENEGAR_API_KEY: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  ZARINPAL_MERCHANT_ID: z.preprocess(
    emptyToUndefined,
    z.string().min(1).optional(),
  ),
  AI_API_KEY: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  CORS_ORIGINS: z.string().default(''),
  JWT_SECRET: z.string().min(16).default('dev-only-jwt-secret-not-for-production'),
  OTP_PEPPER: z.string().min(16).default('dev-only-otp-pepper-not-for-production'),
});

export type Env = z.infer<typeof envSchema>;

export const ENV = Symbol('ENV');

export class EnvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EnvError';
  }
}

/** Fake providers are for local development and tests. Production must name a real provider. */
export function assertProductionProviders(env: Env): void {
  if (env.NODE_ENV !== 'production') return;
  if (env.SMS_PROVIDER === 'console') {
    throw new EnvError('SMS_PROVIDER=console is not allowed in production');
  }
  if (env.PAYMENT_GATEWAY === 'sandbox') {
    throw new EnvError(
      'PAYMENT_GATEWAY=sandbox is not allowed in production',
    );
  }
  if (env.AI_PROVIDER === 'fake') {
    throw new EnvError('AI_PROVIDER=fake is not allowed in production');
  }
  if (env.SMS_PROVIDER === 'kavenegar' && !env.KAVENEGAR_API_KEY) {
    throw new EnvError('KAVENEGAR_API_KEY is required');
  }
  if (env.PAYMENT_GATEWAY === 'zarinpal' && !env.ZARINPAL_MERCHANT_ID) {
    throw new EnvError('ZARINPAL_MERCHANT_ID is required');
  }
  if (env.AI_PROVIDER === 'openai' && !env.AI_API_KEY) {
    throw new EnvError('AI_API_KEY is required');
  }
  if (env.JWT_SECRET.startsWith('dev-only-')) {
    throw new EnvError('JWT_SECRET must be set in production');
  }
  if (env.OTP_PEPPER.startsWith('dev-only-')) {
    throw new EnvError('OTP_PEPPER must be set in production');
  }
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new EnvError(`Invalid environment: ${details}`);
  }
  assertProductionProviders(parsed.data);
  return parsed.data;
}
