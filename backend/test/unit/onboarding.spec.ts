import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, it } from 'node:test';
import { assessSafety, bmr, mealSlots, planEnergy } from '../../src/nutrition/engine.js';
import { canonicalToSubmission, legacyToCanonical, profilePreferences } from '../../src/onboarding/mapper.js';
import { deriveProfile, factsOf, trackOfStored } from '../../src/onboarding/profile.js';
import {
  DISH_PICKER,
  SPEC_QUESTIONS,
  activeQuestions,
  missingRequired,
  type AnswerValue,
  type CanonicalAnswers,
  type TrackId,
} from '../../src/onboarding/spec.js';
import { validateSubmission } from '../../src/questionnaire/schema.js';

const FIXED: Record<string, AnswerValue> = {
  name: 'مهدی',
  age: 34,
  sex: 'female',
  height_cm: 165,
  weight_kg: 80,
  target_weight_kg: 68,
  pregnancy_week: 20,
  pre_pregnancy_weight_kg: 62,
  months_postpartum: 4,
  months_breastfeeding: 4,
  sleep_wake: { sleep: 23, wake: 7 },
  life_stage: 'pregnant',
};

/** Answers every active question with its first sensible option until nothing is missing. */
function fill(track: TrackId, overrides: CanonicalAnswers = {}): CanonicalAnswers {
  const answers: CanonicalAnswers = { ...FIXED, ...overrides };
  for (let round = 0; round < 6; round += 1) {
    for (const question of activeQuestions(track, answers)) {
      if (answers[question.key] != null) continue;
      const options = question.options ?? [];
      if (question.kind === 'text') answers[question.key] = 'توضیح';
      else if (question.kind === 'number' || question.kind === 'age') {
        answers[question.key] = question.default ?? question.min ?? 1;
      } else if (question.kind === 'single') answers[question.key] = options[0]!.code;
      else if (question.kind === 'multi' || question.kind === 'dish_picker') {
        answers[question.key] = [(options.find((option) => option.code === 'none') ?? options[0])!.code];
      }
      if (question.followUp) {
        const chosen = answers[question.key];
        const codes = Array.isArray(chosen) ? chosen : [String(chosen)];
        if (codes.some((code) => question.followUp!.whenCodes.includes(code))) answers[question.followUp.key] = 'توضیح';
      }
    }
  }
  return answers;
}

describe('onboarding spec', () => {
  it('has unique keys and codes and unambiguous labels', () => {
    const keys = new Set<string>();
    for (const question of SPEC_QUESTIONS) {
      assert.equal(keys.has(question.key), false, `duplicate key ${question.key}`);
      keys.add(question.key);
      const codes = new Set<string>();
      for (const option of question.options ?? []) {
        assert.equal(codes.has(option.code), false, `${question.key}: duplicate code ${option.code}`);
        codes.add(option.code);
      }
      if (question.kind === 'single' || question.kind === 'multi') {
        assert.ok((question.options ?? []).length >= 2, `${question.key} needs options`);
      }
    }
    assert.ok(DISH_PICKER.length >= 12);
  });

  it('reports missing required answers per track and shows branch questions only on their track', () => {
    for (const track of ['weight_loss', 'weight_gain', 'pregnancy', 'detox'] as const) {
      assert.ok(missingRequired(track, {}).length > 5);
      assert.deepEqual(missingRequired(track, fill(track)), [], track);
    }
    const loss = activeQuestions('weight_loss', {}).map((question) => question.key);
    assert.deepEqual(loss.slice(0, 6), ['name', 'age', 'sex', 'height_cm', 'weight_kg', 'activity']);
    assert.equal(loss.at(-1), 'binge_history');
    assert.equal(loss.includes('pregnancy_week'), false);
    assert.equal(loss.includes('target_weight_kg'), true);
    assert.equal(loss.includes('water'), false);
    assert.equal(loss.includes('fav_dishes'), false);
    const detox = activeQuestions('detox', { exercise_days: '0' }).map((question) => question.key);
    assert.equal(detox[detox.indexOf('health_focus') + 1], 'water');
    assert.equal(detox.includes('exercise_duration'), false);
    const preg = activeQuestions('pregnancy', { life_stage: 'pregnant' }).map((question) => question.key);
    assert.equal(preg.includes('target_weight_kg'), false);
    assert.equal(preg[preg.indexOf('pregnancy_week') + 1], 'pre_pregnancy_weight_kg');
  });
});

