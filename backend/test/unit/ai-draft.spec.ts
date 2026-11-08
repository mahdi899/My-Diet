import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { assembleMeal, fitServings, kcalOf, servingPhrase, snapServings, type Picked, type PickedMeal } from '../../src/ai/draft/assemble.js';
import type { ModelProfile } from '../../src/ai/draft/model-profile.js';
import { DEFAULT_PROMPTS, REQUIRED_PLACEHOLDERS, renderTemplate } from '../../src/ai/draft/prompts.js';
import { chunkSchema, extractJson } from '../../src/ai/draft/schema.js';
import { seasonOf } from '../../src/ai/draft/shortlist.js';
import { avoidTokensOf, containsAvoided, dayTotals, validateWeek } from '../../src/ai/draft/validator.js';
import type { FoodView } from '../../src/food/food.service.js';

const food = (slug: string, over: Partial<FoodView> = {}): FoodView => ({
  id: slug, slug, nameFa: slug, category: 'main', mealTypes: ['lunch'], servingLabel: '۱ پرس', servingG: 200,
  kcal: 400, proteinG: 25, carbsG: 40, fatG: 14, fiberG: 3, allergens: [], tags: ['meat'], regions: [], seasons: [],
  costTier: 2, prepMinutes: 30, ingredients: [{ name: 'برنج', quantity: 100, unit: 'g' }], image: null, active: true, source: 'seed',
  ...over,
});

const profile = (over: Partial<ModelProfile> = {}): ModelProfile => ({
  track: 'weight_loss', sex: 'female', age: 33, heightCm: 166, weightKg: 79, targetWeightKg: 68, bmi: 28.7,
  energy: { targetKcal: 800, bmrKcal: 1500, tdeeKcal: 2000, proteinG: 60, carbsG: 90, fatG: 25 },
  slots: [{ mealType: 'lunch', suggestedTime: '13:00', kcal: 400 }, { mealType: 'dinner', suggestedTime: '20:00', kcal: 400 }],
  dietStyle: 'omnivore', allergens: [], conditions: [], budget: 'mid', region: null, safetyTier: 'ai_ok', preferences: {},
  ...over,
});

const week = (make: (day: number, mealType: 'lunch' | 'dinner') => Picked[], p = profile()): PickedMeal[] =>
  Array.from({ length: 7 }, (_, index) => index + 1).flatMap((day) =>
    p.slots.map((slot) => ({
      day, slot, primary: make(day, slot.mealType as 'lunch' | 'dinner'), alternative: [{ food: food('alt', { kcal: 390 }), servings: 1 }], note: '',
    })),
  );

