import {
  SPEC_QUESTIONS,
  questionByKey,
  type AnswerValue,
  type CanonicalAnswers,
  type SpecOption,
  type SpecQuestion,
  type TrackId,
} from './spec.js';

const DIGITS: Record<string, string> = {
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
};

export function latinDigits(value: string): string {
  return value.replace(/[۰-۹٠-٩]/g, (digit) => DIGITS[digit] ?? digit);
}

export function norm(value: string): string {
  return latinDigits(value)
    .replace(/[ي]/g, 'ی')
    .replace(/[ك]/g, 'ک')
    .replace(/[\u200c\u200f\u200e]/g, '')
    .replace(/[؟?!.،,:؛]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

const AGE_MIDPOINT: Record<string, number> = { '18_30': 24, '30_40': 35, '40_50': 45, '50_plus': 55 };
const EMPTY_MARKERS = ['ثبت نشده', 'ثبت نشده (اختیاری)', '__skipped__'];

export interface LegacyAnswer {
  question: string;
  answer: string;
  key?: string;
  /** Canonical option codes sent by newer demo builds; they win over label matching. */
  codes?: string[];
}

const titleIndex = (() => {
  const map = new Map<string, SpecQuestion>();
  for (const question of SPEC_QUESTIONS) {
    for (const title of question.demoTitles ?? []) map.set(norm(title), question);
  }
  return map;
})();

function findQuestion(item: LegacyAnswer): SpecQuestion | undefined {
  if (item.key) {
    const byKey = questionByKey(item.key);
    if (byKey) return byKey;
  }
  return titleIndex.get(norm(item.question));
}

/** Matches option labels inside a joined string. Longest labels first, so "بله، X" wins over "بله". */
function matchOptions(options: SpecOption[], text: string): SpecOption[] {
  let rest = norm(text);
  const found: Array<{ option: SpecOption; at: number }> = [];
  const byLength = [...options].sort((a, b) => b.label.length - a.label.length);
  for (const option of byLength) {
    const label = norm(option.label);
    const at = rest.indexOf(label);
    if (at >= 0) {
      found.push({ option, at });
      rest = rest.slice(0, at) + ' '.repeat(label.length) + rest.slice(at + label.length);
    }
  }
  return found.sort((a, b) => a.at - b.at).map((item) => item.option);
}

function splitDetail(text: string): { head: string; detail: string } {
  const at = text.indexOf(' — ');
  if (at < 0) return { head: text.trim(), detail: '' };
  return { head: text.slice(0, at).trim(), detail: text.slice(at + 3).trim() };
}

function toNumber(text: string): number | null {
  const parsed = Number(
    latinDigits(text)
      .replace(/[٫,/]/g, '.')
      .replace(/[٬،\s]/g, '')
      .replace(/[^\d.\-]/g, ''),
  );
  return Number.isFinite(parsed) && text.trim() !== '' ? parsed : null;
}

function applyLegacy(question: SpecQuestion, raw: string, out: CanonicalAnswers, codes?: string[]): void {
  const text = raw.trim();
  if (!text || EMPTY_MARKERS.includes(text)) return;
  switch (question.kind) {
    case 'text':
      out[question.key] = text;
      return;
    case 'number': {
      const value = toNumber(text);
      if (value != null) out[question.key] = value;
      return;
    }
    case 'age': {
      const direct = toNumber(text);
      const range = matchOptions(question.options ?? [], text)[0];
      if (range && AGE_MIDPOINT[range.code]) {
        out.age = AGE_MIDPOINT[range.code]!;
        out.age_approx = 'yes';
      } else if (direct != null && direct >= 18 && direct <= 100) out.age = direct;
      return;
    }
    case 'sleep_wake': {
      const numbers = latinDigits(text).match(/\d{1,2}/g);
      if (numbers && numbers.length >= 2) {
        out[question.key] = { sleep: Number(numbers[0]) % 24, wake: Number(numbers[1]) % 24 };
      }
      return;
    }
    case 'single':
    case 'multi':
    case 'dish_picker': {
      const { head, detail } = splitDetail(text);
      const known = new Set((question.options ?? []).map((option) => option.code));
      const given = (codes ?? []).filter((code) => known.has(code));
      const chosen = given.length > 0 ? given : matchOptions(question.options ?? [], head).map((option) => option.code);
      if (chosen.length === 0) return;
      out[question.key] = question.kind === 'single' ? chosen[0]! : chosen;
      if (detail && question.followUp) out[question.followUp.key] = detail;
      return;
    }
  }
}

export function legacyToCanonical(
  track: TrackId,
  items: LegacyAnswer[],
): { track: TrackId; answers: CanonicalAnswers } {
  const answers: CanonicalAnswers = {};
  for (const item of items) {
    const question = findQuestion(item);
    if (question) applyLegacy(question, item.answer, answers, Array.isArray(item.codes) ? item.codes.filter((c) => typeof c === 'string') : undefined);
  }
  return { track, answers };
}

// ------------------------------------------------------------ canonical -> submission

const str = (value: AnswerValue | undefined): string =>
  typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '';
const num = (value: AnswerValue | undefined): number | undefined =>
  typeof value === 'number' ? value : typeof value === 'string' && value !== '' && Number.isFinite(Number(value)) ? Number(value) : undefined;
const list = (value: AnswerValue | undefined): string[] =>
  Array.isArray(value) ? value : typeof value === 'string' && value ? [value] : [];

function labelsOf(key: string, codes: string[]): string[] {
  const options = questionByKey(key)?.options ?? [];
  return codes.map((code) => options.find((option) => option.code === code)?.label ?? code);
}

const ACTIVITY_MAP: Record<string, string> = {
  very_low: 'sedentary',
  low: 'light',
  medium: 'moderate',
  high: 'high',
  very_high: 'high',
};

function sleepCode(value: AnswerValue | undefined): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '7_to_9';
  const hours = (((value.wake - value.sleep) % 24) + 24) % 24;
  if (hours < 5) return 'under_5';
  if (hours < 7) return '5_to_7';
  if (hours <= 9) return '7_to_9';
  return 'over_9';
}

function exerciseCode(days: string): string {
  const n = Number(days);
  if (!Number.isFinite(n) || n === 0) return 'none';
  if (n <= 2) return '1_2';
  if (n <= 4) return '3_4';
  return '5_plus';
}

const WATER_MAP: Record<string, string> = { under_4: 'under_4', '4_6': '4_to_6', '7_9': '7_to_9', '10_plus': '10_plus' };
const NURSING_FROM_MONTHS = (months: number) => (months < 6 ? 'under_6m' : months <= 12 ? '6_to_12m' : 'over_12m');
const PREVIOUS_DIET: Record<string, string> = { first: 'none', kept: 'kept', regained: 'regained', hard: 'hard' };

/**
 * Builds the object `validateSubmission` expects. The mapping is deterministic
 * and never invents clinical facts: a missing required answer stays missing and
 * validation reports it.
 */
export function canonicalToSubmission(track: TrackId, a: CanonicalAnswers): Record<string, unknown> {
  const pregnancyTrack = track === 'pregnancy';
  const lifeStage = pregnancyTrack ? str(a.life_stage) || 'pregnant' : 'none';
  const health = new Set<string>();
  const notes: string[] = [];

  for (const code of list(a.conditions)) {
    if (code === 'none') continue;
    health.add(code === 'other' ? 'other' : code);
  }
  const conditionsText = str(a.conditions_text);
  const labelled = labelsOf('conditions', list(a.conditions).filter((code) => code !== 'none'));
  if (labelled.length) notes.push(`شرایط پزشکی: ${labelled.join('، ')}${conditionsText ? ` (${conditionsText})` : ''}`);

  const allergyCodes = list(a.allergies).filter((code) => code !== 'none');
  let allergies = '';
  if (allergyCodes.length) {
    health.add('food_allergy');
    allergies = [...labelsOf('allergies', allergyCodes.filter((code) => code !== 'other')), str(a.allergies_text)]
      .filter(Boolean)
      .join('، ');
    if (!allergies) allergies = 'ذکر نشده';
  }

  const medsText = [str(a.medications_text), str(a.lactation_meds_text)].filter(Boolean).join('، ');
  const takesMeds = str(a.medications) === 'yes' || str(a.lactation_meds) === 'yes';
  if (takesMeds) health.add('medication');

  if (str(a.binge_history) === 'yes') health.add('eating_disorder');
  for (const code of list(a.preg_conditions)) {
    if (code === 'gestational_diabetes') health.add('gestational_diabetes');
    else if (code === 'preeclampsia') {
      health.add('hypertension');
      health.add('high_risk_pregnancy');
    } else if (code === 'thyroid') health.add('thyroid');
    else if (code === 'anemia' || code === 'other') health.add('other');
  }
  if (list(a.doctor_diet_advice).some((code) => code === 'blood_sugar')) health.add('diabetes');
  if (list(a.doctor_diet_advice).some((code) => code === 'blood_pressure')) health.add('hypertension');
  if (list(a.digestion).some((code) => code !== 'normal')) health.add('digestive');

  const adviceLabel = labelsOf('doctor_advice', [str(a.doctor_advice)].filter((code) => code && code !== 'no'));
  if (adviceLabel.length) notes.push(`توصیه پزشک: ${adviceLabel[0]}`);
  if (str(a.doctor_restrictions) === 'yes') notes.push(`محدودیت پزشک: ${str(a.doctor_restrictions_text)}`);
  if (list(a.preg_symptoms).some((code) => code !== 'none')) {
    notes.push(`علائم بارداری: ${labelsOf('preg_symptoms', list(a.preg_symptoms).filter((c) => c !== 'none')).join('، ')}`);
  }
  if (list(a.preg_conditions).some((code) => code !== 'none')) {
    notes.push(`شرایط بارداری: ${labelsOf('preg_conditions', list(a.preg_conditions).filter((c) => c !== 'none')).join('، ')}`);
  }
  if (str(a.baby_concern) && str(a.baby_concern) !== 'no') notes.push('نگرانی پزشکی دربارهٔ شیر یا رشد نوزاد مطرح شده است');
  if (str(a.doctor_diet_advice_text)) notes.push(`توصیه غذایی پزشک: ${str(a.doctor_diet_advice_text)}`);
  if (list(a.doctor_diet_advice).some((code) => code !== 'no')) {
    notes.push(`توصیه‌های پزشک: ${labelsOf('doctor_diet_advice', list(a.doctor_diet_advice).filter((c) => c !== 'no')).join('، ')}`);
  }

  if (health.size === 0) health.add('none');
  const needDetails = [...health].some((code) => code !== 'none');
  const healthDetails = needDetails ? notes.join(' | ') || 'مطابق پاسخ‌های پرسش‌نامه' : '';

  const mealsPerDay = str(a.meals_per_day);
  const challenges = list(a.loss_challenges);
  let mealPattern = mealsPerDay === '1' || mealsPerDay === '2' ? 'skipped' : 'regular';
  if (challenges.includes('snacking')) mealPattern = 'grazing';
  else if (str(a.hunger_time) === 'night') mealPattern = 'night';

  const diet = str(a.diet_style);
  const prep = str(a.prep_time);
  const target = num(a.target_weight_kg);

  const submission: Record<string, unknown> = {
    name: str(a.name),
    age: num(a.age),
    sex: str(a.sex),
    heightCm: num(a.height_cm),
    weightKg: num(a.weight_kg),
    goal: track === 'weight_loss' ? 'weight_loss' : track === 'weight_gain' ? 'weight_gain' : 'healthy_eating',
    lifeStage,
    health: [...health],
    healthDetails,
    allergies,
    medicines: takesMeds ? medsText || 'ذکر نشده' : '',
    previousDiet: track === 'weight_loss' ? PREVIOUS_DIET[str(a.previous_diet)] : 'none',
    activity: ACTIVITY_MAP[str(a.activity)],
    exercise: exerciseCode(str(a.exercise_days)),
    sleep: sleepCode(a.sleep_wake),
    mealPattern,
    water: str(a.water) ? WATER_MAP[str(a.water)] : '',
    preference: diet === 'vegan' ? 'vegan' : diet === 'vegetarian' ? 'vegetarian' : 'iranian',
    budget: str(a.budget),
    cooking: prep === 'more' ? 'flexible' : 'under_30',
    dislikes: str(a.dislikes),
  };
  if (track === 'weight_loss' || track === 'weight_gain') submission.targetWeightKg = target;
  if (pregnancyTrack && lifeStage === 'pregnant') {
    submission.pregnancyWeek = num(a.pregnancy_week);
    const babies = str(a.babies);
    submission.babies = babies === 'singleton' ? 'singleton' : babies ? 'multiple' : undefined;
  }
  if (pregnancyTrack && (lifeStage === 'pregnant' || lifeStage === 'breastfeeding')) {
    submission.prePregnancyWeightKg = num(a.pre_pregnancy_weight_kg);
  }
  if (pregnancyTrack && lifeStage === 'breastfeeding') {
    const months = num(a.months_postpartum);
    submission.nursingAge = months == null ? undefined : NURSING_FROM_MONTHS(months);
  }
  return submission;
}

/** Answers that have no column in the validated submission. Codes only, no free text. */
export function profilePreferences(track: TrackId, a: CanonicalAnswers): Record<string, unknown> {
  const keys = [
    'job_activity', 'exercise_duration', 'sport_type', 'meals_per_day', 'loss_pace', 'loss_challenges', 'hunger_time',
    'fast_food_freq', 'craving_level', 'gain_goal', 'appetite', 'gain_obstacle', 'unintended_loss', 'gain_sport',
    'big_meals', 'snack_readiness', 'feeding_mode', 'lactation_goal', 'lactation_energy', 'health_focus', 'fruit_veg',
    'digestion', 'sweets_freq', 'sleep_quality', 'diet_change', 'fav_dishes', 'bread_type', 'rice_frequency',
    'tea_sugar', 'region', 'ramadan', 'guest_meals', 'preg_supplements', 'age_approx',
  ];
  const out: Record<string, unknown> = { track };
  for (const key of keys) if (a[key] != null) out[key] = a[key];
  const sleep = a.sleep_wake;
  if (sleep && typeof sleep === 'object' && !Array.isArray(sleep)) out.sleep_wake = sleep;
  return out;
}
