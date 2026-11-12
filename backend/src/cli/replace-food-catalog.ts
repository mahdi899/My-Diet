import 'reflect-metadata';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { FoodService } from '../food/food.service.js';

const filename = process.argv[2];
if (!filename || !process.env.DATABASE_URL) throw new Error('Pass the catalog JSON path and configure DATABASE_URL');
const file = await readFile(filename, 'utf8');
const payload = JSON.parse(file) as { foods?: unknown[] };
if (!Array.isArray(payload.foods) || payload.foods.length === 0) throw new Error('The file must contain foods');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
try {
  const service = new FoodService(pool);
  const foods = payload.foods.map(food => service.parse(food));
  if (new Set(foods.map(food => food.slug)).size !== foods.length) throw new Error('Duplicate slugs');
  const current = await pool.query<{ count: number }>('select count(*)::int as count from food_catalog');
  console.log(JSON.stringify({ current: current.rows[0]!.count, replacement: foods.length, images: foods.filter(food => food.image).length, estimates: foods.filter(food => food.nutrition).length }));
  if (process.argv.includes('--apply')) {
    const actor = await pool.query<{ id: string }>("select id from users where role='admin' and status='active' order by created_at,id limit 1");
    if (!actor.rows[0]) throw new Error('No active admin is available for the audit entry');
    const digest = createHash('sha256').update(file).digest('hex');
    const operationId = `${digest.slice(0, 8)}-${digest.slice(8, 12)}-4${digest.slice(13, 16)}-a${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
    const result = await service.replace(actor.rows[0].id, { foods, operationId, expectedRevision: await service.revision() });
    console.log(JSON.stringify(result));
    const after = await pool.query('select count(*)::int as count, count(image)::int as images, count(nutrition)::int as nutrition from food_catalog');
    console.log(JSON.stringify(after.rows[0]));
  }
} finally {
  await pool.end();
}
