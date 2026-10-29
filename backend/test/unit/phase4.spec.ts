import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  shouldClearAiRaw,
  shouldExpirePendingPayment,
  shouldInquirePendingPayment,
  shouldPurgeChallenge,
  shouldRequeueGenerating,
} from '../../src/maintenance/policy.js';

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;

describe('phase 4 rules', () => {
  it('expires a pending payment only after 30 minutes', () => {
    assert.equal(shouldExpirePendingPayment(29 * MINUTE), false);
    assert.equal(shouldExpirePendingPayment(30 * MINUTE), true);
    assert.equal(shouldInquirePendingPayment(15 * MINUTE), true);
    assert.equal(shouldInquirePendingPayment(30 * MINUTE), false);
    assert.equal(shouldInquirePendingPayment(14 * MINUTE), false);
  });

  it('requeues a stuck draft and purges old challenges and model text', () => {
    assert.equal(shouldRequeueGenerating(15 * MINUTE), true);
    assert.equal(shouldRequeueGenerating(14 * MINUTE), false);
    assert.equal(shouldPurgeChallenge(7 * DAY), true);
    assert.equal(shouldPurgeChallenge(6 * DAY), false);
    assert.equal(shouldClearAiRaw(30 * DAY), true);
    assert.equal(shouldClearAiRaw(29 * DAY), false);
  });
});
