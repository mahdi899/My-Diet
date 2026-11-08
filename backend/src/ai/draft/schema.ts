import { z } from 'zod';

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;

const item = z.object({
  slug: z.string().trim().min(1).max(64),
  servings: z.number().finite().min(0.25).max(3),
});

const meal = z.object({
  mealType: z.enum(MEAL_TYPES),
  primary: z.array(item).min(1).max(4),
  alternative: z.array(item).min(1).max(4),
  note: z.string().trim().max(400).optional().default(''),
});

export const chunkSchema = z.object({
  days: z
    .array(z.object({ day: z.number().int().min(1).max(7), meals: z.array(meal).min(1).max(6) }))
    .min(1)
    .max(7),
});
export type ChunkOutput = z.infer<typeof chunkSchema>;

export const criticSchema = z.object({
  verdict: z.enum(['ok', 'concerns']),
  issues: z
    .array(z.object({ severity: z.enum(['info', 'warn', 'block']), text: z.string().trim().min(1).max(500) }))
    .max(12)
    .default([]),
});
export type CriticOutput = z.infer<typeof criticSchema>;

/** Models sometimes wrap JSON in prose or code fences; take the outermost object. */
export function extractJson(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // keep going
  }
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1]);
    } catch {
      // keep going
    }
  }
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/** Shown to the model so it knows the exact shape to return. */
export const CHUNK_SCHEMA_TEXT = JSON.stringify({
  days: [
    {
      day: 1,
      meals: [
        {
          mealType: 'breakfast | lunch | dinner | snack',
          primary: [{ slug: 'catalogue slug', servings: 1 }],
          alternative: [{ slug: 'different catalogue slug', servings: 1 }],
          note: 'one short Persian sentence for the client (optional)',
        },
      ],
    },
  ],
});

export const CRITIC_SCHEMA_TEXT = JSON.stringify({
  verdict: 'ok | concerns',
  issues: [{ severity: 'info | warn | block', text: 'short Persian sentence' }],
});
