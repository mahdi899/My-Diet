import { civilNow } from '../common/time.js';

const TEHRAN_OFFSET_MS = (3 * 60 + 30) * 60 * 1000;
const LATE_MINUTE = 23 * 60 + 50;
const BULK_WINDOW_MS = 2 * 60 * 1000;

export function tehranMinutes(instant: Date): number {
  const shifted = new Date(instant.getTime() + TEHRAN_OFFSET_MS);
  return shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
}

/** Every meal of the day ticked inside two minutes at or after 23:50 Tehran. */
export function isLateBulkLog(input: {
  now?: Date;
  mealCount: number;
  allEaten: boolean;
  firstLoggedAt: Date;
  lastLoggedAt: Date;
}): boolean {
  if (!input.allEaten || input.mealCount < 2) return false;
  const now = input.now ?? civilNow();
  if (tehranMinutes(now) < LATE_MINUTE) return false;
  return input.lastLoggedAt.getTime() - input.firstLoggedAt.getTime() <= BULK_WINDOW_MS;
}
