/** Iran has not observed daylight saving since 2022, so the civil date is UTC+03:30. */
const TEHRAN_OFFSET_MS = (3 * 60 + 30) * 60 * 1000;

export function civilNow(): Date {
  if (process.env.NODE_ENV === 'test' && process.env.SABZINE_NOW) {
    return new Date(process.env.SABZINE_NOW);
  }
  return new Date();
}

export function tehranToday(instant = civilNow()): string {
  return new Date(instant.getTime() + TEHRAN_OFFSET_MS).toISOString().slice(0, 10);
}

/** UTC instant of 00:00 on the Tehran civil date that contains `instant`. */
export function tehranDayStartUtc(instant = civilNow()): Date {
  const [year, month, day] = tehranToday(instant).split('-').map(Number);
  return new Date(Date.UTC(year!, (month ?? 1) - 1, day ?? 1) - TEHRAN_OFFSET_MS);
}

export function addCivilDays(civilDate: string, days: number): string {
  const [year, month, day] = civilDate.split('-').map(Number);
  const utc = new Date(Date.UTC(year!, (month ?? 1) - 1, day ?? 1, 12));
  utc.setUTCDate(utc.getUTCDate() + days);
  return utc.toISOString().slice(0, 10);
}

/** Saturday is the first day of a Sabzine week. `civilDate` is YYYY-MM-DD in Asia/Tehran. */
export function weekStartSaturday(civilDate: string): string {
  const [year, month, day] = civilDate.split('-').map(Number);
  const utc = new Date(Date.UTC(year!, (month ?? 1) - 1, day ?? 1, 12));
  const sinceSaturday = (utc.getUTCDay() + 1) % 7;
  return addCivilDays(civilDate, -sinceSaturday);
}

export function fridayOfWeek(weekStart: string): string {
  return addCivilDays(weekStart, 6);
}

/** Consecutive rewarded weeks, alive only when the latest reward is this week or the previous one. */
export function streakLength(weekStarts: readonly string[], today: string): number {
  const unique = [...new Set(weekStarts)].sort();
  if (unique.length === 0) return 0;
  const current = weekStartSaturday(today);
  const previous = addCivilDays(current, -7);
  let cursor = unique[unique.length - 1]!;
  if (cursor !== current && cursor !== previous) return 0;
  const have = new Set(unique);
  let count = 0;
  while (have.has(cursor)) {
    count += 1;
    cursor = addCivilDays(cursor, -7);
  }
  return count;
}
