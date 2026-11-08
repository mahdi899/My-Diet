import { ApiError } from '../common/errors.js';

const goal = {
  weight_loss: 'کاهش وزن',
  weight_gain: 'افزایش وزن',
  weight_maintenance: 'تثبیت وزن',
  healthy_eating: 'تغذیهٔ سالم',
  sports_nutrition: 'تغذیهٔ ورزشی',
  medical_condition: 'رژیم برای شرایط پزشکی',
};
const goalAliases: Record<string, string> = {
  'تغذیهٔ متعادل': 'healthy_eating',
  'بهبود عادت غذایی': 'healthy_eating',
};
const sex = { female: 'زن', male: 'مرد', unspecified: 'ترجیح می‌دهم نگویم' };
const lifeStage = {
  none: 'هیچ‌کدام',
  trying_to_conceive: 'در حال اقدام به بارداری',
  pregnant: 'باردار هستم',
  breastfeeding: 'شیرده هستم',
  not_applicable: 'ارتباطی ندارد',
};
const babies = { singleton: 'تک‌قلو', multiple: 'دوقلو یا بیشتر', unknown: 'هنوز مشخص نیست' };
const nursingAge = {
  under_6m: 'کمتر از ۶ ماه',
  '6_to_12m': '۶ تا ۱۲ ماه',
  over_12m: 'بیشتر از ۱۲ ماه',
};
const previousDiet = {
  none: 'نداشته‌ام',
  kept: 'نتیجه گرفتم و حفظ کردم',
  regained: 'وزن دوباره برگشته',
  hard: 'ادامه‌دادن برایم سخت بود',
};
const health = {
  none: 'موردی ندارم',
  diabetes: 'دیابت',
  hypertension: 'فشار خون',
  thyroid: 'اختلال تیروئید',
  kidney: 'بیماری کلیه',
  liver: 'بیماری کبد',
  digestive: 'مشکل گوارشی',
  eating_disorder: 'سابقهٔ اختلال خوردن',
  food_allergy: 'حساسیت غذایی دارم',
  medication: 'دارو مصرف می‌کنم',
  other: 'شرایط دیگر',
  gestational_diabetes: 'دیابت بارداری تشخیص‌داده‌شده',
  high_risk_pregnancy: 'بارداری پرخطر با نظر پزشک',
};
const activity = {
  sedentary: 'بیشتر نشسته',
  light: 'فعالیت سبک',
  moderate: 'فعالیت متوسط',
  high: 'فعالیت زیاد',
};
const exercise = {
  none: 'ورزش نمی‌کنم',
  '1_2': '۱ تا ۲ جلسه',
  '3_4': '۳ تا ۴ جلسه',
  '5_plus': '۵ جلسه یا بیشتر',
};
const sleep = {
  under_5: 'کمتر از ۵ ساعت',
  '5_to_7': '۵ تا ۷ ساعت',
  '7_to_9': '۷ تا ۹ ساعت',
  over_9: 'بیشتر از ۹ ساعت',
};
const mealPattern = {
  regular: 'سه وعدهٔ منظم',
  skipped: 'بیشتر وعده‌ها را حذف می‌کنم',
  grazing: 'ریزه‌خواری دارم',
  night: 'غذاخوردن شبانه',
  shift: 'به‌دلیل شیفت کاری نامنظم است',
};
const water = {
  under_4: 'کمتر از ۴ لیوان',
  '4_to_6': '۴ تا ۶ لیوان',
  '7_to_9': '۷ تا ۹ لیوان',
  '10_plus': '۱۰ لیوان یا بیشتر',
};
const preference = { iranian: 'غذای ایرانی', mixed: 'ترکیبی', vegetarian: 'گیاه‌خواری', vegan: 'وگان' };
const budget = { low: 'اقتصادی', medium: 'متوسط', open: 'آزاد' };
const cooking = {
  under_30: 'کمتر از ۳۰ دقیقه',
  '30_to_60': '۳۰ تا ۶۰ دقیقه',
  flexible: 'محدودیت ندارم',
};

