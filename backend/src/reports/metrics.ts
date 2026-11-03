export const RETENTION_WINDOWS = [
  { key: 'week1', days: 7 },
  { key: 'week2', days: 14 },
  { key: 'week4', days: 28 },
] as const;

export const RETENTION_EVENTS = {
  activity: 'بازگشت به برنامه بعد از روز شروع، بدون الزام ثبت وعده یا خرید',
  tracking: 'ثبت حداقل یک وعدهٔ خورده‌شده در همان پنجره',
  purchase: 'سفارش پرداخت‌شدهٔ بعدی در همان پنجره',
} as const;

export type RetentionEvent = keyof typeof RETENTION_EVENTS;
export type RetentionWindow = (typeof RETENTION_WINDOWS)[number]['key'];

export interface MeasuredCell {
  state: 'measured';
  count: number;
  denominator: number;
  percent: number;
}
export interface ClosedCell { state: 'not_yet_measurable' | 'no_denominator' }
export type RetentionCell = MeasuredCell | ClosedCell;

export function ageDays(start: string, asOf: string): number {
  const [startYear, startMonth, startDay] = start.split('-').map(Number);
  const [endYear, endMonth, endDay] = asOf.split('-').map(Number);
  const from = Date.UTC(startYear!, (startMonth ?? 1) - 1, startDay ?? 1);
  const to = Date.UTC(endYear!, (endMonth ?? 1) - 1, endDay ?? 1);
  return Math.round((to - from) / 86_400_000);
}

export function percent(count: number, denominator: number): number {
  return Math.round((100 * count) / denominator);
}

export function retentionCell(age: number, windowDays: number, count: number, size: number): RetentionCell {
  if (age < windowDays) return { state: 'not_yet_measurable' };
  if (size <= 0) return { state: 'no_denominator' };
  return { state: 'measured', count, denominator: size, percent: percent(count, size) };
}

/** Exact label after Unicode and space normalization. Short titles stay uncertain and are not folded into a longer name. */
export function foodKey(label: string): { key: string; uncertain: boolean } {
  const key = label.normalize('NFKC').replace(/\s+/g, ' ').trim().toLocaleLowerCase('fa');
  return { key, uncertain: key.length > 0 && key.length < 4 };
}

export interface RankedLabel { id: string; label: string; count: number; uncertain: boolean }

export function rankLabels(events: Array<{ id: string; label: string }>): RankedLabel[] {
  const grouped = new Map<string, RankedLabel>();
  for (const event of events) {
    const named = foodKey(event.label);
    if (!named.key) continue;
    const current = grouped.get(named.key) ?? { id: event.id, label: event.label.trim(), count: 0, uncertain: named.uncertain };
    current.count += 1;
    grouped.set(named.key, current);
  }
  return [...grouped.values()].sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, 'fa'));
}

export interface BoardRow {
  id: string;
  name: string;
  ratingCount: number;
  ratingAverage: number | null;
  smallSample: boolean;
  distribution: Array<{ star: number; count: number }>;
  messageResponse: number | null;
  messageSamples: number;
  changeResponse: number | null;
  changeResponseSamples: number;
  reviewTime: number | null;
  reviewSamples: number;
  pendingMessages: number;
  pendingChanges: number;
  pending: number;
}

export function average(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function sortBoard(rows: BoardRow[], sort: 'rating' | 'response' | 'workload'): BoardRow[] {
  const read = {
    rating: (row: BoardRow) => row.ratingAverage,
    response: (row: BoardRow) => row.messageResponse,
    workload: (row: BoardRow) => row.pending,
  }[sort];
  const direction = sort === 'response' ? 1 : -1;
  return [...rows].sort((left, right) => {
    const leftValue = read(left);
    const rightValue = read(right);
    if (leftValue == null && rightValue == null) return left.name.localeCompare(right.name, 'fa');
    if (leftValue == null) return 1;
    if (rightValue == null) return -1;
    return leftValue === rightValue ? left.name.localeCompare(right.name, 'fa') : (leftValue - rightValue) * direction;
  });
}
