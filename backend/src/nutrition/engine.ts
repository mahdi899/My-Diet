/**
 * Deterministic nutrition engine. Pure functions only.
 * The model never decides energy targets: it only composes food that meets them.
 */
export type Track = 'weight_loss' | 'weight_gain' | 'pregnancy' | 'detox';

export interface EngineInput {
  track: Track;
  sex: 'female' | 'male';
  age: number;
  heightCm: number;
  weightKg: number;
  targetWeightKg?: number | null;
  /** Codes of the stored submission: sedentary | light | moderate | high. */
  activity: string;
  /** none | 1_2 | 3_4 | 5_plus */
  exercise: string;
  lossPace?: 'slow' | 'balanced' | 'fast' | 'auto' | string | null;
  lifeStage?: string;
  pregnancyWeek?: number | null;
  babies?: string | null;
  monthsPostpartum?: number | null;
  lactationGoal?: string | null;
  mealsPerDay?: number | null;
  wakeHour?: number | null;
}

export interface EnergyPlan {
  bmi: number;
  bmiBand: 'underweight' | 'normal' | 'overweight' | 'obese';
  bmrKcal: number;
  tdeeKcal: number;
  targetKcal: number;
  floorKcal: number;
  weeklyChangeKg: number;
  etaWeeks: number | null;
  proteinG: number;
  carbsG: number;
  fatG: number;
  notes: string[];
}

const ACTIVITY_PAL: Record<string, number> = { sedentary: 1.2, light: 1.375, moderate: 1.55, high: 1.725 };
const EXERCISE_BONUS: Record<string, number> = { none: 0, '1_2': 0, '3_4': 0.04, '5_plus': 0.08 };
const PACE_KG_PER_WEEK: Record<string, number> = { slow: 0.25, balanced: 0.5, fast: 0.75, auto: 0.5 };

export function bmiOf(weightKg: number, heightCm: number): number {
  return Math.round((weightKg / (heightCm / 100) ** 2) * 10) / 10;
}

export function bmiBand(bmi: number): EnergyPlan['bmiBand'] {
  if (bmi < 18.5) return 'underweight';
  if (bmi < 25) return 'normal';
  if (bmi < 30) return 'overweight';
  return 'obese';
}

/** Mifflin-St Jeor. */
export function bmr(input: Pick<EngineInput, 'sex' | 'age' | 'heightCm' | 'weightKg'>): number {
  const base = 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.age;
  return Math.round(base + (input.sex === 'male' ? 5 : -161));
}

export function palOf(activity: string, exercise: string): number {
  const pal = (ACTIVITY_PAL[activity] ?? 1.375) + (EXERCISE_BONUS[exercise] ?? 0);
  return Math.min(1.9, Math.round(pal * 1000) / 1000);
}

function trimester(week: number): 1 | 2 | 3 {
  if (week < 14) return 1;
  if (week < 28) return 2;
  return 3;
}

const round5 = (value: number) => Math.round(value / 5) * 5;

export function planEnergy(input: EngineInput): EnergyPlan {
  const notes: string[] = [];
  const bmi = bmiOf(input.weightKg, input.heightCm);
  const base = bmr(input);
  const tdee = Math.round(base * palOf(input.activity, input.exercise));
  const floor = input.sex === 'male' ? 1500 : 1200;
  let target = tdee;
  let weekly = 0;

  switch (input.track) {
    case 'weight_loss': {
      const pace = PACE_KG_PER_WEEK[String(input.lossPace ?? 'auto')] ?? 0.5;
      // Never faster than 1 % of body weight per week.
      const rate = Math.min(pace, input.weightKg * 0.01);
      let deficit = Math.round(rate * 1100);
      deficit = Math.min(deficit, Math.round(tdee * 0.25));
      target = tdee - deficit;
      weekly = -Math.round(((deficit * 7) / 7700) * 100) / 100;
      if (bmi < 18.5) {
        target = tdee;
        weekly = 0;
        notes.push('bmi_underweight_no_deficit');
      }
      break;
    }
    case 'weight_gain': {
      const surplus = 400;
      target = tdee + surplus;
      weekly = Math.round(((surplus * 7) / 7700) * 100) / 100;
      break;
    }
    case 'pregnancy': {
      if (input.lifeStage === 'breastfeeding') {
        const months = input.monthsPostpartum ?? 3;
        target = tdee + (months < 6 ? 500 : 400);
        if (input.lactationGoal === 'gradual_loss') {
          target -= 250;
          weekly = -0.2;
          notes.push('lactation_slow_loss_only');
        } else if (input.lactationGoal === 'more_energy') target += 100;
      } else {
        const week = input.pregnancyWeek ?? 12;
        const t = trimester(week);
        target = tdee + (t === 1 ? 0 : t === 2 ? 340 : 450);
        if (input.babies && input.babies !== 'singleton' && t >= 2) target += 200;
        weekly = t === 1 ? 0.05 : 0.4;
      }
      break;
    }
    case 'detox':
      break;
  }

  const hardFloor = input.track === 'pregnancy' ? 1800 : floor;
  if (target < hardFloor) {
    target = hardFloor;
    notes.push('calorie_floor_applied');
  }
  target = round5(target);

  const proteinPerKg = { weight_loss: 1.5, weight_gain: 1.7, pregnancy: 1.2, detox: 1.1 }[input.track];
  let proteinG = Math.round(input.weightKg * proteinPerKg);
  proteinG = Math.min(proteinG, Math.round((target * 0.3) / 4));
  const fatKcal = target * (input.track === 'weight_loss' ? 0.27 : 0.3);
  const fatG = Math.round(fatKcal / 9);
  const carbsG = Math.max(
    input.track === 'pregnancy' ? 175 : 100,
    Math.round((target - proteinG * 4 - fatG * 9) / 4),
  );

  let etaWeeks: number | null = null;
  if (input.targetWeightKg && weekly !== 0) {
    const diff = input.targetWeightKg - input.weightKg;
    if (Math.sign(diff) === Math.sign(weekly)) etaWeeks = Math.max(1, Math.ceil(Math.abs(diff / weekly)));
  }

  return {
    bmi,
    bmiBand: bmiBand(bmi),
    bmrKcal: base,
    tdeeKcal: tdee,
    targetKcal: target,
    floorKcal: hardFloor,
    weeklyChangeKg: weekly,
    etaWeeks,
    proteinG,
    carbsG,
    fatG,
    notes,
  };
}

