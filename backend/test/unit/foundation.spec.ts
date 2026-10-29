import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import pino from 'pino';
import { SandboxPaymentGateway } from '../../src/adapters/payment.js';
import { FakePlanDraftProvider } from '../../src/adapters/plan-draft.js';
import { maskPhone, otpDispatchMessage } from '../../src/adapters/sms.js';
import { uuidv7 } from '../../src/common/id.js';
import { EnvError, loadEnv } from '../../src/config/env.js';
import { logRedactPaths } from '../../src/config/logger.js';

const baseEnv = {
  NODE_ENV: 'test',
  APP_ROLE: 'api',
  DATABASE_URL: 'postgres://sabzine:sabzine@127.0.0.1:5432/sabzine',
};

describe('loadEnv', () => {
  it('rejects a missing database url', () => {
    assert.throws(() => loadEnv({ NODE_ENV: 'test' }), EnvError);
  });

  it('rejects console SMS, the sandbox gateway, and the fake model in production', () => {
    assert.throws(
      () => loadEnv({ ...baseEnv, NODE_ENV: 'production', SMS_PROVIDER: 'console' }),
      /SMS_PROVIDER=console/,
    );
    assert.throws(
      () =>
        loadEnv({
          ...baseEnv,
          NODE_ENV: 'production',
          SMS_PROVIDER: 'kavenegar',
          KAVENEGAR_API_KEY: 'key',
          PAYMENT_GATEWAY: 'sandbox',
        }),
      /PAYMENT_GATEWAY=sandbox/,
    );
    assert.throws(
      () =>
        loadEnv({
          ...baseEnv,
          NODE_ENV: 'production',
          SMS_PROVIDER: 'kavenegar',
          KAVENEGAR_API_KEY: 'key',
          PAYMENT_GATEWAY: 'zarinpal',
          ZARINPAL_MERCHANT_ID: 'merchant',
          AI_PROVIDER: 'fake',
        }),
      /AI_PROVIDER=fake/,
    );
  });

  it('rejects a named production provider that has no credential', () => {
    assert.throws(
      () =>
        loadEnv({
          ...baseEnv,
          NODE_ENV: 'production',
          SMS_PROVIDER: 'kavenegar',
          PAYMENT_GATEWAY: 'zarinpal',
          ZARINPAL_MERCHANT_ID: 'merchant',
          AI_PROVIDER: 'openai',
          AI_API_KEY: 'key',
        }),
      /KAVENEGAR_API_KEY/,
    );
  });
});

describe('log redaction', () => {
  it('removes phone numbers, OTP codes, and access tokens', () => {
    const lines: string[] = [];
    const logger = pino(
      { redact: { paths: logRedactPaths, censor: '[redacted]' } },
      { write: (chunk: string) => lines.push(chunk) },
    );
    logger.info(
      { phone: '+989121234567', code: '482913', accessToken: 'sekret-token' },
      'otp',
    );
    const text = lines.join('');
    assert.equal(text.includes('482913'), false);
    assert.equal(text.includes('sekret-token'), false);
    assert.equal(text.includes('+989121234567'), false);
    assert.equal(text.includes('[redacted]'), true);
  });
});

describe('adapters', () => {
  it('masks a phone and never puts the OTP code in the dispatch line', () => {
    assert.equal(maskPhone('+989121234567'), '9891***4567');
    const line = otpDispatchMessage('+989121234567', '482913');
    assert.equal(line.includes('9891***4567'), true);
    assert.equal(line.includes('482913'), false);
  });

  it('does not collect card data and does not call a model', () => {
    assert.equal(new SandboxPaymentGateway().collectsCardData, false);
    assert.equal(new FakePlanDraftProvider().callsExternalNetwork, false);
  });
});

describe('uuidv7', () => {
  it('sets the version nibble to 7', () => {
    const id = uuidv7();
    assert.match(
      id,
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});
