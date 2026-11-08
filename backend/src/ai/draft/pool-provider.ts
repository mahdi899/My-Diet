import type { DraftNotes, MealDraft, PlanDraft, PlanDraftInput, PlanDraftProvider } from '../../adapters/plan-draft.js';
import type { FoodService, FoodView } from '../../food/food.service.js';
import type { MealSlot } from '../../nutrition/engine.js';
import { GenerationError } from '../provider-request.js';
import { BudgetBlockedError, PoolExhaustedError, type PoolRouter } from '../pool/router.js';
import { ValidationFailure, type AttemptRecord, type ChatMessage } from '../pool/types.js';
import { assembleMeal, fitMeal, type Picked, type PickedMeal } from './assemble.js';
import type { ModelProfile } from './model-profile.js';
import { renderTemplate, type PromptStore, type PromptTemplate } from './prompts.js';
import { CHUNK_SCHEMA_TEXT, CRITIC_SCHEMA_TEXT, chunkSchema, criticSchema, extractJson } from './schema.js';
import { buildShortlists, catalogText, seasonFa, seasonOf, type MealType, type Shortlists } from './shortlist.js';
import { avoidTokensOf, dayTotals, itemViolations, validateWeek, type Rules, type Violation } from './validator.js';

export const DRAFT_POOL = 'plan_draft';
export const CRITIC_POOL = 'plan_critic';

/** Two short calls instead of one long one keep weaker models accurate. */
const CHUNKS: number[][] = [[1, 2, 3, 4], [5, 6, 7]];
const ATTEMPTS_PER_CHUNK = 2;

export interface DraftClock {
  now(): Date;
}

/** Plan drafting on top of the model pools: catalogue-grounded, validated, costed. */
export class PoolPlanDraftProvider implements PlanDraftProvider {
  readonly name = 'pool';
  readonly callsExternalNetwork = true;

  constructor(
    private readonly router: PoolRouter,
    private readonly foods: FoodService,
    private readonly prompts: PromptStore,
    private readonly clock: DraftClock = { now: () => new Date() },
  ) {}

  async draft(input: PlanDraftInput): Promise<PlanDraft> {
    const profile = input.profile;
    if (!profile) throw new GenerationError('profile_missing');
    const requestId = input.requestId ?? null;
    const avoidTokens = avoidTokensOf(
      ...input.untrustedUserText.filter((block) => block.field === 'allergies' || block.field === 'dislikes').map((block) => block.text),
    );
    const rules: Rules = { profile, avoidTokens };
    const season = seasonOf(this.clock.now());
    const shortlists = await buildShortlists(this.foods, profile, season, avoidTokens);
    for (const slot of profile.slots) {
      if (shortlists.byMeal[slot.mealType].length < 6) throw new GenerationError('catalog_too_small');
    }
    const draftPrompt = await this.prompts.active('plan_draft');
    const bySlug = new Map<string, FoodView>();
    for (const list of Object.values(shortlists.byMeal)) for (const food of list) bySlug.set(food.slug, food);

    const chain: AttemptRecord[] = [];
    const chainNotes: DraftNotes['attemptChain'] = [];
    let spent = { tokens: 0, costMicros: 0 };
    let lastModel = '';
    let lastProvider = '';
    const absorb = (records: AttemptRecord[], chunk: string, usage: { tokens: number; costMicros: number }) => {
      chain.push(...records);
      for (const record of records) {
        chainNotes.push({ provider: record.provider, model: record.model, outcome: record.outcome, costMicros: record.costMicros, chunk });
      }
      spent = { tokens: spent.tokens + usage.tokens, costMicros: spent.costMicros + usage.costMicros };
      const ok = records.filter((record) => record.outcome === 'ok').pop();
      // The critic is a second opinion: the generation is attributed to the model that wrote the plan.
      if (ok && chunk !== 'critic') {
        lastModel = ok.model;
        lastProvider = ok.provider;
      }
    };

    const meals: PickedMeal[] = [];
    try {
      for (const days of CHUNKS) {
        const label = `days_${days[0]}_${days[days.length - 1]}`;
        let repair = '';
        for (let attempt = 1; ; attempt += 1) {
          try {
            const result = await this.router.run({
              task: 'plan_draft',
              poolCode: DRAFT_POOL,
              requestId,
              chunk: label,
              messages: this.chunkMessages(draftPrompt, input, profile, shortlists, season, days, meals, repair),
              validate: (content) => parseChunk(content, days, profile, shortlists, bySlug, rules),
            });
            absorb(result.chain, label, result.usage);
            meals.push(...result.value);
            break;
          } catch (error) {
            if (error instanceof BudgetBlockedError && error.usage) absorb([], label, error.usage);
            if (error instanceof PoolExhaustedError) {
              absorb(error.chain, label, error.usage);
              const reasons = error.chain.filter((record) => record.outcome === 'invalid_plan' || record.outcome === 'invalid_json');
              if (attempt < ATTEMPTS_PER_CHUNK && reasons.length > 0) {
                repair = [...new Set(reasons.map((record) => record.errorCode))].slice(0, 6).join('; ');
                continue;
              }
            }
            throw error;
          }
        }
      }
    } catch (error) {
      // Calls already made were paid for even though no plan came out.
      if (error instanceof GenerationError) {
        error.usage = { tokens: spent.tokens, costMicros: spent.costMicros, model: lastModel, provider: lastProvider, attempts: chain.length };
      }
      throw error;
    }

    const violations = validateWeek(meals, rules);
    const errors = violations.filter((violation) => violation.severity === 'error');
    if (errors.length > 0) {
      const failure = new GenerationError('invalid_draft');
      failure.usage = { tokens: spent.tokens, costMicros: spent.costMicros, model: lastModel, provider: lastProvider, attempts: chain.length };
      throw failure;
    }

    const draft = buildDraft(meals, profile);
    const critic = await this.critique(requestId, input, profile, meals, absorb);
    const notes: DraftNotes = {
      poolCode: DRAFT_POOL,
      promptVersions: { plan_draft: draftPrompt.version },
      attemptChain: chainNotes,
      warnings: violations.map(toWarning),
      critic: critic.notes,
      dayTotals: dayTotals(meals),
    };
    if (critic.version != null) notes.promptVersions.plan_critic = critic.version;
    return {
      days: draft,
      provider: lastProvider || 'pool',
      usage: {
        model: lastModel,
        promptVersion: `plan_draft@${draftPrompt.version}`,
        tokens: spent.tokens,
        costMicros: spent.costMicros,
      },
      notes,
    };
  }

