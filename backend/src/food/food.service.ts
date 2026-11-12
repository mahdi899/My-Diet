import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';
import { ApiError } from '../common/errors.js';
import { uuidv7 } from '../common/id.js';
import { audit, withTransaction } from '../common/sql.js';
import { PG_POOL } from '../database/database.js';
import { macrosOf, toOption, type Picked } from '../ai/draft/assemble.js';
import type { MealOption } from '../plans/options.js';
import { csvCell, parseCsv } from './csv.js';
import { SEED_FOODS, type SeedFood } from './seed.js';

const CATEGORIES = ['breakfast', 'main', 'side', 'soup', 'salad', 'protein', 'carb', 'dairy', 'fruit', 'snack', 'drink', 'dessert'] as const;
const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
const UNITS = ['g', 'kg', 'ml', 'l', 'piece', 'serving', 'cup', 'tbsp', 'tsp'] as const;
const GROUPS = ['produce', 'dairy', 'protein', 'grains', 'pantry', 'other'] as const;
const word = z.string().trim().min(1).max(40);

const ingredientSchema = z.object({
  name: z.string().trim().min(1).max(120),
  quantity: z.number().positive().max(100_000),
  unit: z.enum(UNITS),
  category: z.enum(GROUPS),
});

const nutritionSchema = z.object({
  method: z.literal('recipe_estimate'),
  reference: z.string().min(1).max(300),
  sourceUrl: z.url().max(500).refine(value => value.startsWith('https://')),
  originalPromptKcal: z.number().int().min(0).max(3000).optional(),
  notes: z.string().max(2000),
  ingredients: z.array(z.object({
    ingredient: z.string().min(1).max(160),
    grams: z.number().positive().max(100000),
    fdcId: z.number().int().positive(),
    description: z.string().min(1).max(500),
    nutrientsPer100G: z.object({
      kcal: z.number().min(0).max(1000),
      proteinG: z.number().min(0).max(100),
      carbsG: z.number().min(0).max(100),
      fatG: z.number().min(0).max(100),
      fiberG: z.number().min(0).max(100),
      fiberAssumedZero: z.boolean().optional(),
    }),
  })).min(1).max(30),
});

export const foodInputSchema = z.object({
  slug: z.string().trim().regex(/^[a-z][a-z0-9_]{1,63}$/),
  nameFa: z.string().trim().min(2).max(120),
  category: z.enum(CATEGORIES),
  mealTypes: z.array(z.enum(MEALS)).min(1).max(4),
  servingLabel: z.string().trim().min(2).max(160),
  servingG: z.number().int().positive().max(5000).nullable(),
  kcal: z.number().int().min(0).max(3000),
  proteinG: z.number().min(0).max(300),
  carbsG: z.number().min(0).max(500),
  fatG: z.number().min(0).max(300),
  fiberG: z.number().min(0).max(100),
  allergens: z.array(word).max(10),
  tags: z.array(word).max(20),
  regions: z.array(word).max(8),
  seasons: z.array(z.enum(['spring', 'summer', 'autumn', 'winter'])).max(4),
  costTier: z.number().int().min(1).max(3),
  prepMinutes: z.number().int().min(0).max(1440),
  ingredients: z.array(ingredientSchema).min(1).max(30),
  active: z.boolean().default(true),
  image: z.string().max(240).regex(/^(\/assets\/foods\/[a-z0-9_-]+\.jpg|\/v1\/public\/food-images\/[a-z][a-z0-9_]{1,63}\.jpg)$/).nullable().optional(),
  nutrition: nutritionSchema.nullable().optional(),
});
export type FoodInput = z.infer<typeof foodInputSchema>;

export interface FoodRow {
  id: string;
  slug: string;
  name_fa: string;
  category: string;
  meal_types: string[];
  serving_label: string;
  serving_g: number | null;
  kcal: number;
  protein_g: string;
  carbs_g: string;
  fat_g: string;
  fiber_g: string;
  allergens: string[];
  tags: string[];
  regions: string[];
  seasons: string[];
  cost_tier: number;
  prep_minutes: number;
  ingredients: FoodInput['ingredients'];
  image: string | null;
  active: boolean;
  source: string;
  nutrition: z.infer<typeof nutritionSchema> | null;
}