export const AI_SKIP_FLAGS = ['eating_disorder_history', 'high_risk_pregnancy', 'kidney'] as const;

export interface StoredAnswers {
  name: string;
  age: number;
  sex: string;
  heightCm: number;
  weightKg: number;
  goal: string;
  lifeStage: string;
  pregnancyWeek: number | null;
  prePregnancyWeightKg: number | null;
  babies: string | null;
  nursingAge: string | null;
  targetWeightKg: number | null;
  previousDiet: string;
  health: string[];
  healthDetails: string;
  allergies: string;
  medicines: string;
  activity: string;
  exercise: string;
  sleep: string;
  mealPattern: string;
  water: string;
  preference: string;
  budget: string;
  cooking: string;
  dislikes: string;
}

const questions: Array<{
  id: string;
  title: string;
  kind: 'text' | 'number' | 'single' | 'multiple';
  options?: Record<string, string>;
}> = [
  { id: 'name', title: 'نام و نام خانوادگی', kind: 'text' },
  { id: 'age', title: 'سن / سال', kind: 'number' },
  { id: 'sex', title: 'جنسیت زیستی', kind: 'single', options: sex },
  { id: 'heightCm', title: 'قد / سانتی‌متر', kind: 'number' },
  { id: 'weightKg', title: 'وزن / کیلوگرم', kind: 'number' },
  { id: 'goal', title: 'هدف اصلی تغذیه', kind: 'single', options: goal },
  { id: 'lifeStage', title: 'وضعیت بارداری یا شیردهی', kind: 'single', options: lifeStage },
  { id: 'pregnancyWeek', title: 'هفتهٔ بارداری', kind: 'number' },
  { id: 'prePregnancyWeightKg', title: 'وزن پیش از بارداری / کیلوگرم', kind: 'number' },
  { id: 'babies', title: 'تعداد جنین', kind: 'single', options: babies },
  { id: 'nursingAge', title: 'سن کودک', kind: 'single', options: nursingAge },
  { id: 'targetWeightKg', title: 'وزن هدف / کیلوگرم', kind: 'number' },
  { id: 'previousDiet', title: 'تجربهٔ قبلی رژیم', kind: 'single', options: previousDiet },
  { id: 'health', title: 'بیماری یا شرایط تشخیص‌داده‌شده', kind: 'multiple', options: health },
  { id: 'healthDetails', title: 'توضیح شرایط و محدودیت‌های پزشک', kind: 'text' },
  { id: 'allergies', title: 'نام مادهٔ حساسیت‌زا و نوع واکنش', kind: 'text' },
  { id: 'medicines', title: 'نام داروها و مکمل‌ها و مقدار مصرف', kind: 'text' },
  { id: 'activity', title: 'میزان فعالیت روزانه', kind: 'single', options: activity },
  { id: 'exercise', title: 'تعداد جلسهٔ ورزش در هفته', kind: 'single', options: exercise },
  { id: 'sleep', title: 'خواب معمول شبانه', kind: 'single', options: sleep },
  { id: 'mealPattern', title: 'الگوی معمول غذاخوردن', kind: 'single', options: mealPattern },
  { id: 'water', title: 'آب معمول در روز', kind: 'single', options: water },
  { id: 'preference', title: 'الگوی غذای مورد علاقه', kind: 'single', options: preference },
  { id: 'budget', title: 'بودجهٔ تهیهٔ غذا', kind: 'single', options: budget },
  { id: 'cooking', title: 'زمان معمول آشپزی', kind: 'single', options: cooking },
  { id: 'dislikes', title: 'غذاهای نامطلوب (اختیاری)', kind: 'text' },
];

export function questionnaireView() {
  return {
    version: 1,
    questions: questions.map((question) => ({
      id: question.id,
      title: question.title,
      kind: question.kind,
      options: question.options
        ? Object.entries(question.options).map(([code, label]) => ({ code, label }))
        : [],
    })),
  };
}

