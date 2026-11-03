import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { compilePatientReport, compilePreferences } from '../../src/feedback/facts.js';
import { requireWeek } from '../../src/feedback/weekly-feedback.service.js';

describe('weekly feedback facts', () => {
  it('lets an explicit correction replace inferred likes and avoids', () => {
    const inferred = compilePreferences({
      questionnairePreference: 'غذای ایرانی',
      questionnaireDislikes: 'بادمجان',
      substitutionReasons: ['ترجیح غذایی'],
      favoriteOptions: ['option-a'],
      dislikedOptions: ['option-b'],
      confirmed: null,
    });
    assert.deepEqual(inferred.favoriteOptions, ['option-a', 'غذای ایرانی']);
    assert.equal(inferred.overriddenByCustomer, false);
    assert.equal(inferred.notADiagnosis, true);
    const corrected = compilePreferences({
      questionnairePreference: 'غذای ایرانی',
      questionnaireDislikes: 'بادمجان',
      substitutionReasons: [],
      favoriteOptions: ['option-a'],
      dislikedOptions: ['option-b'],
      confirmed: { favoriteOptions: ['option-c'], dislikedOptions: [], note: 'فقط این' },
    });
    assert.deepEqual(corrected.favoriteOptions, ['option-c']);
    assert.deepEqual(corrected.dislikedOptions, []);
    assert.equal(corrected.overriddenByCustomer, true);
    assert.deepEqual(corrected.inferred.dislikedOptions, ['option-b', 'بادمجان']);
  });

  it('keeps missing adherence unknown and never approves a plan', () => {
    const report = compilePatientReport({
      weekStart: '2026-10-24',
      weekEnd: '2026-10-30',
      plannedMeals: 0,
      recordedMeals: 0,
      accordingToPlan: 0,
      skipped: 0,
      substitutions: 0,
      favoriteOptions: [],
      dislikedOptions: [],
      preparationDifficulty: null,
      ingredientAvailability: null,
      affordability: 'tight',
      portionSatisfaction: null,
      weights: [],
      questionnaireChanged: false,
      previousAdherence: null,
      sourceRefs: [],
    });
    assert.equal(report.consumption.adherence, null);
    assert.equal(report.consumption.adherenceKnown, false);
    assert.equal(report.cutoffCompleteness, 'missing_plan');
    assert.ok(report.missing.includes('weight'));
    assert.equal(report.approvesNewPlan, false);
    assert.equal(report.notADiagnosis, true);
    assert.equal(report.considerations.length, 1);
    assert.throws(() => requireWeek('2026-10-25'));
    assert.equal(requireWeek('2026-10-24'), '2026-10-24');
  });
});
