import { civilNow } from '../common/time.js';

/** HH:MM and weekday (0 = Sunday) in Asia/Tehran. */
export function tehranClock(now = civilNow()): { hhmm: string; minutes: number; weekday: number; date: string } {
  const shifted = new Date(now.getTime() + (3 * 60 + 30) * 60 * 1000);
  const hours = shifted.getUTCHours();
  const minutes = shifted.getUTCMinutes();
  return {
    hhmm: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
    minutes: hours * 60 + minutes,
    weekday: shifted.getUTCDay(),
    date: shifted.toISOString().slice(0, 10),
  };
}

export const minutesOf = (hhmm: string | null | undefined): number | null => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm ?? '');
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
};
