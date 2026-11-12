import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import request from 'supertest';
import { loginAdmin } from '../helpers/admin-login.js';
import { bootApp, type Booted } from '../helpers/boot.js';
import { uuidv7 } from '../../src/common/id.js';
import { SEED_FOODS } from '../../src/food/seed.js';

describe('food catalogue', { concurrency: 1, timeout: 240_000 }, () => {
  let app: Booted;
  let admin: { Authorization: string };

  before(async () => {
    app = await bootApp();
    await app.pool.query(`insert into users (id, phone_e164, role, status) values ($1,'+989180000077','admin','active')`, [uuidv7()]);
    const session = await loginAdmin(app.api, app.pool, '09180000077');
    admin = { Authorization: `Bearer ${session.accessToken}` };
  });
  after(async () => app?.stop());

  const http = () => request(app.api.getHttpServer());

  it('seeds idempotently and searches Persian names by prefix', async () => {
    const count = await app.pool.query<{ n: number }>('select count(*)::int as n from food_catalog');
    assert.equal(count.rows[0]!.n, SEED_FOODS.length);
    const { FoodService } = await import('../../dist/food/food.service.js');
    assert.equal(await app.api.get(FoodService).seed(), 0);
    const found = await http().get('/v1/admin/foods').query({ q: 'قورمه' }).set(admin);
    assert.equal(found.status, 200);
    assert.deepEqual(found.body.items.map((item: { slug: string }) => item.slug), ['ghormeh_sabzi']);
    const category = await http().get('/v1/admin/foods?category=fruit&limit=3').set(admin);
    assert.equal(category.body.items.length, 3);
    assert.ok(category.body.nextCursor);
    assert.equal((await http().get('/v1/admin/foods')).status, 401);
  });

  it('builds safe shortlists in SQL: allergens, diet, cost and region', async () => {
    const { FoodService } = await import('../../dist/food/food.service.js');
    const foods = app.api.get(FoodService);
    const vegan = await foods.candidates({ mealType: 'lunch', diet: 'vegan', limit: 200 });
    assert.ok(vegan.length >= 5);
    assert.ok(vegan.every((food) => !food.tags.includes('meat') && !food.allergens.includes('dairy')));
    const noNuts = await foods.candidates({ mealType: 'breakfast', excludeAllergens: ['nuts', 'dairy'], limit: 200 });
    assert.ok(noNuts.length >= 5);
    assert.ok(noNuts.every((food) => !food.allergens.includes('nuts') && !food.allergens.includes('dairy')));
    const cheap = await foods.candidates({ mealType: 'dinner', maxCostTier: 1, limit: 200 });
    assert.ok(cheap.every((food) => food.costTier === 1));
    const north = await foods.candidates({ mealType: 'dinner', categories: ['main'], preferRegion: 'north', nearKcal: 600, limit: 5 });
    assert.ok(north[0]!.regions.includes('north'));
    const left = await foods.candidates({ mealType: 'lunch', excludeSlugs: ['kabab_koobideh'], limit: 200 });
    assert.ok(!left.some((food) => food.slug === 'kabab_koobideh'));
  });

  it('lets an admin create, edit, disable and round-trip the catalogue as CSV', async () => {
    const body = {
      slug: 'test_ash_kadoo', nameFa: 'آش کدو', category: 'soup', mealTypes: ['lunch'], servingLabel: '۱ کاسه',
      servingG: 300, kcal: 210, proteinG: 8, carbsG: 30, fatG: 6, fiberG: 5, allergens: [], tags: ['traditional'],
      regions: [], seasons: ['autumn'], costTier: 1, prepMinutes: 40,
      ingredients: [{ name: 'کدو حلوایی', quantity: 200, unit: 'g', category: 'produce' }],
    };
    const created = await http().post('/v1/admin/foods').set(admin).send(body);
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.equal((await http().post('/v1/admin/foods').set(admin).send(body)).status, 409);
    assert.equal((await http().post('/v1/admin/foods').set(admin).send({ ...body, slug: 'bad_one', kcal: -4 })).status, 400);
    const edited = await http().put('/v1/admin/foods/test_ash_kadoo').set(admin).send({ ...body, kcal: 230 });
    assert.equal(edited.body.kcal, 230);
    assert.equal(edited.body.source, 'admin');
    const off = await http().post('/v1/admin/foods/test_ash_kadoo/active').set(admin).send({ active: false });
    assert.equal(off.body.active, false);
    const shown = await http().get('/v1/admin/foods?q=کدو&active=true').set(admin);
    assert.ok(!shown.body.items.some((item: { slug: string }) => item.slug === 'test_ash_kadoo'));

    const exported = await http().get('/v1/admin/foods/export.csv').set(admin);
    assert.equal(exported.status, 200);
    assert.match(String(exported.headers['content-type']), /text\/csv/);
    const csv = exported.text.replace(/test_ash_kadoo,آش کدو/, 'test_ash_kadoo,آش کدو دو');
    const imported = await http().post('/v1/admin/foods/import').set(admin).send({ csv });
    assert.equal(imported.status, 201, JSON.stringify(imported.body));
    assert.equal(imported.body.created, 0);
    assert.equal(imported.body.updated, SEED_FOODS.length + 1);
    const renamed = await http().get('/v1/admin/foods/test_ash_kadoo').set(admin);
    assert.equal(renamed.body.nameFa, 'آش کدو دو');

    const broken = exported.text.replace('ghormeh_sabzi,قورمه‌سبزی,main', 'ghormeh_sabzi,قورمه‌سبزی,nonsense');
    const rejected = await http().post('/v1/admin/foods/import').set(admin).send({ csv: broken });
    assert.equal(rejected.status, 400);
    assert.match(rejected.body.messageFa, /خط/);
    const untouched = await http().get('/v1/admin/foods/ghormeh_sabzi').set(admin);
    assert.equal(untouched.body.category, 'main');
  });

  it('replaces atomically, keeps a recoverable snapshot and never reseeds retired foods', async () => {
    const snapshot = await http().get('/v1/admin/foods/export.json').set(admin);
    const revision = await http().get('/v1/admin/foods/revision').set(admin);
    const food = { ...SEED_FOODS[0]!, active: true, image: '/assets/foods/test_food.jpg', nutrition: null };
    const body = { foods: [food], operationId: uuidv7(), expectedRevision: revision.body.revision };
    assert.equal((await http().post('/v1/admin/foods/replace').send(body)).status, 401);
    assert.equal((await http().post('/v1/admin/foods/replace').set(admin).send({ ...body, expectedRevision: '0'.repeat(32) })).status, 409);
    assert.equal((await http().post('/v1/admin/foods/replace').set(admin).send({ ...body, foods: [food, food] })).status, 400);
    const invalid = await http().post('/v1/admin/foods/replace').set(admin).send({ ...body, foods: [food, { ...food, slug: 'invalid_image', image: 'javascript:alert(1)' }] });
    assert.equal(invalid.status, 400);
    const unchanged = await http().get('/v1/admin/foods/revision').set(admin);
    assert.equal(unchanged.body.revision, revision.body.revision);
    const result = await http().post('/v1/admin/foods/replace').set(admin).send(body);
    assert.equal(result.status, 201, JSON.stringify(result.body));
    assert.equal(result.body.replaced, 1);
    const backup = await http().get('/v1/admin/foods/backups/' + result.body.backupId).set(admin);
    assert.deepEqual(backup.body.foods, snapshot.body.foods);
    const duplicate = await http().post('/v1/admin/foods/replace').set(admin).send(body);
    assert.equal(duplicate.body.duplicate, true);
    const { FoodService } = await import('../../dist/food/food.service.js');
    assert.equal(await app.api.get(FoodService).seed(), 0);
    const current = await http().get('/v1/admin/foods').set(admin);
    assert.equal(current.body.items.length, 1);
    assert.equal(current.body.items[0].image, food.image);
    const csv = await http().get('/v1/admin/foods/export.csv').set(admin);
    const imported = await http().post('/v1/admin/foods/import').set(admin).send({ csv: csv.text });
    assert.equal(imported.status, 201);
    const updated = await http().get('/v1/admin/foods/' + food.slug).set(admin);
    assert.equal(updated.body.image, food.image);
  });
});
