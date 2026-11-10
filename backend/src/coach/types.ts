export const CARD_TYPES = [
  'text',
  'quick_replies',
  'meal_card',
  'plan_meal',
  'calorie_ring',
  'weigh_in',
  'water',
  'day_brief',
  'weekly_review',
  'milestone',
  'user_photo',
  'system_note',
] as const;
export type CardType = (typeof CARD_TYPES)[number];

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export const MEAL_TYPES: readonly MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export type Json = Record<string, unknown>;

/** A card ready to be stored as one thread message. */
export interface CardSpec {
  type: CardType;
  payload: Json;
  /** Plain Persian text for clients that cannot render the card, push previews and LLM history. */
  fallbackText: string;
}

export interface CoachMessage {
  id: string;
  seq: number;
  role: 'user' | 'assistant' | 'system';
  type: CardType;
  payload: Json;
  fallbackText: string;
  clientMessageId: string | null;
  replyTo: string | null;
  createdAt: string;
}

export interface MacroTotals {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface EntryItem {
  name: string;
  slug: string | null;
  servings: number;
  servingLabel: string | null;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  /** True when the numbers are the model's rough estimate (food not in the catalogue). */
  estimated: boolean;
}

export interface CoachProfile {
  userId: string;
  track: 'weight_loss' | 'weight_gain' | 'pregnancy' | 'detox';
  goal: string;
  sex: 'female' | 'male';
  age: number;
  heightCm: number;
  weightKg: number;
  targetWeightKg: number | null;
  activity: string;
  bmi: number;
  tdeeKcal: number;
  targetKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  dietStyle: string;
  mealsPerDay: number | null;
  allergens: string[];
  conditions: string[];
  riskFlags: string[];
  safetyTier: 'ai_ok' | 'doctor_only';
  consented: boolean;
  preferences: Record<string, unknown>;
  displayName: string | null;
}

export interface MemoryItem {
  id: string;
  kind: string;
  content: string;
  importance: number;
}

export interface PlanMealView {
  mealUid: string;
  mealType: MealType;
  title: string;
  suggestedTime: string | null;
  plannedKcal: number | null;
  state: string;
  consumedKcal: number | null;
  selectedOptionId: string | null;
  consumptionRevision: number;
  selectionRevision: number;
  options: Array<{ optionId: string; kind: string; title: string; kcal: number | null; portion: unknown }>;
}

export interface TodaySummary {
  date: string;
  hasProfile: boolean;
  calories: {
    target: number;
    consumed: number;
    remaining: number;
    percent: number;
    /** True when at least one planned meal has no known calories (e.g. «different» food without a coach entry). */
    partial: boolean;
  };
  macros: {
    proteinG: { consumed: number; target: number };
    carbsG: { consumed: number; target: number };
    fatG: { consumed: number; target: number };
    /** Macros only exist for foods logged through the coach; plan meals carry calories only. */
    partial: boolean;
  };
  water: { ml: number; targetMl: number };
  weight: {
    latestKg: number | null;
    latestDate: string | null;
    deltaKg7d: number | null;
    targetKg: number | null;
    series: Array<{ date: string; kilograms: number }>;
  };
  streakDays: number;
  nextMeal: { mealUid: string; mealType: MealType; title: string; suggestedTime: string | null; plannedKcal: number | null } | null;
  planMeals: Array<{ mealUid: string; mealType: MealType; title: string; suggestedTime: string | null; plannedKcal: number | null; state: string }>;
}

/** Server-sent event names of POST /v1/me/coach/messages. */
export type SseEvent =
  | { event: 'user_message'; data: { message: CoachMessage } }
  | { event: 'delta'; data: { segment: number; text: string } }
  | { event: 'tool'; data: { name: string; status: 'running' | 'done' | 'failed' } }
  | { event: 'message'; data: { message: CoachMessage; segment?: number } }
  | { event: 'done'; data: Json }
  | { event: 'error'; data: { code: string; messageFa: string; retryable: boolean } };

export class CoachError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly messageFa: string,
    readonly retryable = false,
  ) {
    super(code);
  }
}
