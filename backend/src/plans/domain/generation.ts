import type { MinimizedModelInput } from '../../ai/minimize.js';
import type { MealOption } from '../options.js';

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

export class GenerationError extends Error {
  /** What the failed attempts already cost, so the day's spend stays honest. */
  usage?: { tokens: number; costMicros: number; model: string; provider?: string; attempts?: number };
  constructor(readonly code: string) { super(code); }
}

