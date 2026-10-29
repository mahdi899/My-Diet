import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { normalizeCouncilNo, verificationAfterCouncilChange } from '../../src/admin/profile.js';

describe('specialist council number', () => {
  it('folds Persian digits and resets verification only when the number changes', () => {
    assert.equal(normalizeCouncilNo('۱۲۳۴۵'), '12345');
    assert.equal(normalizeCouncilNo('1234-5'), '12345');
    assert.equal(normalizeCouncilNo(''), '');
    assert.equal(normalizeCouncilNo('12'), null);
    assert.equal(normalizeCouncilNo('12a45'), null);
    assert.equal(verificationAfterCouncilChange('12345', undefined, 'verified'), 'verified');
    assert.equal(verificationAfterCouncilChange('12345', '12345', 'verified'), 'verified');
    assert.equal(verificationAfterCouncilChange('12345', '67890', 'verified'), 'pending');
    assert.equal(verificationAfterCouncilChange('12345', '', 'rejected'), 'pending');
  });
});
