import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseCsv } from '../../src/food/csv.js';
import { foodInputSchema, prefixQuery } from '../../src/food/food.service.js';
import { SEED_FOODS } from '../../src/food/seed.js';
import { DISH_PICKER } from '../../src/onboarding/spec.js';

describe('food catalogue seed', () => {
  it('has unique slugs and every onboarding dish', () => {
    const slugs = SEED_FOODS.map((food) => food.slug);
    assert.equal(new Set(slugs).size, slugs.length);
    for (const [slug] of DISH_PICKER) assert.ok(slugs.includes(slug), `missing dish ${slug}`);
    assert.ok(SEED_FOODS.length >= 100);
  });

  it('keeps each row valid and its energy consistent with its macros', () => {
    for (const food of SEED_FOODS) {
      const parsed = foodInputSchema.safeParse({ ...food, active: true });
      assert.ok(parsed.success, `${food.slug}: ${parsed.success ? '' : JSON.stringify(parsed.error.issues[0])}`);
      const fromMacros = 4 * food.proteinG + 4 * food.carbsG + 9 * food.fatG;
      assert.ok(
        Math.abs(fromMacros - food.kcal) <= Math.max(60, food.kcal * 0.25),
        `${food.slug}: ${food.kcal} kcal vs ${Math.round(fromMacros)} from macros`,
      );
    }
  });

  it('covers every meal slot with enough variety for a week without repeats', () => {
    for (const meal of ['breakfast', 'lunch', 'dinner', 'snack'] as const) {
      assert.ok(SEED_FOODS.filter((food) => food.mealTypes.includes(meal)).length >= 14, meal);
    }
    const vegan = SEED_FOODS.filter((food) => food.tags.includes('vegan') && food.mealTypes.includes('lunch'));
    assert.ok(vegan.length >= 5);
    const noDairy = SEED_FOODS.filter((food) => !food.allergens.includes('dairy') && food.mealTypes.includes('breakfast'));
    assert.ok(noDairy.length >= 5);
  });

  it('derives diet tags from the rows', () => {
    const bySlug = new Map(SEED_FOODS.map((food) => [food.slug, food]));
    assert.ok(!bySlug.get('fesenjan')!.tags.includes('vegetarian'));
    assert.ok(bySlug.get('adas_polo')!.tags.includes('vegan'));
    assert.ok(!bySlug.get('kashk_bademjan')!.tags.includes('vegan'));
    assert.ok(bySlug.get('kashk_bademjan')!.tags.includes('vegetarian'));
    assert.ok(bySlug.get('kabab_koobideh')!.tags.includes('meat'));
  });
});

describe('catalogue helpers', () => {
  it('builds prefix queries from Persian words and drops punctuation', () => {
    assert.equal(prefixQuery('قورمه سبزی'), 'قورمه:* & سبزی:*');
    assert.equal(prefixQuery("'; drop table"), 'drop:* & table:*');
    assert.equal(prefixQuery('   '), '');
  });

  it('reads quoted CSV fields', () => {
    assert.deepEqual(parseCsv('a,"b,c","d ""q"""\r\n1,2,3\n'), [['a', 'b,c', 'd "q"'], ['1', '2', '3']]);
  });
});
