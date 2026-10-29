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

export interface DraftUsage {
  model: string;
  promptVersion: string;
  tokens: number;
  costMicros: number;
}

export interface PlanDraft {
  days: Array<{ meals: MealDraft[] }>;
  provider?: string;
  usage?: DraftUsage;
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
      return {
        provider: this.name,
        usage: { model: 'fake', promptVersion: 'v1', tokens: 12, costMicros: 1000 },
        days: Array.from({ length: 7 }, () => ({ meals: DAY.map((meal) => ({ ...meal, items: meal.items.map((item) => ({ ...item })) })) })),
      };
  }
}

/** Tries the primary drafter, then the secondary one. The recorded provider is the one that returned a draft. */
export class FailoverPlanDraftProvider implements PlanDraftProvider {
  readonly name: string;
  readonly callsExternalNetwork: boolean;

  constructor(
    private readonly primary: PlanDraftProvider,
    private readonly secondary: PlanDraftProvider,
  ) {
    this.name = primary.name;
    this.callsExternalNetwork = primary.callsExternalNetwork || secondary.callsExternalNetwork;
  }

  async draft(input: PlanDraftInput): Promise<PlanDraft> {
    try {
      return await this.primary.draft(input);
    } catch (error) {
      if (this.secondary === this.primary) throw error;
      const draft = await this.secondary.draft(input);
      return { ...draft, provider: this.secondary.name };
    }
  }
}

export class UnavailablePlanDraftProvider implements PlanDraftProvider {
  readonly name = 'openai';
  readonly callsExternalNetwork = true;

  async draft(): Promise<PlanDraft> {
    throw new Error('AI provider adapter is not available in this build');
  }
}
