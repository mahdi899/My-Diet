import { z } from 'zod';
import type { ToolSpec } from '../ai/pool/types.js';
import { uuidv7 } from '../common/id.js';
import { addCivilDays } from '../common/time.js';
import type { CandidateFilter, FoodView } from '../food/food.service.js';
import { Cards, MEAL_LABEL, totalsOf } from './cards.js';
import { composeSuggestion, estimatedItem, itemOf, mealTypeAt, nearestServing, rescaleMacros } from './foods.js';
import { tehranClock } from './clock.js';
import { SafetyGuard } from './safety.js';
import type { FoodEntryRow } from './store.js';
import { normalizeFa, round0 } from './text.js';
import type { CardSpec, CoachProfile, EntryItem, Json, MacroTotals, MealType, PlanMealView, TodaySummary } from './types.js';
import { CoachError, MEAL_TYPES } from './types.js';

/** Everything tools may touch, as narrow functions. The service wires real implementations; unit tests pass fakes. */
export interface ToolDeps {
  now(): Date;
  searchFoods(query: string, options: { limit?: number; excludeAllergens: string[]; mealType?: MealType }): Promise<FoodView[]>;
  foodsBySlugs(slugs: string[]): Promise<Map<string, FoodView>>;
  candidateFoods(filter: CandidateFilter): Promise<FoodView[]>;
  recentSuggestedSlugs(userId: string): Promise<string[]>;
  today(userId: string): Promise<TodaySummary>;
  planMeals(userId: string, date: string): Promise<{ versionId: string | null; meals: PlanMealView[] }>;
  weightSeries(userId: string): Promise<Array<{ date: string; kilograms: number }>>;
  setWeight(userId: string, kilograms: number): Promise<{ date: string; kilograms: number }>;
  addWater(userId: string, date: string, ml: number): Promise<number>;
  createEntry(input: Parameters<CreateEntry>[0]): Promise<FoodEntryRow>;
  linkToPlan(userId: string, date: string, mealType: MealType, explicitUid: string | null, foodName: string): Promise<string | null>;
  saveMemory(userId: string, kind: string, content: string): Promise<boolean>;
  engage(userId: string, kind: string, day: string, detail?: Json, dedupeKey?: string | null): Promise<boolean>;
  lastEngagement(userId: string, kind: string): Promise<{ at: Date; detail: Json } | null>;
  countEngagementToday(userId: string, day: string, kinds: string[]): Promise<number>;
  updateTarget(userId: string, target: { targetKcal: number; proteinG: number; carbsG: number; fatG: number }): Promise<void>;
  openCare(userId: string): Promise<{ conversationId: string | null }>;
  analyzePhoto(userId: string, mediaId: string, mealTypeHint: MealType | null): Promise<{ card: CardSpec; result: Json; entryId: string | null }>;
}

type CreateEntry = (input: {
  userId: string;
  threadId: string | null;
  civilDate: string;
  mealType: MealType;
  title: string;
  source: 'photo' | 'suggestion' | 'manual';
  items: EntryItem[];
  totals: MacroTotals;
  confidence: number | null;
  status: 'suggested' | 'logged';
  planMealUid?: string | null;
}) => Promise<FoodEntryRow>;

export interface ToolContext {
  userId: string;
  threadId: string;
  profile: CoachProfile;
  deps: ToolDeps;
  guard: SafetyGuard;
  /** Tool names switched off for this turn. */
  disabled: Set<string>;
}

export interface ToolOutcome {
  /** What the model sees. Keep it small. */
  result: Json;
  card?: CardSpec;
  entryId?: string | null;
}

interface ToolDef<S extends z.ZodType> {
  name: string;
  description: string;
  schema: S;
  run(ctx: ToolContext, args: z.infer<S>): Promise<ToolOutcome>;
}

function defineTool<S extends z.ZodType>(def: ToolDef<S>): ToolDef<S> {
  return def;
}

const mealType = z.enum(['breakfast', 'lunch', 'dinner', 'snack']);
const failure = (code: string, message: string, extra: Json = {}): ToolOutcome => ({ result: { ok: false, error: code, message, ...extra } });

const SENSITIVE_MEMORY = /\d{8,}|@|https?:|www\.|password|رمز|کد ملی|شماره کارت|iban|ignore (all |the )?(previous|above)|دستور(ات)? (قبلی|سیستم)|نادیده بگیر/i;

