import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cycleStartFor, projectCycle, recordedMeal, type CampaignRules } from '../../src/rewards/streak-rules.js';

const rules: CampaignRules = {
  version: 1,
  consecutiveDays: 7,
  milestones: [{ day: 7, amountToman: 200000 }],
  startsOn: '2026-10-24',
  endsOn: null,
  effectiveOn: '2026-10-24',
  repeat: 'cycle',
};

describe('streak campaign rules', () => {
  it('does not treat login or a skipped meal as a qualified day', () => {
    const open = projectCycle({
      rules, cycleStart: '2026-10-24', today: '2026-10-24',
      qualified: new Set(), partial: new Set(), grantedDays: new Set(),
    });
    assert.equal(open.consecutive, 0);
    assert.equal(open.days[0]?.state, 'pending');
    assert.equal(recordedMeal({ eaten: false, state: 'skipped' }), false);
    assert.equal(recordedMeal({ eaten: true, state: null }), true);
    const partial = projectCycle({
      rules, cycleStart: '2026-10-24', today: '2026-10-24',
      qualified: new Set(), partial: new Set(['2026-10-24']), grantedDays: new Set(),
    });
    assert.equal(partial.days[0]?.state, 'pending_verification');
    assert.equal(partial.consecutive, 0);
  });

  it('resets on a missed day and keeps the cycle across the Tehran midnight', () => {
    const qualified = new Set(['2026-10-24', '2026-10-26']);
    const broken = projectCycle({
      rules, cycleStart: '2026-10-24', today: '2026-10-26', qualified, partial: new Set(), grantedDays: new Set(),
    });
    assert.equal(broken.days[1]?.state, 'missed');
    assert.equal(broken.consecutive, 1);
    assert.equal(cycleStartFor('2026-10-24', 7, '2026-10-30'), '2026-10-24');
    assert.equal(cycleStartFor('2026-10-24', 7, '2026-10-31'), '2026-10-31');
    const next = projectCycle({
      rules, cycleStart: '2026-10-31', today: '2026-10-31',
      qualified: new Set(['2026-10-30']), partial: new Set(), grantedDays: new Set(),
    });
    assert.equal(next.days[0]?.state, 'pending');
    assert.equal(next.consecutive, 0);
  });
});