export interface FoodView {
  id: string;
  slug: string;
  nameFa: string;
  category: string;
  mealTypes: string[];
  servingLabel: string;
  servingG: number | null;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  allergens: string[];
  tags: string[];
  regions: string[];
  seasons: string[];
  costTier: number;
  prepMinutes: number;
  ingredients: FoodInput['ingredients'];
  image: string | null;
  active: boolean;
  source: string;
  nutrition: z.infer<typeof nutritionSchema> | null;
}

const COLUMNS = `id, slug, name_fa, category, meal_types, serving_label, serving_g, kcal, protein_g::text, carbs_g::text,
  fat_g::text, fiber_g::text, allergens, tags, regions, seasons, cost_tier, prep_minutes, ingredients, image, active, source, nutrition`;

export function viewOf(row: FoodRow): FoodView {
  return {
    id: row.id,
    slug: row.slug,
    nameFa: row.name_fa,
    category: row.category,
    mealTypes: row.meal_types,
    servingLabel: row.serving_label,
    servingG: row.serving_g,
    kcal: row.kcal,
    proteinG: Number(row.protein_g),
    carbsG: Number(row.carbs_g),
    fatG: Number(row.fat_g),
    fiberG: Number(row.fiber_g),
    allergens: row.allergens,
    tags: row.tags,
    regions: row.regions,
    seasons: row.seasons,
    costTier: row.cost_tier,
    prepMinutes: row.prep_minutes,
    ingredients: row.ingredients,
    image: row.image,
    active: row.active,
    source: row.source,
    nutrition: row.nutrition ?? null,
  };
}

export interface CandidateFilter {
  mealType: (typeof MEALS)[number];
  categories?: string[];
  excludeAllergens?: string[];
  diet?: 'omnivore' | 'vegetarian' | 'vegan';
  maxCostTier?: number;
  excludeSlugs?: string[];
  requireTags?: string[];
  preferRegion?: string | null;
  nearKcal?: number | null;
  limit?: number;
}

/** Makes a prefix tsquery from user words; empty when nothing searchable is left. */
export function prefixQuery(text: string): string {
  const words = text.normalize('NFKC').match(/[\p{L}\p{N}]+/gu) ?? [];
  return words.slice(0, 6).map((item) => `${item}:*`).join(' & ');
}

@Injectable()
export class FoodService implements OnModuleInit {
  private readonly logger = new Logger(FoodService.name);

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async onModuleInit(): Promise<void> {
    if (process.env.APP_ROLE === 'worker') return;
    await this.seed();
  }

  /** Inserts the missing seed rows. Rows edited by an admin are never overwritten. */
  async seed(): Promise<number> {
    return withTransaction(this.pool, async client => {
      await client.query('lock table food_catalog in share row exclusive mode');
      const replaced = await client.query('select 1 from food_catalog_replacements limit 1');
      if (replaced.rowCount) return 0;
      const existing = await client.query<{ slug: string }>('select slug from food_catalog');
      const have = new Set(existing.rows.map((row) => row.slug));
      const missing = SEED_FOODS.filter((food) => !have.has(food.slug));
      for (const food of missing) await this.insertSeed(food, client);
      if (missing.length) this.logger.log(`seeded ${missing.length} catalog foods`);
      return missing.length;
    });
  }

  private async insertSeed(food: SeedFood, client: PoolClient): Promise<void> {
    await client.query(
      `insert into food_catalog
        (id, slug, name_fa, category, meal_types, serving_label, serving_g, kcal, protein_g, carbs_g, fat_g, fiber_g,
         allergens, tags, regions, seasons, cost_tier, prep_minutes, ingredients, source)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19::jsonb,'seed')
       on conflict (slug) do nothing`,
      [
        uuidv7(), food.slug, food.nameFa, food.category, food.mealTypes, food.servingLabel, food.servingG, food.kcal,
        food.proteinG, food.carbsG, food.fatG, food.fiberG, food.allergens, food.tags, food.regions, food.seasons,
        food.costTier, food.prepMinutes, JSON.stringify(food.ingredients),
      ],
    );
  }

