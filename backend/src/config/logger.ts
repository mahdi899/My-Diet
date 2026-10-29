import type { Env } from './env.js';

/** Fields that must never reach application logs. Questionnaire text and chat bodies are untrusted and sensitive. */
export const logRedactPaths = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.body.phone',
  'req.body.code',
  'req.body.accessToken',
  'req.body.refreshToken',
  'req.body.password',
  'req.body.cardNumber',
  'req.body.cvv',
  'req.body.cvv2',
  'req.query.phone',
  'req.body.answers',
  'req.body.prompt',
  'req.body.message',
  'req.body.text',
  'res.headers["set-cookie"]',
  'phone',
  'code',
  'accessToken',
  'refreshToken',
  'password',
  'answers',
  'prompt',
  'messageBody',
  'apiKey',
  'merchantId',
  '*.phone',
  '*.code',
  '*.accessToken',
  '*.refreshToken',
  '*.password',
  '*.authorization',
  '*.answers',
  '*.prompt',
  '*.messageBody',
  '*.apiKey',
  '*.merchantId',
];

export function pinoHttpOptions(env: Env) {
  return {
    level: env.LOG_LEVEL,
    redact: { paths: logRedactPaths, censor: '[redacted]' },
    autoLogging: {
      ignore: (req: { url?: string }) =>
        req.url === '/health/live' ||
        req.url === '/health/ready' ||
        req.url === '/metrics',
    },
    transport:
      env.NODE_ENV === 'development'
        ? { target: 'pino-pretty', options: { singleLine: true } }
        : undefined,
  };
}
