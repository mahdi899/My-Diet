import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { acknowledgedReward } from '../../src/tracking/rewards.js';

const reward = {
  id: '11111111-1111-4111-8111-111111111111',
  requestId: '22222222-2222-4222-8222-222222222222',
  weekStart: '2026-10-24',
  amountToman: 200000,
  acknowledgedAt: null,
};

describe('phase 10 rules', () => {
  it('records the first acknowledgement and leaves the amount', () => {
    const seen = acknowledgedReward(reward, '2026-10-29T10:00:00.000Z');
    assert.equal(seen.acknowledgedAt, '2026-10-29T10:00:00.000Z');
    assert.equal(seen.amountToman, 200000);
  });

  it('keeps the original timestamp when the reward was already dismissed', () => {
    const seen = acknowledgedReward({ ...reward, acknowledgedAt: '2026-10-29T10:00:00.000Z' }, '2026-10-30T10:00:00.000Z');
    assert.equal(seen.acknowledgedAt, '2026-10-29T10:00:00.000Z');
    assert.equal(seen.amountToman, 200000);
  });
});