  async bySlugs(slugs: string[]): Promise<Map<string, FoodView>> {
    if (slugs.length === 0) return new Map();
    const { rows } = await this.pool.query<FoodRow>(
      `select ${COLUMNS} from food_catalog where slug = any($1::text[])`,
      [[...new Set(slugs)]],
    );
    return new Map(rows.map((row) => [row.slug, viewOf(row)]));
  }

  /**
   * Shortlist for plan generation. Excludes allergens and diet conflicts in SQL, then ranks by
   * regional match and closeness to the slot energy, so the model only ever sees safe rows.
   */
  async candidates(filter: CandidateFilter): Promise<FoodView[]> {
    const values: unknown[] = [filter.mealType];
    const where = [`active`, `$1 = any(meal_types)`];
    const push = (value: unknown) => {
      values.push(value);
      return `$${values.length}`;
    };
    if (filter.categories?.length) where.push(`category = any(${push(filter.categories)}::text[])`);
    if (filter.excludeAllergens?.length) where.push(`not (allergens && ${push(filter.excludeAllergens)}::text[])`);
    if (filter.diet === 'vegetarian') where.push(`'vegetarian' = any(tags)`);
    if (filter.diet === 'vegan') where.push(`'vegan' = any(tags)`);
    if (filter.maxCostTier) where.push(`cost_tier <= ${push(filter.maxCostTier)}`);
    if (filter.excludeSlugs?.length) where.push(`not (slug = any(${push(filter.excludeSlugs)}::text[]))`);
    if (filter.requireTags?.length) where.push(`tags @> ${push(filter.requireTags)}::text[]`);
    const region = filter.preferRegion
      ? `(case when ${push(filter.preferRegion)} = any(regions) then 0 when cardinality(regions) = 0 then 1 else 2 end)`
      : '1';
    const near = filter.nearKcal ? `abs(kcal - ${push(filter.nearKcal)})` : 'kcal';
    const limit = Math.min(Math.max(filter.limit ?? 40, 1), 200);
    const { rows } = await this.pool.query<FoodRow>(
      `select ${COLUMNS} from food_catalog where ${where.join(' and ')}
       order by ${region}, ${near}, slug limit ${limit}`,
      values,
    );
    return rows.map(viewOf);
  }

  /** Active catalogue rows matching Persian words (prefix per word, then substring), allergens already removed. */
  async search(text: string, options: { limit?: number; excludeAllergens?: string[]; mealType?: (typeof MEALS)[number] } = {}): Promise<FoodView[]> {
    const limit = Math.min(Math.max(options.limit ?? 6, 1), 20);
    const clean = text.normalize('NFKC').replace(/ي/g, 'ی').replace(/ك/g, 'ک').trim().slice(0, 80);
    if (!clean) return [];
    const values: unknown[] = [];
    const push = (value: unknown) => {
      values.push(value);
      return `$${values.length}`;
    };
    const where = ['active'];
    if (options.excludeAllergens?.length) where.push(`not (allergens && ${push(options.excludeAllergens)}::text[])`);
    if (options.mealType) where.push(`${push(options.mealType)} = any(meal_types)`);
    const prefix = prefixQuery(clean);
    const like = push(`%${clean.replace(/[\\%_]/g, '\\$&')}%`);
    const match = prefix
      ? `(to_tsvector('simple', name_fa) @@ to_tsquery('simple', ${push(prefix)}) or name_fa ilike ${like})`
      : `name_fa ilike ${like}`;
    const exact = push(clean);
    const { rows } = await this.pool.query<FoodRow>(
      `select ${COLUMNS} from food_catalog where ${where.join(' and ')} and ${match}
       order by (name_fa = ${exact}) desc, length(name_fa), slug limit ${limit}`,
      values,
    );
    return rows.map(viewOf);
  }

  // ------------------------------------------------------------------ admin