describe('canonical answers to the stored submission', () => {
  for (const track of ['weight_loss', 'weight_gain', 'pregnancy', 'detox'] as const) {
    it(`validates a complete ${track} profile`, () => {
      const answers = fill(track, track === 'weight_gain' ? { target_weight_kg: 90 } : {});
      const submission = canonicalToSubmission(track, answers);
      const { answers: stored, riskFlags } = validateSubmission(submission);
      assert.equal(stored.weightKg, 80);
      const profile = deriveProfile({ track, stored, riskFlags, preferences: profilePreferences(track, answers), canonical: answers });
      assert.equal(profile.track, track);
      assert.ok(profile.energy.targetKcal >= profile.energy.floorKcal);
      assert.ok(factsOf(track, answers).some((fact) => fact.key === 'track'));
    });
  }

  it('never copies free text into facts', () => {
    const facts = factsOf('weight_loss', fill('weight_loss'));
    assert.equal(facts.some((fact) => fact.key === 'name'), false);
    assert.equal(facts.some((fact) => fact.code === 'توضیح'), false);
  });

  it('maps life stage and conditions to the right track and flags', () => {
    const answers = fill('pregnancy', { life_stage: 'breastfeeding', feeding_mode: 'exclusive' });
    const { answers: stored } = validateSubmission(canonicalToSubmission('pregnancy', answers));
    assert.equal(stored.lifeStage, 'breastfeeding');
    assert.equal(trackOfStored(stored), 'pregnancy');
  });
});

describe('legacy demo answers', () => {
  it('maps label based demo answers by question text and option label', () => {
    const { track, answers } = legacyToCanonical('weight_loss', [
      { question: 'اسم شما چیست؟', answer: 'سارا' },
      { question: 'جنسیتت چیه؟', answer: 'زن' },
      { question: 'قدت چقدره؟', answer: '۱۶۵' },
      { question: 'وزن فعلیت چقدره؟', answer: '۷۸٫۵' },
    ]);
    assert.equal(track, 'weight_loss');
    assert.equal(answers.name, 'سارا');
    assert.equal(answers.sex, 'female');
    assert.equal(answers.height_cm, 165);
    assert.equal(answers.weight_kg, 78.5);
  });

  it('prefers explicit keys over wording', () => {
    const { answers } = legacyToCanonical('detox', [{ question: 'هر چیزی', key: 'sex', answer: 'مرد' }]);
    assert.equal(answers.sex, 'male');
  });
});

