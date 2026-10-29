export const DAILY_CALORIE_MIN = 800;
export const DAILY_CALORIE_MAX = 3500;

export interface WarningMeal {
  title: string;
  calories: number;
  items: Array<{ name: string }>;
}

export interface DraftWarning {
  code: 'daily_calories_low' | 'daily_calories_high' | 'matches_allergy' | 'matches_dislike';
  dayIndex: number;
  total?: number;
  mealTitle?: string;
  term?: string;
}

/** Flags calorie totals and meals that repeat an allergy or a dislike. The draft is still kept. */
export function draftWarnings(days: WarningMeal[][], allergies: string, dislikes: string): DraftWarning[] {
  const warnings: DraftWarning[] = [];
  const allergyTerms = terms(allergies);
  const dislikeTerms = terms(dislikes);
  days.forEach((day, dayIndex) => {
    const total = day.reduce((sum, meal) => sum + (Number.isFinite(meal.calories) ? meal.calories : 0), 0);
    if (day.length > 0 && total < DAILY_CALORIE_MIN) {
      warnings.push({ code: 'daily_calories_low', dayIndex, total });
    }
    if (total > DAILY_CALORIE_MAX) {
      warnings.push({ code: 'daily_calories_high', dayIndex, total });
    }
    for (const meal of day) {
      const haystack = [meal.title, ...meal.items.map((item) => item.name)].join('\n');
      for (const term of allergyTerms) {
        if (haystack.includes(term)) warnings.push({ code: 'matches_allergy', dayIndex, mealTitle: meal.title, term });
      }
      for (const term of dislikeTerms) {
        if (haystack.includes(term)) warnings.push({ code: 'matches_dislike', dayIndex, mealTitle: meal.title, term });
      }
    }
  });
  return warnings.slice(0, 20);
}

function terms(text: string): string[] {
  const parts = text
    .split(/[\s,،;؛.。!؟?]+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 3);
  return [...new Set(parts)].slice(0, 40);
}
