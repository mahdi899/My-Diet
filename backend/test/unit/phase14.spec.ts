import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { derivedPregnancyWeek, matchesOwnSchema } from '../../src/questionnaire/acquisition.js';

describe('current questionnaire', () => {
  it('validates a submission against the schema it was saved with', () => {
    const saved = [{ id: 'name' }, { id: 'custom_note', required: false }];
    assert.equal(matchesOwnSchema(saved, { name: 'نگار' }), true);
    assert.equal(
      matchesOwnSchema([{ id: 'custom_note', required: true }], { name: 'نگار' }),
      false,
    );
    assert.equal(
      matchesOwnSchema([{ id: 'custom_note', required: true }], { custom_note: 'آهن' }),
      true,
    );
    assert.equal(
      derivedPregnancyWeek({ lifeStage: 'pregnant', pregnancyWeek: 10 }, '2026-09-01', '2026-10-06'),
      15,
    );
    assert.equal(derivedPregnancyWeek({ lifeStage: 'none', pregnancyWeek: 10 }, '2026-09-01', '2026-10-06'), null);
  });
});
