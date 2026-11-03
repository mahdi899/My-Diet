export interface DatedVersion {
  versionId: string;
  requestId: string;
  status: 'published' | 'superseded';
  publishedAt: string;
  publishedOn: string;
  civilDate: string;
  dayIndex: number;
}

const CIVIL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A real `YYYY-MM-DD`. Invalid calendar days are rejected. */
export function parseCivilDate(value: string): string | null {
  const match = CIVIL_DATE.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (utc.getUTCFullYear() !== year || utc.getUTCMonth() !== month - 1 || utc.getUTCDate() !== day) return null;
  return value;
}

/**
 * The version a civil date shows.
 * A revision published later in the week does not replace earlier days.
 */
export function versionForDate(rows: DatedVersion[], date: string): DatedVersion | null {
  const covering = rows.filter((row) => row.civilDate === date && row.publishedOn <= date);
  if (covering.length === 0) return null;
  return covering.reduce((best, row) => (
    row.publishedAt > best.publishedAt || (row.publishedAt===best.publishedAt && row.versionId>best.versionId) ? row : best
  ));
}