describe('AI draft helpers', () => {
  it('words portions in Persian instead of a bare multiplier', () => {
    assert.equal(servingPhrase('۱ کاسه', 1), '۱ کاسه');
    assert.equal(servingPhrase('۱ کاسه', 0.5), 'نصفِ ۱ کاسه');
    assert.equal(servingPhrase('۱ کاسه', 1.5), '۱٫۵ برابرِ ۱ کاسه');
    assert.equal(servingPhrase('۱ پرس', 2), '۲ برابرِ ۱ پرس');
  });

  it('extracts JSON from fenced or chatty answers', () => {
    assert.deepEqual(extractJson('{"a":1}'), { a: 1 });
    assert.deepEqual(extractJson('بفرمایید:\n```json\n{"a":2}\n```'), { a: 2 });
    assert.deepEqual(extractJson('here you go {"a":3} bye'), { a: 3 });
    assert.equal(extractJson('no json'), undefined);
  });

  it('rejects chunks with unknown shapes or absurd portions', () => {
    const meal = { mealType: 'lunch', primary: [{ slug: 'x', servings: 1 }], alternative: [{ slug: 'y', servings: 1 }] };
    assert.ok(chunkSchema.safeParse({ days: [{ day: 1, meals: [meal] }] }).success);
    assert.equal(chunkSchema.safeParse({ days: [{ day: 8, meals: [meal] }] }).success, false);
    assert.equal(chunkSchema.safeParse({ days: [{ day: 1, meals: [{ ...meal, primary: [{ slug: 'x', servings: 9 }] }] }] }).success, false);
    assert.equal(chunkSchema.safeParse({ days: [{ day: 1, meals: [{ ...meal, primary: [] }] }] }).success, false);
  });

  it('keeps portions on measurable steps and moves toward the energy target', () => {
    assert.equal(snapServings(1.1), 1);
    assert.equal(snapServings(1.9), 2);
    const fitted = fitServings([{ food: food('a', { kcal: 300 }), servings: 1 }, { food: food('b', { kcal: 100 }), servings: 1 }], 600);
    assert.ok(Math.abs(kcalOf(fitted) - 600) <= 60, String(kcalOf(fitted)));
    for (const item of fitted) assert.ok([0.5, 0.75, 1, 1.25, 1.5, 2].includes(item.servings));
  });

  it('turns picked dishes into a doctor-editable meal with a primary and an AI alternative', () => {
    const meal = assembleMeal({
      day: 1, slot: profile().slots[0]!, primary: [{ food: food('a'), servings: 1 }], alternative: [{ food: food('b', { kcal: 380 }), servings: 1 }], note: 'نوش جان',
    });
    assert.equal(meal.mealType, 'lunch');
    assert.equal(meal.options?.length, 2);
    assert.equal(meal.options?.[0]?.kind, 'primary');
    assert.equal(meal.options?.[1]?.kind, 'ai_alternative');
    assert.equal(meal.options?.every((option) => option.approved === false), true);
    assert.equal(meal.calories, 400);
  });

  it('flags allergens, diet clashes and avoided words as errors, and energy drift as warnings', () => {
    const p = profile({ allergens: ['nuts'], dietStyle: 'vegetarian' });
    const tokens = avoidTokensOf('قارچ، بادمجان');
    const bad = week(() => [{ food: food('walnut', { allergens: ['nuts'], tags: ['vegetarian'] }), servings: 1 }], p);
    assert.ok(validateWeek(bad, { profile: p, avoidTokens: tokens }).some((v) => v.code === 'allergen' && v.severity === 'error'));
    const meat = week(() => [{ food: food('kebab', { tags: ['meat'] }), servings: 1 }], p);
    assert.ok(validateWeek(meat, { profile: p, avoidTokens: [] }).some((v) => v.code === 'diet_style'));
    const eggplant = week(() => [{ food: food('kashk', { nameFa: 'کشک بادمجان', tags: ['vegetarian'] }), servings: 1 }], p);
    assert.ok(validateWeek(eggplant, { profile: p, avoidTokens: tokens }).some((v) => v.code === 'avoided_food'));

    const light = week(() => [{ food: food('tiny', { kcal: 100 }), servings: 1 }]);
    const found = validateWeek(light, { profile: profile(), avoidTokens: [] });
    assert.equal(found.some((v) => v.severity === 'error'), false);
    assert.ok(found.some((v) => v.code === 'kcal_slot' && v.severity === 'warn'));
    assert.ok(found.some((v) => v.code === 'kcal_day'));
    assert.ok(found.some((v) => v.code === 'fish_missing'));
  });

  it('flags a missing slot and a dish repeated too often', () => {
    const p = profile();
    const same = week(() => [{ food: food('ghorme', { kcal: 400 }), servings: 1 }]);
    assert.ok(validateWeek(same, { profile: p, avoidTokens: [] }).some((v) => v.code === 'repeat_main'));
    const gap = same.filter((meal) => !(meal.day === 3 && meal.slot.mealType === 'dinner'));
    assert.ok(validateWeek(gap, { profile: p, avoidTokens: [] }).some((v) => v.code === 'slot_missing' && v.severity === 'error'));
    assert.equal(dayTotals(same).length, 7);
  });

  it('matches avoided words across Arabic and Persian letter forms', () => {
    const tokens = avoidTokensOf('كدو');
    assert.ok(containsAvoided(food('x', { nameFa: 'خورشت کدو' }), tokens));
    assert.equal(containsAvoided(food('y', { nameFa: 'آبگوشت' }), tokens), null);
  });

  it('keeps required placeholders in the default prompts and renders them', () => {
    for (const key of ['plan_draft', 'plan_critic'] as const) {
      for (const placeholder of REQUIRED_PLACEHOLDERS[key]) assert.ok(DEFAULT_PROMPTS[key].userTemplate.includes(placeholder), `${key} ${placeholder}`);
    }
    assert.equal(renderTemplate('a {{x}} b {{y}}', { x: '1' }), 'a 1 b ');
  });

  it('knows the Iranian seasons', () => {
    assert.equal(seasonOf(new Date('2026-04-10T00:00:00Z')), 'spring');
    assert.equal(seasonOf(new Date('2026-07-10T00:00:00Z')), 'summer');
    assert.equal(seasonOf(new Date('2026-11-08T00:00:00Z')), 'autumn');
    assert.equal(seasonOf(new Date('2026-01-10T00:00:00Z')), 'winter');
  });
});
