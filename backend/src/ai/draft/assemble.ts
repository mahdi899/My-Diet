import type { MealDraft } from '../../adapters/plan-draft.js';
import { uuidv7 } from '../../common/id.js';
import type { FoodView } from '../../food/food.service.js';
import type { MealSlot } from '../../nutrition/engine.js';
import type { MealOption } from '../../plans/options.js';

export interface Picked {
  food: FoodView;
  servings: number;
}

export interface PickedMeal {
  day: number;
  slot: MealSlot;
  primary: Picked[];
  alternative: Picked[];
  note: string;
}

/** Portions a household can actually measure. */
export const SERVING_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

export function snapServings(value: number): number {
  let best: number = SERVING_STEPS[0];
  for (const step of SERVING_STEPS) if (Math.abs(step - value) < Math.abs(best - value)) best = step;
  return best;
}

export const kcalOf = (items: Picked[]): number => Math.round(items.reduce((sum, item) => sum + item.food.kcal * item.servings, 0));

export function macrosOf(items: Picked[]) {
  const sum = (pick: (food: FoodView) => number) => Math.round(items.reduce((total, item) => total + pick(item.food) * item.servings, 0));
  return { kcal: kcalOf(items), proteinG: sum((f) => f.proteinG), carbsG: sum((f) => f.carbsG), fatG: sum((f) => f.fatG) };
}

/**
 * Brings a meal to its energy target by changing portions only, never the dishes the model chose.
 * Largest items move first; the result stays on measurable steps.
 */
export function fitServings(items: Picked[], targetKcal: number, tolerance = 0.07): Picked[] {
  const fitted = items.map((item) => ({ food: item.food, servings: snapServings(item.servings) }));
  const order = [...fitted.keys()].sort((a, b) => fitted[b]!.food.kcal - fitted[a]!.food.kcal);
  for (const index of order) {
    if (Math.abs(kcalOf(fitted) - targetKcal) <= targetKcal * tolerance) break;
    let best = fitted[index]!.servings;
    let bestGap = Math.abs(kcalOf(fitted) - targetKcal);
    for (const step of SERVING_STEPS) {
      fitted[index]!.servings = step;
      const gap = Math.abs(kcalOf(fitted) - targetKcal);
      if (gap < bestGap) {
        best = step;
        bestGap = gap;
      }
    }
    fitted[index]!.servings = best;
  }
  return fitted;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const faNumber = (value: number) => String(value).replace('.', '٫').replace(/\d/g, (digit) => FA_DIGITS[Number(digit)]!);

/** "۱ کاسه", "نصفِ ۱ کاسه", "۱٫۵ برابرِ ۱ کاسه": a readable portion instead of a bare multiplier. */
export function servingPhrase(label: string, servings: number): string {
  if (servings === 1) return label;
  if (servings === 0.5) return `نصفِ ${label}`;
  return `${faNumber(servings)} برابرِ ${label}`;
}

function titleOf(items: Picked[]): string {
  return items.map((item) => item.food.nameFa).join(' + ').slice(0, 200);
}

export function toOption(kind: MealOption['kind'], items: Picked[], note: string): MealOption {
  const merged = new Map<string, MealOption['ingredients'][number]>();
  for (const { food, servings } of items) {
    for (const ingredient of food.ingredients) {
      const key = `${ingredient.name}|${ingredient.unit}`;
      const quantity = round2(ingredient.quantity * servings);
      const existing = merged.get(key);
      if (existing) existing.quantity = round2(existing.quantity + quantity);
      else merged.set(key, { name: ingredient.name, quantity, unit: ingredient.unit, basis: 'raw', category: ingredient.category });
    }
  }
  const lines = items.map(({ food, servings }) => `${food.nameFa}: ${servingPhrase(food.servingLabel, servings)}`);
  if (note) lines.push(note);
  return {
    optionId: uuidv7(),
    kind,
    title: titleOf(items),
    portion: { quantity: 1, unit: 'serving', basis: 'as_served' },
    calories: kcalOf(items),
    preparationMinutes: Math.min(1440, Math.max(...items.map((item) => item.food.prepMinutes))),
    instructions: lines.join('\n').slice(0, 4000),
    ingredients: [...merged.values()].slice(0, 30),
    approved: false,
  };
}

/** One meal of the draft: portions fitted to the slot, calories computed from the catalogue. */
export function assembleMeal(meal: PickedMeal): MealDraft {
  const primary = fitServings(meal.primary, meal.slot.kcal);
  const alternative = fitServings(meal.alternative, meal.slot.kcal);
  const options = [toOption('primary', primary, meal.note), toOption('ai_alternative', alternative, '')];
  return {
    mealType: meal.slot.mealType,
    suggestedTime: meal.slot.suggestedTime,
    title: options[0]!.title,
    calories: options[0]!.calories ?? kcalOf(primary),
    notes: meal.note,
    items: primary.map(({ food, servings }) => ({ name: food.nameFa, quantity: servings, unit: 'وعده' })),
    options,
  };
}

/** Same meal as `assembleMeal` but also returns the fitted picks for validation. */
export function fitMeal(meal: PickedMeal): PickedMeal {
  return {
    ...meal,
    primary: fitServings(meal.primary, meal.slot.kcal),
    alternative: fitServings(meal.alternative, meal.slot.kcal),
  };
}
