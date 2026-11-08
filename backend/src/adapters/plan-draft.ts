import type { MinimizedModelInput } from '../ai/minimize.js';
import type { MealOption } from '../plans/options.js';

export const PLAN_DRAFT_PROVIDER = Symbol('PLAN_DRAFT_PROVIDER');

export interface MealItemDraft {
  name: string;
  quantity: number | null;
  unit: string | null;
}

export interface MealDraft {
  options?: MealOption[];
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

/** What the generation layer learned besides the meals. Stored with the generation for the doctor and the admin. */
export interface DraftNotes {
  poolCode: string;
  promptVersions: Record<string, number | string>;
  attemptChain: Array<{ provider: string; model: string; outcome: string; costMicros: number; chunk: string | null }>;
  warnings: Array<{ code: string; message: string; day?: number; mealType?: string }>;
  critic: { verdict: 'ok' | 'concerns' | 'unavailable'; issues: Array<{ severity: 'info' | 'warn' | 'block'; text: string }> } | null;
  dayTotals: Array<{ kcal: number; proteinG: number; carbsG: number; fatG: number }>;
}

export interface PlanDraft {
  days: Array<{ meals: MealDraft[] }>;
  provider?: string;
  usage?: DraftUsage;
  notes?: DraftNotes;
}

export type PlanDraftInput = MinimizedModelInput & {
  /** Plan request id, used to attribute ledger rows. Never sent to a model. */
  requestId?: string;
};

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