  async list(filter: { q?: string; category?: string; active?: string; cursor?: string; limit?: number }) {
    const values: unknown[] = [];
    const where: string[] = [];
    const push = (value: unknown) => {
      values.push(value);
      return `$${values.length}`;
    };
    if (filter.category) {
      if (!(CATEGORIES as readonly string[]).includes(filter.category)) throw new ApiError(400, 'validation', 'دستهٔ غذا نامعتبر است');
      where.push(`category = ${push(filter.category)}`);
    }
    if (filter.active === 'true' || filter.active === 'false') where.push(`active = ${push(filter.active === 'true')}`);
    const search = filter.q ? prefixQuery(filter.q) : '';
    if (search) where.push(`to_tsvector('simple', name_fa) @@ to_tsquery('simple', ${push(search)})`);
    else if (filter.q) where.push(`slug ilike ${push(`%${filter.q.replace(/[\\%_]/g, '\\$&')}%`)}`);
    if (filter.cursor) where.push(`slug > ${push(filter.cursor)}`);
    const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200);
    const { rows } = await this.pool.query<FoodRow>(
      `select ${COLUMNS} from food_catalog ${where.length ? `where ${where.join(' and ')}` : ''}
       order by slug limit ${limit + 1}`,
      values,
    );
    const page = rows.slice(0, limit);
    return { items: page.map(viewOf), nextCursor: rows.length > limit ? page[page.length - 1]!.slug : null };
  }

  /** Builds a plan option from catalogue dishes, so a doctor's pick gets the same maths as an AI pick. */
  async compose(body: unknown): Promise<{ option: MealOption; macros: ReturnType<typeof macrosOf> }> {
    const parsed = z
      .object({
        kind: z.enum(['primary', 'ai_alternative', 'specialist_alternative']),
        items: z.array(z.object({ slug: z.string().min(1).max(80), servings: z.number().min(0.25).max(6) })).min(1).max(5),
        note: z.string().trim().max(300).optional(),
      })
      .safeParse(body);
    if (!parsed.success) throw new ApiError(400, 'validation', 'ترکیب غذا نامعتبر است');
    const picks: Picked[] = [];
    for (const item of parsed.data.items) {
      const food = await this.get(item.slug);
      if (!food.active) throw new ApiError(409, 'food_inactive', 'این غذا در کاتالوگ غیرفعال است');
      picks.push({ food, servings: item.servings });
    }
    return { option: toOption(parsed.data.kind, picks, parsed.data.note ?? ''), macros: macrosOf(picks) };
  }

  async get(slug: string): Promise<FoodView> {
    const { rows } = await this.pool.query<FoodRow>(`select ${COLUMNS} from food_catalog where slug = $1`, [slug]);
    if (!rows[0]) throw new ApiError(404, 'not_found', 'غذا پیدا نشد');
    return viewOf(rows[0]);
  }

  parse(body: unknown): FoodInput {
    const parsed = foodInputSchema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new ApiError(400, 'validation', `فیلد «${issue?.path.join('.') ?? ''}» معتبر نیست`);
    }
    return parsed.data;
  }

  async create(adminId: string, body: unknown): Promise<FoodView> {
    const photo = jpegOf(body);
    const food = this.parse(body);
    if (photo) food.image = publicFoodImage(food.slug);
    await withTransaction(this.pool, async (client) => {
      const inserted = await client.query(
        `insert into food_catalog
          (id, slug, name_fa, category, meal_types, serving_label, serving_g, kcal, protein_g, carbs_g, fat_g, fiber_g,
           allergens, tags, regions, seasons, cost_tier, prep_minutes, ingredients, active, source)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19::jsonb,$20,'admin')
         on conflict (slug) do nothing returning id`,
        [uuidv7(), food.slug, ...this.fields(food)],
      );
      if (!inserted.rowCount) throw new ApiError(409, 'conflict', 'غذایی با این شناسه وجود دارد');
      await audit(client, adminId, 'food_created', 'food_catalog', null, { slug: food.slug });
      await client.query(METADATA_SQL, [food.slug, food.image !== undefined, food.image ?? null, food.nutrition !== undefined, JSON.stringify(food.nutrition ?? null)]);
      if (photo) await client.query('update food_catalog set image_bytes=$2 where slug=$1', [food.slug, photo]);
    });
    return this.get(food.slug);
  }

  async update(adminId: string, slug: string, body: unknown): Promise<FoodView> {
    const photo = jpegOf(body);
    const food = this.parse({ ...(body as object), slug });
    if (photo) food.image = publicFoodImage(slug);
    if (photo === null && food.image?.startsWith('/v1/public/food-images/')) food.image = null;
    await withTransaction(this.pool, async (client) => {
      const updated = await client.query(`${UPDATE_SQL} returning id`, [food.slug, ...this.fields(food)]);
      if (!updated.rowCount) throw new ApiError(404, 'not_found', 'غذا پیدا نشد');
      await client.query(METADATA_SQL, [food.slug, food.image !== undefined, food.image ?? null, food.nutrition !== undefined, JSON.stringify(food.nutrition ?? null)]);
      if (photo) await client.query('update food_catalog set image_bytes=$2 where slug=$1', [slug, photo]);
      if (photo === null) await client.query('update food_catalog set image_bytes=null where slug=$1', [slug]);
      await audit(client, adminId, 'food_updated', 'food_catalog', null, { slug });
    });
    return this.get(slug);
  }

  async imageBytes(file: string): Promise<Buffer | null> {
    const slug = file.endsWith('.jpg') ? file.slice(0, -4) : '';
    if (!/^[a-z][a-z0-9_]{1,63}$/.test(slug)) return null;
    const { rows } = await this.pool.query<{ image_bytes: Buffer | null }>(
      'select image_bytes from food_catalog where slug=$1',
      [slug],
    );
    return rows[0]?.image_bytes ?? null;
  }

  async setActive(adminId: string, slug: string, active: boolean): Promise<FoodView> {
    const result = await this.pool.query(`update food_catalog set active=$2, updated_at=now() where slug=$1`, [slug, active]);
    if (!result.rowCount) throw new ApiError(404, 'not_found', 'غذا پیدا نشد');
    await withTransaction(this.pool, (client) => audit(client, adminId, active ? 'food_enabled' : 'food_disabled', 'food_catalog', null, { slug }));
    return this.get(slug);
  }

  /** The 18 editable columns, in the order both the insert and the update statements expect. */
  private fields(food: FoodInput): unknown[] {
    return [
      food.nameFa, food.category, food.mealTypes, food.servingLabel, food.servingG, food.kcal,
      food.proteinG, food.carbsG, food.fatG, food.fiberG, food.allergens, food.tags, food.regions, food.seasons,
      food.costTier, food.prepMinutes, JSON.stringify(food.ingredients), food.active,
    ];
  }

  // ----------------------------------------------------------------- CSV

  async revision(): Promise<string> {
    const result = await this.pool.query<{ revision: string }>(REVISION_SQL);
    return result.rows[0]!.revision;
  }

  async exportJson() {
    const { rows } = await this.pool.query<FoodRow>(`select ${COLUMNS} from food_catalog order by slug`);
    return { version: 1, foods: rows.map(viewOf) };
  }

  async replace(adminId: string, body: unknown) {
    const parsed = z.object({
      operationId: z.uuid(),
      expectedRevision: z.string().regex(/^[a-f0-9]{32}$/),
      foods: z.array(foodInputSchema).min(1).max(1000),
    }).safeParse(body);
    if (!parsed.success) throw new ApiError(400, 'validation', 'فایل جایگزینی معتبر نیست');
    const { foods, operationId, expectedRevision } = parsed.data;
    if (new Set(foods.map(food => food.slug)).size !== foods.length) throw new ApiError(400, 'validation', 'شناسهٔ غذای تکراری در فایل وجود دارد');
    return withTransaction(this.pool, async client => {
      await client.query('lock table food_catalog in share row exclusive mode');
      const duplicate = await client.query('select replacement_count from food_catalog_replacements where id=$1', [operationId]);
      if (duplicate.rows[0]) return { replaced: duplicate.rows[0].replacement_count, backupId: operationId, duplicate: true };
      const revision = await client.query<{ revision: string }>(REVISION_SQL);
      if (revision.rows[0]!.revision !== expectedRevision) throw new ApiError(409, 'catalog_changed', 'کاتالوگ تغییر کرده است؛ پیش‌نمایش را دوباره باز کن');
      const previous = await client.query<FoodRow>(`select ${COLUMNS} from food_catalog order by slug`);
      await client.query('insert into food_catalog_replacements (id, actor_id, previous_foods, replacement_count) values ($1,$2,$3::jsonb,$4)', [operationId, adminId, JSON.stringify(previous.rows.map(viewOf)), foods.length]);
      await client.query('delete from food_catalog');
      for (const food of foods) {
        await client.query(
          `insert into food_catalog (id,slug,name_fa,category,meal_types,serving_label,serving_g,kcal,protein_g,carbs_g,fat_g,fiber_g,allergens,tags,regions,seasons,cost_tier,prep_minutes,ingredients,active,source)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19::jsonb,$20,'admin')`,
          [uuidv7(), food.slug, ...this.fields(food)],
        );
        await client.query(METADATA_SQL, [food.slug, true, food.image ?? null, true, JSON.stringify(food.nutrition ?? null)]);
      }
      await audit(client, adminId, 'food_catalog_replaced', 'food_catalog', null, { backupId: operationId, previousCount: previous.rows.length, count: foods.length, digest: createHash('sha256').update(JSON.stringify(foods)).digest('hex') });
      return { replaced: foods.length, removed: previous.rows.length, backupId: operationId };
    });
  }

  async backup(id: string) {
    if (!z.uuid().safeParse(id).success) throw new ApiError(400, 'validation', 'شناسهٔ پشتیبان معتبر نیست');
    const result = await this.pool.query('select previous_foods from food_catalog_replacements where id=$1', [id]);
    if (!result.rows[0]) throw new ApiError(404, 'not_found', 'نسخهٔ پشتیبان پیدا نشد');
    return { version: 1, foods: result.rows[0].previous_foods };
  }

  /** One header line, then one food per line. Arrays use `|`, ingredients use `name:qty:unit:group|...`. */
  async exportCsv(): Promise<string> {
    const { rows } = await this.pool.query<FoodRow>(`select ${COLUMNS} from food_catalog order by slug`);
    const header = CSV_COLUMNS.join(',');
    const lines = rows.map((row) => {
      const food = viewOf(row);
      return [
        food.slug, food.nameFa, food.category, food.mealTypes.join('|'), food.servingLabel, food.servingG ?? '', food.kcal,
        food.proteinG, food.carbsG, food.fatG, food.fiberG, food.allergens.join('|'), food.tags.join('|'),
        food.regions.join('|'), food.seasons.join('|'), food.costTier, food.prepMinutes,
        food.ingredients.map((item) => `${item.name}:${item.quantity}:${item.unit}:${item.category}`).join('|'), food.active, food.image ?? '', food.nutrition ? JSON.stringify(food.nutrition) : '',
      ].map(csvCell).join(',');
    });
    return `\uFEFF${[header, ...lines].join('\r\n')}\r\n`;
  }

  /** All-or-nothing: any invalid row rejects the whole file and reports the line. */
  async importCsv(adminId: string, text: string) {
    if (text.length > 2_000_000) throw new ApiError(400, 'validation', 'فایل بیش از حد بزرگ است');
    const rows = parseCsv(text);
    const header = rows[0]?.map((cell) => cell.trim());
    if (!header || CSV_COLUMNS.slice(0, 19).some((column, index) => header[index] !== column) || header.slice(19).some((column, index) => column !== CSV_COLUMNS[index + 19])) {
      throw new ApiError(400, 'validation', 'سرستون‌های فایل با قالب استاندارد نمی‌خواند');
    }
    if (rows.length > 1001) throw new ApiError(400, 'validation', 'حداکثر هزار غذا در هر فایل مجاز است');
    const foods = rows.slice(1).map((cells, index) => {
      try {
        return this.parse(csvToFood(cells));
      } catch (error) {
        const message = error instanceof ApiError ? (error.getResponse() as { messageFa: string }).messageFa : 'ردیف معتبر نیست';
        throw new ApiError(400, 'validation', `خط ${index + 2}: ${message}`);
      }
    });
    let created = 0;
    let updated = 0;
    await withTransaction(this.pool, async (client) => {
      for (const food of foods) {
        const existing = await client.query<{ id: string }>(`select id from food_catalog where slug = $1`, [food.slug]);
        if (existing.rows[0]) {
          await client.query(UPDATE_SQL, [food.slug, ...this.fields(food)]);
          updated += 1;
        } else {
          await client.query(
            `insert into food_catalog
              (id, slug, name_fa, category, meal_types, serving_label, serving_g, kcal, protein_g, carbs_g, fat_g, fiber_g,
               allergens, tags, regions, seasons, cost_tier, prep_minutes, ingredients, active, source)
             values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19::jsonb,$20,'admin')`,
            [uuidv7(), food.slug, ...this.fields(food)],
          );
          created += 1;
        }
        await client.query(METADATA_SQL, [food.slug, food.image !== undefined, food.image ?? null, food.nutrition !== undefined, JSON.stringify(food.nutrition ?? null)]);
      }
      await audit(client, adminId, 'food_csv_import', 'food_catalog', null, { created, updated });
    });
    return { created, updated };
  }
}

