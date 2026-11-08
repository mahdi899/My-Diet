import type { FoodService, FoodView } from '../../food/food.service.js';
import type { ModelProfile } from './model-profile.js';
import { containsAvoided } from './validator.js';

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

/** How many items of each category the model may choose from, per meal type. */
const QUOTAS: Record<MealType, Array<[category: string, limit: number, nearSlot: boolean]>> = {
  breakfast: [['breakfast', 22, true], ['main', 6, true], ['dairy', 4, false], ['protein', 3, false], ['fruit', 4, false], ['drink', 4, false], ['carb', 3, false]],
  lunch: [['main', 28, true], ['soup', 6, false], ['salad', 6, false], ['side', 6, false], ['carb', 4, false], ['protein', 3, false], ['dairy', 3, false], ['fruit', 2, false], ['drink', 3, false]],
  dinner: [['main', 28, true], ['soup', 8, false], ['salad', 6, false], ['side', 6, false], ['carb', 4, false], ['protein', 3, false], ['dairy', 3, false], ['fruit', 2, false], ['drink', 3, false]],
  snack: [['fruit', 9, false], ['snack', 10, false], ['dairy', 4, false], ['drink', 4, false], ['dessert', 3, false], ['protein', 2, false]],
};

/** Gregorian dates of the Iranian seasons are close enough for choosing fruit and soups. */
export function seasonOf(date: Date): Season {
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  const afterEquinox = (m: number, d: number) => month > m || (month === m && day >= d);
  if (afterEquinox(3, 21) && !afterEquinox(6, 21)) return 'spring';
  if (afterEquinox(6, 21) && !afterEquinox(9, 23)) return 'summer';
  if (afterEquinox(9, 23) && !afterEquinox(12, 22)) return 'autumn';
  return 'winter';
}

const SEASON_FA: Record<Season, string> = { spring: 'بهار', summer: 'تابستان', autumn: 'پاییز', winter: 'زمستان' };
export const seasonFa = (season: Season) => SEASON_FA[season];

export function budgetTier(budget: string): number {
  return budget === 'low' ? 2 : 3;
}

export interface Shortlists {
  byMeal: Record<MealType, FoodView[]>;
  /** Every slug the model was offered, per meal type: the only slugs it may answer with. */
  allowed: Record<MealType, Set<string>>;
}

/**
 * Safe, seasonal, region-aware candidates. Allergens, diet style, budget and in-season rules are hard
 * filters here, so the model can only ever choose among rows that are acceptable.
 */
export async function buildShortlists(
  foods: FoodService,
  profile: ModelProfile,
  season: Season,
  avoidTokens: string[],
): Promise<Shortlists> {
  const byMeal = { breakfast: [], lunch: [], dinner: [], snack: [] } as Record<MealType, FoodView[]>;
  const allowed = { breakfast: new Set(), lunch: new Set(), dinner: new Set(), snack: new Set() } as Record<MealType, Set<string>>;
  const wanted = new Set(profile.slots.map((slot) => slot.mealType));
  for (const mealType of wanted) {
    const slot = profile.slots.find((entry) => entry.mealType === mealType)!;
    const seen = new Set<string>();
    for (const [category, limit, nearSlot] of QUOTAS[mealType]) {
      const rows = await foods.candidates({
        mealType,
        categories: [category],
        excludeAllergens: profile.allergens.filter((code) => code !== 'other'),
        diet: profile.dietStyle,
        maxCostTier: budgetTier(profile.budget),
        preferRegion: profile.region,
        nearKcal: nearSlot ? Math.round(slot.kcal * 0.85) : null,
        limit: limit * 3,
      });
      let taken = 0;
      for (const food of rows) {
        if (taken >= limit || seen.has(food.slug)) continue;
        if (food.seasons.length > 0 && !food.seasons.includes(season)) continue;
        if (containsAvoided(food, avoidTokens)) continue;
        if (profile.track === 'pregnancy' && food.tags.includes('raw')) continue;
        seen.add(food.slug);
        byMeal[mealType].push(food);
        allowed[mealType].add(food.slug);
        taken += 1;
      }
    }
  }
  return { byMeal, allowed };
}

const KEY_TAGS = ['meat', 'poultry', 'fish', 'vegan', 'high_protein', 'light', 'high_fiber', 'fasting_friendly', 'quick', 'traditional'];

/** One line per item keeps the prompt small. */
export function catalogText(shortlists: Shortlists, profile: ModelProfile): string {
  const types = [...new Set(profile.slots.map((slot) => slot.mealType))];
  return types
    .map((mealType) => {
      const lines = shortlists.byMeal[mealType].map(
        (food) =>
          `${food.slug} | ${food.nameFa} | ${food.kcal} | ${food.servingLabel.slice(0, 48)} | ${food.tags.filter((tag) => KEY_TAGS.includes(tag)).join(',')}`,
      );
      return `[${mealType}]\n${lines.join('\n')}`;
    })
    .join('\n\n');
}
