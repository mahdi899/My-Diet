import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { debitFits, signedAdjustment } from '../../src/admin/adjustment.js';
import { isDeadLetter } from '../../src/jobs/outbox-policy.js';

describe('phase 6 rules', () => {
  it('debits cash for a bank refund and refuses a debit the wallet cannot cover', () => {
    assert.equal(signedAdjustment('debit', 1000), -1000);
    assert.equal(signedAdjustment('credit', 1000), 1000);
    assert.equal(debitFits(1000, 1000), true);
    assert.equal(debitFits(999, 1000), false);
    assert.equal(debitFits(1000, 0), false);
  });

  it('treats an undelivered event as dead only after the attempt limit', () => {
    assert.equal(isDeadLetter(10, false), true);
    assert.equal(isDeadLetter(9, false), false);
    assert.equal(isDeadLetter(10, true), false);
  });
});