const UPDATE_SQL = `update food_catalog set name_fa=$2, category=$3, meal_types=$4, serving_label=$5, serving_g=$6, kcal=$7,
  protein_g=$8, carbs_g=$9, fat_g=$10, fiber_g=$11, allergens=$12, tags=$13, regions=$14, seasons=$15,
  cost_tier=$16, prep_minutes=$17, ingredients=$18::jsonb, active=$19, source='admin', updated_at=now()
  where slug = $1`;

export function publicFoodImage(slug: string) {
  return `/v1/public/food-images/${slug}.jpg`;
}

/** `undefined` leaves the stored photo, `null` removes it, a buffer replaces it. */
export function jpegOf(body: unknown): Buffer | null | undefined {
  if (!body || typeof body !== 'object' || !('imageData' in body)) return undefined;
  const raw = (body as { imageData?: unknown }).imageData;
  if (raw == null || raw === '') return null;
  if (typeof raw !== 'string') throw new ApiError(400, 'validation', 'عکس غذا معتبر نیست');
  const bytes = Buffer.from(raw.replace(/^data:image\/jpeg;base64,/, ''), 'base64');
  if (bytes.length < 32 || bytes.length > 1_200_000 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) {
    throw new ApiError(400, 'validation', 'عکس باید JPEG و کوچک‌تر از ۱٫۲ مگابایت باشد');
  }
  return bytes;
}

