import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { foodKey, rankLabels, retentionCell, sortBoard, type BoardRow } from '../../src/reports/metrics.js';

describe('product report definitions', () => {
  it('keeps an unfinished window unknown and a finished empty window at zero', () => {
    assert.deepEqual(retentionCell(2, 7, 0, 5), { state: 'not_yet_measurable' });
    assert.deepEqual(retentionCell(28, 28, 0, 10), { state: 'measured', count: 0, denominator: 10, percent: 0 });
    assert.equal(retentionCell(28, 28, 0, 0).state, 'no_denominator');
  });

  it('does not merge a short food name into a longer recipe', () => {
    const rows = rankLabels([
      { id: 'soup', label: 'سوپ جو' },
      { id: 'soup', label: 'سوپ  جو' },
      { id: 'short', label: 'سوپ' },
    ]);
    assert.equal(rows.length, 2);
    assert.equal(rows[0]?.count, 2);
    assert.equal(foodKey('سوپ').uncertain, true);
    assert.equal(foodKey('سوپ جو').uncertain, false);
  });

  it('keeps one specialist and leaves missing timings blank', () => {
    const rated: BoardRow = {
      id: 'a', name: 'الف', ratingCount: 1, ratingAverage: 2, smallSample: true,
      distribution: [], messageResponse: 30, messageSamples: 1, changeResponse: null, changeResponseSamples: 0, reviewTime: null, reviewSamples: 0,
      pendingMessages: 1, pendingChanges: 0, pending: 1,
    };
    const blank: BoardRow = {
      id: 'b', name: 'ب', ratingCount: 0, ratingAverage: null, smallSample: false,
      distribution: [], messageResponse: null, messageSamples: 0, changeResponse: 60, changeResponseSamples: 1, reviewTime: 60, reviewSamples: 1,
      pendingMessages: 0, pendingChanges: 0, pending: 0,
    };
    const board = sortBoard([blank, rated], 'rating');
    assert.equal(board.at(-1)?.ratingAverage, null);
    assert.equal(sortBoard([rated], 'workload').length, 1);
    assert.equal(sortBoard([blank, rated], 'response').at(-1)?.messageResponse, null);
  });
});
