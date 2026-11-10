import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Pool } from 'pg';
import { addCivilDays, tehranToday, weekStartSaturday } from '../common/time.js';
import { PG_POOL } from '../database/database.js';
import { minutesOf, tehranClock } from './clock.js';
import { PlanDraftService } from '../plans/plans.service.js';
import { round0, round1 } from './text.js';
import { CoachStore } from './store.js';
import type { CoachProfile, MealType, PlanMealView, TodaySummary } from './types.js';

export { minutesOf, tehranClock };
export const WATER_TARGET_ML = 2000;

interface RawMeal {
  mealUid: string;
  mealType: MealType;
  title?: string;
  suggestedTime?: string | null;
  plannedCalories?: number | null;
  consumptionState?: string;
  consumption?: { consumedCalories?: number | null } | null;
  selectedOptionId?: string | null;
  consumptionRevision?: number;
  selectionRevision?: number;
  options?: Array<{ optionId: string; kind: string; title: string; calories: number | null; portion?: unknown; approved?: boolean }>;
}

interface ProfileRow {
  user_id: string;
  track: CoachProfile['track'];
  goal: string;
  sex: CoachProfile['sex'];
  age: number;
  height_cm: string;
  weight_kg: string;
  target_weight_kg: string | null;
  activity: string;
  bmi: string;
  tdee_kcal: number;
  target_kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  diet_style: string;
  meals_per_day: number | null;
  allergens: string[];
  conditions: string[];
  risk_flags: string[];
  safety_tier: CoachProfile['safetyTier'];
  consented_at: Date | null;
  preferences: Record<string, unknown>;
  display_name: string | null;
}

