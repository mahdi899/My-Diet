import { Injectable } from '@nestjs/common';
import { ApiError, errorBody } from '../common/errors.js';
import { uuidv7 } from '../common/id.js';
import { civilNow, tehranToday } from '../common/time.js';
import { FoodService } from '../food/food.service.js';
import { MessagingService } from '../messaging/messaging.service.js';
import { MealActivityService } from '../tracking/meal-activity.service.js';
import { TrackingService } from '../tracking/tracking.service.js';
import { Cards, totalsOf } from './cards.js';
import { tehranClock } from './clock.js';
import { estimatedItem, itemOf, nearestServing } from './foods.js';
import { CoachInsights, WATER_TARGET_ML } from './insights.js';
import { SafetyGuard } from './safety.js';
import { CoachStore, type FoodEntryRow } from './store.js';
import { runTool, type ToolContext, type ToolDeps } from './tools.js';
import type { CardSpec, CoachMessage, CoachProfile, EntryItem, Json, MealType, TodaySummary } from './types.js';
import { CoachError, MEAL_TYPES } from './types.js';
import { FoodPhotoService } from './vision.js';

const ACTIONS = new Set(['confirm_meal', 'dismiss', 'confirm_swap', 'log_as_planned', 'log_water', 'log_weight', 'show_ring']);

export function isCoachAction(action: string): boolean {
  return ACTIONS.has(action);
}

