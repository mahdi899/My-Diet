export const PROMPT_VERSION = 'v1';

export type ManualDraftReason = 'kill_switch' | 'cost_cap';

/** The model is not called when the switch is on, or when today's spend has reached the cap. */
export function manualDraftReason(input: {
  killSwitch: boolean;
  spentMicros: number;
  capMicros: number | null;
}): ManualDraftReason | null {
  if (input.killSwitch) return 'kill_switch';
  if (input.capMicros != null && input.spentMicros >= input.capMicros) return 'cost_cap';
  return null;
}

export function usageCount(value: number | undefined): number {
  if (value == null || !Number.isSafeInteger(value) || value < 0) return 0;
  return value;
}
