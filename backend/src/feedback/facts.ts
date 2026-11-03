export const PREPARATION = ['easy', 'moderate', 'hard', 'unknown'] as const;
export const AVAILABILITY = ['available', 'partial', 'unavailable', 'unknown'] as const;
export const AFFORDABILITY = ['affordable', 'tight', 'unaffordable', 'unknown'] as const;
export const PORTION = ['too_small', 'right', 'too_large', 'unknown'] as const;

export interface PreferenceSources {
  questionnairePreference: string | null;
  questionnaireDislikes: string | null;
  substitutionReasons: string[];
  favoriteOptions: string[];
  dislikedOptions: string[];
  confirmed: { favoriteOptions: string[]; dislikedOptions: string[]; note: string } | null;
}

export interface PreferenceView {
  statedPreference: string | null;
  statedDislikes: string | null;
  favoriteOptions: string[];
  dislikedOptions: string[];
  substitutionReasons: string[];
  inferred: { favoriteOptions: string[]; dislikedOptions: string[] };
  confirmed: PreferenceSources['confirmed'];
  overriddenByCustomer: boolean;
  notADiagnosis: true;
}

export interface ReportFacts {
  weekStart: string;
  weekEnd: string;
  plannedMeals: number;
  recordedMeals: number;
  accordingToPlan: number;
  skipped: number;
  substitutions: number;
  favoriteOptions: string[];
  dislikedOptions: string[];
  preparationDifficulty: string | null;
  ingredientAvailability: string | null;
  affordability: string | null;
  portionSatisfaction: string | null;
  weights: { date: string; kilograms: number }[];
  questionnaireChanged: boolean;
  previousAdherence: number | null;
  sourceRefs: { kind: string; ref: string }[];
}

const unique = (values: string[]) => [...new Set(values.filter((value) => value.trim().length > 0))];

export function compilePreferences(sources: PreferenceSources): PreferenceView {
  const inferred = {
    favoriteOptions: unique([
      ...sources.favoriteOptions,
      ...(sources.questionnairePreference ? [sources.questionnairePreference] : []),
    ]),
    dislikedOptions: unique([
      ...sources.dislikedOptions,
      ...(sources.questionnaireDislikes ? [sources.questionnaireDislikes] : []),
    ]),
  };
  const confirmed = sources.confirmed;
  return {
    statedPreference: sources.questionnairePreference,
    statedDislikes: sources.questionnaireDislikes,
    favoriteOptions: confirmed ? unique(confirmed.favoriteOptions) : inferred.favoriteOptions,
    dislikedOptions: confirmed ? unique(confirmed.dislikedOptions) : inferred.dislikedOptions,
    substitutionReasons: unique(sources.substitutionReasons),
    inferred,
    confirmed,
    overriddenByCustomer: confirmed != null,
    notADiagnosis: true,
  };
}

export function compilePatientReport(facts: ReportFacts) {
  const missing: string[] = [];
  if (facts.plannedMeals === 0) missing.push('plan');
  if (facts.recordedMeals === 0) missing.push('consumption');
  if (facts.weights.length === 0) missing.push('weight');
  if (!facts.preparationDifficulty) missing.push('preparation');
  if (!facts.affordability) missing.push('affordability');
  const adherence =
    facts.plannedMeals === 0 ? null : Math.round((facts.accordingToPlan / facts.plannedMeals) * 1000) / 1000;
  const completeness =
    facts.plannedMeals === 0
      ? 'missing_plan'
      : facts.recordedMeals === 0
        ? 'no_records'
        : facts.recordedMeals < facts.plannedMeals
          ? 'partial'
          : 'complete';
  const considerations: string[] = [];
  if (facts.favoriteOptions.length) considerations.push('گزینه‌های علاقه‌مند ثبت‌شده در بازخورد همین هفته را در بازبینی در نظر بگیرید.');
  if (facts.dislikedOptions.length) considerations.push('گزینه‌های نامطلوب ثبت‌شده را با الگوی جایگزینی همین هفته مقایسه کنید.');
  if (facts.preparationDifficulty === 'hard') considerations.push('دشواری آماده‌سازی گزارش شده است.');
  if (facts.ingredientAvailability === 'unavailable' || facts.ingredientAvailability === 'partial') {
    considerations.push('دسترسی ناکامل به مواد اولیه گزارش شده است.');
  }
  if (facts.affordability === 'tight' || facts.affordability === 'unaffordable') {
    considerations.push('فشار هزینه گزارش شده است.');
  }
  if (facts.previousAdherence != null) considerations.push('پایبندی هفتهٔ قبل فقط برای مقایسه آمده و عدد این هفته را عوض نمی‌کند.');
  return {
    period: { weekStart: facts.weekStart, weekEnd: facts.weekEnd, timezone: 'Asia/Tehran' },
    cutoffCompleteness: completeness,
    missing,
    consumption: {
      plannedMeals: facts.plannedMeals,
      recordedMeals: facts.recordedMeals,
      accordingToPlan: facts.accordingToPlan,
      skipped: facts.skipped,
      adherence,
      adherenceKnown: adherence != null,
    },
    favorites: facts.favoriteOptions,
    dislikes: facts.dislikedOptions,
    substitutions: facts.substitutions,
    preparationDifficulty: facts.preparationDifficulty,
    ingredientAvailability: facts.ingredientAvailability,
    affordability: facts.affordability,
    portionSatisfaction: facts.portionSatisfaction,
    weights: facts.weights,
    questionnaireChanged: facts.questionnaireChanged,
    previousWeekAdherence: facts.previousAdherence,
    considerations,
    approvesNewPlan: false as const,
    notADiagnosis: true as const,
    sourceRefs: facts.sourceRefs,
  };
}