  private chunkMessages(
    prompt: PromptTemplate,
    input: PlanDraftInput,
    profile: ModelProfile,
    shortlists: Shortlists,
    season: ReturnType<typeof seasonOf>,
    days: number[],
    done: PickedMeal[],
    repair: string,
  ): ChatMessage[] {
    const used = new Map<string, number>();
    for (const meal of done) {
      for (const picked of meal.primary) if (picked.food.category === 'main') used.set(picked.food.slug, (used.get(picked.food.slug) ?? 0) + 1);
    }
    const user = renderTemplate(prompt.userTemplate, {
      profile: JSON.stringify(profileForModel(profile, input)),
      untrusted: input.untrustedUserText.map((block) => block.text).join('\n') || '(none)',
      season: `${season} (${seasonFa(season)})`,
      catalog: catalogText(shortlists, profile),
      used: used.size ? [...used].map(([slug, count]) => `${slug} x${count}`).join(', ') : '(none yet)',
      days: JSON.stringify(days),
      schema: CHUNK_SCHEMA_TEXT,
      repair: repair ? `\nREPAIR: the previous answer was rejected (${repair}). Return the full corrected JSON for the same days.` : '',
    });
    return [
      { role: 'system', content: prompt.systemPrompt },
      { role: 'user', content: user },
    ];
  }

  /** Advisory review for the doctor. Never blocks the draft: a failed critic only leaves a note. */
  private async critique(
    requestId: string | null,
    input: PlanDraftInput,
    profile: ModelProfile,
    meals: PickedMeal[],
    absorb: (records: AttemptRecord[], chunk: string, usage: { tokens: number; costMicros: number }) => void,
  ): Promise<{ notes: NonNullable<DraftNotes['critic']>; version: number | null }> {
    const unavailable = { notes: { verdict: 'unavailable' as const, issues: [] }, version: null };
    try {
      const prompt = await this.prompts.active('plan_critic');
      const totals = dayTotals(meals);
      const lines = Array.from({ length: 7 }, (_, index) => {
        const day = index + 1;
        const ofDay = meals.filter((meal) => meal.day === day);
        const text = ofDay.map((meal) => `${meal.slot.mealType}: ${titleOf(meal.primary)}`).join(' | ');
        const total = totals[index]!;
        return `D${day}: ${text} || ${total.kcal} kcal, P${total.proteinG} C${total.carbsG} F${total.fatG}`;
      });
      const user = renderTemplate(prompt.userTemplate, {
        profile: JSON.stringify(profileForModel(profile, input)),
        plan: lines.join('\n'),
        schema: CRITIC_SCHEMA_TEXT,
      });
      const result = await this.router.run({
        task: 'plan_critic',
        poolCode: CRITIC_POOL,
        requestId,
        chunk: 'critic',
        maxTokens: 1500,
        temperature: 0.1,
        messages: [
          { role: 'system', content: prompt.systemPrompt },
          { role: 'user', content: user },
        ],
        validate: (content) => {
          const parsed = criticSchema.safeParse(extractJson(content));
          if (!parsed.success) throw new ValidationFailure('invalid_json', 'critic_schema');
          return parsed.data;
        },
      });
      absorb(result.chain, 'critic', result.usage);
      return { notes: { verdict: result.value.verdict, issues: result.value.issues }, version: prompt.version };
    } catch (error) {
      if (error instanceof PoolExhaustedError) absorb(error.chain, 'critic', error.usage);
      return unavailable;
    }
  }
}