function todayOf(deps: ToolDeps): string {
  return tehranClock(deps.now()).date;
}

function findMeal(meals: PlanMealView[], type: MealType | undefined, uid?: string): PlanMealView | null {
  if (uid) return meals.find((meal) => meal.mealUid === uid) ?? null;
  const matching = type ? meals.filter((meal) => meal.mealType === type) : meals;
  return matching.find((meal) => meal.state === 'unrecorded') ?? matching[0] ?? null;
}

const searchFood = defineTool({
  name: 'search_food',
  description: 'جست‌وجوی غذا در کاتالوگ غذاهای ایرانی و گرفتن کالری و درشت‌مغذی دقیق هر پرس. قبل از گفتن هر عدد کالری استفاده کن.',
  schema: z.object({ query: z.string().trim().min(1).max(60), meal_type: mealType.optional(), limit: z.number().int().min(1).max(6).optional() }).strict(),
  async run(ctx, args) {
    const foods = await ctx.deps.searchFoods(args.query, {
      limit: args.limit ?? 5,
      excludeAllergens: ctx.profile.allergens,
      ...(args.meal_type ? { mealType: args.meal_type } : {}),
    });
    return {
      result: {
        ok: true,
        foods: foods.map((food) => ({
          slug: food.slug, name: food.nameFa, serving: food.servingLabel, kcal: food.kcal, protein_g: food.proteinG, carbs_g: food.carbsG, fat_g: food.fatG,
        })),
        note: foods.length ? 'اعداد برای یک پرس است.' : 'در کاتالوگ پیدا نشد؛ از کاربر مقدار بخواه یا برآورد خودش را در log_meal بگیر.',
      },
    };
  },
});

const suggestMeal = defineTool({
  name: 'suggest_meal',
  description: 'پیشنهاد یک وعده از کاتالوگ با کالری نزدیک به هدف. کارت وعده را به کاربر نشان می‌دهد؛ photo_hint چند کلیدواژهٔ کوتاه برای تصویر غذا (مثلاً نام غذا).',
  schema: z.object({
    meal_type: mealType,
    target_kcal: z.number().int().min(80).max(1500).optional(),
    note: z.string().trim().max(120).optional(),
    photo_hint: z.array(z.string().trim().min(1).max(40)).max(4).optional(),
  }).strict(),
  async run(ctx, args) {
    const today = await ctx.deps.today(ctx.userId);
    const share: Record<MealType, number> = { breakfast: 0.27, lunch: 0.36, dinner: 0.27, snack: 0.1 };
    const fallbackTarget = Math.round((ctx.profile.targetKcal * share[args.meal_type]) / 5) * 5;
    const target = Math.min(args.target_kcal ?? fallbackTarget, Math.max(150, today.calories.remaining > 0 ? today.calories.remaining : fallbackTarget));
    const recent = await ctx.deps.recentSuggestedSlugs(ctx.userId);
    const diet = ctx.profile.dietStyle === 'vegetarian' || ctx.profile.dietStyle === 'vegan' ? ctx.profile.dietStyle : undefined;
    const filter: CandidateFilter = {
      mealType: args.meal_type,
      excludeAllergens: ctx.profile.allergens,
      excludeSlugs: recent.slice(0, 12),
      nearKcal: target,
      limit: 30,
      ...(diet ? { diet } : {}),
    };
    let candidates = await ctx.deps.candidateFoods(filter);
    if (candidates.length === 0) candidates = await ctx.deps.candidateFoods({ ...filter, excludeSlugs: [] });
    const items = composeSuggestion(candidates, target, recent.length);
    if (items.length === 0) return failure('no_candidates', 'غذای مناسبی در کاتالوگ پیدا نشد.');
    const totals = totalsOf(items);
    const title = items.map((item) => item.name).join(' + ');
    const entry = await ctx.deps.createEntry({
      userId: ctx.userId, threadId: ctx.threadId, civilDate: todayOf(ctx.deps), mealType: args.meal_type, title, source: 'suggestion',
      items, totals, confidence: null, status: 'suggested',
    });
    const hints = (args.photo_hint?.length ? args.photo_hint : items.map((item) => item.name)).slice(0, 4);
    return {
      entryId: entry.id,
      card: Cards.mealCard({
        entryId: entry.id, title, mealType: args.meal_type, source: 'suggestion', status: 'suggested', items, confidence: null,
        photoHint: hints, note: args.note ?? '', remainingKcal: today.calories.remaining - totals.kcal,
      }),
      result: { ok: true, entry_id: entry.id, title, items: items.map((item) => ({ name: item.name, servings: item.servings, kcal: item.kcal })), totals, remaining_after_kcal: today.calories.remaining - totals.kcal },
    };
  },
});

