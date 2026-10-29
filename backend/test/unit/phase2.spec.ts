import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { FailoverPlanDraftProvider, FakePlanDraftProvider, type PlanDraftProvider } from '../../src/adapters/plan-draft.js';
import { decryptText, encryptText } from '../../src/common/field-crypto.js';
import { base32Decode, base32Encode, randomTotpSecret, totpCode, totpMatches } from '../../src/common/totp.js';
import { loadEnv } from '../../src/config/env.js';
import { compatibilityErrors } from '../../src/questionnaire/compatibility.js';
import { questionnaireView } from '../../src/questionnaire/schema.js';
import { isLateBulkLog } from '../../src/tracking/anomaly.js';

const baseEnv = {
  NODE_ENV: 'production',
  APP_ROLE: 'api',
  DATABASE_URL: 'postgres://sabzine:sabzine@127.0.0.1:5432/sabzine',
  SMS_PROVIDER: 'kavenegar',
  KAVENEGAR_API_KEY: 'key',
  PAYMENT_GATEWAY: 'zarinpal',
  ZARINPAL_MERCHANT_ID: 'merchant',
  AI_PROVIDER: 'openai',
  AI_API_KEY: 'key',
  JWT_SECRET: 'production-jwt-secret-value',
  OTP_PEPPER: 'production-otp-pepper-value',
};

class DownProvider implements PlanDraftProvider {
  readonly name = 'down';
  readonly callsExternalNetwork = false;
  async draft(): Promise<never> {
    throw new Error('down');
  }
}

describe('phase 2 rules', () => {
  it('encrypts clinical text and reads it back with the same key', () => {
    const secret = 'test-field-key-test-field-key';
    const stored = encryptText('متفورمین', secret);
    assert.equal(stored.startsWith('enc1:'), true);
    assert.equal(stored.includes('متفورمین'), false);
    assert.equal(decryptText(stored, secret), 'متفورمین');
    assert.equal(encryptText('', secret), '');
  });

  it('keeps built-in questions and allows a label change', () => {
    const builtin = questionnaireView().questions;
    assert.deepEqual(compatibilityErrors(builtin, builtin), []);
    const renamed = builtin.map((question) =>
      question.id === 'name' ? { ...question, title: 'نام' } : question,
    );
    assert.deepEqual(compatibilityErrors(renamed, builtin), []);
    const removed = builtin.filter((question) => question.id !== 'health');
    assert.equal(compatibilityErrors(removed, builtin).some((error) => error.includes('health')), true);
  });

  it('matches a totp code and rejects a different one', () => {
    const secret = randomTotpSecret();
    const encoded = base32Encode(secret);
    const at = Date.now();
    assert.equal(totpMatches(base32Decode(encoded), totpCode(secret, at), at), true);
    assert.equal(totpMatches(secret, '000000', at), false);
  });

  it('flags a full day logged at 23:55 Tehran and ignores noon', () => {
    const late = new Date('2026-10-30T20:25:00.000Z');
    const noon = new Date('2026-10-30T08:30:00.000Z');
    assert.equal(
      isLateBulkLog({ now: late, mealCount: 4, allEaten: true, firstLoggedAt: late, lastLoggedAt: late }),
      true,
    );
    assert.equal(
      isLateBulkLog({ now: noon, mealCount: 4, allEaten: true, firstLoggedAt: noon, lastLoggedAt: noon }),
      false,
    );
    const earlier = new Date(late.getTime() - 3 * 60 * 1000);
    assert.equal(
      isLateBulkLog({ now: late, mealCount: 4, allEaten: true, firstLoggedAt: earlier, lastLoggedAt: late }),
      false,
    );
  });

  it('uses the second drafter when the first one fails', async () => {
    const draft = await new FailoverPlanDraftProvider(new DownProvider(), new FakePlanDraftProvider()).draft({
      goal: 'weight_loss',
      flags: [],
    });
    assert.equal(draft.provider, 'fake');
    assert.equal(draft.days.length, 7);
    assert.equal(new FakePlanDraftProvider().callsExternalNetwork, false);
  });

  it('refuses the console push provider and the development field key in production', () => {
    assert.throws(() => loadEnv(baseEnv), /PUSH_PROVIDER=console/);
    assert.throws(
      () => loadEnv({ ...baseEnv, PUSH_PROVIDER: 'fcm', AI_FAILOVER_PROVIDER: 'fake' }),
      /AI_FAILOVER_PROVIDER=fake/,
    );
    assert.throws(() => loadEnv({ ...baseEnv, PUSH_PROVIDER: 'fcm' }), /FIELD_KEY/);
  });
});