const titleOf = (items: Picked[]) => items.map((item) => item.food.nameFa).join(' + ');

function toWarning(violation: Violation): DraftNotes['warnings'][number] {
  return { code: violation.code, message: violation.message, day: violation.day, mealType: violation.mealType };
}

/** The slice of the profile the model sees: codes and numbers, nothing that identifies the person. */
function profileForModel(profile: ModelProfile, input: PlanDraftInput) {
  return {
    track: profile.track,
    lifeStage: input.lifeStage,
    pregnancyWeek: input.pregnancyWeek,
    sex: profile.sex,
    age: profile.age,
    bmi: profile.bmi,
    energy: profile.energy,
    slots: profile.slots,
    dietStyle: profile.dietStyle,
    allergens: profile.allergens,
    conditions: profile.conditions,
    budget: profile.budget,
    cooking: input.cooking,
    region: profile.region,
    preferences: profile.preferences,
  };
}

function parseChunk(
  content: string,
  days: number[],
  profile: ModelProfile,
  shortlists: Shortlists,
  bySlug: Map<string, FoodView>,
  rules: Rules,
): PickedMeal[] {
  const parsed = chunkSchema.safeParse(extractJson(content));
  if (!parsed.success) {
    throw new ValidationFailure('invalid_json', `schema:${parsed.error.issues[0]?.path.join('.') ?? ''}`);
  }
  const given = new Map(parsed.data.days.map((day) => [day.day, day]));
  const out: PickedMeal[] = [];
  for (const dayNumber of days) {
    const day = given.get(dayNumber);
    if (!day) throw new ValidationFailure('invalid_plan', `day_missing:${dayNumber}`);
    for (const slot of profile.slots) {
      const found = day.meals.filter((meal) => meal.mealType === slot.mealType);
      if (found.length !== 1) throw new ValidationFailure('invalid_plan', `meal_count:${dayNumber}:${slot.mealType}`);
      const meal = found[0]!;
      const resolve = (items: Array<{ slug: string; servings: number }>): Picked[] => {
        const merged = new Map<string, Picked>();
        for (const item of items) {
          const food = bySlug.get(item.slug);
          if (!food || !shortlists.allowed[slot.mealType as MealType].has(item.slug)) {
            throw new ValidationFailure('invalid_plan', `unknown_slug:${item.slug}`);
          }
          const existing = merged.get(item.slug);
          if (existing) existing.servings += item.servings;
          else merged.set(item.slug, { food, servings: item.servings });
        }
        return [...merged.values()];
      };
      const primary = resolve(meal.primary);
      const alternative = resolve(meal.alternative);
      const sameDishes = primary.length === alternative.length && primary.every((item) => alternative.some((other) => other.food.slug === item.food.slug));
      if (sameDishes) throw new ValidationFailure('invalid_plan', `alternative_same:${dayNumber}:${slot.mealType}`);
      const fitted = fitMeal({ day: dayNumber, slot: slot as MealSlot, primary, alternative, note: meal.note });
      const hard = [...fitted.primary, ...fitted.alternative]
        .flatMap((picked) => itemViolations(picked, rules, { day: dayNumber, mealType: slot.mealType }))
        .find((violation) => violation.severity === 'error');
      if (hard) throw new ValidationFailure('invalid_plan', `${hard.code}:${dayNumber}:${slot.mealType}`);
      out.push(fitted);
    }
  }
  return out;
}

function buildDraft(meals: PickedMeal[], profile: ModelProfile): PlanDraft['days'] {
  return Array.from({ length: 7 }, (_, index) => {
    const ofDay = meals.filter((meal) => meal.day === index + 1);
    const ordered: MealDraft[] = profile.slots.map((slot) => assembleMeal(ofDay.find((meal) => meal.slot.mealType === slot.mealType)!));
    return { meals: ordered };
  });
}