const METADATA_SQL = `update food_catalog set image=case when $2 then $3 else image end,
  nutrition=case when $4 then $5::jsonb else nutrition end where slug=$1`;
const REVISION_SQL = `select md5(coalesce(jsonb_agg(to_jsonb(f) order by slug)::text,'[]')) as revision from food_catalog f`;

const CSV_COLUMNS = [
  'slug', 'name_fa', 'category', 'meal_types', 'serving_label', 'serving_g', 'kcal', 'protein_g', 'carbs_g', 'fat_g',
  'fiber_g', 'allergens', 'tags', 'regions', 'seasons', 'cost_tier', 'prep_minutes', 'ingredients', 'active', 'image', 'nutrition',
] as const;

const list = (cell: string | undefined) => (cell ?? '').split('|').map((item) => item.trim()).filter(Boolean);
const num = (cell: string | undefined) => (cell == null || cell.trim() === '' ? NaN : Number(cell.trim()));

function csvToFood(cells: string[]): unknown {
  return {
    slug: cells[0],
    nameFa: cells[1],
    category: cells[2]?.trim(),
    mealTypes: list(cells[3]),
    servingLabel: cells[4],
    servingG: cells[5]?.trim() === '' ? null : num(cells[5]),
    kcal: num(cells[6]),
    proteinG: num(cells[7]),
    carbsG: num(cells[8]),
    fatG: num(cells[9]),
    fiberG: num(cells[10]),
    allergens: list(cells[11]),
    tags: list(cells[12]),
    regions: list(cells[13]),
    seasons: list(cells[14]),
    costTier: num(cells[15]),
    prepMinutes: num(cells[16]),
    ingredients: list(cells[17]).map((item) => {
      const [name, quantity, unit, category] = item.split(':');
      return { name, quantity: num(quantity), unit, category };
    }),
    active: (cells[18] ?? 'true').trim().toLowerCase() !== 'false',
    image: cells[19] === undefined ? undefined : cells[19] || null,
    nutrition: cells[20] === undefined ? undefined : cells[20] ? JSON.parse(cells[20]) : null,
  };
}