const showPlanMeal = defineTool({
  name: 'show_plan_meal',
  description: 'نمایش وعدهٔ برنامهٔ غذایی کاربر (امروز یا یکی از روزهای آینده) به‌صورت کارت.',
  schema: z.object({ meal_type: mealType.optional(), date: z.iso.date().optional() }).strict(),
  async run(ctx, args) {
    const today = todayOf(ctx.deps);
    const date = args.date ?? today;
    if (date < today || date > addCivilDays(today, 7)) return failure('bad_date', 'فقط امروز و هفتهٔ آینده قابل نمایش است.');
    const plan = await ctx.deps.planMeals(ctx.userId, date);
    const meal = findMeal(plan.meals, args.meal_type);
    if (!meal) return failure('no_plan', 'برای این روز برنامهٔ منتشرشده‌ای نیست.');
    return {
      card: Cards.planMeal({ date, versionId: plan.versionId, meal }),
      result: { ok: true, meal_type: meal.mealType, title: meal.title, planned_kcal: meal.plannedKcal, time: meal.suggestedTime, state: meal.state },
    };
  },
});

const swapPlanMeal = defineTool({
  name: 'swap_plan_meal',
  description: 'پیشنهاد جایگزین هم‌کالری برای وعدهٔ امروز یا فردا از گزینه‌های تأییدشدهٔ متخصص. چیزی تغییر نمی‌کند تا کاربر روی کارت تأیید کند.',
  schema: z.object({ meal_type: mealType.optional(), date: z.iso.date().optional(), reason: z.string().trim().max(120).optional() }).strict(),
  async run(ctx, args) {
    const today = todayOf(ctx.deps);
    const date = args.date ?? today;
    if (date < today || date > addCivilDays(today, 1)) return failure('bad_date', 'جایگزینی فقط برای امروز و فردا ممکن است.');
    const plan = await ctx.deps.planMeals(ctx.userId, date);
    const meal = findMeal(plan.meals, args.meal_type);
    if (!meal || !plan.versionId) return failure('no_plan', 'برای این روز برنامهٔ منتشرشده‌ای نیست.');
    if (meal.state !== 'unrecorded') return failure('already_logged', 'این وعده قبلاً ثبت شده و جایگزین نمی‌شود.');
    const current = meal.options.find((option) => option.optionId === meal.selectedOptionId) ?? meal.options.find((option) => option.kind === 'primary');
    if (!current || current.kcal == null) return failure('no_alternative', 'گزینهٔ جایگزین تأییدشده‌ای نیست.');
    const tolerance = Math.max(40, current.kcal * 0.15);
    const alternative = meal.options
      .filter((option) => option.optionId !== current.optionId && option.kcal != null && Math.abs(option.kcal - current.kcal!) <= tolerance)
      .sort((a, b) => Math.abs(a.kcal! - current.kcal!) - Math.abs(b.kcal! - current.kcal!))[0];
    if (!alternative) return failure('no_alternative', 'جایگزین هم‌کالری در برنامه نیست؛ می‌توانی از متخصص بخواهی گزینه اضافه کند.');
    const proposal = {
      status: 'pending',
      commandId: uuidv7(),
      date,
      versionId: plan.versionId,
      mealUid: meal.mealUid,
      expectedRevision: meal.selectionRevision,
      reasonId: 'preference',
      fromOptionId: current.optionId,
      fromTitle: current.title,
      fromKcal: current.kcal,
      toOptionId: alternative.optionId,
      toTitle: alternative.title,
      toKcal: alternative.kcal,
      deltaKcal: round0((alternative.kcal ?? 0) - current.kcal),
    };
    return {
      card: Cards.planMeal({ date, versionId: plan.versionId, meal, proposal }),
      result: { ok: true, proposal_pending_user_confirmation: true, from: current.title, to: alternative.title, from_kcal: current.kcal, to_kcal: alternative.kcal, delta_kcal: proposal.deltaKcal },
    };
  },
});

