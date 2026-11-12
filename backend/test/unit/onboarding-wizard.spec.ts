import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../../../onboarding/wizard.js', import.meta.url), 'utf8');
const window = {} as { mydietWizard: {
  messageFromBody: (body: unknown, fallback: string) => string;
  text: (error: unknown, fallback: string) => string;
  historyAction: (previous: { stage: string; index: number } | null, next: { stage: string; index: number } | null) => string;
} };
vm.runInNewContext(source, { window, globalThis: window });
const wizard = window.mydietWizard;

test('server and browser failures become a Persian sentence', () => {
  assert.equal(wizard.messageFromBody({ messageFa: 'ارسال کد ممکن نشد. کمی بعد دوباره تلاش کن' }, 'دوباره'), 'ارسال کد ممکن نشد. کمی بعد دوباره تلاش کن');
  assert.equal(wizard.messageFromBody({ detail: 'Bad Gateway' }, 'دوباره تلاش کنید'), 'دوباره تلاش کنید');
  assert.equal(wizard.messageFromBody({ detail: 'کد واردشده درست نیست' }, 'دوباره'), 'کد واردشده درست نیست');
  assert.equal(wizard.text({ name: 'TypeError', message: 'Failed to fetch' }, 'ارسال نشد'), 'ارتباط با سرور برقرار نشد. اینترنت را بررسی کنید و دوباره تلاش کنید.');
  assert.equal(wizard.text({ name: 'TimeoutError', message: 'signal timed out' }, 'ارسال نشد'), 'ارتباط طول کشید. اینترنت را بررسی کنید و دوباره تلاش کنید.');
  assert.equal(wizard.text(new Error('ابتدا پرسش‌نامه را کامل کنید.'), 'ارسال نشد'), 'ابتدا پرسش‌نامه را کامل کنید.');
  assert.equal(wizard.text(new Error('Cannot read properties of null'), 'ارسال نشد'), 'ارسال نشد');
});

test('each wizard step is one history entry and the loading screen does not stay behind the specialists', () => {
  assert.equal(wizard.historyAction(null, { stage: 'question', index: 0 }), 'replace');
  assert.equal(wizard.historyAction({ stage: 'question', index: 0 }, { stage: 'question', index: 0 }), 'ignore');
  assert.equal(wizard.historyAction({ stage: 'question', index: 0 }, { stage: 'question', index: 1 }), 'push');
  assert.equal(wizard.historyAction({ stage: 'question', index: 4 }, { stage: 'preparing', index: 0 }), 'push');
  assert.equal(wizard.historyAction({ stage: 'preparing', index: 0 }, { stage: 'specialists', index: 0 }), 'replace');
  assert.equal(wizard.historyAction({ stage: 'specialists', index: 0 }, { stage: 'plans', index: 0 }), 'push');
  assert.equal(wizard.historyAction({ stage: 'phone', index: 0 }, { stage: 'otp', index: 0 }), 'push');
});