function record(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new ApiError(400, 'validation', 'پرسشنامه کامل نیست');
  }
  return input as Record<string, unknown>;
}

function pick(input: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (input[key] != null && input[key] !== '') return input[key];
  }
  return undefined;
}

function asChoice(
  options: Record<string, string>,
  value: unknown,
  message: string,
  aliases: Record<string, string> = {},
): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ApiError(400, 'validation', message);
  }
  const raw = value.trim();
  if (raw in options) return raw;
  if (raw in aliases) return aliases[raw]!;
  const code = Object.entries(options).find(([, label]) => label === raw)?.[0];
  if (!code) throw new ApiError(400, 'validation', message);
  return code;
}

function integer(value: unknown, message: string, min: number, max: number): number {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new ApiError(400, 'validation', message);
  }
  return parsed;
}

function decimal(value: unknown, message: string, min: number, max: number): number {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new ApiError(400, 'validation', message);
  }
  return Math.round(parsed * 10) / 10;
}

function text(value: unknown, max: number): string {
  if (value == null) return '';
  if (typeof value !== 'string') throw new ApiError(400, 'validation', 'پرسشنامه کامل نیست');
  const trimmed = value.trim();
  if (trimmed.length > max) throw new ApiError(400, 'validation', 'یکی از پاسخ‌ها بیش از حد طولانی است');
  return trimmed;
}

