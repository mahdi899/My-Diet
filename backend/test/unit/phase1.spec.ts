import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { FakePlanDraftProvider } from '../../src/adapters/plan-draft.js';
import { errorBody } from '../../src/common/errors.js';
import { signAccessToken, verifyAccessToken } from '../../src/common/jwt.js';
import { normalizeIranianMobile } from '../../src/common/phone.js';
import { addCivilDays, streakLength, tehranToday, weekStartSaturday } from '../../src/common/time.js';
import { loadEnv } from '../../src/config/env.js';
import { validateSubmission } from '../../src/questionnaire/schema.js';

const secret = 'test-secret-test-secret';
const baseEnv = {
  NODE_ENV: 'test',
  APP_ROLE: 'api',
  DATABASE_URL: 'postgres://sabzine:sabzine@127.0.0.1:5432/sabzine',
};

const complete = {
  name: 'تست کاربر',
  age: 30,
  sex: 'female',
  heightCm: 170,
  weightKg: 80,
  goal: 'weight_loss',
  lifeStage: 'none',
  targetWeightKg: 70,
  previousDiet: 'none',
  health: ['none'],
  activity: 'light',
  exercise: '1_2',
  sleep: '7_to_9',
  mealPattern: 'regular',
  water: '4_to_6',
  preference: 'iranian',
  budget: 'medium',
  cooking: '30_to_60',
};

describe('phase 1 rules', () => {
  it('normalizes Iranian mobiles and rejects other countries', () => {
    assert.equal(normalizeIranianMobile('09121234567'), '+989121234567');
    assert.equal(normalizeIranianMobile('۰۹۱۲۱۲۳۴۵۶۷'), '+989121234567');
    assert.equal(normalizeIranianMobile('+98 912 123 4567'), '+989121234567');
    assert.equal(normalizeIranianMobile('00989121234567'), '+989121234567');
    assert.equal(errorBody(assertThrow(() => normalizeIranianMobile('+14155552671'))).code, 'unsupported_country');
    assert.equal(errorBody(assertThrow(() => normalizeIranianMobile('0912'))).code, 'invalid_phone');
  });

  it('keeps the Tehran day across midnight UTC and starts weeks on Saturday', () => {
    assert.equal(tehranToday(new Date('2026-10-30T20:15:00.000Z')), '2026-10-30');
    assert.equal(tehranToday(new Date('2026-10-30T20:45:00.000Z')), '2026-10-31');
    assert.equal(weekStartSaturday('2026-10-30'), '2026-10-24');
    assert.equal(addCivilDays('2026-10-24', 6), '2026-10-30');
  });

  it('counts a streak only while the latest reward is this week or the previous one', () => {
    assert.equal(streakLength(['2026-10-10', '2026-10-17', '2026-10-24'], '2026-10-30'), 3);
    assert.equal(streakLength(['2026-10-10'], '2026-10-30'), 0);
    assert.equal(streakLength([], '2026-10-30'), 0);
  });

  it('rejects a tampered access token', () => {
    const token = signAccessToken(
      { sub: 'user', sid: 'session', role: 'user', iat: 1, exp: Math.floor(Date.now() / 1000) + 60 },
      secret,
    );
    assert.equal(verifyAccessToken(token, secret).sub, 'user');
    assert.equal(errorBody(assertThrow(() => verifyAccessToken(`${token}x`, secret))).code, 'unauthorized');
  });

  it('stores stable codes, including the old healthy-eating label', () => {
    const healthy = validateSubmission({ ...complete, goal: 'تغذیهٔ متعادل' });
    assert.equal(healthy.answers.goal, 'healthy_eating');
    const pregnant = validateSubmission({
      ...complete,
      goal: 'weight_maintenance',
      lifeStage: 'باردار هستم',
      pregnancyWeek: 20,
      prePregnancyWeightKg: 68,
      babies: 'تک‌قلو',
      targetWeightKg: undefined,
    });
    assert.equal(pregnant.answers.pregnancyWeek, 20);
    assert.equal(pregnant.answers.targetWeightKg, null);
    assert.equal(errorBody(assertThrow(() => validateSubmission({ ...complete, age: 17 }))).messageFa.includes('۱۸'), true);
    assert.equal(
      errorBody(assertThrow(() => validateSubmission({ ...complete, targetWeightKg: 90 }))).code,
      'validation',
    );
    const kidney = validateSubmission({
      ...complete,
      health: ['بیماری کلیه'],
      healthDetails: 'تحت نظر پزشک',
    });
    assert.deepEqual(kidney.riskFlags, ['kidney']);
  });

  it('refuses the development signing secret in production', () => {
    assert.throws(
      () =>
        loadEnv({
          ...baseEnv,
          NODE_ENV: 'production',
          SMS_PROVIDER: 'kavenegar',
          KAVENEGAR_API_KEY: 'key',
          PAYMENT_GATEWAY: 'zarinpal',
          ZARINPAL_MERCHANT_ID: 'merchant',
          AI_PROVIDER: 'openai',
          AI_API_KEY: 'key',
        }),
      /JWT_SECRET/,
    );
  });

  it('still does not call a model from the fake drafter', () => {
    assert.equal(new FakePlanDraftProvider().callsExternalNetwork, false);
  });
});

function assertThrow(fn: () => void): Parameters<typeof errorBody>[0] {
  try {
    fn();
  } catch (error) {
    return error as Parameters<typeof errorBody>[0];
  }
  throw new Error('expected a failure');
}
