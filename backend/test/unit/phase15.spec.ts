import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseCivilDate, versionForDate, type DatedVersion } from '../../src/plans/views.js';

function row(partial: Partial<DatedVersion> & Pick<DatedVersion, 'publishedOn' | 'civilDate'>): DatedVersion {
  return {
    versionId: partial.versionId ?? partial.publishedOn,
    requestId: partial.requestId ?? 'request',
    status: partial.status ?? 'published',
    publishedAt: partial.publishedAt ?? `${partial.publishedOn}T04:30:00.000Z`,
    publishedOn: partial.publishedOn,
    civilDate: partial.civilDate,
    dayIndex: partial.dayIndex ?? 0,
  };
}

describe('published plan dates', () => {
  it('keeps days before a mid-week revision on the earlier version', () => {
    const early = row({
      versionId: 'early',
      status: 'superseded',
      publishedOn: '2026-10-24',
      publishedAt: '2026-10-24T04:30:00.000Z',
      civilDate: '2026-10-26',
    });
    const later = row({
      versionId: 'later',
      status: 'published',
      publishedOn: '2026-10-28',
      publishedAt: '2026-10-28T04:30:00.000Z',
      civilDate: '2026-10-26',
    });
    const wednesday = { ...later, civilDate: '2026-10-28' };
    assert.equal(versionForDate([early, later, wednesday], '2026-10-26')?.versionId, 'early');
    assert.equal(versionForDate([early, later, wednesday], '2026-10-28')?.versionId, 'later');
    assert.equal(versionForDate([later], '2026-10-26'), null);
    assert.equal(parseCivilDate('2026-10-24'), '2026-10-24');
    assert.equal(parseCivilDate('2026-02-31'), null);
  });
});
