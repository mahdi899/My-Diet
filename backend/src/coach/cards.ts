import { faNumber, round0, round1 } from './text.js';
import type { CardSpec, EntryItem, Json, MacroTotals, MealType, TodaySummary } from './types.js';

export const MEAL_LABEL: Record<MealType, string> = {
  breakfast: 'صبحانه',
  lunch: 'ناهار',
  dinner: 'شام',
  snack: 'میان‌وعده',
};

export function totalsOf(items: EntryItem[]): MacroTotals {
  return {
    kcal: round0(items.reduce((sum, item) => sum + item.kcal, 0)),
    proteinG: round1(items.reduce((sum, item) => sum + item.proteinG, 0)),
    carbsG: round1(items.reduce((sum, item) => sum + item.carbsG, 0)),
    fatG: round1(items.reduce((sum, item) => sum + item.fatG, 0)),
  };
}

export interface QuickReply {
  id: string;
  label: string;
  /** Present for replies the server executes without a model: send it to POST /actions. */
  action?: string;
  args?: Json;
}

/** Quick reply that is simply sent back as text to the coach. */
export const textReply = (id: string, label: string): QuickReply => ({ id, label });
/** Quick reply handled by POST /v1/me/coach/actions (no model call). */
export const actionReply = (id: string, label: string, action: string, args: Json = {}): QuickReply => ({ id, label, action, args });

