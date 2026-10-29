export const PLAN_DRAFT_PROVIDER = Symbol('PLAN_DRAFT_PROVIDER');

export interface MealItemDraft {
  name: string;
  quantity: number | null;
  unit: string | null;
}

export interface MealDraft {
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  suggestedTime: string;
  title: string;
  calories: number;
  notes: string;
  items: MealItemDraft[];
}

export interface PlanDraft {
  days: Array<{ meals: MealDraft[] }>;
}

export interface PlanDraftInput {
  goal: string;
  flags: string[];
}

export interface PlanDraftProvider {
  readonly name: string;
  readonly callsExternalNetwork: boolean;
  draft(input: PlanDraftInput): Promise<PlanDraft>;
}

const DAY: MealDraft[] = [
  {
    mealType: 'breakfast',
    suggestedTime: '08:00',
    title: 'صبحانه',
    calories: 420,
    notes: '',
    items: [{ name: 'نان و پنیر', quantity: 1, unit: 'وعده' }],
  },
  {
    mealType: 'lunch',
    suggestedTime: '13:00',
    title: 'ناهار',
    calories: 620,
    notes: '',
    items: [{ name: 'برنج و خورش', quantity: 1, unit: 'وعده' }],
  },
  {
    mealType: 'snack',
    suggestedTime: '16:30',
    title: 'میان‌وعده',
    calories: 180,
    notes: '',
    items: [{ name: 'میوه', quantity: 1, unit: 'عدد' }],
  },
  {
    mealType: 'dinner',
    suggestedTime: '20:00',
    title: 'شام',
    calories: 480,
    notes: '',
    items: [{ name: 'خوراک مرغ', quantity: 1, unit: 'وعده' }],
  },
];

export class FakePlanDraftProvider implements PlanDraftProvider {
  readonly name = 'fake';
  readonly callsExternalNetwork = false;

  async draft(_input: PlanDraftInput): Promise<PlanDraft> {
    return { days: Array.from({ length: 7 }, () => ({ meals: DAY.map((meal) => ({ ...meal, items: meal.items.map((item) => ({ ...item })) })) })) };
  }
}

export class UnavailablePlanDraftProvider implements PlanDraftProvider {
  readonly name = 'openai';
  readonly callsExternalNetwork = true;

  async draft(): Promise<PlanDraft> {
    throw new Error('AI provider adapter is not available in this build');
  }
}