@Injectable()
export class CoachInsights {
  private readonly logger = new Logger(CoachInsights.name);

  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly plans: PlanDraftService,
    private readonly store: CoachStore,
  ) {}

  async profile(userId: string): Promise<CoachProfile | null> {
    const { rows } = await this.pool.query<ProfileRow>(
      `select p.user_id, p.track, p.goal, p.sex, p.age, p.height_cm::text, p.weight_kg::text, p.target_weight_kg::text, p.activity,
              p.bmi::text, p.tdee_kcal, p.target_kcal, p.protein_g, p.carbs_g, p.fat_g, p.diet_style, p.meals_per_day,
              p.allergens, p.conditions, p.risk_flags, p.safety_tier, p.consented_at, p.preferences, u.display_name
       from nutrition_profiles p join users u on u.id = p.user_id where p.user_id = $1`,
      [userId],
    );
    const row = rows[0];
    if (!row) return null;
    // The newest weigh-in is the truth, the onboarding weight is only the starting point.
    const latest = await this.pool.query<{ kilograms: string }>(
      `select kilograms::text from weight_entries where user_id = $1 order by civil_date desc limit 1`,
      [userId],
    );
    return {
      userId: row.user_id,
      track: row.track,
      goal: row.goal,
      sex: row.sex,
      age: row.age,
      heightCm: Number(row.height_cm),
      weightKg: latest.rows[0] ? Number(latest.rows[0].kilograms) : Number(row.weight_kg),
      targetWeightKg: row.target_weight_kg == null ? null : Number(row.target_weight_kg),
      activity: row.activity,
      bmi: Number(row.bmi),
      tdeeKcal: row.tdee_kcal,
      targetKcal: row.target_kcal,
      proteinG: row.protein_g,
      carbsG: row.carbs_g,
      fatG: row.fat_g,
      dietStyle: row.diet_style,
      mealsPerDay: row.meals_per_day,
      allergens: row.allergens,
      conditions: row.conditions,
      riskFlags: row.risk_flags,
      safetyTier: row.safety_tier,
      consented: row.consented_at != null,
      preferences: row.preferences,
      displayName: row.display_name,
    };
  }

  /** Plan meals of a day with their consumption state. Empty (never throws) when the user has no published plan. */
  async planMeals(userId: string, date: string): Promise<{ versionId: string | null; meals: PlanMealView[] }> {
    try {
      const day = (await this.plans.planDay(userId, date)) as { versionId: string | null; meals: RawMeal[] };
      return {
        versionId: day.versionId,
        meals: day.meals.map((meal) => ({
          mealUid: meal.mealUid,
          mealType: meal.mealType,
          title: meal.title ?? '',
          suggestedTime: meal.suggestedTime ?? null,
          plannedKcal: typeof meal.plannedCalories === 'number' ? meal.plannedCalories : null,
          state: meal.consumptionState ?? 'unrecorded',
          consumedKcal: typeof meal.consumption?.consumedCalories === 'number' ? meal.consumption.consumedCalories : null,
          selectedOptionId: meal.selectedOptionId ?? null,
          consumptionRevision: meal.consumptionRevision ?? 0,
          selectionRevision: meal.selectionRevision ?? 0,
          options: (meal.options ?? [])
            .filter((option) => option.approved !== false)
            .map((option) => ({ optionId: option.optionId, kind: option.kind, title: option.title, kcal: option.calories, portion: option.portion ?? null })),
        })),
      };
    } catch (error) {
      this.logger.warn(`plan lookup failed: ${error instanceof Error ? error.message : 'unknown'}`);
      return { versionId: null, meals: [] };
    }
  }

  async weightSeries(userId: string, days = 30): Promise<Array<{ date: string; kilograms: number }>> {
    const from = addCivilDays(tehranToday(), -days);
    const { rows } = await this.pool.query<{ civil_date: string; kilograms: string }>(
      `select civil_date::text as civil_date, kilograms::text from weight_entries where user_id = $1 and civil_date >= $2 order by civil_date`,
      [userId, from],
    );
    return rows.map((row) => ({ date: row.civil_date, kilograms: Number(row.kilograms) }));
  }

  /** Consecutive days (ending today or yesterday) with at least one recorded meal. */
  async streakDays(userId: string): Promise<number> {
    const today = tehranToday();
    const from = addCivilDays(today, -60);
    const { rows } = await this.pool.query<{ day: string }>(
      `select distinct d::text as day from (
         select scheduled_date as d from meal_logs where user_id = $1 and scheduled_date >= $2
           and (eaten or coalesce(details->>'state', 'unrecorded') <> 'unrecorded')
         union
         select civil_date as d from coach_food_entries where user_id = $1 and civil_date >= $2 and status = 'logged'
       ) t`,
      [userId, from],
    );
    const days = new Set(rows.map((row) => row.day));
    let cursor = days.has(today) ? today : addCivilDays(today, -1);
    let count = 0;
    while (days.has(cursor)) {
      count += 1;
      cursor = addCivilDays(cursor, -1);
    }
    return count;
  }

  /** Calories eaten on a day from plan logs plus coach-logged foods, without counting a linked meal twice. */
  async consumedOn(
    userId: string,
    date: string,
    meals: PlanMealView[],
  ): Promise<{ kcal: number; partial: boolean; coachMacros: { proteinG: number; carbsG: number; fatG: number }; planKcal: number }> {
    const entries = await this.store.loggedEntries(userId, date, date);
    const planKcalByUid = new Map(meals.map((meal) => [meal.mealUid, meal.consumedKcal]));
    const linked = new Set(entries.filter((entry) => entry.planMealUid).map((entry) => entry.planMealUid));
    let planKcal = 0;
    let partial = false;
    for (const meal of meals) {
      if (meal.state === 'unrecorded') continue;
      if (meal.consumedKcal == null) {
        // «different» food: known only when a coach entry is linked to this meal
        if (!linked.has(meal.mealUid)) partial = true;
      } else planKcal += meal.consumedKcal;
    }
    let coachKcal = 0;
    const macros = { proteinG: 0, carbsG: 0, fatG: 0 };
    for (const entry of entries) {
      macros.proteinG += entry.totals.proteinG;
      macros.carbsG += entry.totals.carbsG;
      macros.fatG += entry.totals.fatG;
      const planned = entry.planMealUid ? planKcalByUid.get(entry.planMealUid) : undefined;
      if (typeof planned === 'number') continue; // the plan log already counts this meal
      coachKcal += entry.totals.kcal;
    }
    return {
      kcal: round0(planKcal + coachKcal),
      partial,
      coachMacros: { proteinG: round1(macros.proteinG), carbsG: round1(macros.carbsG), fatG: round1(macros.fatG) },
      planKcal,
    };
  }

  nextMeal(meals: PlanMealView[], nowMinutes: number): PlanMealView | null {
    const open = meals.filter((meal) => meal.state === 'unrecorded');
    if (!open.length) return null;
    const upcoming = open.filter((meal) => (minutesOf(meal.suggestedTime) ?? 0) >= nowMinutes - 30);
    const pool = upcoming.length ? upcoming : open;
    return [...pool].sort((a, b) => (minutesOf(a.suggestedTime) ?? 9999) - (minutesOf(b.suggestedTime) ?? 9999))[0] ?? null;
  }

  async today(userId: string, known?: CoachProfile | null): Promise<TodaySummary> {
    const profile = known === undefined ? await this.profile(userId) : known;
    const clock = tehranClock();
    const date = clock.date;
    const [plan, water, series, streakDays] = await Promise.all([
      this.planMeals(userId, date),
      this.store.water(userId, date),
      this.weightSeries(userId, 30),
      this.streakDays(userId),
    ]);
    const target = profile?.targetKcal ?? 0;
    const eaten = await this.consumedOn(userId, date, plan.meals);
    const latest = series[series.length - 1] ?? null;
    const weekAgo = [...series].reverse().find((entry) => entry.date <= addCivilDays(date, -6)) ?? series[0] ?? null;
    const next = this.nextMeal(plan.meals, clock.minutes);
    return {
      date,
      hasProfile: profile != null,
      calories: {
        target,
        consumed: eaten.kcal,
        remaining: target - eaten.kcal,
        percent: target > 0 ? Math.min(999, round0((eaten.kcal / target) * 100)) : 0,
        partial: eaten.partial,
      },
      macros: {
        proteinG: { consumed: eaten.coachMacros.proteinG, target: profile?.proteinG ?? 0 },
        carbsG: { consumed: eaten.coachMacros.carbsG, target: profile?.carbsG ?? 0 },
        fatG: { consumed: eaten.coachMacros.fatG, target: profile?.fatG ?? 0 },
        partial: eaten.planKcal > 0,
      },
      water: { ml: water, targetMl: WATER_TARGET_ML },
      weight: {
        latestKg: latest?.kilograms ?? profile?.weightKg ?? null,
        latestDate: latest?.date ?? null,
        deltaKg7d: latest && weekAgo && weekAgo.date !== latest.date ? round1(latest.kilograms - weekAgo.kilograms) : null,
        targetKg: profile?.targetWeightKg ?? null,
        series: series.slice(-14),
      },
      streakDays,
      nextMeal: next ? { mealUid: next.mealUid, mealType: next.mealType, title: next.title, suggestedTime: next.suggestedTime, plannedKcal: next.plannedKcal } : null,
      planMeals: plan.meals.map((meal) => ({
        mealUid: meal.mealUid, mealType: meal.mealType, title: meal.title, suggestedTime: meal.suggestedTime, plannedKcal: meal.plannedKcal, state: meal.state,
      })),
    };
  }

  /** Numbers for the weekly review of the Saturday-first week that starts at `weekStart`. */
  async weekStats(userId: string, weekStart: string, targetKcal: number) {
    const weekEnd = addCivilDays(weekStart, 6);
    const logs = await this.pool.query<{ day: string; kcal: string | null }>(
      `select scheduled_date::text as day, sum(case when (details->>'consumedCalories') is not null then (details->>'consumedCalories')::numeric end)::text as kcal
       from meal_logs where user_id = $1 and scheduled_date between $2 and $3
         and (eaten or coalesce(details->>'state', 'unrecorded') <> 'unrecorded') group by scheduled_date`,
      [userId, weekStart, weekEnd],
    );
    const entries = await this.store.loggedEntries(userId, weekStart, weekEnd);
    const perDay = new Map<string, number>();
    for (const row of logs.rows) perDay.set(row.day, (perDay.get(row.day) ?? 0) + Number(row.kcal ?? 0));
    for (const entry of entries) {
      perDay.set(entry.civilDate, (perDay.get(entry.civilDate) ?? 0) + entry.totals.kcal);
    }
    const days = [...perDay.entries()].filter(([, kcal]) => kcal > 0);
    const avgKcal = days.length ? round0(days.reduce((sum, [, kcal]) => sum + kcal, 0) / days.length) : null;
    const onTarget = days.filter(([, kcal]) => targetKcal > 0 && Math.abs(kcal - targetKcal) <= targetKcal * 0.15).length;
    const weights = await this.pool.query<{ civil_date: string; kilograms: string }>(
      `select civil_date::text as civil_date, kilograms::text from weight_entries where user_id = $1 and civil_date between $2 and $3 order by civil_date`,
      [userId, addCivilDays(weekStart, -7), weekEnd],
    );
    const inWeek = weights.rows.filter((row) => row.civil_date >= weekStart);
    const before = weights.rows.filter((row) => row.civil_date < weekStart).pop();
    const last = inWeek[inWeek.length - 1];
    const first = before ?? inWeek[0];
    const waterRows = await this.pool.query<{ avg: string | null }>(
      `select avg(ml)::text as avg from coach_water where user_id = $1 and civil_date between $2 and $3`,
      [userId, weekStart, weekEnd],
    );
    return {
      weekStart,
      weekEnd,
      daysLogged: days.length,
      avgKcal,
      adherencePercent: days.length ? round0((onTarget / days.length) * 100) : null,
      weightChangeKg: last && first && last.civil_date !== first.civil_date ? round1(Number(last.kilograms) - Number(first.kilograms)) : null,
      waterAvgMl: waterRows.rows[0]?.avg ? round0(Number(waterRows.rows[0].avg)) : null,
    };
  }

  weekOf(date: string): string {
    return weekStartSaturday(date);
  }
}
