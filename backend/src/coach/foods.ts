import type { FoodView } from '../food/food.service.js';
import { round0, round1 } from './text.js';
import type { EntryItem, MealType } from './types.js';

export const SERVING_STEPS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3] as const;

export function itemOf(food: FoodView, servings: number): EntryItem {
  return {
    name: food.nameFa,
    slug: food.slug,
    servings,
    servingLabel: food.servingLabel,
    kcal: round0(food.kcal * servings),
    proteinG: round1(food.proteinG * servings),
    carbsG: round1(food.carbsG * servings),
    fatG: round1(food.fatG * servings),
    estimated: false,
  };
}

/** Item for food the catalogue does not know: only the energy the user or model gave, macros stay 0. */
export function estimatedItem(name: string, kcal: number, servings = 1, macros?: { proteinG?: number; carbsG?: number; fatG?: number }): EntryItem {
  return {
    name: name.slice(0, 120),
    slug: null,
    servings,
    servingLabel: null,
    kcal: round0(Math.min(2000, Math.max(0, kcal))),
    proteinG: round1(Math.min(200, Math.max(0, macros?.proteinG ?? 0))),
    carbsG: round1(Math.min(400, Math.max(0, macros?.carbsG ?? 0))),
    fatG: round1(Math.min(200, Math.max(0, macros?.fatG ?? 0))),
    estimated: true,
  };
}

export function nearestServing(wanted: number): number {
  return SERVING_STEPS.reduce((best, step) => (Math.abs(step - wanted) < Math.abs(best - wanted) ? step : best), SERVING_STEPS[0]);
}

const SIDE_CATEGORIES = new Set(['salad', 'fruit', 'dairy', 'side', 'soup']);

/**
 * Builds a 1–2 item meal near `targetKcal` from catalogue candidates (already filtered for allergens and diet).
 * `pick` rotates which candidate leads so repeated asks do not return the same dish. Pure and deterministic.
 */
export function composeSuggestion(candidates: FoodView[], targetKcal: number, pick: number): EntryItem[] {
  if (candidates.length === 0) return [];
  const sorted = [...candidates].sort((a, b) => Math.abs(a.kcal - targetKcal) - Math.abs(b.kcal - targetKcal) || a.slug.localeCompare(b.slug));
  const pool = sorted.slice(0, Math.min(8, sorted.length));
  const lead = pool[Math.abs(pick) % pool.length]!;
  const servings = nearestServing(Math.min(2, Math.max(0.5, targetKcal / Math.max(lead.kcal, 1))));
  const items = [itemOf(lead, servings)];
  const remaining = targetKcal - items[0]!.kcal;
  if (remaining > targetKcal * 0.25) {
    const side = sorted.find((food) => food.slug !== lead.slug && SIDE_CATEGORIES.has(food.category) && food.kcal <= remaining * 1.3);
    if (side) items.push(itemOf(side, nearestServing(Math.min(2, Math.max(0.5, remaining / Math.max(side.kcal, 1))))));
  }
  return items;
}

export function mealTypeAt(minutes: number): MealType {
  if (minutes < 10 * 60 + 30) return 'breakfast';
  if (minutes < 15 * 60 + 30) return 'lunch';
  if (minutes < 18 * 60) return 'snack';
  return 'dinner';
}

/** Rescales macro grams for a new calorie target: protein kept (capped at 30 %), fat ~28 %, carbs the rest (min 100 g). */
export function rescaleMacros(targetKcal: number, proteinG: number): { proteinG: number; carbsG: number; fatG: number } {
  const protein = Math.min(proteinG, Math.round((targetKcal * 0.3) / 4));
  const fat = Math.round((targetKcal * 0.28) / 9);
  const carbs = Math.max(100, Math.round((targetKcal - protein * 4 - fat * 9) / 4));
  return { proteinG: protein, carbsG: carbs, fatG: fat };
}