describe('nutrition engine', () => {
  const base = {
    sex: 'female' as const,
    age: 34,
    heightCm: 165,
    weightKg: 80,
    activity: 'light',
    exercise: '1_2',
  };

  it('uses Mifflin-St Jeor', () => {
    assert.equal(bmr({ sex: 'female', age: 34, heightCm: 165, weightKg: 80 }), 1500);
    assert.equal(bmr({ sex: 'male', age: 34, heightCm: 180, weightKg: 80 }), 1760);
  });

  it('caps weight loss at the safe rate and never goes under the floor', () => {
    const fast = planEnergy({ ...base, track: 'weight_loss', lossPace: 'fast', targetWeightKg: 68 });
    assert.ok(fast.tdeeKcal - fast.targetKcal <= Math.round(fast.tdeeKcal * 0.25) + 5);
    assert.ok(fast.weeklyChangeKg >= -0.8);
    assert.ok(fast.etaWeeks && fast.etaWeeks > 10);
    const tiny = planEnergy({ ...base, weightKg: 45, heightCm: 150, age: 60, activity: 'sedentary', exercise: 'none', track: 'weight_loss', lossPace: 'fast' });
    assert.ok(tiny.targetKcal >= 1200);
  });

  it('adds energy by trimester and while breastfeeding', () => {
    const t1 = planEnergy({ ...base, track: 'pregnancy', lifeStage: 'pregnant', pregnancyWeek: 8 });
    const t3 = planEnergy({ ...base, track: 'pregnancy', lifeStage: 'pregnant', pregnancyWeek: 32 });
    assert.ok(t3.targetKcal > t1.targetKcal);
    assert.ok(t1.targetKcal >= 1800);
    const lact = planEnergy({ ...base, track: 'pregnancy', lifeStage: 'breastfeeding', monthsPostpartum: 3 });
    assert.ok(lact.targetKcal >= lact.tdeeKcal + 450);
  });

  it('splits meals so the slots sum to the target', () => {
    for (const meals of [2, 3, 4, null]) {
      const slots = mealSlots(1735, meals, 6);
      assert.equal(slots.reduce((sum, slot) => sum + slot.kcal, 0), 1735);
    }
  });

  it('routes risky profiles to the doctor only', () => {
    assert.equal(assessSafety({ track: 'weight_loss', bmi: 27, health: [], riskFlags: [], heightCm: 170 }).tier, 'ai_ok');
    const eating = assessSafety({ track: 'weight_loss', bmi: 27, health: [], riskFlags: ['eating_disorder_history'], heightCm: 170 });
    assert.equal(eating.tier, 'doctor_only');
    const diabetes = assessSafety({ track: 'weight_loss', bmi: 29, health: ['diabetes', 'medication'], riskFlags: [], heightCm: 170 });
    assert.ok(diabetes.reasons.includes('diabetes_on_medication'));
    const low = assessSafety({ track: 'weight_loss', bmi: 22, health: [], riskFlags: [], targetWeightKg: 45, heightCm: 170 });
    assert.ok(low.reasons.includes('target_bmi_low'));
  });
});

describe('demo keys file', () => {
  const source = readFileSync(new URL('../../../demo/onboarding-keys.js', import.meta.url), 'utf8');
  const sandbox: { window?: unknown; SabzineKeys?: { canonical(q: unknown, a: unknown): { key?: string; codes?: string[] } } } = {};
  sandbox.window = sandbox;
  runInNewContext(source, sandbox);
  const keys = sandbox.SabzineKeys!;

  it('knows every question the demo can ask (regenerate with tool/build_demo_keys.mjs when the spec changes)', () => {
    for (const question of SPEC_QUESTIONS) {
      for (const title of question.demoTitles ?? []) {
        assert.equal(keys.canonical({ q: title }, undefined).key, question.key, `${question.key}: ${title}`);
      }
    }
  });

  it('sends codes that map back to the same canonical answers even when the wording changed', () => {
    for (const question of SPEC_QUESTIONS) {
      if (!question.demoTitles?.length || !question.options?.length || question.kind === 'age') continue;
      const demoQuestion = { q: question.demoTitles[0], options: question.options.map((o) => ({ label: o.label })) };
      const sent = JSON.parse(JSON.stringify(keys.canonical(demoQuestion, 0))) as { key?: string; codes?: string[] };
      assert.deepEqual(sent.codes, [question.options[0]!.code], question.key);
      const { answers } = legacyToCanonical('weight_loss', [
        { question: 'متن ویرایش‌شده توسط ادمین', answer: question.options[0]!.label, ...sent },
      ]);
      const stored = answers[question.key];
      assert.deepEqual(Array.isArray(stored) ? stored : [stored], [question.options[0]!.code], question.key);
    }
  });

  it('ignores unknown codes and falls back to the label', () => {
    const { answers } = legacyToCanonical('weight_loss', [
      { question: 'جنسیتت چیه؟', answer: 'زن', codes: ['nonsense'] },
    ]);
    assert.equal(answers.sex, 'female');
  });
});