const logMeal = defineTool({
  name: 'log_meal',
  description: 'ثبت غذایی که کاربر خورده. هر آیتم باید در کاتالوگ پیدا شود یا کاربر کالری‌اش را گفته باشد (kcal).',
  schema: z.object({
    meal_type: mealType.optional(),
    title: z.string().trim().min(1).max(120).optional(),
    items: z.array(z.object({
      name: z.string().trim().min(1).max(80),
      slug: z.string().trim().max(80).optional(),
      servings: z.number().min(0.25).max(6).optional(),
      kcal: z.number().int().min(10).max(2000).optional(),
    }).strict()).min(1).max(8),
    plan_meal_uid: z.uuid().optional(),
  }).strict(),
  async run(ctx, args) {
    const clock = tehranClock(ctx.deps.now());
    const type = args.meal_type ?? mealTypeAt(clock.minutes);
    const items: EntryItem[] = [];
    const unresolved: string[] = [];
    const warnings: string[] = [];
    const bySlug = await ctx.deps.foodsBySlugs(args.items.map((item) => item.slug).filter((slug): slug is string => Boolean(slug)));
    for (const raw of args.items) {
      const servings = nearestServing(raw.servings ?? 1);
      let food: FoodView | undefined = raw.slug ? bySlug.get(raw.slug) : undefined;
      if (!food) food = (await ctx.deps.searchFoods(raw.name, { limit: 1, excludeAllergens: [] }))[0];
      if (food) {
        items.push(itemOf(food, servings));
        if (food.allergens.some((allergen) => ctx.profile.allergens.includes(allergen))) warnings.push(`«${food.nameFa}» با حساسیت ثبت‌شدهٔ کاربر هم‌پوشانی دارد`);
      } else if (raw.kcal != null) items.push(estimatedItem(raw.name, raw.kcal * (raw.servings ?? 1), raw.servings ?? 1));
      else unresolved.push(raw.name);
    }
    if (unresolved.length) return failure('unresolved_items', 'این غذاها در کاتالوگ نیست و کالری هم داده نشده.', { unresolved, hint: 'مقدار یا کالری تقریبی را از کاربر بپرس.' });
    const totals = totalsOf(items);
    const title = args.title ?? items.map((item) => item.name).join(' + ');
    const date = clock.date;
    const planMealUid = await ctx.deps.linkToPlan(ctx.userId, date, type, args.plan_meal_uid ?? null, title);
    const entry = await ctx.deps.createEntry({
      userId: ctx.userId, threadId: ctx.threadId, civilDate: date, mealType: type, title, source: 'manual', items, totals, confidence: null, status: 'logged', planMealUid,
    });
    const today = await ctx.deps.today(ctx.userId);
    return {
      entryId: entry.id,
      card: Cards.mealCard({ entryId: entry.id, title, mealType: type, source: 'manual', status: 'logged', items, confidence: null, planMealUid, remainingKcal: today.calories.remaining }),
      result: { ok: true, entry_id: entry.id, title, totals, remaining_kcal: today.calories.remaining, linked_to_plan: planMealUid !== null, warnings },
    };
  },
});

const analyzeFoodPhoto = defineTool({
  name: 'analyze_food_photo',
  description: 'تحلیل عکس غذایی که کاربر فرستاده (media_id از پیام کاربر). نتیجه به‌صورت کارت وعده با دکمهٔ تأیید نمایش داده می‌شود.',
  schema: z.object({ media_id: z.uuid(), meal_type: mealType.optional() }).strict(),
  async run(ctx, args) {
    const outcome = await ctx.deps.analyzePhoto(ctx.userId, args.media_id, args.meal_type ?? null);
    return { card: outcome.card, entryId: outcome.entryId, result: outcome.result };
  },
});

const showCalorieRing = defineTool({
  name: 'show_calorie_ring',
  description: 'نمایش حلقهٔ کالری امروز: هدف، مصرف‌شده، باقی‌مانده، درشت‌مغذی و آب.',
  schema: z.object({}).strict(),
  async run(ctx) {
    const today = await ctx.deps.today(ctx.userId);
    return {
      card: Cards.calorieRing(today),
      result: { ok: true, target_kcal: today.calories.target, consumed_kcal: today.calories.consumed, remaining_kcal: today.calories.remaining, partial: today.calories.partial, water_ml: today.water.ml, streak_days: today.streakDays },
    };
  },
});

