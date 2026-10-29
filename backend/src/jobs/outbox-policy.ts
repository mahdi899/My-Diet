export const OUTBOX_MAX_ATTEMPTS = 10;

/** An outbox row is dead when delivery stopped and it was never handed off. */
export function isDeadLetter(attempts: number, dispatched: boolean): boolean {
  return !dispatched && attempts >= OUTBOX_MAX_ATTEMPTS;
}