export function validateSubmission(input: unknown): {
  answers: StoredAnswers;
  riskFlags: string[];
  bmi: number;
} {
  const source = record(input);
  const name = text(pick(source, ['name']), 80);
  if (name.length < 2) throw new ApiError(400, 'validation', 'نام را کامل بنویس');
  const age = integer(pick(source, ['age']), 'سن باید بین ۱۸ و ۱۰۰ سال باشد', 18, 100);
  const sexCode = asChoice(sex, pick(source, ['sex']), 'جنسیت را انتخاب کن');
  const heightCm = integer(pick(source, ['heightCm', 'height']), 'قد باید بین ۱۰۰ و ۲۵۰ سانتی‌متر باشد', 100, 250);
  const weightKg = decimal(pick(source, ['weightKg', 'weight']), 'وزن باید بین ۲۵ و ۳۰۰ کیلوگرم باشد', 25, 300);
  const goalCode = asChoice(goal, pick(source, ['goal']), 'هدف را انتخاب کن', goalAliases);
  const stage = asChoice(lifeStage, pick(source, ['lifeStage']), 'وضعیت بارداری یا شیردهی را انتخاب کن');
  const pregnant = stage === 'pregnant';
  const breastfeeding = stage === 'breastfeeding';

  const pregnancyWeek = pregnant
    ? integer(pick(source, ['pregnancyWeek']), 'هفتهٔ بارداری باید عددی بین ۱ و ۴۲ باشد', 1, 42)
    : null;
  const prePregnancyWeightKg = pregnant || breastfeeding
    ? decimal(
        pick(source, ['prePregnancyWeightKg', 'prePregnancyWeight']),
        'وزن پیش از بارداری باید بین ۲۵ و ۳۰۰ کیلوگرم باشد',
        25,
        300,
      )
    : null;
  const babyCount = pregnant
    ? asChoice(babies, pick(source, ['babies']), 'تعداد جنین را انتخاب کن')
    : null;
  const nursing = breastfeeding
    ? asChoice(nursingAge, pick(source, ['nursingAge']), 'سن کودک را انتخاب کن')
    : null;

  let targetWeightKg: number | null = null;
  const rawTarget = pick(source, ['targetWeightKg', 'targetWeight']);
  if (!pregnant && (goalCode === 'weight_loss' || goalCode === 'weight_gain')) {
    targetWeightKg = decimal(rawTarget, 'وزن هدف باید بین ۲۵ و ۳۰۰ کیلوگرم باشد', 25, 300);
    if (goalCode === 'weight_loss' && targetWeightKg >= weightKg) {
      throw new ApiError(400, 'validation', 'وزن هدف باید کمتر از وزن فعلی باشد');
    }
    if (goalCode === 'weight_gain' && targetWeightKg <= weightKg) {
      throw new ApiError(400, 'validation', 'وزن هدف باید بیشتر از وزن فعلی باشد');
    }
  } else if (rawTarget != null && rawTarget !== '') {
    targetWeightKg = decimal(rawTarget, 'وزن هدف باید بین ۲۵ و ۳۰۰ کیلوگرم باشد', 25, 300);
  }

  const healthValue = pick(source, ['health']);
  const healthList = Array.isArray(healthValue) ? healthValue : healthValue == null ? [] : [healthValue];
  if (healthList.length === 0) {
    throw new ApiError(400, 'validation', 'حداقل یک مورد سلامت را انتخاب کن');
  }
  const healthCodes = [...new Set(healthList.map((item) => asChoice(health, item, 'گزینهٔ سلامت شناخته نشد')))];
  const healthDetails = text(pick(source, ['healthDetails']), 1000);
  const allergies = text(pick(source, ['allergies']), 500);
  const medicines = text(pick(source, ['medicines']), 500);
  if (healthCodes.some((code) => code !== 'none') && !healthDetails) {
    throw new ApiError(400, 'validation', 'شرایط پزشکی را توضیح بده');
  }
  if (healthCodes.includes('food_allergy') && !allergies) {
    throw new ApiError(400, 'validation', 'مادهٔ حساسیت‌زا را بنویس');
  }
  if (healthCodes.includes('medication') && !medicines) {
    throw new ApiError(400, 'validation', 'داروها را بنویس');
  }

  const answers: StoredAnswers = {
    name,
    age,
    sex: sexCode,
    heightCm,
    weightKg,
    goal: goalCode,
    lifeStage: stage,
    pregnancyWeek,
    prePregnancyWeightKg,
    babies: babyCount,
    nursingAge: nursing,
    targetWeightKg,
    previousDiet: asChoice(previousDiet, pick(source, ['previousDiet']), 'تجربهٔ رژیم را انتخاب کن'),
    health: healthCodes,
    healthDetails,
    allergies,
    medicines,
    activity: asChoice(activity, pick(source, ['activity']), 'میزان فعالیت را انتخاب کن'),
    exercise: asChoice(exercise, pick(source, ['exercise']), 'تعداد ورزش را انتخاب کن'),
    sleep: asChoice(sleep, pick(source, ['sleep']), 'خواب را انتخاب کن'),
    mealPattern: asChoice(mealPattern, pick(source, ['mealPattern']), 'الگوی غذا را انتخاب کن'),
    water: pick(source, ['water']) == null ? '' : asChoice(water, pick(source, ['water']), 'مقدار آب را انتخاب کن'),
    preference: asChoice(preference, pick(source, ['preference']), 'سلیقهٔ غذا را انتخاب کن'),
    budget: asChoice(budget, pick(source, ['budget']), 'بودجه را انتخاب کن'),
    cooking: asChoice(cooking, pick(source, ['cooking']), 'زمان آشپزی را انتخاب کن'),
    dislikes: text(pick(source, ['dislikes']), 500),
  };

  const riskFlags: string[] = [];
  if (pregnant) riskFlags.push('pregnant');
  if (healthCodes.includes('eating_disorder')) riskFlags.push('eating_disorder_history');
  if (healthCodes.includes('high_risk_pregnancy')) riskFlags.push('high_risk_pregnancy');
  if (healthCodes.includes('kidney')) riskFlags.push('kidney');
  const bmi = Math.round((weightKg / (heightCm / 100) ** 2) * 10) / 10;
  return { answers, riskFlags, bmi };
}
