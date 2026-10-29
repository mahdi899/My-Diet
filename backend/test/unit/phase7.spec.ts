import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { minimizeForModel, requestPseudonym } from '../../src/ai/minimize.js';
import { DAILY_CALORIE_MIN, draftWarnings } from '../../src/ai/warnings.js';

describe('phase 7 rules', () => {
  it('drops name, phone, and user id before a model draft', () => {
    const userId = '11111111-1111-4111-8111-111111111111';
    const requestId = '22222222-2222-4222-8222-222222222222';
    const minimized = minimizeForModel(
      {
        name: 'نگار تست',
        age: 30,
        sex: 'female',
        heightCm: 170,
        weightKg: 70,
        goal: 'weight_loss',
        lifeStage: 'none',
        pregnancyWeek: null,
        health: ['none'],
        healthDetails: `نام نگار تست و شناسه ${userId}`,
        allergies: `پنیر و تماس 09121111111 و کد 0012345678`,
        medicines: '',
        dislikes: '',
        preference: 'home',
        budget: 'mid',
        cooking: 'self',
      },
      requestId,
      { userId, phone: '+989121111111', name: 'نگار تست' },
    );
    const packed = JSON.stringify(minimized);
    assert.equal(packed.includes('نگار'), false);
    assert.equal(packed.includes('09121111111'), false);
    assert.equal(packed.includes('+98912111111'), false);
    assert.equal(packed.includes(userId), false);
    assert.equal(packed.includes(requestId), false);
    assert.equal(minimized.pseudonym, requestPseudonym(requestId));
    assert.equal(minimized.pseudonym === requestId, false);
    assert.equal(minimized.untrustedUserText.some((block) => block.text.includes('untrusted_user_text')), true);
    assert.equal(minimized.untrustedUserText.some((block) => block.text.includes('پنیر')), true);
    assert.equal(packed.includes('name'), false);
    const long = minimizeForModel(
      { allergies: `پنیر ${'آ'.repeat(600)}` },
      requestId,
      { userId, name: '' },
    );
    const allergy = long.untrustedUserText.find((block) => block.field === 'allergies');
    assert.ok(allergy);
    const inner = allergy.text.split('\n')[1] ?? '';
    assert.ok(inner.length <= 500);
    assert.equal(inner.includes('آ'.repeat(501)), false);
  });

  it('warns on a low calorie day and on a meal that repeats an allergy', () => {
    const warnings = draftWarnings(
      [[{ title: 'نان و پنیر', calories: DAILY_CALORIE_MIN - 1, items: [{ name: 'پنیر' }] }]],
      'حساسیت به پنیر',
      '',
    );
    assert.equal(warnings.some((warning) => warning.code === 'daily_calories_low'), true);
    assert.equal(warnings.some((warning) => warning.code === 'matches_allergy' && warning.term === 'پنیر'), true);
  });
});
