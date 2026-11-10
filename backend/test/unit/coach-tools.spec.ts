import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { FoodView } from '../../src/food/food.service.js';
import { buildContext } from '../../src/coach/context.js';
import { SAFETY_SECTION } from '../../src/coach/prompts.js';
import { runTool, type ToolDeps } from '../../src/coach/tools.js';
import { SafetyGuard } from '../../src/coach/safety.js';
import type { CoachProfile, EntryItem, TodaySummary } from '../../src/coach/types.js';

function food(overrides: Partial<FoodView> & { slug: string; nameFa: string; kcal: number }): FoodView {
  return {
    id: overrides.slug,
    category: 'main',
    mealTypes: ['lunch'],
    servingLabel: 'یک پرس',
    servingG: 300,
    proteinG: 20,
    carbsG: 45,
    fatG: 12,
    fiberG: 4,
    allergens: [],
    tags: [],
    regions: [],
    seasons: [],
    costTier: 1,
    prepMinutes: 30,
    ingredients: [{ name: 'برنج', quantity: 80, unit: 'g', category: 'grains' }],
    image: null,
    active: true,
    source: 'seed',
    ...overrides,
  };
}

function profile(overrides: Partial<CoachProfile> = {}): CoachProfile {
  return {
    userId: '11111111-1111-7111-8111-111111111111',
    track: 'weight_loss',
    goal: 'weight_loss',
    sex: 'female',
    age: 32,
    heightCm: 165,
    weightKg: 78,
    targetWeightKg: 68,
    activity: 'moderate',
    bmi: 28.6,
    tdeeKcal: 2100,
    targetKcal: 1600,
    proteinG: 90,
    carbsG: 160,
    fatG: 50,
    dietStyle: 'omnivore',
    mealsPerDay: 3,
    allergens: [],
    conditions: [],
    riskFlags: [],
    safetyTier: 'ai_ok',
    consented: true,
    preferences: {},
    displayName: 'نگار',
    ...overrides,
  };
}

function today(): TodaySummary {
  return {
    date: '2026-06-01',
    hasProfile: true,
    calories: { target: 1600, consumed: 200, remaining: 1400, percent: 12, partial: false },
    macros: {
      proteinG: { consumed: 10, target: 90 },
      carbsG: { consumed: 20, target: 160 },
      fatG: { consumed: 5, target: 50 },
      partial: false,
    },
    water: { ml: 250, targetMl: 2000 },
    weight: { latestKg: 78, latestDate: '2026-05-30', deltaKg7d: -0.4, targetKg: 68, series: [] },
    streakDays: 2,
    nextMeal: null,
    planMeals: [],
  };
}

function deps(overrides: Partial<ToolDeps> = {}): ToolDeps {
  const base: ToolDeps = {
    now: () => new Date('2026-06-01T08:00:00.000Z'),
    searchFoods: async () => [],
    foodsBySlugs: async () => new Map(),
    candidateFoods: async () => [],
    recentSuggestedSlugs: async () => [],
    today: async () => today(),
    planMeals: async () => ({ versionId: null, meals: [] }),
    weightSeries: async () => [],
    setWeight: async (_userId, kilograms) => ({ date: '2026-06-01', kilograms }),
    addWater: async (_userId, _date, ml) => ml,
    createEntry: async (input) => ({
      id: '22222222-2222-7222-8222-222222222222',
      userId: input.userId,
      threadId: input.threadId,
      messageId: null,
      mediaId: null,
      civilDate: input.civilDate,
      mealType: input.mealType,
      title: input.title,
      source: input.source,
      items: input.items,
      totals: input.totals,
      confidence: input.confidence,
      status: input.status,
      planMealUid: input.planMealUid ?? null,
    }),
    linkToPlan: async () => null,
    saveMemory: async () => true,
    engage: async () => true,
    lastEngagement: async () => null,
    countEngagementToday: async () => 0,
    updateTarget: async () => undefined,
    openCare: async () => ({ conversationId: null }),
    analyzePhoto: async () => ({ card: { type: 'system_note', payload: { code: 'x', text: 'نه' }, fallbackText: 'نه' }, result: { ok: false }, entryId: null }),
  };
  return { ...base, ...overrides };
}