const logWeight = defineTool({
  name: 'log_weight',
  description: 'ثبت وزن امروز کاربر (کیلوگرم). اگر تغییر خیلی ناگهانی بود از کاربر تأیید بگیر و confirm=true بفرست.',
  schema: z.object({ kilograms: z.number().min(25).max(300), confirm: z.boolean().optional() }).strict(),
  async run(ctx, args) {
    const series = await ctx.deps.weightSeries(ctx.userId);
    const date = todayOf(ctx.deps);
    const previous = [...series].reverse().find((entry) => entry.date < date) ?? null;
    const reference = previous ?? { date: '', kilograms: ctx.profile.weightKg };
    const recent = previous != null && previous.date >= addCivilDays(date, -3);
    if (recent && Math.abs(args.kilograms - reference.kilograms) > 5 && !args.confirm) {
      return failure('suspicious_change', `تغییر بیش از ۵ کیلو نسبت به ${reference.kilograms} است؛ از کاربر بپرس مطمئن است؟`);
    }
    const saved = await ctx.deps.setWeight(ctx.userId, round1k(args.kilograms));
    const next = (await ctx.deps.weightSeries(ctx.userId)).slice(-14);
    return {
      card: Cards.weighIn({ date: saved.date, kilograms: saved.kilograms, previousKg: previous?.kilograms ?? null, targetKg: ctx.profile.targetWeightKg, series: next }),
      result: { ok: true, kilograms: saved.kilograms, previous_kg: previous?.kilograms ?? null, target_kg: ctx.profile.targetWeightKg },
    };
  },
});

const round1k = (value: number) => Math.round(value * 10) / 10;

const logWater = defineTool({
  name: 'log_water',
  description: 'ثبت آب نوشیده‌شده به میلی‌لیتر (یک لیوان ≈ ۲۵۰).',
  schema: z.object({ ml: z.number().int().min(50).max(1500) }).strict(),
  async run(ctx, args) {
    const date = todayOf(ctx.deps);
    const total = await ctx.deps.addWater(ctx.userId, date, args.ml);
    const today = await ctx.deps.today(ctx.userId);
    return {
      card: Cards.water({ date, ml: total, addedMl: args.ml, targetMl: today.water.targetMl }),
      result: { ok: true, added_ml: args.ml, total_ml: total, target_ml: today.water.targetMl },
    };
  },
});

const COOLDOWN_DAYS = 7;

const adjustTarget = defineTool({
  name: 'adjust_nutrition_target',
  description: 'تغییر هدف کالری روزانه. فقط وقتی کاربر صریحاً خواست و دلیل منطقی هست. ابزار سقف، کف ایمن، حداکثر ۲۰۰ کالری در هر تغییر و فاصلهٔ ۷ روز را اعمال می‌کند.',
  schema: z.object({ target_kcal: z.number().int().min(800).max(4500), reason: z.string().trim().min(5).max(200) }).strict(),
  async run(ctx, args) {
    const bounds = ctx.guard.targetBounds(ctx.profile);
    if (!bounds.allowed) {
      return failure('not_allowed', 'تغییر هدف کالری برای این کاربر مجاز نیست؛ باید با متخصص هماهنگ شود.', { reason: bounds.reason });
    }
    const current = ctx.profile.targetKcal;
    if (ctx.profile.bmi < 18.5 && args.target_kcal < current) return failure('not_allowed', 'کاهش کالری برای وزن کم مجاز نیست.', { reason: 'underweight' });
    const last = await ctx.deps.lastEngagement(ctx.userId, 'target_change');
    const now = ctx.deps.now();
    if (last && now.getTime() - last.at.getTime() < COOLDOWN_DAYS * 86_400_000) {
      const next = new Date(last.at.getTime() + COOLDOWN_DAYS * 86_400_000).toISOString();
      return failure('cooldown', 'هدف کالری به‌تازگی تغییر کرده؛ باید چند روز صبر کرد.', { next_allowed_at: next });
    }
    let requested = Math.min(bounds.ceiling, Math.max(bounds.floor, args.target_kcal));
    requested = Math.min(current + bounds.maxStep, Math.max(current - bounds.maxStep, requested));
    requested = Math.round(requested / 5) * 5;
    requested = Math.min(bounds.ceiling, Math.max(bounds.floor, requested));
    if (requested === current) return failure('no_change', 'با سقف و کف ایمن، تغییری ممکن نیست.', { floor_kcal: bounds.floor, ceiling_kcal: bounds.ceiling });
    const macros = rescaleMacros(requested, ctx.profile.proteinG);
    await ctx.deps.updateTarget(ctx.userId, { targetKcal: requested, ...macros });
    await ctx.deps.engage(ctx.userId, 'target_change', todayOf(ctx.deps), { from: current, to: requested, reason: args.reason, asked: args.target_kcal });
    const clamped = requested !== args.target_kcal;
    return {
      card: Cards.systemNote('target_adjusted', `هدف کالری روزانه از ${current} به ${requested} تغییر کرد. برنامهٔ فعلی تا بازنگری متخصص همان است.`, {
        oldKcal: current, newKcal: requested, clamped, reason: args.reason, macros,
      }),
      result: { ok: true, old_kcal: current, new_kcal: requested, clamped, floor_kcal: bounds.floor, ceiling_kcal: bounds.ceiling, next_change_in_days: COOLDOWN_DAYS },
    };
  },
});

