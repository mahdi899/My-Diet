import type { ModelProfile } from './model-profile.js';
import { kcalOf, macrosOf, type Picked, type PickedMeal } from './assemble.js';

export interface Violation {
  severity: 'error' | 'warn';
  code: string;
  message: string;
  day?: number;
  mealType?: string;
}

export interface Rules {
  profile: ModelProfile;
  /** Tokens (Persian words) from free-text allergies and dislikes that must not appear in a dish. */
  avoidTokens: string[];
}

const ANIMAL_TAGS = ['meat', 'poultry', 'fish'];
const SLOT_TOLERANCE = 0.12;
const DAY_TOLERANCE = 0.08;

/** Words from free text, normalised the same way ingredient names are compared. */
export function avoidTokensOf(...texts: string[]): string[] {
  const words = texts
    .join('\n')
    .replace(/<<<[^>]*>>>/g, ' ')
    .normalize('NFKC')
    .split(/[\n,،;؛/\\|]|\s+و\s+/)
    .map((word) => word.replace(/[ي]/g, 'ی').replace(/[ك]/g, 'ک').replace(/[\u200c]/g, ' ').trim().toLowerCase())
    .filter((word) => word.length >= 3 && word.length <= 40);
  return [...new Set(words)];
}

const normalise = (text: string) => text.replace(/[ي]/g, 'ی').replace(/[ك]/g, 'ک').replace(/\u200c/g, ' ').toLowerCase();

/** Does this dish contain a word the person must avoid? */
export function containsAvoided(food: Picked['food'], tokens: string[]): string | null {
  if (tokens.length === 0) return null;
  const haystack = normalise([food.nameFa, ...food.ingredients.map((ingredient) => ingredient.name)].join(' | '));
  return tokens.find((token) => haystack.includes(token)) ?? null;
}

export function itemViolations(picked: Picked, rules: Rules, where: { day?: number; mealType?: string }): Violation[] {
  const out: Violation[] = [];
  const { food } = picked;
  const clash = food.allergens.filter((allergen) => rules.profile.allergens.includes(allergen));
  if (clash.length) out.push({ severity: 'error', code: 'allergen', message: `${food.nameFa}: ${clash.join('، ')}`, ...where });
  if (rules.profile.dietStyle !== 'omnivore' && !food.tags.includes(rules.profile.dietStyle)) {
    out.push({ severity: 'error', code: 'diet_style', message: `${food.nameFa} با سبک تغذیه نمی‌خواند`, ...where });
  }
  const avoided = containsAvoided(food, rules.avoidTokens);
  if (avoided) out.push({ severity: 'error', code: 'avoided_food', message: `${food.nameFa} شامل «${avoided}» است`, ...where });
  return out;
}

/** Checks a whole assembled week. Errors reject the draft; warnings go to the doctor. */
export function validateWeek(meals: PickedMeal[], rules: Rules): Violation[] {
  const out: Violation[] = [];
  const { profile } = rules;
  const wanted = profile.slots.map((slot) => slot.mealType);
  const mains = new Map<string, number>();
  let fishMeals = 0;

  for (let day = 1; day <= 7; day += 1) {
    const ofDay = meals.filter((meal) => meal.day === day);
    for (const mealType of wanted) {
      if (!ofDay.some((meal) => meal.slot.mealType === mealType)) {
        out.push({ severity: 'error', code: 'slot_missing', message: `روز ${day}: وعدهٔ ${mealType} ندارد`, day, mealType });
      }
    }
    for (const meal of ofDay) {
      const where = { day, mealType: meal.slot.mealType };
      for (const picked of [...meal.primary, ...meal.alternative]) out.push(...itemViolations(picked, rules, where));
      const kcal = kcalOf(meal.primary);
      if (Math.abs(kcal - meal.slot.kcal) > meal.slot.kcal * SLOT_TOLERANCE) {
        out.push({ severity: 'warn', code: 'kcal_slot', message: `${kcal} به‌جای ${meal.slot.kcal} کیلوکالری`, ...where });
      }
      const alt = kcalOf(meal.alternative);
      if (Math.abs(alt - kcal) > Math.max(120, kcal * 0.2)) {
        out.push({ severity: 'warn', code: 'alternative_gap', message: `جایگزین ${alt} کیلوکالری است`, ...where });
      }
      for (const picked of meal.primary) {
        if (picked.food.category === 'main') mains.set(picked.food.slug, (mains.get(picked.food.slug) ?? 0) + 1);
        if (picked.food.tags.includes('fish')) fishMeals += 1;
      }
    }
    const dayKcal = ofDay.reduce((sum, meal) => sum + kcalOf(meal.primary), 0);
    const target = profile.energy.targetKcal;
    if (ofDay.length && Math.abs(dayKcal - target) > target * DAY_TOLERANCE) {
      out.push({ severity: 'warn', code: 'kcal_day', message: `روز ${day}: ${dayKcal} به‌جای ${target} کیلوکالری`, day });
    }
    const protein = ofDay.reduce((sum, meal) => sum + macrosOf(meal.primary).proteinG, 0);
    if (ofDay.length && protein < profile.energy.proteinG * 0.75) {
      out.push({ severity: 'warn', code: 'protein_low', message: `روز ${day}: پروتئین ${protein} گرم (هدف ${profile.energy.proteinG})`, day });
    }
  }
  for (const [slug, count] of mains) {
    if (count > 2) out.push({ severity: 'warn', code: 'repeat_main', message: `${slug} ${count} بار تکرار شده` });
  }
  if (profile.dietStyle === 'omnivore' && fishMeals === 0) {
    out.push({ severity: 'warn', code: 'fish_missing', message: 'در هفته ماهی ندارد' });
  }
  return out;
}

export function dayTotals(meals: PickedMeal[]) {
  return Array.from({ length: 7 }, (_, index) => {
    const ofDay = meals.filter((meal) => meal.day === index + 1);
    const total = { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 };
    for (const meal of ofDay) {
      const m = macrosOf(meal.primary);
      total.kcal += m.kcal;
      total.proteinG += m.proteinG;
      total.carbsG += m.carbsG;
      total.fatG += m.fatG;
    }
    return total;
  });
}

export const isAnimalFree = (tags: string[]) => !ANIMAL_TAGS.some((tag) => tags.includes(tag));
