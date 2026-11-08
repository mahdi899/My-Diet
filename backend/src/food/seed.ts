/**
 * Iranian food catalogue seed. Every row is one household serving; the plan builder composes
 * from these rows, so energy and shopping lists never come from model guesses.
 * Values are rounded dietitian estimates for typical home cooking and can be corrected in the admin panel.
 */
export type FoodCategory =
  | 'breakfast' | 'main' | 'side' | 'soup' | 'salad' | 'protein' | 'carb' | 'dairy' | 'fruit' | 'snack' | 'drink' | 'dessert';
export type IngredientUnit = 'g' | 'kg' | 'ml' | 'l' | 'piece' | 'serving' | 'cup' | 'tbsp' | 'tsp';
export type IngredientGroup = 'produce' | 'dairy' | 'protein' | 'grains' | 'pantry' | 'other';
export type MealLetter = 'b' | 'l' | 'd' | 's';

export interface SeedIngredient {
  name: string;
  quantity: number;
  unit: IngredientUnit;
  category: IngredientGroup;
}

export interface SeedFood {
  slug: string;
  nameFa: string;
  category: FoodCategory;
  mealTypes: Array<'breakfast' | 'lunch' | 'dinner' | 'snack'>;
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
  costTier: 1 | 2 | 3;
  prepMinutes: number;
  ingredients: SeedIngredient[];
}

interface Opts {
  a?: string[];
  t?: string[];
  r?: string[];
  s?: string[];
  cost?: 1 | 2 | 3;
  prep?: number;
}
type Ing = [string, number, IngredientUnit, IngredientGroup];
type Macros = [kcal: number, protein: number, carbs: number, fat: number, fiber: number];

const MEAL: Record<MealLetter, SeedFood['mealTypes'][number]> = { b: 'breakfast', l: 'lunch', d: 'dinner', s: 'snack' };
const ANIMAL = ['meat', 'poultry', 'fish'];

/** Derived dietary tags so the rows stay short and consistent. */
export function deriveTags(tags: string[], allergens: string[], macros: Macros): string[] {
  const out = new Set(tags);
  const animal = ANIMAL.some((tag) => out.has(tag));
  if (!animal) out.add('vegetarian');
  if (!animal && !allergens.includes('dairy') && !allergens.includes('egg') && !out.has('honey')) out.add('vegan');
  if (!allergens.includes('gluten')) out.add('gluten_free');
  if (macros[1] >= 25) out.add('high_protein');
  if (macros[4] >= 6) out.add('high_fiber');
  if (macros[0] <= 350) out.add('light');
  return [...out];
}

function f(
  slug: string,
  nameFa: string,
  category: FoodCategory,
  meals: string,
  servingLabel: string,
  servingG: number | null,
  macros: Macros,
  ingredients: Ing[],
  o: Opts = {},
): SeedFood {
  const allergens = o.a ?? [];
  return {
    slug,
    nameFa,
    category,
    mealTypes: [...meals].map((letter) => MEAL[letter as MealLetter]),
    servingLabel,
    servingG,
    kcal: macros[0],
    proteinG: macros[1],
    carbsG: macros[2],
    fatG: macros[3],
    fiberG: macros[4],
    allergens,
    tags: deriveTags(o.t ?? [], allergens, macros),
    regions: o.r ?? [],
    seasons: o.s ?? [],
    costTier: o.cost ?? 2,
    prepMinutes: o.prep ?? 20,
    ingredients: ingredients.map(([name, quantity, unit, group]) => ({ name, quantity, unit, category: group })),
  };
}

const RICE_SERVE = 'یک پرس (خورش + ۱ کفگیر برنج)';
const rice = (g = 70): Ing => ['برنج ایرانی', g, 'g', 'grains'];

