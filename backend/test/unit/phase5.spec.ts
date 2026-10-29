import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { manualDraftReason, usageCount } from '../../src/ai/cost.js';
import { tehranDayStartUtc } from '../../src/common/time.js';

describe('phase 5 rules', () => {
  it('skips the model when the switch is on or the daily cap is reached', () => {
    assert.equal(manualDraftReason({ killSwitch: true, spentMicros: 0, capMicros: null }), 'kill_switch');
    assert.equal(manualDraftReason({ killSwitch: false, spentMicros: 1000, capMicros: 1000 }), 'cost_cap');
    assert.equal(manualDraftReason({ killSwitch: false, spentMicros: 999, capMicros: 1000 }), null);
    assert.equal(manualDraftReason({ killSwitch: false, spentMicros: 5000, capMicros: null }), null);
    assert.equal(usageCount(12), 12);
    assert.equal(usageCount(-1), 0);
    assert.equal(usageCount(1.5), 0);
  });

  it('starts the cost day at Tehran midnight', () => {
    assert.equal(tehranDayStartUtc(new Date('2026-10-28T20:30:00.000Z')).toISOString(), '2026-10-28T20:30:00.000Z');
    assert.equal(tehranDayStartUtc(new Date('2026-10-28T20:29:59.000Z')).toISOString(), '2026-10-27T20:30:00.000Z');
  });
});
