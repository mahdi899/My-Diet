import { z } from 'zod';
import { ApiError } from '../common/errors.js';

const amount = z.number().finite().positive().max(1_000_000);
const unit = z.enum(['g', 'kg', 'ml', 'l', 'piece', 'serving', 'cup', 'tbsp', 'tsp']);
const basis = z.enum(['raw', 'cooked', 'as_served', 'unknown']);
export const optionSchema = z.object({
  optionId: z.uuid(),
  kind: z.enum(['primary', 'ai_alternative', 'specialist_alternative']),
  title: z.string().trim().min(1).max(200),
  portion: z.object({ quantity: amount, unit, basis }),
  calories: z.number().finite().nonnegative().max(10000).nullable(),
  preparationMinutes: z.number().int().nonnegative().max(1440),
  instructions: z.string().trim().min(1).max(4000),
  ingredients: z.array(z.object({ name: z.string().trim().min(1).max(200), quantity: amount, unit, basis,
    category:z.enum(['produce','dairy','protein','grains','pantry','other']).optional() })).min(1).max(30),
  approved: z.boolean(),
}).strict();
export type MealOption = z.infer<typeof optionSchema>;

export function parseOptions(value: unknown): MealOption[] | undefined {
  if (value === undefined) return undefined;
  const parsed = z.array(optionSchema).length(3).safeParse(value);
  if (!parsed.success) throw new ApiError(400, 'validation', 'هر وعده به سه گزینه با مقدار و واحد معتبر نیاز دارد');
  if (new Set(parsed.data.map(o => o.kind)).size !== 3 || new Set(parsed.data.map(o => o.optionId)).size !== 3) {
    throw new ApiError(400, 'validation', 'شناسه و نوع گزینه‌ها باید یکتا باشد');
  }
  return parsed.data;
}

export function requireApprovedOptions(options: MealOption[] | undefined): void {
  if (!options || options.length !== 3 || options.some(o => !o.approved)) {
    throw new ApiError(409, 'options_required', 'تمام گزینه‌های وعده باید کامل و به تأیید متخصص رسیده باشند');
  }
}
