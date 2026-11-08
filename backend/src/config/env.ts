import { z } from 'zod';
import { enabledGatewayNames } from './gateways.js';

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
  DATABASE_REPLICA_URL: z.string().default(''),
  ANALYTICS_DATABASE_URL: z.preprocess(emptyToUndefined, z.string().optional()),
  ANALYTICS_WEBSITE_ID: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .default('info'),
  RUN_MIGRATIONS: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  SENTRY_DSN: z.preprocess(emptyToUndefined, z.string().url().optional()),
  SMS_PROVIDER: z.enum(['console', 'kavenegar','melipayamak']).default('console'),
  MELIPAYAMAK_USERNAME: z.preprocess(emptyToUndefined,z.string().optional()),
  MELIPAYAMAK_API_KEY: z.preprocess(emptyToUndefined,z.string().optional()),
  MELIPAYAMAK_FROM: z.preprocess(emptyToUndefined,z.string().optional()),
  MELIPAYAMAK_PATTERN_ID: z.preprocess(emptyToUndefined,z.string().regex(/^\d+$/).optional()),
  PAYMENT_GATEWAY: z.enum(['sandbox', 'zarinpal', 'idpay']).default('sandbox'),
  PAYMENT_GATEWAYS: z.string().default(''),
  AI_PROVIDER: z.enum(['fake', 'openai', 'configured', 'pool']).default('fake'),
  /** Lets admin-defined AI endpoints point at private hosts. Tests only; never in production. */
  AI_ALLOW_PRIVATE_ENDPOINTS: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
  AI_FAILOVER_PROVIDER: z.enum(['none', 'fake', 'openai']).default('none'),
  PUSH_PROVIDER: z.enum(['console', 'fcm']).default('console'),
  KAVENEGAR_API_KEY: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  ZARINPAL_MERCHANT_ID: z.preprocess(
    emptyToUndefined,
    z.string().min(1).optional(),
  ),
  ZARINPAL_SANDBOX: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
  /** Test hook: points the Zarinpal adapter at a local fake. Never set in production. */
  ZARINPAL_BASE_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
  /** Public https origin of this API; hosted gateways call back to `${PUBLIC_API_URL}/v1/payments/callback/<gateway>`. */
  PUBLIC_API_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
  IDPAY_API_KEY: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  AI_API_KEY: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  CORS_ORIGINS: z.string().default(''),
  JWT_SECRET: z.string().min(16).default('dev-only-jwt-secret-not-for-production'),
  OTP_PEPPER: z.string().min(16).default('dev-only-otp-pepper-not-for-production'),
  OTP_FIXED_CODE: z.preprocess(
    emptyToUndefined,
    z.string().regex(/^\d{6}$/).optional(),
  ),
  FIELD_KEY: z.string().min(16).default('dev-only-field-key-not-for-production'),
  AI_FAILOVER_API_KEY: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
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
  if (enabledGatewayNames(env).includes('sandbox')) {
    throw new EnvError('PAYMENT_GATEWAYS must not include sandbox in production');
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
  if (env.AI_ALLOW_PRIVATE_ENDPOINTS) {
    throw new EnvError('AI_ALLOW_PRIVATE_ENDPOINTS is not allowed in production');
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
  if (env.OTP_FIXED_CODE) {
    throw new EnvError('OTP_FIXED_CODE is not allowed in production');
  }
  if (env.PUSH_PROVIDER === 'console') {
    throw new EnvError('PUSH_PROVIDER=console is not allowed in production');
  }
  if (env.AI_FAILOVER_PROVIDER === 'fake') {
    throw new EnvError('AI_FAILOVER_PROVIDER=fake is not allowed in production');
  }
  if (env.AI_FAILOVER_PROVIDER === 'openai' && !env.AI_FAILOVER_API_KEY && !env.AI_API_KEY) {
    throw new EnvError('AI_FAILOVER_API_KEY is required');
  }
  if (env.FIELD_KEY.startsWith('dev-only-')) {
    throw new EnvError('FIELD_KEY must be set in production');
  }
  const gateways = enabledGatewayNames(env);
  if (gateways.includes('idpay') && !env.IDPAY_API_KEY) {
    throw new EnvError('IDPAY_API_KEY is required');
  }
  if (gateways.includes('zarinpal') && !env.ZARINPAL_MERCHANT_ID) {
    throw new EnvError('ZARINPAL_MERCHANT_ID is required');
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
  enabledGatewayNames(parsed.data);
  return parsed.data;
}
