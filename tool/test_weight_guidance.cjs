const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../frontend/public/onboarding');
const context = { window: {} };
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, 'weight-guidance.js'), 'utf8'), context);
const { assess } = context.window.mydietWeightGuidance;

test('adult BMI and the approximate healthy-weight range use the entered height and weight', () => {
  const result = assess(170, 50, 'weight_loss');
  assert.ok(Math.abs(result.bmi - 50 / 1.7 ** 2) < 1e-10);
  assert.equal(result.low, 53.5);
  assert.equal(result.high, 71.9);
  assert.equal(result.category, 'کمبود وزن');
  assert.equal(result.suggestGain, true);
  assert.equal(assess('۱۷۰', '۵۰', 'weight_loss').suggestGain, true);
  assert.equal(assess('١٧٠', '٥٠', 'weight_loss').suggestGain, true);
});

test('goal suggestion uses the unrounded BMI and only applies to underweight loss requests', () => {
  assert.equal(assess(200, 73.99, 'weight_loss').suggestGain, true);
  assert.equal(assess(200, 74, 'weight_loss').suggestGain, false);
  assert.equal(assess(170, 68, 'weight_loss').suggestGain, false);
  assert.equal(assess(170, 50, 'weight_gain').suggestGain, false);
  assert.equal(assess(170, 50, 'detox').suggestGain, false);
  assert.equal(assess(200, 100, 'weight_loss').category, 'اضافه‌وزن');
});

test('pregnancy and missing or invalid measurements have no adult weight recommendation', () => {
  assert.equal(assess(170, 50, 'pregnancy'), null);
  for (const [height, weight] of [[null, 50], [170, null], ['', 50], [0, 50], [170, -1], ['invalid', 50]]) {
    assert.equal(assess(height, weight, 'weight_loss'), null);
  }
});
