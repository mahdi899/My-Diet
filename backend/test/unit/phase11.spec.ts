import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { publicReviewerName } from '../../src/tracking/review-name.js';

describe('phase 11 rules', () => {
  it('shows a first name and the first letter of the last name', () => {
    assert.equal(publicReviewerName('نگار تستی'), 'نگار ت.');
    assert.equal(publicReviewerName('  نگار   تستی  '), 'نگار ت.');
    assert.equal(publicReviewerName('نگار'), 'نگار');
    assert.equal(publicReviewerName(''), '');
    assert.equal(publicReviewerName(null), '');
  });
});
