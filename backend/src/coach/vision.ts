import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { BudgetBlockedError, PoolExhaustedError, PoolUnavailableError } from '../ai/pool/router.js';
import { PromptStore } from '../ai/draft/prompts.js';
import { ENV, type Env } from '../config/env.js';
import { FoodService } from '../food/food.service.js';
import { Cards, MEAL_LABEL, totalsOf } from './cards.js';
import { tehranClock } from './clock.js';
import { estimatedItem, itemOf, mealTypeAt, nearestServing } from './foods.js';
import { COACH_LLM, type CoachLlm } from './llm.js';
import { CoachStore } from './store.js';
import { round0 } from './text.js';
import type { CardSpec, CoachProfile, EntryItem, Json, MealType } from './types.js';
import { CoachError } from './types.js';

export type DetectedImage = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
export const PHOTO_LIMIT_BYTES = 1_500_000;

export function detectImage(bytes: Buffer): DetectedImage | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (bytes.length >= 6 && ['GIF89a', 'GIF87a'].includes(bytes.subarray(0, 6).toString('ascii'))) return 'image/gif';
  if (bytes.length >= 12 && bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  return null;
}

/** Accepts a data URL or bare base64 and returns verified image bytes. */
export function decodeImage(input: string, declaredMime?: string): { bytes: Buffer; mime: DetectedImage } {
  const match = /^data:([a-z/+.-]+);base64,(.*)$/is.exec(input.trim());
  const base64 = (match ? match[2]! : input).replace(/\s+/g, '');
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) throw new CoachError(400, 'invalid_image', 'تصویر معتبر نیست');
  const bytes = Buffer.from(base64, 'base64');
  if (bytes.length === 0) throw new CoachError(400, 'invalid_image', 'تصویر معتبر نیست');
  if (bytes.length > PHOTO_LIMIT_BYTES) throw new CoachError(413, 'image_too_large', 'حجم عکس بیش از ۱٫۵ مگابایت است');
  const detected = detectImage(bytes);
  const claimed = (match?.[1] ?? declaredMime)?.toLowerCase();
  if (!detected || (claimed && claimed !== detected && !(claimed === 'image/jpg' && detected === 'image/jpeg'))) {
    throw new CoachError(400, 'invalid_image', 'فقط تصویر JPEG، PNG، WebP یا GIF پذیرفته می‌شود');
  }
  return { bytes, mime: detected };
}

const visionSchema = z.object({
  is_food: z.boolean(),
  meal_type: z.enum(['breakfast', 'lunch', 'dinner', 'snack']).nullish(),
  confidence: z.number().min(0).max(1).default(0.5),
  items: z
    .array(
      z.object({
        name_fa: z.string().trim().min(1).max(120),
        search_terms: z.array(z.string().trim().min(1).max(60)).max(3).default([]),
        servings: z.number().min(0.1).max(6).default(1),
        kcal_estimate: z.number().min(0).max(3000).optional(),
        protein_g: z.number().min(0).max(300).optional(),
        carbs_g: z.number().min(0).max(500).optional(),
        fat_g: z.number().min(0).max(300).optional(),
      }),
    )
    .max(6)
    .default([]),
  note: z.string().max(300).optional(),
});

export interface PhotoAnalysis {
  card: CardSpec;
  result: Json;
  entryId: string | null;
}