const MEMORY_KINDS = ['preference', 'dislike', 'allergy_note', 'habit', 'goal', 'schedule', 'health_note', 'other'] as const;

const saveMemory = defineTool({
  name: 'save_memory',
  description: 'ذخیرهٔ یک واقعیت پایدار دربارهٔ تغذیهٔ کاربر (ترجیح، بیزاری، عادت، ساعت غذا). اطلاعات هویتی و حساس ذخیره نکن.',
  schema: z.object({ kind: z.enum(MEMORY_KINDS), content: z.string().trim().min(3).max(200) }).strict(),
  async run(ctx, args) {
    if (SENSITIVE_MEMORY.test(normalizeFa(args.content)) || SENSITIVE_MEMORY.test(args.content)) return failure('sensitive', 'این مورد قابل ذخیره نیست.');
    const saved = await ctx.deps.saveMemory(ctx.userId, args.kind, args.content);
    return { result: { ok: true, saved, duplicate: !saved } };
  },
});

const showQuickReplies = defineTool({
  name: 'show_quick_replies',
  description: 'نمایش حداکثر ۴ پاسخ سریع کوتاه برای کاربر (هر کدام حداکثر ۴۰ نویسه).',
  schema: z.object({ replies: z.array(z.string().trim().min(1).max(40)).min(1).max(4) }).strict(),
  async run(_ctx, args) {
    return {
      card: Cards.quickReplies(args.replies.map((label, index) => ({ id: `qr${index + 1}`, label }))),
      result: { ok: true, shown: args.replies.length },
    };
  },
});

const planNextStep = defineTool({
  name: 'plan_next_step',
  description: 'یادداشت یک پیگیری برای بعد (مثلاً «بعد از شام وزن‌کشی»). سیستم در زمان مناسب یک پیام کوتاه می‌فرستد.',
  schema: z.object({ delay_minutes: z.number().int().min(30).max(2880), note: z.string().trim().min(3).max(140) }).strict(),
  async run(ctx, args) {
    const now = ctx.deps.now();
    const day = todayOf(ctx.deps);
    if ((await ctx.deps.countEngagementToday(ctx.userId, day, ['next_step'])) >= 3) return failure('limit', 'امروز پیگیری‌های کافی ثبت شده است.');
    const dueAt = new Date(now.getTime() + args.delay_minutes * 60_000).toISOString();
    await ctx.deps.engage(ctx.userId, 'next_step', day, { dueAt, note: args.note, sent: false });
    return { result: { ok: true, due_at: dueAt } };
  },
});

