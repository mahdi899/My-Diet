import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { addCivilDays } from '../../src/common/time.js';
import { decideAcquisition, questionsOf, type AcquisitionInput } from '../../src/questionnaire/acquisition.js';

const base: AcquisitionInput = {
  hasSubmission: true,
  submittedSchemaVersion: 1,
  publishedSchemaVersion: 1,
  questions: [{ id: 'name' }],
  answers: { name: 'نگار تست', lifeStage: 'none', pregnancyWeek: null },
  pregnancyAsOf: null,
  today: '2026-10-06',
  openRequest: null,
};

describe('phase 8 rules', () => {
  it('sends a user with no submission to the questionnaire', () => {
    const decision = decideAcquisition({ ...base, hasSubmission: false, answers: null });
    assert.deepEqual(decision, {
      questionnaire: 'missing',
      reasons: [],
      nextStep: 'questionnaire',
      openRequest: null,
      pregnancyWeek: null,
    });
  });

  it('lets a current submission choose a service', () => {
    const decision = decideAcquisition(base);
    assert.equal(decision.questionnaire, 'complete');
    assert.deepEqual(decision.reasons, []);
    assert.equal(decision.nextStep, 'select_service');
  });

  it('asks for review when a new required question has no answer', () => {
    const decision = decideAcquisition({
      ...base,
      questions: [{ id: 'custom_note', required: true }],
    });
    assert.equal(decision.questionnaire, 'needs_review');
    assert.deepEqual(decision.reasons, ['schema_required_question_added']);
    assert.equal(decision.nextStep, 'questionnaire');
  });

  it('keeps an answered required question current', () => {
    const decision = decideAcquisition({
      ...base,
      questions: [{ id: 'custom_note', required: true }],
      answers: { ...base.answers, custom_note: 'آهن' },
    });
    assert.equal(decision.questionnaire, 'complete');
    assert.equal(decision.nextStep, 'select_service');
  });

  it('adds five weeks to a pregnancy recorded five weeks earlier', () => {
    const today = '2026-10-06';
    const decision = decideAcquisition({
      ...base,
      answers: { lifeStage: 'pregnant', pregnancyWeek: 10 },
      pregnancyAsOf: addCivilDays(today, -35),
      today,
    });
    assert.equal(decision.pregnancyWeek, 15);
    assert.deepEqual(decision.reasons, ['pregnancy_stale']);
    assert.equal(decision.nextStep, 'questionnaire');
  });

  it('confirms the summary when the pregnancy week moved inside four weeks', () => {
    const today = '2026-10-06';
    const decision = decideAcquisition({
      ...base,
      answers: { lifeStage: 'pregnant', pregnancyWeek: 10 },
      pregnancyAsOf: addCivilDays(today, -14),
      today,
    });
    assert.equal(decision.pregnancyWeek, 12);
    assert.equal(decision.questionnaire, 'complete');
    assert.equal(decision.nextStep, 'confirm_summary');
  });

  it('opens an existing request and ignores a published one', () => {
    const open = decideAcquisition({
      ...base,
      openRequest: { id: 'req-1', status: 'in_review' },
    });
    assert.equal(open.nextStep, 'open_request');
    assert.equal(open.openRequest?.id, 'req-1');
    const published = decideAcquisition({
      ...base,
      openRequest: { id: 'req-2', status: 'published' },
    });
    assert.equal(published.nextStep, 'select_service');
    assert.equal(published.openRequest, null);
  });

  it('reads required flags from a schema document and ignores the seeded id list', () => {
    assert.deepEqual(questionsOf({ questions: ['name', 'age'] }), [{ id: 'name' }, { id: 'age' }]);
    assert.deepEqual(questionsOf({ questions: [{ id: 'custom_note', required: true }] }), [
      { id: 'custom_note', required: true },
    ]);
  });
});