export interface MealSlot {
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  suggestedTime: string;
  kcal: number;
}

const hhmm = (hour: number, minute = 0) =>
  `${String(Math.floor(hour) % 24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

/** Splits a day target into the slots the plan format accepts. Always sums to the target. */
export function mealSlots(targetKcal: number, mealsPerDay: number | null | undefined, wakeHour: number | null | undefined): MealSlot[] {
  const wake = wakeHour == null ? 7 : wakeHour;
  const breakfastHour = Math.min(10, Math.max(7, wake + 1));
  const shape: Array<[MealSlot['mealType'], number, string]> =
    (mealsPerDay ?? 3) <= 2
      ? [
          ['breakfast', 0.35, hhmm(breakfastHour, 30)],
          ['lunch', 0.65, '14:00'],
        ]
      : (mealsPerDay ?? 3) >= 4
        ? [
            ['breakfast', 0.25, hhmm(breakfastHour)],
            ['lunch', 0.3, '13:00'],
            ['snack', 0.15, '16:30'],
            ['dinner', 0.3, '20:00'],
          ]
        : [
            ['breakfast', 0.28, hhmm(breakfastHour)],
            ['lunch', 0.37, '13:30'],
            ['snack', 0.1, '17:00'],
            ['dinner', 0.25, '20:00'],
          ];
  const slots = shape.map(([mealType, share, suggestedTime]) => ({
    mealType,
    suggestedTime,
    kcal: round5(targetKcal * share),
  }));
  const drift = targetKcal - slots.reduce((sum, slot) => sum + slot.kcal, 0);
  slots[slots.length - 1]!.kcal += drift;
  return slots;
}

export interface SafetyInput {
  track: Track;
  bmi: number;
  health: string[];
  riskFlags: string[];
  targetWeightKg?: number | null;
  heightCm: number;
}

export interface SafetyResult {
  tier: 'ai_ok' | 'doctor_only';
  reasons: string[];
  flags: string[];
}

const DOCTOR_ONLY_FLAGS = ['eating_disorder_history', 'high_risk_pregnancy', 'kidney', 'underweight_loss', 'diabetes_on_medication', 'target_bmi_low', 'unintentional_weight_loss'];

export function assessSafety(input: SafetyInput): SafetyResult {
  const flags = new Set(input.riskFlags);
  if (input.health.includes('unintentional_weight_loss')) flags.add('unintentional_weight_loss');
  if (input.track === 'weight_loss' && input.bmi < 18.5) flags.add('underweight_loss');
  if (input.health.includes('diabetes') && input.health.includes('medication')) flags.add('diabetes_on_medication');
  if (input.track === 'weight_loss' && input.targetWeightKg && bmiOf(input.targetWeightKg, input.heightCm) < 18.5) {
    flags.add('target_bmi_low');
  }
  const reasons = [...flags].filter((flag) => DOCTOR_ONLY_FLAGS.includes(flag));
  return { tier: reasons.length ? 'doctor_only' : 'ai_ok', reasons, flags: [...flags] };
}
