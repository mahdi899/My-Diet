import { ApplicationError as ApiError } from '../../common/application-error.js';
import { uuidv7 } from '../../common/id.js';
import { requiredUuid } from '../../common/identifiers.js';
import { parseOptions, type MealOption } from '../options.js';
import type { PlanDraft, MealDraft } from './generation.js';

const MEAL_TYPES = new Set(['breakfast', 'lunch', 'dinner', 'snack']);
const MEAL_ALIASES: Record<string, string> = {
  breakfast: 'breakfast',
  lunch: 'lunch',
  dinner: 'dinner',
  snack: 'snack',
  صبحانه: 'breakfast',
  ناهار: 'lunch',
  شام: 'dinner',
  'میان‌وعده': 'snack',
};

export interface DayInput {
  meals: MealInput[];
}
export interface MealInput {
  options?: MealOption[];
  mealUid: string;
  mealType: string;
  suggestedTime: string | null;
  title: string;
  calories: number;
  notes: string;
  items: Array<{ name: string; quantity: number | null; unit: string | null }>;
}

export function emptyDraft(): MealInput[][] {
  return Array.from({ length: 7 }, () => []);
}

export function isUsable(draft: PlanDraft): boolean {
  return (
    draft.days.length === 7 &&
    draft.days.every((day) =>
      day.meals.length > 0 &&
      day.meals.every((meal) => meal.title.trim() && meal.calories > 0 && meal.items.some((item) => item.name.trim())),
    )
  );
}

export function producedToInput(draft: PlanDraft): MealInput[][] {
  return draft.days.map((day) => day.meals.map(mealFromProvider));
}

function mealFromProvider(meal: MealDraft): MealInput {
  return {
    options:meal.options,
    mealUid: uuidv7(),
    mealType: meal.mealType,
    suggestedTime: meal.suggestedTime,
    title: meal.title,
    calories: meal.calories,
    notes: meal.notes,
    items: meal.items.map((item) => ({ name: item.name, quantity: item.quantity, unit: item.unit })),
  };
}

export function assertPublishable(days: Array<{ meals: MealInput[] }>): void {
  if (days.length !== 7 || days.some((day) => day.meals.length === 0)) {
    throw new ApiError(409, 'plan_incomplete', 'هر روز باید حداقل یک وعده داشته باشد');
  }
  for (const day of days) {
    for (const meal of day.meals) {
      if (!meal.title.trim() || meal.calories <= 0 || meal.items.length === 0 || meal.items.some((item) => !item.name.trim())) {
        throw new ApiError(409, 'plan_incomplete', 'هر وعده باید عنوان، مقدار و کالری داشته باشد');
      }
    }
  }
}

export function parseDays(body: unknown): MealInput[][] {
  if (!body || typeof body !== 'object' || !('days' in body) || !Array.isArray((body as { days: unknown }).days)) {
    throw new ApiError(400, 'validation', 'برنامه باید هفت روز داشته باشد');
  }
  const days = (body as { days: unknown[] }).days;
  if (days.length !== 7) throw new ApiError(400, 'validation', 'برنامه باید هفت روز داشته باشد');
  const parsed = days.map((day) => {
    if (!day || typeof day !== 'object' || !Array.isArray((day as { meals?: unknown }).meals)) {
      throw new ApiError(400, 'validation', 'وعده‌های روز درست نیست');
    }
    const meals = (day as { meals: unknown[] }).meals;
    if (meals.length > 12) throw new ApiError(400, 'validation', 'تعداد وعده‌های یک روز زیاد است');
    return meals.map((meal) => parseMeal(meal));
  });
  const ids = parsed.flat().map(m=>m.mealUid);
  const optionIds = parsed.flat().flatMap(m=>m.options?.map(o=>o.optionId) ?? []);
  if (new Set(ids).size!==ids.length || new Set(optionIds).size!==optionIds.length) {
    throw new ApiError(400,'validation','شناسه وعده و گزینه در نسخه باید یکتا باشد');
  }
  return parsed;
}

function parseMeal(value: unknown): MealInput {
  if (!value || typeof value !== 'object') throw new ApiError(400, 'validation', 'وعده درست نیست');
  const meal = value as Record<string, unknown>;
  const options = parseOptions(meal.options);
  const primary = options?.find(o=>o.kind==='primary');
  if (primary && (primary.title!==meal.title || primary.calories!==meal.calories)) {
    throw new ApiError(400,'validation','عنوان و کالری اصلی باید با گزینه اصلی یکسان باشد');
  }
  const mealType = MEAL_ALIASES[String(meal.mealType ?? '')];
  if (!mealType || !MEAL_TYPES.has(mealType)) throw new ApiError(400, 'validation', 'نوع وعده درست نیست');
  const title = typeof meal.title === 'string' ? meal.title.trim() : '';
  const calories = meal.calories;
  if (!title || title.length > 120 || typeof calories !== 'number' || !Number.isInteger(calories) || calories <= 0 || calories > 5000) {
    throw new ApiError(400, 'validation', 'عنوان یا کالری وعده درست نیست');
  }
  const notes = typeof meal.notes === 'string' ? meal.notes.trim() : '';
  if (notes.length > 500) throw new ApiError(400, 'validation', 'توضیح وعده بیش از حد طولانی است');
  const suggested = meal.suggestedTime;
  const suggestedTime = suggested == null || suggested === '' ? null : String(suggested);
  if (suggestedTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(suggestedTime)) {
    throw new ApiError(400, 'validation', 'ساعت وعده درست نیست');
  }
  if (!Array.isArray(meal.items) || meal.items.length === 0 || meal.items.length > 20) {
    throw new ApiError(400, 'validation', 'هر وعده باید مادهٔ غذایی داشته باشد');
  }
  const mealUid = meal.mealUid === undefined ? uuidv7() : requiredUuid(String(meal.mealUid));
  return {
    mealUid,
    options,
    mealType,
    suggestedTime,
    title,
    calories,
    notes,
    items: (primary?.ingredients ?? meal.items).map((item) => {
      if (!item || typeof item !== 'object') throw new ApiError(400, 'validation', 'مادهٔ غذایی درست نیست');
      const record = item as Record<string, unknown>;
      const name = typeof record.name === 'string' ? record.name.trim() : '';
      if (!name || name.length > 120) throw new ApiError(400, 'validation', 'نام مادهٔ غذایی درست نیست');
      const quantity = record.quantity == null ? null : Number(record.quantity);
      if (quantity != null && (!Number.isFinite(quantity) || quantity <= 0)) {
        throw new ApiError(400, 'validation', 'مقدار مادهٔ غذایی درست نیست');
      }
      const unit = record.unit == null ? null : String(record.unit).trim();
      if (unit && unit.length > 16) throw new ApiError(400, 'validation', 'واحد مادهٔ غذایی درست نیست');
      return { name, quantity, unit: unit || null };
    }),
  };
}