export const Cards = {
  text(text: string, extra: Json = {}): CardSpec {
    return { type: 'text', payload: { text, ...extra }, fallbackText: text };
  },

  quickReplies(replies: QuickReply[]): CardSpec {
    const list = replies.slice(0, 4).map((reply) => ({
      id: reply.id,
      label: reply.label.slice(0, 40),
      ...(reply.action ? { action: reply.action, args: reply.args ?? {} } : {}),
    }));
    return { type: 'quick_replies', payload: { replies: list }, fallbackText: list.map((reply) => reply.label).join(' | ') };
  },

  mealCard(input: {
    entryId: string;
    title: string;
    mealType: MealType;
    source: 'photo' | 'suggestion' | 'manual';
    status: 'suggested' | 'logged';
    items: EntryItem[];
    confidence: number | null;
    mediaId?: string | null;
    photoHint?: string[];
    note?: string;
    planMealUid?: string | null;
    remainingKcal?: number | null;
  }): CardSpec {
    const totals = totalsOf(input.items);
    const logged = input.status === 'logged';
    return {
      type: 'meal_card',
      payload: {
        entryId: input.entryId,
        title: input.title,
        mealType: input.mealType,
        source: input.source,
        status: input.status,
        items: input.items,
        totals,
        confidence: input.confidence,
        photoUrl: input.mediaId ? `/v1/me/coach/media/${input.mediaId}` : null,
        mediaId: input.mediaId ?? null,
        photoHint: input.photoHint ?? [],
        note: input.note ?? '',
        planMealUid: input.planMealUid ?? null,
        remainingKcal: input.remainingKcal ?? null,
        actions: logged ? [] : ['confirm', 'edit'],
      },
      fallbackText: `${MEAL_LABEL[input.mealType]}: ${input.title} — حدود ${faNumber(totals.kcal)} کالری${logged ? ' (ثبت شد)' : ''}`,
    };
  },

  planMeal(input: {
    date: string;
    versionId: string | null;
    meal: {
      mealUid: string;
      mealType: MealType;
      title: string;
      suggestedTime: string | null;
      plannedKcal: number | null;
      state: string;
      consumedKcal: number | null;
      selectedOptionId: string | null;
      consumptionRevision: number;
      selectionRevision: number;
      options: Array<{ optionId: string; kind: string; title: string; kcal: number | null; portion: unknown }>;
    };
    proposal?: Json | null;
  }): CardSpec {
    const { meal } = input;
    const selected = meal.options.find((option) => option.optionId === meal.selectedOptionId) ?? meal.options[0] ?? null;
    return {
      type: 'plan_meal',
      payload: {
        date: input.date,
        versionId: input.versionId,
        mealUid: meal.mealUid,
        mealType: meal.mealType,
        title: selected?.title ?? meal.title,
        suggestedTime: meal.suggestedTime,
        plannedKcal: meal.plannedKcal,
        state: meal.state,
        consumedKcal: meal.consumedKcal,
        selectedOption: selected,
        options: meal.options,
        proposal: input.proposal ?? null,
        actions: input.proposal ? ['confirm_swap', 'dismiss'] : meal.state === 'unrecorded' ? ['log_as_planned', 'swap'] : [],
      },
      fallbackText: `${MEAL_LABEL[meal.mealType]}${meal.suggestedTime ? ` (${meal.suggestedTime})` : ''}: ${selected?.title ?? meal.title}${
        meal.plannedKcal != null ? ` — ${faNumber(meal.plannedKcal)} کالری` : ''
      }`,
    };
  },

  calorieRing(today: TodaySummary): CardSpec {
    return {
      type: 'calorie_ring',
      payload: {
        date: today.date,
        targetKcal: today.calories.target,
        consumedKcal: today.calories.consumed,
        remainingKcal: today.calories.remaining,
        percent: today.calories.percent,
        partial: today.calories.partial,
        macros: today.macros,
        water: today.water,
        nextMeal: today.nextMeal,
      },
      fallbackText: `امروز ${faNumber(today.calories.consumed)} از ${faNumber(today.calories.target)} کالری — ${faNumber(Math.max(0, today.calories.remaining))} کالری باقی مانده`,
    };
  },

  weighIn(input: {
    date: string;
    kilograms: number;
    previousKg: number | null;
    targetKg: number | null;
    series: Array<{ date: string; kilograms: number }>;
  }): CardSpec {
    const delta = input.previousKg == null ? null : round1(input.kilograms - input.previousKg);
    const trend = delta == null ? null : delta < -0.05 ? 'down' : delta > 0.05 ? 'up' : 'flat';
    return {
      type: 'weigh_in',
      payload: {
        date: input.date,
        kilograms: input.kilograms,
        previousKg: input.previousKg,
        deltaKg: delta,
        trend,
        targetWeightKg: input.targetKg,
        remainingToTargetKg: input.targetKg == null ? null : round1(input.kilograms - input.targetKg),
        series: input.series.slice(-14),
      },
      fallbackText: `وزن ثبت شد: ${input.kilograms} کیلوگرم${delta == null ? '' : ` (${delta > 0 ? '+' : ''}${delta})`}`,
    };
  },

  water(input: { date: string; ml: number; addedMl: number; targetMl: number }): CardSpec {
    return {
      type: 'water',
      payload: { date: input.date, ml: input.ml, addedMl: input.addedMl, targetMl: input.targetMl, percent: Math.min(100, round0((input.ml / input.targetMl) * 100)) },
      fallbackText: `آب امروز: ${faNumber(input.ml)} از ${faNumber(input.targetMl)} میلی‌لیتر`,
    };
  },

  dayBrief(input: {
    date: string;
    greeting: string;
    targetKcal: number;
    meals: Array<{ mealUid: string; mealType: MealType; title: string; suggestedTime: string | null; plannedKcal: number | null }>;
    tip: string;
    waterTargetMl: number;
    weighInSuggested: boolean;
    streakDays: number;
  }): CardSpec {
    return {
      type: 'day_brief',
      payload: { ...input },
      fallbackText: `${input.greeting} هدف امروز ${faNumber(input.targetKcal)} کالری است. ${input.tip}`,
    };
  },

  weeklyReview(input: {
    weekStart: string;
    weekEnd: string;
    daysLogged: number;
    avgKcal: number | null;
    targetKcal: number;
    adherencePercent: number | null;
    weightChangeKg: number | null;
    waterAvgMl: number | null;
    wins: string[];
    focus: string;
  }): CardSpec {
    return {
      type: 'weekly_review',
      payload: { ...input },
      fallbackText: `مرور هفته: ${faNumber(input.daysLogged)} روز ثبت. ${input.focus}`,
    };
  },

  milestone(input: { kind: string; title: string; body: string; value: number | null }): CardSpec {
    return { type: 'milestone', payload: { ...input }, fallbackText: `${input.title} — ${input.body}` };
  },

  userPhoto(input: { mediaId: string; mime: string; caption?: string }): CardSpec {
    return {
      type: 'user_photo',
      payload: { mediaId: input.mediaId, url: `/v1/me/coach/media/${input.mediaId}`, mime: input.mime, caption: input.caption ?? '' },
      fallbackText: input.caption ? `[عکس غذا] ${input.caption}` : '[عکس غذا]',
    };
  },

  systemNote(code: string, text: string, extra: Json = {}): CardSpec {
    return { type: 'system_note', payload: { code, text, ...extra }, fallbackText: text };
  },
};
