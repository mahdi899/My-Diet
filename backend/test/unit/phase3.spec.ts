import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { enabledGatewayNames } from '../../src/config/gateways.js';
import { EnvError, loadEnv } from '../../src/config/env.js';
import { isOverdue, medianMinutes } from '../../src/reports/sla.js';

const production = {
  NODE_ENV: 'production',
  APP_ROLE: 'api',
  DATABASE_URL: 'postgres://sabzine:sabzine@127.0.0.1:5432/sabzine',
  SMS_PROVIDER: 'kavenegar',
  KAVENEGAR_API_KEY: 'key',
  PAYMENT_GATEWAY: 'zarinpal',
  ZARINPAL_MERCHANT_ID: 'merchant',
  AI_PROVIDER: 'openai',
  AI_API_KEY: 'key',
  PUSH_PROVIDER: 'fcm',
  JWT_SECRET: 'production-jwt-secret-value',
  OTP_PEPPER: 'production-otp-pepper-value',
  FIELD_KEY: 'production-field-key-value',
};

describe('phase 3 rules', () => {
  it('enables only the primary gateway unless a list names more', () => {
    assert.deepEqual(enabledGatewayNames({ PAYMENT_GATEWAY: 'sandbox', PAYMENT_GATEWAYS: '' }), ['sandbox']);
    assert.deepEqual(
      enabledGatewayNames({ PAYMENT_GATEWAY: 'sandbox', PAYMENT_GATEWAYS: 'sandbox,idpay' }),
      ['sandbox', 'idpay'],
    );
    assert.throws(
      () => enabledGatewayNames({ PAYMENT_GATEWAY: 'sandbox', PAYMENT_GATEWAYS: 'sandbox,card' }),
      EnvError,
    );
  });

  it('rejects sandbox in the production gateway list and an idpay key that is missing', () => {
    assert.throws(
      () => loadEnv({ ...production, PAYMENT_GATEWAYS: 'zarinpal,sandbox' }),
      /PAYMENT_GATEWAYS must not include sandbox/,
    );
    assert.throws(
      () => loadEnv({ ...production, PAYMENT_GATEWAYS: 'zarinpal,idpay' }),
      /IDPAY_API_KEY/,
    );
  });

  it('marks an unanswered request overdue only after 24 hours', () => {
    const created = new Date('2026-10-28T08:00:00.000Z');
    const within = new Date(created.getTime() + 23 * 60 * 60 * 1000);
    const after = new Date(created.getTime() + 25 * 60 * 60 * 1000);
    assert.equal(isOverdue({ status: 'in_review', createdAt: created, now: within, responded: false }), false);
    assert.equal(isOverdue({ status: 'in_review', createdAt: created, now: after, responded: false }), true);
    assert.equal(isOverdue({ status: 'in_review', createdAt: created, now: after, responded: true }), false);
    assert.equal(isOverdue({ status: 'published', createdAt: created, now: after, responded: false }), false);
    assert.equal(medianMinutes([10, 30]), 20);
    assert.equal(medianMinutes([]), null);
  });
});