export const SEED_FOODS: SeedFood[] = [
  // ------------------------------------------------------------- breakfast
  f('nan_paneer_gerdoo', 'نان، پنیر و گردو', 'breakfast', 'b', 'یک کف‌دست نان + ۴۰ گرم پنیر + ۲ گردو', 140, [330, 14, 35, 15, 3],
    [['نان سنگک', 1, 'piece', 'grains'], ['پنیر', 40, 'g', 'dairy'], ['گردو', 2, 'piece', 'pantry']], { a: ['gluten', 'dairy', 'nuts'], cost: 1, prep: 3, t: ['traditional', 'quick'] }),
  f('nan_paneer_sabzi', 'نان، پنیر و سبزی خوردن', 'breakfast', 'b', 'یک کف‌دست نان + ۴۰ گرم پنیر + سبزی', 150, [300, 13, 34, 12, 3],
    [['نان سنگک', 1, 'piece', 'grains'], ['پنیر', 40, 'g', 'dairy'], ['سبزی خوردن', 30, 'g', 'produce']], { a: ['gluten', 'dairy'], cost: 1, prep: 3, t: ['traditional', 'quick'] }),
  f('nan_paneer_khiar_gojeh', 'نان، پنیر، خیار و گوجه', 'breakfast', 'b', 'یک کف‌دست نان + ۴۰ گرم پنیر + خیار و گوجه', 230, [290, 13, 35, 11, 4],
    [['نان سنگک', 1, 'piece', 'grains'], ['پنیر', 40, 'g', 'dairy'], ['خیار', 1, 'piece', 'produce'], ['گوجه‌فرنگی', 1, 'piece', 'produce']], { a: ['gluten', 'dairy'], cost: 1, prep: 5, t: ['quick'] }),
  f('nan_labneh_khiar', 'نان، لبنه و خیار', 'breakfast', 'b', 'یک کف‌دست نان + ۳ قاشق لبنه + خیار', 190, [310, 12, 33, 14, 3],
    [['نان سنگک', 1, 'piece', 'grains'], ['لبنه', 45, 'g', 'dairy'], ['خیار', 1, 'piece', 'produce']], { a: ['gluten', 'dairy'], cost: 1, prep: 4, t: ['quick'] }),
  f('nimroo', 'نیمرو با نان و سبزی', 'breakfast', 'b', '۲ تخم‌مرغ + نصف نان + سبزی', 190, [340, 17, 30, 17, 2],
    [['تخم‌مرغ', 2, 'piece', 'protein'], ['نان سنگک', 1, 'piece', 'grains'], ['روغن', 1, 'tsp', 'pantry'], ['سبزی خوردن', 20, 'g', 'produce']], { a: ['egg', 'gluten'], cost: 1, prep: 8, t: ['quick', 'traditional'] }),
  f('omelet_gojeh', 'املت گوجه‌فرنگی', 'breakfast', 'bd', '۲ تخم‌مرغ + گوجه + نصف نان', 260, [330, 16, 28, 17, 3],
    [['تخم‌مرغ', 2, 'piece', 'protein'], ['گوجه‌فرنگی', 2, 'piece', 'produce'], ['نان سنگک', 1, 'piece', 'grains'], ['روغن', 1, 'tsp', 'pantry']], { a: ['egg', 'gluten'], cost: 1, prep: 10, t: ['traditional', 'quick'] }),
  f('tokhm_morgh_abpaz', 'تخم‌مرغ آب‌پز با نان و خیار', 'breakfast', 'b', '۲ تخم‌مرغ آب‌پز + نصف نان + خیار', 230, [310, 17, 30, 13, 2],
    [['تخم‌مرغ', 2, 'piece', 'protein'], ['نان سنگک', 1, 'piece', 'grains'], ['خیار', 1, 'piece', 'produce']], { a: ['egg', 'gluten'], cost: 1, prep: 10, t: ['quick'] }),
  f('khagineh', 'خاگینه', 'breakfast', 'b', '۲ تخم‌مرغ شیرین با نان', 200, [320, 14, 30, 17, 1],
    [['تخم‌مرغ', 2, 'piece', 'protein'], ['شکر', 1, 'tbsp', 'pantry'], ['نان سنگک', 1, 'piece', 'grains'], ['کره', 1, 'tsp', 'dairy']], { a: ['egg', 'gluten', 'dairy'], cost: 1, prep: 8, t: ['traditional', 'sweet'] }),
  f('nan_kare_asal', 'نان، کره و عسل', 'breakfast', 'b', 'یک کف‌دست نان + ۱ قاشق کره + ۱ قاشق عسل', 90, [360, 6, 50, 15, 2],
    [['نان سنگک', 1, 'piece', 'grains'], ['کره', 1, 'tbsp', 'dairy'], ['عسل', 1, 'tbsp', 'pantry']], { a: ['gluten', 'dairy'], cost: 1, prep: 3, t: ['sweet', 'honey', 'quick'] }),
  f('nan_sarshir_asal', 'نان، سرشیر و عسل', 'breakfast', 'b', 'یک کف‌دست نان + ۲ قاشق سرشیر + عسل', 110, [390, 7, 48, 19, 2],
    [['نان سنگک', 1, 'piece', 'grains'], ['سرشیر', 30, 'g', 'dairy'], ['عسل', 1, 'tbsp', 'pantry']], { a: ['gluten', 'dairy'], cost: 2, prep: 3, t: ['sweet', 'honey', 'traditional'] }),
  f('oatmeal_moz', 'جو دوسر با شیر و موز', 'breakfast', 'b', '۱ کاسه جو دوسر با شیر + نصف موز', 330, [340, 11, 56, 8, 6],
    [['جو دوسر', 50, 'g', 'grains'], ['شیر کم‌چرب', 200, 'ml', 'dairy'], ['موز', 1, 'piece', 'produce'], ['دارچین', 1, 'tsp', 'pantry']], { a: ['dairy', 'gluten'], cost: 1, prep: 8, t: ['fasting_friendly'] }),
  f('smoothie_moz_shir', 'اسموتی موز و شیر', 'breakfast', 'bs', '۱ لیوان بزرگ', 350, [260, 9, 44, 5, 3],
    [['موز', 1, 'piece', 'produce'], ['شیر کم‌چرب', 250, 'ml', 'dairy'], ['عسل', 1, 'tsp', 'pantry']], { a: ['dairy'], cost: 1, prep: 5, t: ['quick', 'honey'] }),
  f('halim', 'حلیم', 'breakfast', 'b', '۱ کاسه (۲۵۰ گرم) با کمی شکر و دارچین', 250, [380, 18, 48, 13, 5],
    [['گندم برشته', 45, 'g', 'grains'], ['گوشت مرغ یا بوقلمون', 50, 'g', 'protein'], ['روغن', 1, 'tsp', 'pantry'], ['دارچین', 1, 'tsp', 'pantry']], { a: ['gluten'], t: ['poultry', 'traditional'], cost: 2, prep: 120, r: ['central', 'azari'] }),
  f('adasi', 'عدسی', 'breakfast', 'bld', '۱ کاسه (۳۰۰ گرم) با نان', 300, [290, 14, 42, 7, 9],
    [['عدس', 50, 'g', 'grains'], ['پیاز', 1, 'piece', 'produce'], ['سیب‌زمینی', 1, 'piece', 'produce'], ['نان سنگک', 1, 'piece', 'grains']], { a: ['gluten'], cost: 1, prep: 40, t: ['traditional', 'fasting_friendly'] }),
  f('nargesi_esfenaj', 'نرگسی اسفناج', 'main', 'bld', '۱ پرس با نصف نان', 270, [270, 14, 20, 15, 4],
    [['اسفناج', 150, 'g', 'produce'], ['تخم‌مرغ', 1, 'piece', 'protein'], ['پیاز', 1, 'piece', 'produce'], ['نان سنگک', 1, 'piece', 'grains']], { a: ['egg', 'gluten'], cost: 1, prep: 20, t: ['traditional'] }),
  f('kuku_sabzi', 'کوکو سبزی', 'main', 'bld', '۱ برش (۱۵۰ گرم) + یک لقمه نان', 190, [300, 15, 24, 16, 4],
    [['سبزی کوکو', 120, 'g', 'produce'], ['تخم‌مرغ', 2, 'piece', 'protein'], ['گردو', 1, 'piece', 'pantry'], ['نان سنگک', 1, 'piece', 'grains']], { a: ['egg', 'gluten', 'nuts'], cost: 1, prep: 35, t: ['traditional', 'batch_cook'] }),
  f('kuku_sibzamini', 'کوکو سیب‌زمینی', 'main', 'bld', '۱ عدد متوسط با سالاد', 210, [320, 10, 36, 15, 3],
    [['سیب‌زمینی', 200, 'g', 'produce'], ['تخم‌مرغ', 1, 'piece', 'protein'], ['روغن', 1, 'tsp', 'pantry']], { a: ['egg'], cost: 1, prep: 35, t: ['traditional'] }),
  f('nan_gerdoo_khorma', 'نان، گردو و خرما', 'breakfast', 'bs', 'نصف نان + ۲ گردو + ۳ خرما', 100, [350, 7, 52, 14, 5],
    [['نان سنگک', 1, 'piece', 'grains'], ['گردو', 4, 'piece', 'pantry'], ['خرما', 3, 'piece', 'produce']], { a: ['gluten', 'nuts'], cost: 2, prep: 2, t: ['quick', 'fasting_friendly', 'lactation_friendly'] }),
  // ----------------------------------------------------------------- mains
  f('ghormeh_sabzi', 'قورمه‌سبزی', 'main', 'ld', RICE_SERVE, 380, [630, 32, 70, 24, 9],
    [['گوشت گوسفندی یا گوساله', 80, 'g', 'protein'], ['سبزی قورمه', 120, 'g', 'produce'], ['لوبیا قرمز', 30, 'g', 'grains'], ['لیمو عمانی', 1, 'piece', 'pantry'], rice()], { t: ['meat', 'traditional'], cost: 2, prep: 90 }),
  f('gheymeh', 'قیمه', 'main', 'ld', RICE_SERVE, 380, [660, 30, 72, 26, 8],
    [['گوشت خورشتی', 70, 'g', 'protein'], ['لپه', 40, 'g', 'grains'], ['رب گوجه‌فرنگی', 1, 'tbsp', 'pantry'], ['سیب‌زمینی سرخ‌کرده', 40, 'g', 'produce'], rice()], { t: ['meat', 'traditional'], cost: 2, prep: 80 }),
  f('gheymeh_bademjan', 'قیمه‌بادمجان', 'main', 'ld', RICE_SERVE, 390, [650, 28, 70, 27, 8],
    [['گوشت خورشتی', 70, 'g', 'protein'], ['بادمجان', 1, 'piece', 'produce'], ['لپه', 35, 'g', 'grains'], rice()], { t: ['meat', 'traditional'], cost: 2, prep: 80 }),
  f('fesenjan', 'فسنجان', 'main', 'ld', RICE_SERVE, 380, [760, 32, 66, 38, 6],
    [['مرغ', 120, 'g', 'protein'], ['گردوی آسیاب‌شده', 50, 'g', 'pantry'], ['رب انار', 2, 'tbsp', 'pantry'], rice()], { a: ['nuts'], t: ['poultry', 'traditional'], cost: 3, prep: 120, r: ['north', 'central'] }),
  f('khoresh_bamieh', 'خورشت بامیه', 'main', 'ld', RICE_SERVE, 380, [560, 28, 64, 20, 7],
    [['گوشت خورشتی', 70, 'g', 'protein'], ['بامیه', 100, 'g', 'produce'], ['رب گوجه‌فرنگی', 1, 'tbsp', 'pantry'], rice()], { t: ['meat'], cost: 2, prep: 60, r: ['south'] }),
  f('khoresh_karafs', 'خورشت کرفس', 'main', 'ld', RICE_SERVE, 380, [570, 28, 64, 21, 7],
    [['گوشت خورشتی', 70, 'g', 'protein'], ['کرفس', 120, 'g', 'produce'], ['سبزی خورشتی', 80, 'g', 'produce'], rice()], { t: ['meat', 'traditional'], cost: 2, prep: 80 }),
  f('khoresh_alu_esfenaj', 'خورشت آلو اسفناج', 'main', 'ld', RICE_SERVE, 380, [600, 28, 68, 23, 6],
    [['گوشت خورشتی', 70, 'g', 'protein'], ['اسفناج', 100, 'g', 'produce'], ['آلو اسفناج', 30, 'g', 'produce'], rice()], { t: ['meat', 'traditional'], cost: 2, prep: 80 }),
  f('khoresh_kadoo', 'خورشت کدو', 'main', 'ld', RICE_SERVE, 380, [530, 25, 64, 19, 6],
    [['گوشت خورشتی', 60, 'g', 'protein'], ['کدو سبز', 150, 'g', 'produce'], ['رب گوجه‌فرنگی', 1, 'tbsp', 'pantry'], rice()], { t: ['meat'], cost: 2, prep: 60 }),
  f('khoresh_bademjan', 'خورشت بادمجان', 'main', 'ld', RICE_SERVE, 390, [600, 26, 66, 25, 8],
    [['گوشت خورشتی', 70, 'g', 'protein'], ['بادمجان', 1, 'piece', 'produce'], ['گوجه‌فرنگی', 1, 'piece', 'produce'], rice()], { t: ['meat', 'traditional'], cost: 2, prep: 70 }),
  f('khoresh_beh', 'خورشت به', 'main', 'ld', RICE_SERVE, 380, [640, 28, 76, 24, 7],
    [['گوشت خورشتی', 70, 'g', 'protein'], ['به', 1, 'piece', 'produce'], ['لپه', 25, 'g', 'grains'], rice()], { t: ['meat', 'traditional'], cost: 2, prep: 90, r: ['isfahan_fars'], s: ['autumn'] }),
  f('zereshk_polo_morgh', 'زرشک‌پلو با مرغ', 'main', 'ld', '۱ ران یا نصف سینه + ۱٫۵ کفگیر برنج', 420, [700, 38, 82, 22, 3],
    [['مرغ', 150, 'g', 'protein'], ['زرشک', 10, 'g', 'pantry'], rice(90), ['زعفران', 1, 'tsp', 'pantry']], { t: ['poultry', 'traditional'], cost: 2, prep: 60, r: ['khorasan', 'central'] }),
  f('havij_polo_morgh', 'هویج‌پلو با مرغ', 'main', 'ld', '۱ ران مرغ + ۱٫۵ کفگیر برنج', 420, [680, 32, 78, 24, 5],
    [['مرغ', 150, 'g', 'protein'], ['هویج', 80, 'g', 'produce'], rice(90), ['زعفران', 1, 'tsp', 'pantry']], { t: ['poultry', 'traditional'], cost: 2, prep: 60 }),
  f('adas_polo', 'عدس‌پلو', 'main', 'ld', '۱ پرس با کشمش و ماست', 380, [600, 18, 102, 13, 8],
    [['عدس', 40, 'g', 'grains'], ['کشمش', 15, 'g', 'pantry'], rice(80), ['پیازداغ', 1, 'tbsp', 'pantry']], { t: ['traditional', 'fasting_friendly'], cost: 1, prep: 50, r: ['central', 'isfahan_fars'] }),
  f('baghali_polo', 'باقالی‌پلو', 'main', 'ld', '۱ پرس با شوید', 380, [640, 20, 102, 15, 9],
    [['باقالی', 70, 'g', 'produce'], ['شوید', 30, 'g', 'produce'], rice(80), ['روغن', 1, 'tbsp', 'pantry']], { t: ['traditional'], cost: 2, prep: 55, s: ['spring'], r: ['north', 'central'] }),
  f('baghali_polo_morgh', 'باقالی‌پلو با مرغ', 'main', 'ld', '۱ ران مرغ + ۱ کفگیر باقالی‌پلو', 430, [690, 38, 80, 22, 7],
    [['مرغ', 150, 'g', 'protein'], ['باقالی', 60, 'g', 'produce'], ['شوید', 25, 'g', 'produce'], rice(80)], { t: ['poultry', 'traditional'], cost: 2, prep: 70, s: ['spring'] }),
  f('loobia_polo', 'لوبیاپلو', 'main', 'ld', '۱ پرس با گوشت', 400, [660, 26, 86, 22, 7],
    [['گوشت چرخ‌کرده', 60, 'g', 'protein'], ['لوبیا سبز', 80, 'g', 'produce'], ['رب گوجه‌فرنگی', 1, 'tbsp', 'pantry'], rice(80)], { t: ['meat', 'traditional'], cost: 2, prep: 60 }),
  f('sabzi_polo_mahi', 'سبزی‌پلو با ماهی', 'main', 'ld', '۱ تکه ماهی + ۱ کفگیر سبزی‌پلو', 400, [620, 32, 76, 20, 4],
    [['ماهی', 150, 'g', 'protein'], ['سبزی پلویی', 40, 'g', 'produce'], rice(80), ['روغن', 1, 'tsp', 'pantry']], { a: ['fish'], t: ['fish', 'traditional'], cost: 3, prep: 50, r: ['central', 'north'] }),
  f('estamboli_polo', 'استانبولی‌پلو', 'main', 'ld', '۱ پرس با گوشت', 400, [640, 24, 88, 22, 5],
    [['گوشت چرخ‌کرده', 50, 'g', 'protein'], ['گوجه‌فرنگی', 2, 'piece', 'produce'], ['سیب‌زمینی', 1, 'piece', 'produce'], rice(80)], { t: ['meat'], cost: 2, prep: 60 }),
  f('albaloo_polo_morgh', 'آلبالوپلو با مرغ', 'main', 'ld', '۱ ران مرغ + ۱٫۵ کفگیر برنج', 430, [700, 36, 86, 22, 4],
    [['مرغ', 150, 'g', 'protein'], ['آلبالو', 30, 'g', 'produce'], rice(90), ['شکر', 1, 'tsp', 'pantry']], { t: ['poultry', 'traditional'], cost: 2, prep: 70, r: ['central'] }),
  f('tahchin_morgh', 'ته‌چین مرغ', 'main', 'ld', '۱ برش بزرگ', 330, [740, 36, 78, 30, 3],
    [['مرغ', 120, 'g', 'protein'], ['ماست', 60, 'g', 'dairy'], ['تخم‌مرغ', 1, 'piece', 'protein'], rice(90), ['زعفران', 1, 'tsp', 'pantry']], { a: ['egg', 'dairy'], t: ['poultry', 'traditional'], cost: 2, prep: 90 }),
  f('kalam_polo', 'کلم‌پلو شیرازی', 'main', 'ld', '۱ پرس با گوشت', 400, [650, 24, 84, 24, 6],
    [['گوشت چرخ‌کرده', 50, 'g', 'protein'], ['کلم', 100, 'g', 'produce'], ['سبزی کلم‌پلو', 40, 'g', 'produce'], rice(80)], { t: ['meat', 'traditional'], cost: 2, prep: 60, r: ['isfahan_fars'] }),
  f('kabab_koobideh', 'کباب کوبیده', 'main', 'ld', '۱ سیخ کوبیده + ۱ کفگیر برنج + گوجه کبابی', 360, [560, 34, 62, 20, 3],
    [['گوشت چرخ‌کرده', 120, 'g', 'protein'], rice(70), ['گوجه‌فرنگی', 1, 'piece', 'produce'], ['پیاز', 1, 'piece', 'produce']], { t: ['meat', 'traditional'], cost: 3, prep: 40 }),
  f('joojeh_kabab', 'جوجه‌کباب', 'main', 'ld', '۱ سیخ جوجه (۱۵۰ گرم) + ۱ کفگیر برنج', 370, [580, 42, 64, 16, 3],
    [['سینه یا ران مرغ', 150, 'g', 'protein'], rice(70), ['گوجه‌فرنگی', 1, 'piece', 'produce'], ['زعفران', 1, 'tsp', 'pantry']], { t: ['poultry', 'traditional'], cost: 2, prep: 45 }),
  f('kabab_barg', 'کباب برگ', 'main', 'ld', '۱ سیخ برگ (۱۳۰ گرم) + ۱ کفگیر برنج', 370, [620, 46, 62, 20, 3],
    [['گوشت گوسفندی', 130, 'g', 'protein'], rice(70), ['گوجه‌فرنگی', 1, 'piece', 'produce']], { t: ['meat', 'traditional'], cost: 3, prep: 40 }),
  f('morgh_gerill_sabzijat', 'مرغ گریل با سبزیجات', 'main', 'ld', '۱ سینه (۱۵۰ گرم) + سبزیجات بخارپز', 330, [400, 42, 18, 16, 6],
    [['سینه مرغ', 150, 'g', 'protein'], ['کدو سبز', 100, 'g', 'produce'], ['هویج', 60, 'g', 'produce'], ['روغن زیتون', 1, 'tsp', 'pantry']], { t: ['poultry', 'low_carb'], cost: 2, prep: 25 }),
  f('seena_morgh_berenj_sabzi', 'سینه مرغ، کته و سبزیجات', 'main', 'ld', '۱ سینه + ۱ کفگیر کته + سبزی', 400, [480, 44, 50, 10, 5],
    [['سینه مرغ', 130, 'g', 'protein'], ['برنج ایرانی', 60, 'g', 'grains'], ['سبزیجات بخارپز', 100, 'g', 'produce']], { t: ['poultry'], cost: 2, prep: 30 }),
  f('mahi_kabab_gerill', 'ماهی گریل با سبزیجات', 'main', 'ld', '۱ تکه ماهی (۱۵۰ گرم) + سبزیجات', 330, [360, 38, 12, 16, 4],
    [['ماهی', 150, 'g', 'protein'], ['لیمو', 1, 'piece', 'produce'], ['کدو سبز', 100, 'g', 'produce'], ['روغن زیتون', 1, 'tsp', 'pantry']], { a: ['fish'], t: ['fish', 'low_carb'], cost: 3, prep: 25 }),
  f('ghalieh_mahi', 'قلیه‌ماهی', 'main', 'ld', RICE_SERVE, 380, [520, 30, 60, 18, 6],
    [['ماهی', 100, 'g', 'protein'], ['سبزی قلیه', 80, 'g', 'produce'], ['تمر هندی', 1, 'tbsp', 'pantry'], rice(60)], { a: ['fish'], t: ['fish', 'traditional'], cost: 3, prep: 60, r: ['south'] }),
  f('mirza_ghasemi', 'میرزاقاسمی', 'main', 'ld', '۱ پرس + نصف نان', 300, [380, 10, 32, 24, 8],
    [['بادمجان', 2, 'piece', 'produce'], ['تخم‌مرغ', 1, 'piece', 'protein'], ['سیر', 4, 'piece', 'produce'], ['نان سنگک', 1, 'piece', 'grains']], { a: ['egg', 'gluten'], cost: 1, prep: 40, r: ['north'], t: ['traditional'] }),
  f('kashk_bademjan', 'کشک‌بادمجان', 'main', 'ld', '۱ پرس + نصف نان', 300, [380, 12, 30, 24, 7],
    [['بادمجان', 2, 'piece', 'produce'], ['کشک', 40, 'g', 'dairy'], ['گردو', 2, 'piece', 'pantry'], ['نان سنگک', 1, 'piece', 'grains']], { a: ['dairy', 'gluten', 'nuts'], cost: 1, prep: 40, t: ['traditional'] }),
  f('dizi', 'دیزی (آبگوشت)', 'main', 'ld', '۱ پرس دیزی + نصف نان', 600, [680, 38, 66, 28, 9],
    [['گوشت گوسفندی', 90, 'g', 'protein'], ['نخود', 40, 'g', 'grains'], ['سیب‌زمینی', 1, 'piece', 'produce'], ['نان سنگک', 1, 'piece', 'grains']], { a: ['gluten'], t: ['meat', 'traditional'], cost: 3, prep: 180, r: ['central', 'kurdish', 'azari'] }),
  f('ash_reshteh', 'آش رشته', 'soup', 'ld', '۱ کاسه بزرگ (۳۵۰ گرم)', 350, [340, 16, 48, 9, 10],
    [['رشته آش', 40, 'g', 'grains'], ['لوبیا و نخود و عدس', 50, 'g', 'grains'], ['سبزی آش', 100, 'g', 'produce'], ['کشک', 15, 'g', 'dairy'], ['پیازداغ', 1, 'tbsp', 'pantry']], { a: ['gluten', 'dairy'], cost: 1, prep: 90, t: ['traditional', 'fasting_friendly'] }),
  f('ash_jo', 'آش جو', 'soup', 'ld', '۱ کاسه (۳۵۰ گرم)', 350, [300, 15, 44, 7, 7],
    [['جو پوست‌کنده', 40, 'g', 'grains'], ['هویج', 60, 'g', 'produce'], ['سبزی آش', 60, 'g', 'produce'], ['نخود', 20, 'g', 'grains']], { a: ['gluten'], cost: 1, prep: 90, t: ['traditional', 'lactation_friendly'] }),
  f('ash_anar', 'آش انار', 'soup', 'ld', '۱ کاسه (۳۵۰ گرم)', 350, [320, 14, 46, 9, 6],
    [['رب انار', 2, 'tbsp', 'pantry'], ['لپه', 30, 'g', 'grains'], ['سبزی آش', 80, 'g', 'produce'], ['برنج ایرانی', 20, 'g', 'grains']], { cost: 2, prep: 90, t: ['traditional'], r: ['north'], s: ['autumn', 'winter'] }),
  f('ash_doogh', 'آش دوغ', 'soup', 'ld', '۱ کاسه (۳۰۰ گرم)', 300, [240, 10, 34, 6, 3],
    [['دوغ', 150, 'ml', 'dairy'], ['برنج ایرانی', 30, 'g', 'grains'], ['سبزی آش', 60, 'g', 'produce'], ['نخود', 20, 'g', 'grains']], { a: ['dairy'], cost: 1, prep: 50, r: ['azari'], t: ['traditional'] }),
  f('soup_jo_morgh', 'سوپ جو و مرغ', 'soup', 'ld', '۱ کاسه (۳۰۰ گرم)', 300, [260, 18, 30, 6, 4],
    [['مرغ', 50, 'g', 'protein'], ['جو پرک', 30, 'g', 'grains'], ['هویج', 50, 'g', 'produce'], ['جعفری', 10, 'g', 'produce']], { a: ['gluten'], t: ['poultry', 'lactation_friendly'], cost: 1, prep: 50 }),
  f('dolme_barg', 'دلمه برگ مو', 'main', 'ld', '۵ عدد دلمه + ماست', 260, [270, 10, 34, 11, 4],
    [['برگ مو', 5, 'piece', 'produce'], ['گوشت چرخ‌کرده', 40, 'g', 'protein'], ['برنج ایرانی', 30, 'g', 'grains'], ['لپه', 10, 'g', 'grains']], { t: ['meat', 'traditional'], cost: 2, prep: 90, r: ['azari', 'kurdish'] }),
  f('dolme_felfel', 'دلمه فلفل', 'main', 'ld', '۲ عدد دلمه فلفل', 330, [320, 14, 28, 16, 4],
    [['فلفل دلمه‌ای', 2, 'piece', 'produce'], ['گوشت چرخ‌کرده', 60, 'g', 'protein'], ['برنج ایرانی', 30, 'g', 'grains'], ['رب گوجه‌فرنگی', 1, 'tbsp', 'pantry']], { t: ['meat', 'traditional'], cost: 2, prep: 70 }),
  f('koofteh_tabrizi', 'کوفته تبریزی', 'main', 'ld', '۱ کوفته بزرگ + کمی نان', 330, [520, 26, 56, 20, 4],
    [['گوشت چرخ‌کرده', 100, 'g', 'protein'], ['برنج ایرانی', 40, 'g', 'grains'], ['لپه', 30, 'g', 'grains'], ['نان سنگک', 1, 'piece', 'grains']], { a: ['gluten', 'egg'], t: ['meat', 'traditional'], cost: 3, prep: 100, r: ['azari'] }),
  f('tas_kabab', 'تاس‌کباب', 'main', 'ld', RICE_SERVE, 380, [540, 28, 54, 24, 6],
    [['گوشت گوسفندی', 80, 'g', 'protein'], ['سیب‌زمینی', 1, 'piece', 'produce'], ['هویج', 50, 'g', 'produce'], rice(50)], { t: ['meat', 'traditional'], cost: 2, prep: 80 }),
  f('torsh_tareh', 'ترش‌تره', 'main', 'ld', RICE_SERVE, 380, [560, 26, 60, 22, 8],
    [['گوشت خورشتی', 70, 'g', 'protein'], ['سبزی ترش‌تره', 120, 'g', 'produce'], ['لپه', 25, 'g', 'grains'], rice(60)], { t: ['meat', 'traditional'], cost: 2, prep: 90, r: ['north'] }),
  f('lobia_chiti_khorak', 'خوراک لوبیا چیتی', 'main', 'ld', '۱ پرس با نان و ترشی', 330, [330, 16, 48, 8, 12],
    [['لوبیا چیتی', 60, 'g', 'grains'], ['رب گوجه‌فرنگی', 1, 'tbsp', 'pantry'], ['پیاز', 1, 'piece', 'produce'], ['نان سنگک', 1, 'piece', 'grains']], { a: ['gluten'], cost: 1, prep: 60, t: ['traditional', 'fasting_friendly', 'lactation_friendly'] }),
  f('baghala_ghatogh', 'باقلاقاتوق', 'main', 'ld', '۱ پرس با نصف نان', 320, [380, 16, 34, 20, 9],
    [['باقالی', 150, 'g', 'produce'], ['تخم‌مرغ', 2, 'piece', 'protein'], ['شوید', 30, 'g', 'produce'], ['نان سنگک', 1, 'piece', 'grains']], { a: ['egg', 'gluten'], cost: 1, prep: 30, r: ['north'], s: ['spring'], t: ['traditional'] }),
  f('salad_olivieh', 'سالاد الویه', 'main', 'ld', '۱ پرس با نصف نان', 250, [420, 17, 30, 26, 4],
    [['مرغ پخته', 60, 'g', 'protein'], ['سیب‌زمینی', 1, 'piece', 'produce'], ['تخم‌مرغ', 1, 'piece', 'protein'], ['مایونز', 2, 'tbsp', 'pantry'], ['خیارشور', 1, 'piece', 'produce']], { a: ['egg', 'gluten'], t: ['poultry'], cost: 2, prep: 40 }),
  f('tuna_salad_nan', 'سالاد تن‌ماهی با نان', 'main', 'ld', '۱ قوطی کوچک تن + سالاد + نصف نان', 300, [330, 30, 24, 12, 5],
    [['تن‌ماهی', 100, 'g', 'protein'], ['کاهو', 80, 'g', 'produce'], ['گوجه‌فرنگی', 1, 'piece', 'produce'], ['نان سنگک', 1, 'piece', 'grains']], { a: ['fish', 'gluten'], t: ['fish', 'quick'], cost: 2, prep: 8 }),
  f('mast_khiar_nan', 'ماست‌وخیار با نان و سبزی', 'main', 'l', '۱ کاسه ماست‌وخیار + نان + سبزی', 330, [290, 12, 38, 9, 4],
    [['ماست کم‌چرب', 200, 'g', 'dairy'], ['خیار', 1, 'piece', 'produce'], ['نان سنگک', 1, 'piece', 'grains'], ['سبزی خوردن', 30, 'g', 'produce']], { a: ['dairy', 'gluten'], cost: 1, prep: 5, t: ['quick'] }),
  f('borani_esfenaj_nan', 'بورانی اسفناج با نان', 'main', 'ld', '۱ کاسه بورانی + نان', 280, [310, 14, 36, 12, 5],
    [['اسفناج', 150, 'g', 'produce'], ['ماست', 150, 'g', 'dairy'], ['سیر', 2, 'piece', 'produce'], ['نان سنگک', 1, 'piece', 'grains']], { a: ['dairy', 'gluten'], cost: 1, prep: 15, t: ['traditional'] }),
  f('khorak_morgh_sabzijat', 'خوراک مرغ و سبزیجات', 'main', 'ld', '۱ پرس با نصف نان', 350, [380, 34, 28, 14, 6],
    [['مرغ', 130, 'g', 'protein'], ['هویج', 60, 'g', 'produce'], ['لوبیا سبز', 60, 'g', 'produce'], ['نان سنگک', 1, 'piece', 'grains']], { a: ['gluten'], t: ['poultry'], cost: 2, prep: 40 }),
  // -------------------------------------------------------- salads & sides
  f('salad_shirazi', 'سالاد شیرازی', 'salad', 'ld', '۱ کاسه کوچک', 180, [90, 2, 10, 5, 3],
    [['خیار', 1, 'piece', 'produce'], ['گوجه‌فرنگی', 1, 'piece', 'produce'], ['پیاز', 0.5, 'piece', 'produce'], ['آب‌لیمو', 1, 'tbsp', 'pantry'], ['روغن زیتون', 1, 'tsp', 'pantry']], { cost: 1, prep: 8, t: ['traditional', 'quick'] }),
  f('salad_kahoo', 'سالاد کاهو', 'salad', 'ld', '۱ کاسه', 150, [70, 2, 8, 4, 3],
    [['کاهو', 120, 'g', 'produce'], ['خیار', 1, 'piece', 'produce'], ['سرکه', 1, 'tbsp', 'pantry'], ['روغن زیتون', 1, 'tsp', 'pantry']], { cost: 1, prep: 5, t: ['quick'] }),
  f('salad_fasl', 'سالاد فصل', 'salad', 'ld', '۱ کاسه', 200, [80, 2, 10, 4, 4],
    [['کاهو', 80, 'g', 'produce'], ['هویج', 50, 'g', 'produce'], ['گوجه‌فرنگی', 1, 'piece', 'produce'], ['روغن زیتون', 1, 'tsp', 'pantry']], { cost: 1, prep: 8 }),
  f('salad_havij_kalam', 'سالاد کلم و هویج', 'salad', 'ld', '۱ کاسه', 180, [100, 2, 14, 5, 4],
    [['کلم', 100, 'g', 'produce'], ['هویج', 60, 'g', 'produce'], ['آب‌لیمو', 1, 'tbsp', 'pantry'], ['روغن', 1, 'tsp', 'pantry']], { cost: 1, prep: 8 }),
  f('borani_esfenaj', 'بورانی اسفناج', 'side', 'ld', '۱ کاسه کوچک', 150, [150, 8, 10, 9, 2],
    [['اسفناج', 80, 'g', 'produce'], ['ماست', 100, 'g', 'dairy'], ['سیر', 1, 'piece', 'produce']], { a: ['dairy'], cost: 1, prep: 12, t: ['traditional'] }),
  f('mast_khiar', 'ماست‌وخیار', 'side', 'ld', '۱ کاسه کوچک', 180, [110, 6, 12, 4, 1],
    [['ماست', 150, 'g', 'dairy'], ['خیار', 1, 'piece', 'produce'], ['نعنا', 2, 'g', 'produce']], { a: ['dairy'], cost: 1, prep: 5, t: ['traditional', 'quick'] }),
  f('mast_musir', 'ماست و موسیر', 'side', 'ld', '۱ کاسه کوچک', 150, [100, 6, 10, 4, 0],
    [['ماست', 150, 'g', 'dairy'], ['موسیر', 10, 'g', 'produce']], { a: ['dairy'], cost: 1, prep: 3, t: ['quick', 'traditional'] }),
  f('sabzi_khordan', 'سبزی خوردن', 'side', 'bld', '۱ بشقاب کوچک', 60, [25, 2, 4, 0, 3],
    [['سبزی خوردن', 60, 'g', 'produce']], { cost: 1, prep: 5, t: ['traditional', 'quick'] }),
  f('zeytoon_parvardeh', 'زیتون پرورده', 'side', 'bld', '۴ قاشق', 50, [90, 1, 5, 8, 2],
    [['زیتون', 40, 'g', 'pantry'], ['گردو', 1, 'piece', 'pantry']], { a: ['nuts'], cost: 2, prep: 0, r: ['north'], t: ['traditional'] }),
  // ----------------------------------------------------------------- carbs
  f('berenj_abkesh', 'برنج آبکش', 'carb', 'ld', '۱ کفگیر پخته', 150, [210, 4, 46, 1, 1],
    [['برنج ایرانی', 70, 'g', 'grains']], { cost: 1, prep: 40, t: ['traditional'] }),
  f('berenj_kateh', 'کته', 'carb', 'ld', '۱ کفگیر پخته', 150, [230, 4, 48, 2, 1],
    [['برنج ایرانی', 70, 'g', 'grains'], ['کره', 1, 'tsp', 'dairy']], { a: ['dairy'], cost: 1, prep: 35, t: ['traditional'] }),
  f('nan_sangak', 'نان سنگک', 'carb', 'bld', 'یک کف‌دست', 40, [110, 4, 22, 1, 2],
    [['نان سنگک', 1, 'piece', 'grains']], { a: ['gluten'], cost: 1, prep: 0, t: ['traditional', 'quick'] }),
  f('nan_barbari', 'نان بربری', 'carb', 'bld', 'یک کف‌دست', 50, [140, 5, 27, 2, 1],
    [['نان بربری', 1, 'piece', 'grains']], { a: ['gluten'], cost: 1, prep: 0, t: ['traditional', 'quick'] }),
  f('nan_lavash', 'نان لواش', 'carb', 'bld', '۱ عدد متوسط', 35, [95, 3, 19, 1, 1],
    [['نان لواش', 1, 'piece', 'grains']], { a: ['gluten'], cost: 1, prep: 0, t: ['traditional', 'quick'] }),
  f('nan_jo', 'نان جو', 'carb', 'bld', 'یک کف‌دست', 45, [105, 5, 19, 1, 3],
    [['نان جو', 1, 'piece', 'grains']], { a: ['gluten'], cost: 1, prep: 0, t: ['traditional', 'quick'] }),
  f('sibzamini_abpaz', 'سیب‌زمینی آب‌پز', 'carb', 'ld', '۱ عدد متوسط', 150, [130, 3, 30, 0, 3],
    [['سیب‌زمینی', 150, 'g', 'produce']], { cost: 1, prep: 25, t: ['quick'] }),
  // ----------------------------------------------------------------- fruit
  f('sib', 'سیب', 'fruit', 's', '۱ عدد متوسط', 180, [95, 1, 25, 0, 4], [['سیب', 1, 'piece', 'produce']], { cost: 1, prep: 0, t: ['quick'] }),
  f('porteghal', 'پرتقال', 'fruit', 's', '۱ عدد متوسط', 180, [85, 2, 21, 0, 4], [['پرتقال', 1, 'piece', 'produce']], { cost: 1, prep: 0, t: ['quick'], s: ['autumn', 'winter'] }),
  f('moz', 'موز', 'fruit', 's', '۱ عدد متوسط', 120, [105, 1, 27, 0, 3], [['موز', 1, 'piece', 'produce']], { cost: 1, prep: 0, t: ['quick'] }),
  f('khiar_2', 'خیار', 'fruit', 's', '۲ عدد', 200, [30, 1, 6, 0, 1], [['خیار', 2, 'piece', 'produce']], { cost: 1, prep: 2, t: ['quick'] }),
  f('hendevaneh', 'هندوانه', 'fruit', 's', '۲ برش متوسط', 300, [90, 2, 22, 0, 1], [['هندوانه', 300, 'g', 'produce']], { cost: 1, prep: 2, s: ['summer'], t: ['quick'] }),
  f('kharbozeh', 'خربزه', 'fruit', 's', '۲ برش', 250, [70, 2, 17, 0, 2], [['خربزه', 250, 'g', 'produce']], { cost: 1, prep: 2, s: ['summer'], t: ['quick'] }),
  f('anar', 'انار', 'fruit', 's', '۱ عدد متوسط', 200, [130, 3, 29, 2, 6], [['انار', 1, 'piece', 'produce']], { cost: 1, prep: 5, s: ['autumn'], t: ['quick'] }),
  f('angoor', 'انگور', 'fruit', 's', '۱ خوشه کوچک', 150, [100, 1, 26, 0, 1], [['انگور', 150, 'g', 'produce']], { cost: 1, prep: 2, s: ['summer', 'autumn'], t: ['quick'] }),
  f('kiwi_2', 'کیوی', 'fruit', 's', '۲ عدد', 140, [90, 2, 22, 1, 5], [['کیوی', 2, 'piece', 'produce']], { cost: 2, prep: 2, s: ['winter'], t: ['quick'] }),
  f('naspati', 'گلابی', 'fruit', 's', '۱ عدد متوسط', 180, [100, 1, 27, 0, 5], [['گلابی', 1, 'piece', 'produce']], { cost: 1, prep: 0, t: ['quick'] }),
  f('khorma_3', 'خرما', 'fruit', 'sb', '۳ عدد', 30, [70, 1, 19, 0, 2], [['خرما', 3, 'piece', 'produce']], { cost: 2, prep: 0, t: ['quick', 'fasting_friendly', 'lactation_friendly'] }),
  // ---------------------------------------------------------------- snacks
  f('gerdoo_3', 'گردو', 'snack', 's', '۳ عدد (۱۵ گرم)', 15, [130, 3, 3, 13, 1], [['گردو', 3, 'piece', 'pantry']], { a: ['nuts'], cost: 2, prep: 0, t: ['quick'] }),
  f('badam_15', 'بادام', 'snack', 's', '۱۵ عدد (۲۰ گرم)', 20, [115, 4, 4, 10, 3], [['بادام', 15, 'piece', 'pantry']], { a: ['nuts'], cost: 2, prep: 0, t: ['quick'] }),
  f('pesteh_30', 'پسته', 'snack', 's', 'یک مشت کوچک (۳۰ گرم)', 30, [170, 6, 8, 14, 3], [['پسته', 30, 'g', 'pantry']], { a: ['nuts'], cost: 3, prep: 0, t: ['quick'] }),
  f('tokhmeh_afabgardan', 'تخمه آفتابگردان', 'snack', 's', 'یک مشت کوچک (۳۰ گرم)', 30, [170, 6, 6, 15, 2], [['تخمه آفتابگردان', 30, 'g', 'pantry']], { cost: 1, prep: 0, t: ['quick'] }),
  f('nokhodchi', 'نخودچی', 'snack', 's', 'یک مشت (۳۰ گرم)', 30, [150, 8, 24, 3, 6], [['نخودچی', 30, 'g', 'pantry']], { cost: 1, prep: 0, t: ['quick', 'traditional'] }),
  f('makhloot_ajil', 'آجیل مخلوط', 'snack', 's', 'یک مشت کوچک (۳۰ گرم)', 30, [170, 5, 12, 12, 3], [['آجیل مخلوط', 30, 'g', 'pantry']], { a: ['nuts'], cost: 2, prep: 0, t: ['quick'] }),
  f('mast_kamcharb', 'ماست کم‌چرب', 'dairy', 'sb', '۱ کاسه کوچک (۱۵۰ گرم)', 150, [90, 9, 12, 0, 0], [['ماست کم‌چرب', 150, 'g', 'dairy']], { a: ['dairy'], cost: 1, prep: 0, t: ['quick'] }),
  f('popcorn', 'ذرت بوداده', 'snack', 's', '۳ پیمانه', 25, [110, 3, 22, 1, 4], [['ذرت بوداده', 25, 'g', 'pantry']], { cost: 1, prep: 5, t: ['quick'] }),
  f('tokhm_morgh_abpaz_yek', 'تخم‌مرغ آب‌پز', 'protein', 'sb', '۱ عدد', 50, [80, 6, 1, 5, 0], [['تخم‌مرغ', 1, 'piece', 'protein']], { a: ['egg'], cost: 1, prep: 10, t: ['quick'] }),
  f('mast_miveh', 'ماست و میوه', 'dairy', 'sb', '۱ کاسه کوچک ماست + نصف سیب', 230, [160, 7, 28, 2, 2],
    [['ماست کم‌چرب', 120, 'g', 'dairy'], ['سیب', 1, 'piece', 'produce']], { a: ['dairy'], cost: 1, prep: 3, t: ['quick'] }),
  f('hoomos_nan', 'حمص با نان', 'snack', 's', '۳ قاشق حمص + نصف نان', 90, [210, 8, 26, 8, 6],
    [['نخود', 40, 'g', 'grains'], ['ارده', 1, 'tbsp', 'pantry'], ['نان لواش', 1, 'piece', 'grains']], { a: ['gluten', 'sesame'], cost: 1, prep: 10, t: ['quick'] }),
  // ---------------------------------------------------------------- drinks
  f('doogh', 'دوغ', 'drink', 'ls', '۱ لیوان', 250, [60, 3, 5, 3, 0], [['دوغ', 250, 'ml', 'dairy']], { a: ['dairy'], cost: 1, prep: 0, t: ['traditional', 'quick'] }),
  f('chai', 'چای (بدون شکر)', 'drink', 'bs', '۱ استکان', 120, [5, 0, 1, 0, 0], [['چای', 2, 'g', 'pantry']], { cost: 1, prep: 5, t: ['traditional', 'quick'] }),
  f('chai_nabat', 'چای با نبات', 'drink', 'bs', '۱ استکان با ۱ قند', 120, [30, 0, 8, 0, 0], [['چای', 2, 'g', 'pantry'], ['نبات', 7, 'g', 'pantry']], { cost: 1, prep: 5, t: ['traditional', 'sweet'] }),
  f('chai_sabz', 'چای سبز', 'drink', 'bs', '۱ فنجان', 200, [2, 0, 0, 0, 0], [['چای سبز', 2, 'g', 'pantry']], { cost: 1, prep: 5, t: ['quick'] }),
  f('sekanjabin', 'سکنجبین', 'drink', 's', '۱ لیوان', 250, [60, 0, 15, 0, 0], [['سرکه', 1, 'tbsp', 'pantry'], ['عسل', 1, 'tbsp', 'pantry']], { cost: 1, prep: 5, t: ['traditional', 'honey', 'fasting_friendly'] }),
  f('shir_kamcharb', 'شیر کم‌چرب', 'drink', 'bs', '۱ لیوان', 250, [100, 8, 12, 2, 0], [['شیر کم‌چرب', 250, 'ml', 'dairy']], { a: ['dairy'], cost: 1, prep: 0, t: ['quick', 'lactation_friendly'] }),
  f('ab_havij', 'آب‌هویج تازه', 'drink', 's', '۱ لیوان', 250, [90, 2, 20, 0, 1], [['هویج', 300, 'g', 'produce']], { cost: 1, prep: 10 }),
  // --------------------------------------------------------------- desserts
  f('sholeh_zard_small', 'شله‌زرد', 'dessert', 's', '۱ کاسه کوچک (۱۰۰ گرم)', 100, [220, 3, 48, 3, 1], [['برنج ایرانی', 15, 'g', 'grains'], ['شکر', 2, 'tbsp', 'pantry'], ['زعفران', 1, 'tsp', 'pantry']], { cost: 1, prep: 60, t: ['traditional', 'sweet'] }),
  f('faloodeh_small', 'فالوده', 'dessert', 's', '۱ کاسه کوچک', 120, [180, 1, 42, 0, 0], [['فالوده', 120, 'g', 'other']], { cost: 2, prep: 0, t: ['traditional', 'sweet'], s: ['summer'] }),
  f('bastani_sonnati', 'بستنی سنتی', 'dessert', 's', '۱ اسکوپ', 70, [150, 3, 20, 7, 0], [['بستنی سنتی', 70, 'g', 'dairy']], { a: ['dairy', 'egg', 'nuts'], cost: 2, prep: 0, t: ['traditional', 'sweet'] }),
  f('ranginak_small', 'رنگینک', 'dessert', 's', '۱ برش کوچک', 70, [260, 3, 40, 11, 3], [['خرما', 6, 'piece', 'produce'], ['گردو', 3, 'piece', 'pantry'], ['آرد', 20, 'g', 'grains']], { a: ['nuts', 'gluten'], cost: 2, prep: 30, t: ['traditional', 'sweet'], r: ['south'] }),
];
