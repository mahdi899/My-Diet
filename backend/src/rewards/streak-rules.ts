import { addCivilDays } from '../common/time.js';

export type DayState = 'pending' | 'pending_verification' | 'qualified' | 'missed' | 'rewarded';
export interface Milestone { day: number; amountToman: number }
export interface CampaignRules {
  version: number;
  consecutiveDays: number;
  milestones: Milestone[];
  startsOn: string;
  endsOn: string | null;
  effectiveOn: string;
  repeat: 'cycle' | 'none';
}

export const STREAK_RESET_RULE = 'اگر یک روز وعده‌ها ثبت نشود، شمارش روزهای پیاپی از نو شروع می‌شود. ورود به برنامه یک روز را کامل نمی‌کند.';
export const STREAK_TODAY_RULE = 'امروز همهٔ وعده‌های برنامهٔ فعال باید ثبت شده باشند. رد کردن یا نانوشته ماندن وعده روز را کامل نمی‌کند.';

export function diffCivilDays(later: string, earlier: string): number {
  const [year, month, day] = later.split('-').map(Number);
  const [startYear, startMonth, startDay] = earlier.split('-').map(Number);
  const end = Date.UTC(year!, (month ?? 1) - 1, day ?? 1);
  const start = Date.UTC(startYear!, (startMonth ?? 1) - 1, startDay ?? 1);
  return Math.round((end - start) / 86_400_000);
}

export function cycleStartFor(startsOn: string, length: number, today: string): string | null {
  const elapsed = diffCivilDays(today, startsOn);
  if (elapsed < 0) return null;
  return addCivilDays(startsOn, Math.floor(elapsed / length) * length);
}

export function projectCycle(input: {
  rules: CampaignRules;
  cycleStart: string;
  today: string;
  qualified: ReadonlySet<string>;
  partial: ReadonlySet<string>;
  grantedDays: ReadonlySet<number>;
}): { days: Array<{ date: string; state: DayState }>; consecutive: number } {
  const { rules, cycleStart, today } = input;
  if (rules.repeat === 'none' && diffCivilDays(cycleStart, rules.startsOn) > 0) {
    return { days: [], consecutive: 0 };
  }
  const days: Array<{ date: string; state: DayState }> = [];
  let consecutive = 0;
  for (let index = 0; index < rules.consecutiveDays; index += 1) {
    const date = addCivilDays(cycleStart, index);
    if (date < rules.effectiveOn || (rules.endsOn != null && date > rules.endsOn) || date > today) {
      days.push({ date, state: 'pending' });
      continue;
    }
    if (input.qualified.has(date)) {
      consecutive += 1;
      days.push({ date, state: 'qualified' });
      continue;
    }
    if (date === today && input.partial.has(date)) {
      days.push({ date, state: 'pending_verification' });
      continue;
    }
    if (date < today) {
      consecutive = 0;
      days.push({ date, state: 'missed' });
      continue;
    }
    days.push({ date, state: 'pending' });
  }
  for (const day of input.grantedDays) {
    const slot = days[day - 1];
    if (slot?.state === 'qualified') slot.state = 'rewarded';
  }
  return { days, consecutive };
}

export function recordedMeal(log: { eaten: boolean; state?: string | null }): boolean {
  if (log.state === 'skipped' || log.state === 'unrecorded') return false;
  if (log.state === 'as_planned' || log.state === 'less' || log.state === 'more' || log.state === 'different') return true;
  return log.eaten && (log.state == null || log.state === '');
}