@Injectable()
export class FoodPhotoService {
  constructor(
    private readonly store: CoachStore,
    private readonly foods: FoodService,
    private readonly prompts: PromptStore,
    @Inject(COACH_LLM) private readonly llm: CoachLlm,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /** Daily cap check, before any provider is called. */
  async assertQuota(userId: string, day: string): Promise<void> {
    const usage = await this.store.usage(userId, day);
    if (usage.visionCalls >= this.env.COACH_DAILY_PHOTOS) {
      throw new CoachError(429, 'photo_limit', 'سقف تحلیل عکس امروز پر شده است؛ فردا دوباره امتحان کن.', true);
    }
  }

  async analyze(
    profile: CoachProfile,
    threadId: string,
    mediaId: string,
    options: { mealTypeHint: MealType | null; caption: string; requestId: string | null; messageId?: string | null },
  ): Promise<PhotoAnalysis> {
    const clock = tehranClock();
    const media = await this.store.media(profile.userId, mediaId);
    if (!media) return failed('media_not_found', 'عکس پیدا نشد.');
    await this.assertQuota(profile.userId, clock.date);

    const prompt = await this.prompts.active('coach_vision');
    let value: Record<string, unknown>;
    try {
      const out = await this.llm.vision({
        requestId: options.requestId,
        system: prompt.systemPrompt,
        mime: media.mime,
        base64: media.content.toString('base64'),
        caption: options.caption,
      });
      value = out.value;
      await this.store.addUsage(profile.userId, clock.date, { visionCalls: 1, costMicros: out.usage.costMicros });
    } catch (error) {
      if (error instanceof BudgetBlockedError || error instanceof PoolUnavailableError || error instanceof PoolExhaustedError) {
        await this.store.addUsage(profile.userId, clock.date, { visionCalls: 1 });
        return failed('ai_unavailable', 'تحلیل عکس الان در دسترس نیست؛ می‌توانی اسم غذا را بنویسی تا ثبتش کنم.');
      }
      throw error;
    }

    const parsed = visionSchema.safeParse(value);
    if (!parsed.success) return failed('vision_invalid', 'نتوانستم عکس را بخوانم؛ لطفاً دوباره با نور بهتر امتحان کن یا اسم غذا را بنویس.');
    const data = parsed.data;
    if (!data.is_food || data.items.length === 0) {
      return {
        card: Cards.systemNote('not_food', data.is_food ? 'غذایی در عکس تشخیص ندادم؛ اسم غذا را بنویس تا ثبتش کنم.' : 'این عکس غذا به نظر نمی‌رسد. یک عکس واضح از وعده‌ات بفرست.'),
        result: { ok: false, error: 'not_food', message: 'عکس غذا نیست یا آیتمی تشخیص داده نشد.' },
        entryId: null,
      };
    }

    const items: EntryItem[] = [];
    const unmatched: string[] = [];
    const warnings: string[] = [];
    for (const raw of data.items) {
      let found = undefined as Awaited<ReturnType<FoodService['search']>>[number] | undefined;
      for (const term of [raw.name_fa, ...raw.search_terms]) {
        found = (await this.foods.search(term, { limit: 1 }))[0];
        if (found) break;
      }
      if (found) {
        items.push(itemOf(found, nearestServing(raw.servings)));
        if (found.allergens.some((allergen) => profile.allergens.includes(allergen))) warnings.push(`«${found.nameFa}» با حساسیت ثبت‌شدهٔ تو هم‌پوشانی دارد`);
      } else if (raw.kcal_estimate != null && raw.kcal_estimate > 0) {
        items.push(estimatedItem(raw.name_fa, Math.min(1500, raw.kcal_estimate * Math.min(raw.servings, 2)), raw.servings, { proteinG: raw.protein_g, carbsG: raw.carbs_g, fatG: raw.fat_g }));
        unmatched.push(raw.name_fa);
      }
    }
    if (items.length === 0) return failed('vision_empty', 'نتوانستم مقدار غذا را برآورد کنم؛ اسم و مقدار را بنویس.');

    let confidence = data.confidence;
    if (unmatched.length) confidence = Math.min(confidence, unmatched.length === items.length ? 0.45 : 0.65);
    const mealType = options.mealTypeHint ?? data.meal_type ?? mealTypeAt(clock.minutes);
    const totals = totalsOf(items);
    const title = items.map((item) => item.name).join(' + ');
    const entry = await this.store.createEntry({
      userId: profile.userId, threadId, mediaId, civilDate: clock.date, mealType, title, source: 'photo', items, totals,
      confidence: Math.round(confidence * 100) / 100, status: 'suggested',
    });
    const noteParts = [...warnings];
    if (unmatched.length) noteParts.push('برای بعضی آیتم‌ها عدد برآوردی است؛ قبل از تأیید بررسی کن.');
    if (data.note) noteParts.push(data.note);
    return {
      entryId: entry.id,
      card: Cards.mealCard({
        entryId: entry.id, title, mealType, source: 'photo', status: 'suggested', items, confidence: entry.confidence, mediaId, note: noteParts.join(' '),
      }),
      result: {
        ok: true, entry_id: entry.id, meal: MEAL_LABEL[mealType], title, totals, confidence: entry.confidence, estimated_items: unmatched, allergen_warnings: warnings,
        total_kcal: round0(totals.kcal),
      },
    };
  }
}

function failed(code: string, message: string): PhotoAnalysis {
  return { card: Cards.systemNote(code, message), result: { ok: false, error: code, message }, entryId: null };
}