const guard = new SafetyGuard();
const ctx = (user = profile(), extra: Partial<ToolDeps> = {}) => ({
  userId: user.userId,
  threadId: '33333333-3333-7333-8333-333333333333',
  profile: user,
  deps: deps(extra),
  guard,
  disabled: new Set<string>(),
});

describe('coach tools', () => {
  it('searches the catalogue and refuses unknown arguments', async () => {
    const dish = food({ slug: 'gheymeh', nameFa: 'خورش قیمه', kcal: 420 });
    const found = await runTool(ctx(profile(), { searchFoods: async () => [dish] }), 'search_food', JSON.stringify({ query: 'قیمه' }));
    const body = JSON.parse(found.content) as { foods: Array<{ kcal: number; name: string }> };
    assert.equal(found.ok, true);
    assert.equal(body.foods[0]!.kcal, 420);
    assert.equal(body.foods[0]!.name, 'خورش قیمه');
    assert.equal(found.card, undefined);

    const extra = await runTool(ctx(), 'search_food', JSON.stringify({ query: 'قیمه', invented: true }));
    assert.equal(extra.ok, false);
    assert.match(JSON.parse(extra.content).error, /invalid_arguments/);
  });

  it('suggests a meal whose calories come from the catalogue, with a photo hint', async () => {
    const dish = food({ slug: 'kobideh', nameFa: 'کباب کوبیده', kcal: 500, category: 'main' });
    let stored: EntryItem[] = [];
    const run = await runTool(ctx(profile(), {
      candidateFoods: async () => [dish],
      createEntry: async (input) => {
        stored = input.items;
        return {
          id: '22222222-2222-7222-8222-222222222222',
          userId: input.userId, threadId: input.threadId, messageId: null, mediaId: null,
          civilDate: input.civilDate, mealType: input.mealType, title: input.title, source: input.source,
          items: input.items, totals: input.totals, confidence: null, status: input.status, planMealUid: null,
        };
      },
    }), 'suggest_meal', JSON.stringify({ meal_type: 'lunch', photo_hint: ['کباب'] }));
    assert.equal(run.card?.type, 'meal_card');
    assert.deepEqual(run.card?.payload.photoHint, ['کباب']);
    assert.equal(run.card?.payload.status, 'suggested');
    assert.ok(stored[0]!.kcal > 0);
    assert.equal(stored[0]!.estimated, false);
    assert.equal(stored[0]!.slug, 'kobideh');
  });

  it('logs a catalogue food and refuses a food with no calories', async () => {
    const dish = food({ slug: 'mast', nameFa: 'ماست', kcal: 80, category: 'dairy', mealTypes: ['lunch', 'snack'] });
    const logged = await runTool(ctx(profile(), {
      foodsBySlugs: async () => new Map([['mast', dish]]),
    }), 'log_meal', JSON.stringify({ meal_type: 'lunch', items: [{ name: 'ماست', slug: 'mast', servings: 1 }] }));
    assert.equal(logged.ok, true);
    assert.equal(logged.card?.type, 'meal_card');
    assert.equal(logged.card?.payload.status, 'logged');
    assert.equal((logged.card?.payload.totals as { kcal: number }).kcal, 80);

    const missing = await runTool(ctx(), 'log_meal', JSON.stringify({ items: [{ name: 'غذای خیالی' }] }));
    assert.equal(missing.ok, false);
    assert.equal(JSON.parse(missing.content).error, 'unresolved_items');
  });

  it('clamps a calorie target, blocks minors, and enforces the cooldown', async () => {
    let saved: number | null = null;
    const changed = await runTool(ctx(profile(), {
      updateTarget: async (_userId, target) => {
        saved = target.targetKcal;
      },
    }), 'adjust_nutrition_target', JSON.stringify({ target_kcal: 900, reason: 'گرسنه می‌مانم و انرژی ندارم' }));
    assert.equal(changed.ok, true);
    assert.equal(saved, 1400);
    assert.equal(JSON.parse(changed.content).clamped, true);
    assert.equal(changed.card?.type, 'system_note');

    const minor = await runTool(ctx(profile({ age: 16 })), 'adjust_nutrition_target', JSON.stringify({ target_kcal: 1500, reason: 'می‌خواهم کمتر بخورم امروز' }));
    assert.equal(minor.ok, false);
    assert.equal(JSON.parse(minor.content).reason, 'minor');

    const cooled = await runTool(ctx(profile(), {
      lastEngagement: async () => ({ at: new Date('2026-05-30T08:00:00.000Z'), detail: {} }),
    }), 'adjust_nutrition_target', JSON.stringify({ target_kcal: 1500, reason: 'دوباره تغییر بده لطفاً' }));
    assert.equal(JSON.parse(cooled.content).error, 'cooldown');
  });
});

