import { minutesOf } from './clock.js';
import type { MealType } from './types.js';

export interface ProactiveMeal {
  mealUid: string;
  mealType: MealType;
  title: string;
  suggestedTime: string | null;
  state: string;
}

export interface ProactivePlanInput {
  quiet: boolean;
  hour: number;
  minutes: number;
  /** 0 = Sunday … 5 = Friday, 6 = Saturday. Asia/Tehran. */
  weekday: number;
  /** Nags and milestones already delivered today. Weekly review and promised follow-ups are not counted. */
  sentToday: number;
  dailyMax: number;
  /** Silent for several days: skip reminders, keep the weekly review and milestones. */
  backedOff: boolean;
  /** A reminder already went out in the last few hours. */
  recentNag: boolean;
  dayBriefSent: boolean;
  weeklySent: boolean;
  meals: ProactiveMeal[];
  reminded: string[];
  missedSent: string[];
  dueStepNote: string | null;
  streak: number;
  streakMilestonesSent: number[];
  /** Whole kilograms lost since onboarding. 0 when unknown or not a loss. */
  lossKg: number;
  lossMilestonesSent: number[];
}

export type ProactiveIntent =
  | { kind: 'next_step'; note: string }
  | { kind: 'day_brief' }
  | { kind: 'meal_reminder'; mealUid: string; title: string; mealType: MealType; suggestedTime: string }
  | { kind: 'missed_meal'; mealUid: string; title: string; mealType: MealType }
  | { kind: 'weekly_review' }
  | { kind: 'milestone'; key: string; milestone: 'streak' | 'loss'; value: number };

const STREAKS = [3, 7, 14, 21, 30];

/**
 * Which proactive messages to try, highest priority first, already clipped by the daily budget and backoff.
 * Promised follow-ups (`next_step`) ignore the budget. The weekly review is not crowded out by earlier nags.
 * Pure: the service decides what is already sent and performs the writes.
 */
export function planProactive(input: ProactivePlanInput): ProactiveIntent[] {
  if (input.quiet) return [];
  const intents: ProactiveIntent[] = [];
  if (input.dueStepNote) intents.push({ kind: 'next_step', note: input.dueStepNote });
  if (input.dailyMax <= 0) return intents;

  const candidates: ProactiveIntent[] = [];
  if (!input.dayBriefSent && input.hour >= 7 && input.hour < 10) candidates.push({ kind: 'day_brief' });
  for (const meal of input.meals) {
    if (meal.state !== 'unrecorded' || !meal.suggestedTime) continue;
    const at = minutesOf(meal.suggestedTime);
    if (at == null) continue;
    const until = at - input.minutes;
    if (until >= 0 && until <= 25 && !input.reminded.includes(meal.mealUid)) {
      candidates.push({
        kind: 'meal_reminder', mealUid: meal.mealUid, title: meal.title, mealType: meal.mealType, suggestedTime: meal.suggestedTime,
      });
    }
    const late = input.minutes - at;
    if (late >= 90 && late <= 180 && !input.missedSent.includes(meal.mealUid)) {
      candidates.push({ kind: 'missed_meal', mealUid: meal.mealUid, title: meal.title, mealType: meal.mealType });
    }
  }
  const weeklyWindow = (input.weekday === 5 && input.hour >= 18) || (input.weekday === 6 && input.hour >= 9 && input.hour < 12);
  if (weeklyWindow && !input.weeklySent) candidates.push({ kind: 'weekly_review' });
  for (const days of STREAKS) {
    if (input.streak >= days && !input.streakMilestonesSent.includes(days)) {
      candidates.push({ kind: 'milestone', key: `streak:${days}`, milestone: 'streak', value: days });
      break;
    }
  }
  const loss = Math.min(30, Math.floor(input.lossKg));
  for (let kg = 1; kg <= loss; kg += 1) {
    if (!input.lossMilestonesSent.includes(kg)) {
      candidates.push({ kind: 'milestone', key: `loss:${kg}`, milestone: 'loss', value: kg });
      break;
    }
  }

  let room = Math.max(0, input.dailyMax - input.sentToday);
  for (const candidate of candidates) {
    const nag = candidate.kind === 'day_brief' || candidate.kind === 'meal_reminder' || candidate.kind === 'missed_meal';
    if (nag && (input.backedOff || input.recentNag)) continue;
    if (candidate.kind !== 'weekly_review') {
      if (room <= 0) continue;
      room -= 1;
    }
    intents.push(candidate);
  }
  return intents;
}
