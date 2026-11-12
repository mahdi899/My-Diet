import fs from 'node:fs';
import path from 'node:path';
import { parseCsv } from '../../backend/dist/food/csv.js';
import { recipes } from './recipes.mjs';
import { ingredients } from './ingredients.mjs';
import { legacySlugs } from './legacy-slugs.mjs';

const [sourceMarkdown, usdaDirectory, imageDirectory, outputDirectory] = process.argv.slice(2);
if (!outputDirectory) throw new Error('Pass markdown, USDA CSV directory, images directory, output directory');
fs.mkdirSync(outputDirectory, { recursive: true });
const readTable = (name) => {
  const [header, ...rows] = parseCsv(fs.readFileSync(path.join(usdaDirectory, name), 'utf8'));
  return rows.map(row => Object.fromEntries(header.map((key, index) => [key, row[index]])));
};
const foodDescriptions = new Map(readTable('food.csv').map(row => [Number(row.fdc_id), row.description]));
const wantedIds = new Set(Object.values(ingredients).map(item => item[0]));
const nutrientIds = { 1008: 'kcal', 1003: 'proteinG', 1005: 'carbsG', 1004: 'fatG', 1079: 'fiberG' };
const nutrientsById = new Map();
for (const row of readTable('food_nutrient.csv')) {
  const id = Number(row.fdc_id);
  const field = nutrientIds[row.nutrient_id];
  if (!wantedIds.has(id) || !field) continue;
  const values = nutrientsById.get(id) || {};
  values[field] = Number(row.amount);
  nutrientsById.set(id, values);
}
for (const [key, [id, , , , animalTag]] of Object.entries(ingredients)) {
  if (!foodDescriptions.has(id)) throw new Error(`USDA record missing for ${key}: ${id}`);
  if (animalTag && nutrientsById.get(id)?.fiberG === undefined) {
    nutrientsById.get(id).fiberG = 0;
    nutrientsById.get(id).fiberAssumedZero = true;
  }
  for (const field of Object.values(nutrientIds)) {
    if (!Number.isFinite(nutrientsById.get(id)?.[field])) throw new Error(`Nutrient missing for ${key}: ${field}`);
  }
}
const markdown = fs.readFileSync(sourceMarkdown, 'utf8');
const definitions = new Map();
for (const match of markdown.matchAll(/^####\s+(\d+)\.\s+(.+)\r?\n([\s\S]*?)(?=^####\s|^###\s|$(?![\s\S]))/gm)) {
  const kcal = match[3].match(/کالری تقریبی.*?([۰-۹\d]+)\s*کیلوکالری/);
  if (!kcal) continue;
  const number = Number(match[1]);
  const prompt = match[3].match(/```text\s*([\s\S]*?)```/)?.[1].trim() || '';
  const digits = kcal[1].replace(/[۰-۹]/g, char => '۰۱۲۳۴۵۶۷۸۹'.indexOf(char));
  definitions.set(number, { title: match[2].replace(/\s*\([^()]*\)\s*$/, '').trim(), originalKcal: Number(digits), prompt });
}
const images = fs.readdirSync(imageDirectory).filter(name => /\.jpe?g$/i.test(name));
const byHash = new Map(images.map(name => [name.match(/_([a-f0-9]{8})\.jpg$/i)?.[1], name]));
const usedImages = new Set();
const excluded = [];
const round = value => Math.round(value * 10) / 10;
function categoryOf(number) {
  if (number <= 73) return 'breakfast';
  if (number >= 118 && number <= 125) return 'soup';
  if (number === 126 || number === 132 || number === 133 || number === 168) return 'salad';
  if (number >= 127 && number <= 131) return 'side';
  if (number >= 134 && number <= 142) return 'snack';
  if (number >= 143 && number <= 150) return 'drink';
  if (number >= 175) return 'dessert';
  return 'main';
}
const foods = [];
for (const [number, hash, servingG, prepMinutes, weights] of recipes) {
  const definition = definitions.get(number);
  if (!definition) throw new Error(`Markdown definition ${number} missing`);
  const imageFilename = byHash.get(hash);
  if (!hash || !imageFilename) {
    excluded.push({ number, name: definition.title, reason: 'تصویر متناظر در زیپ موجود نیست' });
    continue;
  }
  if (usedImages.has(imageFilename)) throw new Error(`Duplicate image ${imageFilename}`);
  usedImages.add(imageFilename);
  const totals = { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 };
  const sources = [];
  const allergens = new Set();
  const tags = new Set(['traditional', 'recipe_estimate']);
  const recipeIngredients = [];
  for (const [key, grams] of Object.entries(weights)) {
    const [id, name, category, ingredientAllergens = [], tag] = ingredients[key];
    const nutrients = nutrientsById.get(id);
    for (const field of Object.keys(totals)) totals[field] += nutrients[field] * grams / 100;
    ingredientAllergens.forEach(value => allergens.add(value));
    if (tag) tags.add(tag);
    recipeIngredients.push({ name, quantity: grams, unit: 'g', category });
    sources.push({ ingredient: name, grams, fdcId: id, description: foodDescriptions.get(id), nutrientsPer100G: nutrients });
  }
  if (!['poultry', 'meat', 'fish'].some(tag => tags.has(tag))) {
    tags.add('vegetarian');
    if (!['dairy', 'egg'].some(allergen => allergens.has(allergen)) && !tags.has('honey')) tags.add('vegan');
  }
  const category = categoryOf(number);
  const slug = legacySlugs[number] || `md_${number}_${hash}`;
  if (totals.proteinG * 4 >= totals.kcal * 0.2) tags.add('high_protein');
  if (totals.kcal < 250) tags.add('light');
  if (!allergens.has('gluten')) tags.add('gluten_free');
  const quantityLabel = category === 'drink' ? `۱ لیوان (${servingG} گرم)` : `۱ پرس (${servingG} گرم غذای آماده)`;
  foods.push({
    slug, nameFa: definition.title, category,
    mealTypes: category === 'breakfast' ? ['breakfast', 'snack'] : ['snack', 'drink', 'dessert', 'side'].includes(category) ? ['snack'] : ['lunch', 'dinner'],
    servingLabel: quantityLabel, servingG,
    ...Object.fromEntries(Object.entries(totals).map(([key, value]) => [key, key === 'kcal' ? Math.round(value) : round(value)])),
    allergens: [...allergens].sort(), tags: [...tags].sort(), regions: [], seasons: [],
    costTier: tags.has('fish') || tags.has('meat') ? 3 : tags.has('poultry') || ['walnut', 'almond', 'pistachio', 'quinoa', 'peanutButter', 'tahini'].some(key => weights[key]) ? 2 : 1,
    prepMinutes, ingredients: recipeIngredients, active: true,
    image: `/assets/foods/${slug}.jpg`,
    nutrition: {
      method: 'recipe_estimate', reference: 'USDA FoodData Central SR Legacy, April 2018',
      sourceUrl: 'https://fdc.nal.usda.gov/download-datasets/', originalPromptKcal: definition.originalKcal,
      notes: 'برآورد برای دستور استاندارد و وزن پرس درج‌شده است. وزن مواد، بخش خوراکیِ خام است مگر وضعیت دیگری در نام ماده ذکر شده باشد. وزن پرس، وزن آمادهٔ سرو است. تزئینات و ظروف جانبی عکس خارج از فهرست مواد در محاسبه نیستند. مرجع جایگزینِ مواد محلی در نام ماده مشخص شده است. اعداد برای نسخه‌های دیگر دستور یا روغن بیشتر قابل تعمیم نیستند.',
      ingredients: sources,
    },
  });
}
const unusedImages = images.filter(filename => !usedImages.has(filename)).map(filename => ({
  filename, reason: /Family_dining/i.test(filename) ? 'تصویر خانواده و افراد؛ خارج از کاتالوگ' : 'تصویر عمومی، تکراری یا بدون غذای یکتای متناظر در بخش غذایی Markdown',
}));
fs.writeFileSync(path.join(outputDirectory, 'catalog.json'), JSON.stringify({ version: 1, foods }, null, 2));
fs.writeFileSync(path.join(outputDirectory, 'matching-report.json'), JSON.stringify({ foods: foods.length, sourceFoods: definitions.size, excluded, unusedImages }, null, 2));
fs.writeFileSync(path.join(outputDirectory, 'image-jobs.json'), JSON.stringify(foods.map(food => {
  const recipe = recipes.find(row => (legacySlugs[row[0]] || `md_${row[0]}_${row[1]}`) === food.slug);
  return { input: path.join(imageDirectory, byHash.get(recipe[1])), output: `${food.slug}.jpg` };
}), null, 2));
console.log(JSON.stringify({ foods: foods.length, excluded, unusedImages: unusedImages.length }));