const escalate = defineTool({
  name: 'escalate_to_specialist',
  description: 'ارجاع کاربر به متخصص تغذیهٔ واقعی (گفتگوی مراقبت). برای مسائل پزشکی، نگرانی جدی یا وقتی نمی‌توانی مطمئن جواب بدهی.',
  schema: z.object({ reason: z.string().trim().min(5).max(300), urgent: z.boolean().optional() }).strict(),
  async run(ctx, args) {
    let conversationId: string | null;
    try {
      conversationId = (await ctx.deps.openCare(ctx.userId)).conversationId;
    } catch {
      conversationId = null;
    }
    await ctx.deps.engage(ctx.userId, 'escalation', todayOf(ctx.deps), { reason: args.reason, urgent: args.urgent === true, conversationId });
    const text = conversationId
      ? 'موضوع را برای متخصص تغذیه‌ات علامت زدم. می‌توانی همین حالا در گفتگوی مراقبت پیام بدهی.'
      : 'فعلاً متخصص فعالی به حساب تو تخصیص داده نشده. اگر موضوع فوری است با پزشک تماس بگیر؛ بعد از تخصیص، می‌توانی از بخش مراقبت پیام بدهی.';
    return {
      card: Cards.systemNote(conversationId ? 'escalated' : 'no_specialist', text, { conversationId, urgent: args.urgent === true }),
      result: { ok: true, care_conversation_available: conversationId !== null },
    };
  },
});

export const TOOLS = [
  searchFood, suggestMeal, showPlanMeal, swapPlanMeal, logMeal, analyzeFoodPhoto, showCalorieRing, logWeight, logWater,
  adjustTarget, saveMemory, showQuickReplies, planNextStep, escalate,
] as unknown as Array<ToolDef<z.ZodType>>;

export const TOOL_NAMES = TOOLS.map((tool) => tool.name);

/** tool → card type, documented in coach-api-contract.md. */
export const TOOL_CARD: Record<string, string | null> = {
  search_food: null,
  suggest_meal: 'meal_card',
  show_plan_meal: 'plan_meal',
  swap_plan_meal: 'plan_meal',
  log_meal: 'meal_card',
  analyze_food_photo: 'meal_card',
  show_calorie_ring: 'calorie_ring',
  log_weight: 'weigh_in',
  log_water: 'water',
  adjust_nutrition_target: 'system_note',
  save_memory: null,
  show_quick_replies: 'quick_replies',
  plan_next_step: null,
  escalate_to_specialist: 'system_note',
};

function jsonSchemaOf(schema: z.ZodType): Record<string, unknown> {
  const out = z.toJSONSchema(schema, { io: 'input' }) as Record<string, unknown>;
  delete out.$schema;
  return out;
}

export function toolSpecs(disabled: ReadonlySet<string> = new Set()): ToolSpec[] {
  return TOOLS.filter((tool) => !disabled.has(tool.name)).map((tool) => ({
    type: 'function' as const,
    function: { name: tool.name, description: tool.description, parameters: jsonSchemaOf(tool.schema) },
  }));
}

export interface ToolRun {
  name: string;
  ok: boolean;
  /** JSON text handed back to the model. */
  content: string;
  card?: CardSpec;
  entryId?: string | null;
}

const MAX_RESULT_CHARS = 3500;

/** Validates raw model arguments against the strict schema and runs the tool. Never throws. */
export async function runTool(ctx: ToolContext, name: string, rawArguments: string): Promise<ToolRun> {
  const done = (outcome: ToolOutcome, ok: boolean): ToolRun => ({
    name,
    ok,
    content: JSON.stringify(outcome.result).slice(0, MAX_RESULT_CHARS),
    ...(outcome.card ? { card: outcome.card } : {}),
    ...(outcome.entryId !== undefined ? { entryId: outcome.entryId } : {}),
  });
  const tool = TOOLS.find((candidate) => candidate.name === name);
  if (!tool || ctx.disabled.has(name)) return done(failure('unknown_tool', 'این ابزار در دسترس نیست.'), false);
  let parsedArgs: unknown;
  try {
    parsedArgs = rawArguments.trim() === '' ? {} : JSON.parse(rawArguments);
  } catch {
    return done(failure('invalid_arguments', 'آرگومان‌ها JSON معتبر نیست.'), false);
  }
  const parsed = tool.schema.safeParse(parsedArgs);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return done(failure('invalid_arguments', `آرگومان نامعتبر: ${issue?.path.join('.') || 'body'} ${issue?.message ?? ''}`.trim()), false);
  }
  try {
    const outcome = await tool.run(ctx, parsed.data);
    return done(outcome, outcome.result.ok !== false);
  } catch (error) {
    if (error instanceof CoachError) return done(failure(error.code, error.messageFa), false);
    return done(failure('tool_failed', 'ابزار با خطا روبه‌رو شد.'), false);
  }
}

export { MEAL_LABEL, MEAL_TYPES };