function textOf(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function intOf(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : null;
}

function proposalOf(args: Json): Json {
  return args.proposal && typeof args.proposal === 'object' && !Array.isArray(args.proposal) ? args.proposal as Json : args;
}

@Injectable()
export class CoachEffects {
  constructor(
    private readonly store: CoachStore,
    private readonly insights: CoachInsights,
    private readonly foods: FoodService,
    private readonly tracking: TrackingService,
    private readonly activity: MealActivityService,
    private readonly messaging: MessagingService,
    private readonly photos: FoodPhotoService,
    private readonly guard: SafetyGuard,
  ) {}

  deps(): ToolDeps {
    return {
      now: () => civilNow(),
      searchFoods: (query, options) => this.foods.search(query, options),
      foodsBySlugs: (slugs) => this.foods.bySlugs(slugs),
      candidateFoods: (filter) => this.foods.candidates(filter),
      recentSuggestedSlugs: (userId) => this.store.recentSuggestedSlugs(userId),
      today: (userId) => this.insights.today(userId),
      planMeals: (userId, date) => this.insights.planMeals(userId, date),
      weightSeries: (userId) => this.insights.weightSeries(userId),
      setWeight: (userId, kilograms) => this.tracking.setWeight(userId, kilograms),
      addWater: (userId, date, ml) => this.store.addWater(userId, date, ml),
      createEntry: (input) => this.store.createEntry(input),
      linkToPlan: (userId, date, mealType, explicitUid, foodName) => this.linkToPlan(userId, date, mealType, explicitUid, foodName),
      saveMemory: (userId, kind, content) => this.store.saveMemory(userId, kind, content, 'tool'),
      engage: (userId, kind, day, detail, dedupeKey) => this.store.engage(userId, kind, day, detail ?? {}, dedupeKey ?? null),
      lastEngagement: (userId, kind) => this.store.lastEngagement(userId, kind),
      countEngagementToday: (userId, day, kinds) => this.store.countEngagementToday(userId, day, kinds),
      updateTarget: (userId, target) => this.updateTarget(userId, target),
      openCare: (userId) => this.openCare(userId),
      analyzePhoto: (userId, mediaId, hint) => this.analyzeForTool(userId, mediaId, hint),
    };
  }

  context(profile: CoachProfile, threadId: string, disabled: Set<string> = new Set()): ToolContext {
    return { userId: profile.userId, threadId, profile, deps: this.deps(), guard: this.guard, disabled };
  }

  /** Chat/card actions that must not call the model. Unknown actions return null so the caller can say so. */
  async handle(profile: CoachProfile, threadId: string, action: string, args: Json): Promise<CardSpec[] | null> {
    switch (action) {
      case 'confirm_meal': {
        const applied = await this.applyConfirm(profile, args);
        if ('error' in applied) return [Cards.text(applied.error)];
        return [applied.card, Cards.calorieRing(applied.today)];
      }
      case 'dismiss':
        return [Cards.text('باشه، این یکی را ثبت نکردم.')];
      case 'confirm_swap':
        return this.confirmSwap(profile.userId, args);
      case 'log_as_planned':
        return this.logAsPlanned(profile.userId, args);
      case 'log_water':
        return this.runNamed(profile, threadId, 'log_water', args);
      case 'log_weight':
        return this.runNamed(profile, threadId, 'log_weight', args);
      case 'show_ring':
        return this.runNamed(profile, threadId, 'show_calorie_ring', {});
      default:
        return null;
    }
  }

  /**
   * Confirms a suggested food entry: recomputes catalogue numbers, marks it logged, and mirrors it into
   * today's plan log when a matching unrecorded meal exists. Idempotent once status is `logged`.
   */
  async applyConfirm(profile: CoachProfile, args: Json): Promise<
    { entry: FoodEntryRow; card: CardSpec; today: TodaySummary; message: CoachMessage | null } | { error: string }
  > {
    const entryId = textOf(args.entryId);
    const entry = entryId ? await this.store.entry(profile.userId, entryId) : null;
    if (!entry) return { error: 'این وعده را پیدا نکردم. دوباره بگو چی خوردی.' };
    if (entry.status === 'logged') {
      const today = await this.insights.today(profile.userId);
      const card = this.loggedCard(entry, today);
      return { entry, card, today, message: entry.messageId ? await this.store.message(profile.userId, entry.messageId) : null };
    }
    let mealType = entry.mealType;
    const askedType = textOf(args.mealType);
    if (askedType && (MEAL_TYPES as readonly string[]).includes(askedType)) mealType = askedType as MealType;
    let title = textOf(args.title)?.slice(0, 120) ?? entry.title;
    let items = entry.items;
    if (Array.isArray(args.items) && args.items.length) {
      const resolved = await this.resolveEdits(args.items);
      if (!resolved.items.length && resolved.unresolved.length) {
        return { error: `این‌ها در کاتالوگ نیست: ${resolved.unresolved.join('، ')}. اسم دقیق‌تر یا کالری را بفرست.` };
      }
      if (resolved.unresolved.length) {
        return { error: `این‌ها در کاتالوگ نیست: ${resolved.unresolved.join('، ')}.` };
      }
      items = resolved.items;
      if (!textOf(args.title)) title = items.map((item) => item.name).join(' + ');
    }
    const totals = totalsOf(items);
    const explicit = textOf(args.planMealUid) ?? entry.planMealUid;
    const linked = await this.linkToPlan(profile.userId, entry.civilDate, mealType, explicit, title);
    const saved = await this.store.updateEntry(profile.userId, entry.id, {
      title, mealType, items, totals, status: 'logged', planMealUid: linked ?? explicit,
    });
    const today = await this.insights.today(profile.userId);
    const card = this.loggedCard(saved, today);
    let message: CoachMessage | null = null;
    if (saved.messageId) {
      await this.store.updatePayload(profile.userId, saved.messageId, card.payload);
      message = await this.store.message(profile.userId, saved.messageId);
    }
    return { entry: saved, card, today, message };
  }

  async ensureDayBrief(userId: string): Promise<{ message: CoachMessage; created: boolean }> {
    const profile = await this.insights.profile(userId);
    if (!profile) throw new CoachError(409, 'no_profile', 'اول پرسش‌نامهٔ تغذیه را کامل کن.');
    const thread = await this.store.ensureThread(userId);
    const today = await this.insights.today(userId, profile);
    const existing = await this.store.latestByType(thread.id, 'day_brief', today.date);
    if (existing) return { message: existing, created: false };
    const fresh = await this.store.engage(userId, 'day_brief', today.date, {}, `day_brief:${today.date}`);
    if (!fresh) {
      const again = await this.store.latestByType(thread.id, 'day_brief', today.date);
      if (again) return { message: again, created: false };
    }
    const clock = tehranClock(civilNow());
    const brief = Cards.dayBrief({
      date: today.date,
      greeting: greeting(profile.displayName, clock.minutes / 60),
      targetKcal: today.calories.target,
      meals: today.planMeals.map((meal) => ({
        mealUid: meal.mealUid, mealType: meal.mealType, title: meal.title, suggestedTime: meal.suggestedTime, plannedKcal: meal.plannedKcal,
      })),
      tip: tipOf(today),
      waterTargetMl: WATER_TARGET_ML,
      weighInSuggested: today.weight.latestDate !== today.date,
      streakDays: today.streakDays,
    });
    const message = await this.store.insertMessage({ threadId: thread.id, userId, role: 'assistant', card: brief });
    await this.store.insertMessage({
      threadId: thread.id,
      userId,
      role: 'assistant',
      card: Cards.quickReplies([
        { id: 'ring', label: 'حلقهٔ امروز', action: 'show_ring', args: {} },
        { id: 'idea', label: 'یه غذا پیشنهاد بده' },
        { id: 'plan', label: 'برنامهٔ امروزم' },
      ]),
    });
    await this.store.setDayBriefDate(thread.id, today.date);
    return { message, created: true };
  }

  /** Writes a same-kcal plan swap the user already confirmed. Failures stay in the thread as text. */
  async confirmSwap(userId: string, args: Json): Promise<CardSpec[]> {
    const src = proposalOf(args);
    const date = textOf(src.date);
    const versionId = textOf(src.versionId);
    const mealUid = textOf(src.mealUid);
    const optionId = textOf(src.toOptionId) ?? textOf(src.optionId);
    const expectedRevision = intOf(src.expectedRevision);
    if (!date || !versionId || !mealUid || !optionId || expectedRevision == null) {
      return [Cards.text('اطلاعات جایگزینی ناقص است. یک بار دیگر از برنامه بخواه عوضش کند.')];
    }
    try {
      await this.activity.select(userId, {
        commandId: textOf(src.commandId) ?? uuidv7(),
        versionId,
        mealUid,
        optionId,
        date,
        expectedRevision,
        reasonId: textOf(src.reasonId) ?? 'preference',
      });
    } catch (error) {
      if (error instanceof ApiError) return [Cards.text(errorBody(error).messageFa)];
      throw error;
    }
    const plan = await this.insights.planMeals(userId, date);
    const meal = plan.meals.find((item) => item.mealUid === mealUid);
    if (!meal) return [Cards.text('جایگزین ثبت شد.')];
    return [Cards.planMeal({ date, versionId: plan.versionId, meal }), Cards.text('جایگزین ثبت شد.')];
  }

  async logAsPlanned(userId: string, args: Json): Promise<CardSpec[]> {
    const date = textOf(args.date);
    const versionId = textOf(args.versionId);
    const mealUid = textOf(args.mealUid);
    const optionId = textOf(args.optionId);
    const expectedRevision = intOf(args.expectedRevision);
    if (!date || !versionId || !mealUid || !optionId || expectedRevision == null) {
      return [Cards.text('برای ثبت طبق برنامه، اطلاعات وعده ناقص است.')];
    }
    try {
      await this.activity.record(userId, {
        commandId: textOf(args.commandId) ?? uuidv7(),
        versionId,
        mealUid,
        optionId,
        date,
        expectedRevision,
        state: 'as_planned',
      });
    } catch (error) {
      if (error instanceof ApiError) return [Cards.text(errorBody(error).messageFa)];
      throw error;
    }
    const today = await this.insights.today(userId);
    return [Cards.text('طبق برنامه ثبت شد.'), Cards.calorieRing(today)];
  }

  /**
   * Mirrors a coach-logged food onto today's plan meal as «different», so the plan screen and the ring agree.
   * Returns null when there is nothing to attach or the plan rejects the write; the coach entry still counts.
   */
  async linkToPlan(userId: string, date: string, mealType: MealType, explicitUid: string | null, foodName: string): Promise<string | null> {
    if (date !== tehranToday()) return null;
    const plan = await this.insights.planMeals(userId, date);
    if (!plan.versionId) return null;
    const meal = explicitUid
      ? plan.meals.find((item) => item.mealUid === explicitUid) ?? null
      : plan.meals.find((item) => item.mealType === mealType && item.state === 'unrecorded') ?? null;
    if (!meal || meal.state !== 'unrecorded') return null;
    const optionId = meal.selectedOptionId ?? meal.options[0]?.optionId;
    if (!optionId) return null;
    try {
      await this.activity.record(userId, {
        commandId: uuidv7(),
        versionId: plan.versionId,
        mealUid: meal.mealUid,
        optionId,
        date,
        expectedRevision: meal.consumptionRevision,
        state: 'different',
        foodName: foodName.slice(0, 200),
        actual: { quantity: 1, unit: 'serving', basis: 'as_served' },
      });
      return meal.mealUid;
    } catch (error) {
      if (error instanceof ApiError) return null;
      throw error;
    }
  }

  private loggedCard(entry: FoodEntryRow, today: TodaySummary): CardSpec {
    return Cards.mealCard({
      entryId: entry.id,
      title: entry.title,
      mealType: entry.mealType,
      source: entry.source,
      status: 'logged',
      items: entry.items,
      confidence: entry.confidence,
      mediaId: entry.mediaId,
      planMealUid: entry.planMealUid,
      remainingKcal: today.calories.remaining,
    });
  }

  private async resolveEdits(raw: unknown[]): Promise<{ items: EntryItem[]; unresolved: string[] }> {
    const rows = raw.slice(0, 8).filter((item): item is Record<string, unknown> => !!item && typeof item === 'object' && !Array.isArray(item));
    const slugs = rows.map((row) => textOf(row.slug)).filter((slug): slug is string => Boolean(slug));
    const bySlug = await this.foods.bySlugs(slugs);
    const items: EntryItem[] = [];
    const unresolved: string[] = [];
    for (const row of rows) {
      const name = textOf(row.name);
      if (!name) continue;
      const servings = nearestServing(typeof row.servings === 'number' ? row.servings : 1);
      const slug = textOf(row.slug);
      let food = slug ? bySlug.get(slug) : undefined;
      if (!food) food = (await this.foods.search(name, { limit: 1 }))[0];
      if (food) items.push(itemOf(food, servings));
      else if (typeof row.kcal === 'number') {
        items.push(estimatedItem(name, row.kcal, servings, {
          ...(typeof row.proteinG === 'number' ? { proteinG: row.proteinG } : {}),
          ...(typeof row.carbsG === 'number' ? { carbsG: row.carbsG } : {}),
          ...(typeof row.fatG === 'number' ? { fatG: row.fatG } : {}),
        }));
      } else unresolved.push(name);
    }
    return { items, unresolved };
  }

  private async runNamed(profile: CoachProfile, threadId: string, name: string, args: Json): Promise<CardSpec[]> {
    const run = await runTool(this.context(profile, threadId), name, JSON.stringify(args));
    if (run.card) return [run.card];
    let message = 'این کار انجام نشد.';
    try {
      const parsed = JSON.parse(run.content) as { message?: unknown };
      if (typeof parsed.message === 'string' && parsed.message.trim()) message = parsed.message;
    } catch {
      // The tool already returned a short JSON string; the fallback above is enough.
    }
    return [Cards.text(message)];
  }

  private async updateTarget(userId: string, target: { targetKcal: number; proteinG: number; carbsG: number; fatG: number }): Promise<void> {
    const { rowCount } = await this.store.pool.query(
      `update nutrition_profiles set target_kcal = $2, protein_g = $3, carbs_g = $4, fat_g = $5, updated_at = now() where user_id = $1`,
      [userId, target.targetKcal, target.proteinG, target.carbsG, target.fatG],
    );
    if (!rowCount) throw new CoachError(409, 'no_profile', 'پروفایل تغذیه پیدا نشد');
  }

  private async openCare(userId: string): Promise<{ conversationId: string | null }> {
    try {
      const opened = await this.messaging.openCare(userId);
      return { conversationId: opened.id };
    } catch (error) {
      if (error instanceof ApiError) return { conversationId: null };
      throw error;
    }
  }

  private async analyzeForTool(userId: string, mediaId: string, hint: MealType | null) {
    const profile = await this.insights.profile(userId);
    if (!profile) throw new CoachError(409, 'no_profile', 'اول پرسش‌نامهٔ تغذیه را کامل کن.');
    if (!profile.consented) throw new CoachError(403, 'no_consent', 'تحلیل عکس نیاز به رضایت ارسال دادهٔ سلامت دارد.');
    const thread = await this.store.ensureThread(userId);
    return this.photos.analyze(profile, thread.id, mediaId, { mealTypeHint: hint, caption: '', requestId: null });
  }
}

function greeting(name: string | null, hour: number): string {
  const hello = hour < 11 ? 'صبح بخیر' : hour < 15 ? 'ظهر بخیر' : hour < 19 ? 'عصر بخیر' : 'شب بخیر';
  const first = name?.trim().split(/\s+/)[0];
  return first ? `${hello} ${first}` : hello;
}

function tipOf(today: TodaySummary): string {
  if (!today.planMeals.length) return 'امروز برنامهٔ منتشرشده‌ای نداری. هر چیزی خوردی بگو تا ثبتش کنم.';
  if (today.nextMeal) {
    const when = today.nextMeal.suggestedTime ? ` ساعت ${today.nextMeal.suggestedTime}` : '';
    return `وعدهٔ بعدی: ${today.nextMeal.title}${when}.`;
  }
  if (today.calories.remaining < 0) return 'از هدف کالری امروز گذشتی. وعدهٔ بعدی را سبک و پروتئینی بگیر.';
  return 'وعده‌های امروز ثبت شده. اگر چیزی بیرون از برنامه خوردی بگو.';
}
