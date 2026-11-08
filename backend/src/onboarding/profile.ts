import type { StoredAnswers } from '../questionnaire/schema.js';
import {
  assessSafety,
  mealSlots,
  planEnergy,
  type EnergyPlan,
  type SafetyResult,
  type Track,
} from '../nutrition/engine.js';
import { SPEC_QUESTIONS, type CanonicalAnswers } from './spec.js';

export interface DerivedProfile {
  track: Track;
  goal: string;
  sex: 'female' | 'male';
  age: number;
  heightCm: number;
  weightKg: number;
  targetWeightKg: number | null;
  activity: string;
  bmi: number;
  energy: EnergyPlan;
  dietStyle: 'omnivore' | 'vegetarian' | 'vegan';
  mealsPerDay: number | null;
  budget: string;
  region: string | null;
  allergens: string[];
  conditions: string[];
  riskFlags: string[];
  safety: SafetyResult;
  preferences: Record<string, unknown>;
}

export function trackOfStored(stored: Pick<StoredAnswers, 'goal' | 'lifeStage'>, hint?: string | null): Track {
  if (hint === 'weight_loss' || hint === 'weight_gain' || hint === 'pregnancy' || hint === 'detox') return hint;
  if (stored.lifeStage === 'pregnant' || stored.lifeStage === 'breastfeeding') return 'pregnancy';
  if (stored.goal === 'weight_loss') return 'weight_loss';
  if (stored.goal === 'weight_gain') return 'weight_gain';
  return 'detox';
}

const mealsOf = (value: unknown): number | null => {
  if (value === '1') return 1;
  if (value === '2') return 2;
  if (value === '3') return 3;
  if (value === '4_plus') return 4;
  return null;
};

export function deriveProfile(args: {
  track: Track;
  stored: StoredAnswers;
  riskFlags: string[];
  preferences?: Record<string, unknown>;
  canonical?: CanonicalAnswers;
}): DerivedProfile {
  const { stored, canonical } = args;
  const preferences = { ...(args.preferences ?? {}) };
  const sleepWake = preferences.sleep_wake as { wake?: number } | undefined;
  const mealsPerDay = mealsOf(preferences.meals_per_day);
  const energy = planEnergy({
    track: args.track,
    sex: stored.sex === 'male' ? 'male' : 'female',
    age: stored.age,
    heightCm: stored.heightCm,
    weightKg: stored.weightKg,
    targetWeightKg: stored.targetWeightKg,
    activity: stored.activity,
    exercise: stored.exercise,
    lossPace: typeof preferences.loss_pace === 'string' ? preferences.loss_pace : null,
    lifeStage: stored.lifeStage,
    pregnancyWeek: stored.pregnancyWeek,
    babies: stored.babies,
    monthsPostpartum:
      typeof canonical?.months_postpartum === 'number' ? canonical.months_postpartum : null,
    lactationGoal: typeof preferences.lactation_goal === 'string' ? preferences.lactation_goal : null,
    mealsPerDay,
    wakeHour: sleepWake?.wake ?? null,
  });
  const safety = assessSafety({
    track: args.track,
    bmi: energy.bmi,
    health: stored.health,
    riskFlags: args.riskFlags,
    targetWeightKg: stored.targetWeightKg,
    heightCm: stored.heightCm,
  });
  const allergenCodes = Array.isArray(canonical?.allergies)
    ? (canonical.allergies as string[]).filter((code) => code !== 'none')
    : stored.health.includes('food_allergy')
      ? ['other']
      : [];
  return {
    track: args.track,
    goal: stored.goal,
    sex: stored.sex === 'male' ? 'male' : 'female',
    age: stored.age,
    heightCm: stored.heightCm,
    weightKg: stored.weightKg,
    targetWeightKg: stored.targetWeightKg,
    activity: stored.activity,
    bmi: energy.bmi,
    energy,
    dietStyle: stored.preference === 'vegan' ? 'vegan' : stored.preference === 'vegetarian' ? 'vegetarian' : 'omnivore',
    mealsPerDay,
    budget: stored.budget,
    region: typeof preferences.region === 'string' ? preferences.region : null,
    allergens: allergenCodes,
    conditions: stored.health.filter((code) => code !== 'none'),
    riskFlags: safety.flags,
    safety,
    preferences,
  };
}

export function slotsFor(profile: DerivedProfile) {
  const sleepWake = profile.preferences.sleep_wake as { wake?: number } | undefined;
  return mealSlots(profile.energy.targetKcal, profile.mealsPerDay, sleepWake?.wake ?? null);
}

export interface Fact {
  key: string;
  code: string;
  num: number | null;
}

/** One row per chosen code or numeric value. Free text is never copied. */
export function factsOf(track: Track, canonical: CanonicalAnswers): Fact[] {
  const facts: Fact[] = [{ key: 'track', code: track, num: null }];
  for (const question of SPEC_QUESTIONS) {
    const value = canonical[question.key];
    if (value == null) continue;
    if (question.kind === 'text') continue;
    if (question.kind === 'number' || question.kind === 'age') {
      if (typeof value === 'number') facts.push({ key: question.key, code: '', num: value });
    } else if (question.kind === 'sleep_wake') {
      if (typeof value === 'object' && !Array.isArray(value)) {
        facts.push({ key: 'sleep_hour', code: '', num: value.sleep });
        facts.push({ key: 'wake_hour', code: '', num: value.wake });
      }
    } else if (Array.isArray(value)) {
      for (const code of value) facts.push({ key: question.key, code: String(code), num: null });
    } else if (typeof value === 'string') {
      facts.push({ key: question.key, code: value, num: null });
    }
  }
  return facts;
}