describe('coach ContextBuilder', () => {
  const user = profile();
  const base = {
    systemPrompt: 'تو مربی تغذیه هستی.',
    directives: ['کاربر دیابت دارد.'],
    profile: user,
    today: today(),
    memories: [{ id: 'm1', kind: 'dislike', content: 'عدس دوست ندارد', importance: 3 }],
    summary: 'دیروز ناهار را ثبت کرد.',
    now: new Date('2026-06-01T08:00:00.000Z'),
    current: { text: 'امروز چقدر مانده؟' },
  };

  it('appends the immutable safety section and treats memory as data', () => {
    const messages = buildContext({ ...base, history: [] });
    const system = messages.filter((message) => message.role === 'system').map((message) => String(message.content)).join('\n');
    assert.match(system, /تو مربی تغذیه هستی/);
    assert.ok(system.includes(SAFETY_SECTION.slice(0, 24)));
    assert.match(system, /دیابت/);
    assert.match(system, /هدف کالری روزانه: 1600/);
    assert.match(system, /<user_memory>/);
    assert.match(system, /عدس دوست ندارد/);
    assert.equal(messages.at(-1)?.role, 'user');
    assert.match(String(messages.at(-1)?.content), /چقدر مانده/);
  });

  it('keeps the recent history inside the character budget and attaches a photo id', () => {
    const history = [
      { id: '1', seq: 1, role: 'user' as const, type: 'text' as const, payload: { text: 'قدیمی' }, fallbackText: 'این پیام قدیمی است و باید از پنجره خارج شود چون بودجه کم است.', clientMessageId: null, replyTo: null, createdAt: '2026-06-01T00:00:00.000Z' },
      { id: '2', seq: 2, role: 'assistant' as const, type: 'text' as const, payload: { text: 'باشه' }, fallbackText: 'باشه.', clientMessageId: null, replyTo: null, createdAt: '2026-06-01T00:01:00.000Z' },
      { id: '3', seq: 3, role: 'user' as const, type: 'text' as const, payload: { text: 'تازه' }, fallbackText: 'ناهار', clientMessageId: null, replyTo: null, createdAt: '2026-06-01T00:02:00.000Z' },
    ];
    const messages = buildContext({
      ...base,
      history,
      historyCharBudget: 20,
      current: { text: 'این عکس را ببین', photoMediaId: '44444444-4444-7444-8444-444444444444' },
    });
    const joined = messages.map((message) => String(message.content)).join('\n');
    assert.doesNotMatch(joined, /پیام قدیمی/);
    assert.match(joined, /ناهار/);
    assert.match(joined, /media_id=44444444-4444-7444-8444-444444444444/);
  });
});
