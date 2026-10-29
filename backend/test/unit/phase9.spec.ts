import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { QUEUE_BUCKETS, inBucket, isQueueBucket } from '../../src/plans/queue.js';

describe('phase 9 rules', () => {
  it('keeps each review bucket exclusive for a new plan', () => {
    const rows = [
      { status: 'queued', kind: 'new_plan', bucket: 'generating' },
      { status: 'generating', kind: 'new_plan', bucket: 'generating' },
      { status: 'in_review', kind: 'new_plan', bucket: 'awaiting_review' },
      { status: 'awaiting_user', kind: 'new_plan', bucket: 'awaiting_user' },
      { status: 'response_received', kind: 'new_plan', bucket: 'response_received' },
      { status: 'published', kind: 'new_plan', bucket: 'published' },
      { status: 'cancelled', kind: 'new_plan', bucket: null },
    ] as const;
    for (const row of rows) {
      for (const bucket of QUEUE_BUCKETS) {
        assert.equal(inBucket(row, bucket), bucket === row.bucket, `${row.status} ${bucket}`);
      }
    }
  });

  it('puts an open revision in revisions and not in the new-plan review bucket', () => {
    const revision = { status: 'in_review', kind: 'ai_revision' };
    assert.equal(inBucket(revision, 'revisions'), true);
    assert.equal(inBucket(revision, 'awaiting_review'), false);
    assert.equal(inBucket({ status: 'published', kind: 'specialist_revision' }, 'revisions'), false);
    assert.equal(inBucket({ status: 'published', kind: 'specialist_revision' }, 'published'), true);
  });

  it('rejects a bucket name that is not in the list', () => {
    assert.equal(isQueueBucket('awaiting_review'), true);
    assert.equal(isQueueBucket('cancelled'), false);
    assert.equal(isQueueBucket("in_review' or 1=1"), false);
  });
});
