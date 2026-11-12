const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const context = { window: {} };
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, 'onboarding/loss-pace.js'), 'utf8'), context);
vm.runInContext(fs.readFileSync(path.join(root, 'onboarding/questionnaire-data.js'), 'utf8'), context);
const { estimate, describe } = context.window.mydietLossPace;
const goal = context.window.SABZINE_QUESTIONNAIRE.goals.find(goal => goal.id === 'weight_loss');
const questions = goal.questions;
const weightIndex = questions.findIndex(question => question.metric === 'current-weight');
const targetIndex = questions.findIndex(question => question.metric === 'target-loss');
const heightIndex = questions.findIndex(question => question.originalNumber === 4);
const pace = questions.find(question => question.ui === 'loss-pace');

test('five kilograms gives different month estimates for each pace', () => {
  const answers = { [weightIndex]: '80', [targetIndex]: '75', [heightIndex]: '170' };
  assert.match(describe('slow', questions, answers), /۴ تا ۵ ماه/);
  assert.match(describe('balanced', questions, answers), /۲ تا ۳ ماه/);
  assert.match(describe('fast', questions, answers), /۱ تا ۲ ماه/);
  assert.equal(describe('auto', questions, answers), describe('balanced', questions, answers));
});

test('estimates follow changed weights, Persian input and short or long goals', () => {
  const first = estimate('slow', 80, 75, 170);
  const doubled = estimate('slow', 80, 70, 170);
  assert.equal(doubled.months, first.months * 2);
  assert.equal(estimate('slow', '۸۰', '۷۵', '۱۷۰').months, first.months);
  assert.equal(estimate('slow', '٨٠', '٧٥', '١٧٠').months, first.months);
  assert.ok(estimate('slow', 130, 80, 170).maxMonths > 12);
  assert.match(describe('fast', questions, { [weightIndex]: 80, [targetIndex]: 79, [heightIndex]: 170 }), /۱ ماه یا کمتر/);
});

test('missing, invalid and underweight targets do not produce a weight-loss timeline', () => {
  for (const [weight, target, height] of [[null, 75, 170], [80, '', 170], [80, 80, 170], [80, 81, 170], [50, 45, 170]]) {
    assert.equal(estimate('slow', weight, target, height), null);
  }
  assert.equal(estimate('unknown', 80, 75, 170), null);
  assert.match(describe('slow', questions, {}), /پس از بررسی/);
});

test('option codes and initial weekly rates agree with the nutrition engine', () => {
  const engine = fs.readFileSync(path.join(root, 'backend/src/nutrition/engine.ts'), 'utf8');
  const ratesSource = engine.match(/const PACE_KG_PER_WEEK[^=]*=\s*(\{[^}]+\})/)[1];
  const rates = vm.runInNewContext(`(${ratesSource})`);
  for (const option of pace.options) {
    assert.equal(estimate(option.pace, 100, 95, 170).weeklyRate, rates[option.pace], option.pace);
  }
  assert.equal(new Set(pace.options.map(option => option.pace)).size, 4);
});
