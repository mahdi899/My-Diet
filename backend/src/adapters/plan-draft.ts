export const PLAN_DRAFT_PROVIDER = Symbol('PLAN_DRAFT_PROVIDER');

export interface PlanDraftProvider {
  readonly name: string;
  readonly callsExternalNetwork: boolean;
}

export class FakePlanDraftProvider implements PlanDraftProvider {
  readonly name = 'fake';
  readonly callsExternalNetwork = false;
}

export class UnavailablePlanDraftProvider implements PlanDraftProvider {
  readonly name = 'openai';
  readonly callsExternalNetwork = true;
}
