export const SLA_MS = 24 * 60 * 60 * 1000;

const CLOSED = new Set(['published', 'cancelled']);

/** A request is overdue when it is still open after 24 hours with no specialist response. */
export function isOverdue(input: {
  status: string;
  createdAt: Date;
  now: Date;
  responded: boolean;
}): boolean {
  if (CLOSED.has(input.status) || input.responded) return false;
  return input.now.getTime() - input.createdAt.getTime() > SLA_MS;
}

export function medianMinutes(samples: readonly number[]): number | null {
  if (samples.length === 0) return null;
  const sorted = [...samples].sort((left, right) => left - right);
  const mid = Math.floor(sorted.length / 2);
  const upper = sorted[mid] ?? 0;
  if (sorted.length % 2 === 1) return upper;
  const lower = sorted[mid - 1] ?? upper;
  return (lower + upper) / 2;
}
