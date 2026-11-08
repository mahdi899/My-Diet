/**
 * Canonical onboarding specification (version 2).
 *
 * One source of truth for the web demo, the Flutter app and the admin panel.
 * Every question has a stable `key` and every choice a stable `code`.
 * `demoTitles` / option labels match the legacy demo wording so old demo
 * leads (stored as question/answer text) can still be mapped.
 */
export const ONBOARDING_SPEC_VERSION = 2;

export type TrackId = 'weight_loss' | 'weight_gain' | 'pregnancy' | 'detox';
export type GroupId = 'basics' | 'body' | 'lifestyle' | 'food' | 'goal' | 'health' | 'culture';
export type QuestionKind =
  | 'text'
  | 'number'
  | 'single'
  | 'multi'
  | 'age'
  | 'sleep_wake'
  | 'dish_picker';

export interface SpecOption {
  code: string;
  label: string;
  image?: string;
  description?: string;
  /** Choosing this option clears the others (e.g. "none"). */
  exclusive?: boolean;
}

export interface SpecQuestion {
  key: string;
  group: GroupId;
  kind: QuestionKind;
  title: string;
  subtitle?: string;
  placeholder?: string;
  options?: SpecOption[];
  min?: number;
  max?: number;
  step?: number;
  default?: number;
  unit?: string;
  /** Present only for these tracks. Missing = every track. */
  tracks?: TrackId[];
  required: boolean;
  /** Tracks whose web demo already asks this question. Missing = the app asks it alone. */
  demo?: TrackId[] | 'all';
  showIf?: { key: string; notIn?: string[]; in?: string[] };
  /** Free text asked when one of `whenCodes` is chosen. */
  followUp?: { whenCodes: string[]; key: string; placeholder: string; required: boolean };
  /** Legacy demo wording used to map old leads without keys. */
  demoTitles?: string[];
}

export interface SpecTrack {
  id: TrackId;
  title: string;
  badge: string;
  image: string;
  description: string;
  kcalHint: string;
}

export interface SpecInsight {
  afterKey: string;
  title: string;
  body: string;
  icon: string;
}

const o = (code: string, label: string, extra: Partial<SpecOption> = {}): SpecOption => ({
  code,
  label,
  ...extra,
});

const AGE_OPTIONS = [
  o('18_30', '۱۸ تا ۳۰ سال', { image: 'age-18-30' }),
  o('30_40', '۳۰ تا ۴۰ سال', { image: 'age-30-40' }),
  o('40_50', '۴۰ تا ۵۰ سال', { image: 'age-40-50' }),
  o('50_plus', 'بالای ۵۰ سال', { image: 'age-50-plus' }),
];

export const SPEC_TRACKS: SpecTrack[] = [
  {
    id: 'weight_loss',
    title: 'لاغری',
    badge: 'کاهش وزن',
    image: 'goal-loss',
    description: 'برنامه غذایی متناسب با هدف کاهش وزن و شرایط تو',
    kcalHint: '۱,۴۵۰ کیلوکالری در روز',
  },
  {
    id: 'weight_gain',
    title: 'افزایش وزن',
    badge: 'افزایش سالم',
    image: 'goal-gain',
    description: 'رسیدن به وزن سالم با تغذیه متعادل',
    kcalHint: '۲,۶۵۰ کیلوکالری در روز',
  },
  {
    id: 'pregnancy',
    title: 'بارداری و شیردهی',
    badge: 'ایمن و تخصصی',
    image: 'goal-maternal',
    description: 'تغذیه دوران بارداری و شیردهی با توجه به وضعیت پزشکی',
    kcalHint: '۲,۲۵۰ کیلوکالری در روز',
  },
  {
    id: 'detox',
    title: 'سلامت و پاکسازی بدن',
    badge: 'تعادل و انرژی',
    image: 'goal-wellness',
    description: 'بهبود کیفیت تغذیه، گوارش و انرژی روزانه',
    kcalHint: '۱,۷۵۰ کیلوکالری در روز',
  },
];

const LOSS: TrackId[] = ['weight_loss'];
const GAIN: TrackId[] = ['weight_gain'];
const PREG: TrackId[] = ['pregnancy'];
const DETOX: TrackId[] = ['detox'];

/** Dish slugs must exist in the food catalog seed. */
export const DISH_PICKER: Array<[string, string]> = [
  ['ghormeh_sabzi', 'قورمه‌سبزی'],
  ['gheymeh', 'قیمه'],
  ['fesenjan', 'فسنجان'],
  ['ash_reshteh', 'آش رشته'],
  ['adas_polo', 'عدس‌پلو'],
  ['kabab_koobideh', 'کباب کوبیده'],
  ['joojeh_kabab', 'جوجه‌کباب'],
  ['zereshk_polo_morgh', 'زرشک‌پلو با مرغ'],
  ['mirza_ghasemi', 'میرزاقاسمی'],
  ['kashk_bademjan', 'کشک بادمجان'],
  ['dizi', 'دیزی'],
  ['kuku_sabzi', 'کوکو سبزی'],
  ['baghali_polo', 'باقالی‌پلو'],
  ['sabzi_polo_mahi', 'سبزی‌پلو با ماهی'],
  ['halim', 'حلیم'],
  ['omelet_gojeh', 'املت گوجه'],
  ['ash_jo', 'آش جو'],
  ['salad_shirazi', 'سالاد شیرازی'],
];

export const SPEC_QUESTIONS: SpecQuestion[] = [

  // ---------------------------------------------------------------- basics
  {
    key: 'name',
    group: 'basics',
    kind: 'text',
    title: 'اسم شما چیست؟',
    subtitle: 'نام و نام خانوادگی',
    placeholder: 'نام و نام خانوادگی',
    required: true,
    demo: 'all',
    demoTitles: ['اسم شما چیست؟'],
  },
  {
    key: 'age',
    group: 'basics',
    kind: 'age',
    title: 'چند سال داری؟',
    subtitle: 'برای محاسبهٔ دقیق نیاز انرژی',
    min: 18,
    max: 100,
    default: 30,
    unit: 'سال',
    options: AGE_OPTIONS,
    required: true,
    demo: 'all',
    demoTitles: ['چند سال داری؟'],
  },
  {
    key: 'sex',
    group: 'basics',
    kind: 'single',
    title: 'جنسیتت چیه؟',
    subtitle: 'یک گزینه را انتخاب کن',
    options: [o('female', 'زن'), o('male', 'مرد')],
    required: true,
    demo: 'all',
    demoTitles: ['جنسیتت چیه؟'],
  },
  // ------------------------------------------------------------------ body
  {
    key: 'height_cm',
    group: 'body',
    kind: 'number',
    title: 'قدت چقدره؟',
    subtitle: 'سانتی‌متر',
    min: 120,
    max: 230,
    step: 1,
    default: 165,
    unit: 'سانتی‌متر',
    required: true,
    demo: 'all',
    demoTitles: ['قدت چقدره؟'],
  },
  {
    key: 'weight_kg',
    group: 'body',
    kind: 'number',
    title: 'وزن فعلیت چقدره؟',
    subtitle: 'کیلوگرم',
    min: 35,
    max: 240,
    step: 0.5,
    default: 68,
    unit: 'کیلوگرم',
    required: true,
    demo: 'all',
    demoTitles: ['وزن فعلیت چقدره؟'],
  },
  // ----------------------------------------------------------- lifestyle
  {
    key: 'activity',
    group: 'lifestyle',
    kind: 'single',
    title: 'میزان فعالیت روزانه‌ات چقدره؟',
    options: [
      o('very_low', 'خیلی کم'),
      o('low', 'کم'),
      o('medium', 'متوسط'),
      o('high', 'زیاد'),
      o('very_high', 'خیلی زیاد'),
    ],
    required: true,
    demo: 'all',
    demoTitles: ['میزان فعالیت روزانه‌ات چقدره؟'],
  },
  // ------------------------------------------------------------------ food
  {
    key: 'meals_per_day',
    group: 'food',
    kind: 'single',
    title: 'معمولاً چند وعده در روز غذا می‌خوری؟',
    options: [o('1', '۱ وعده'), o('2', '۲ وعده'), o('3', '۳ وعده'), o('4_plus', 'بیشتر')],
    required: true,
    demo: 'all',
    demoTitles: ['معمولاً چند وعده در روز غذا می‌خوری؟'],
  },
  {
    key: 'allergies',
    group: 'food',
    kind: 'multi',
    title: 'به چه غذاهایی حساسیت داری؟',
    options: [
      o('none', 'بدون حساسیت', { exclusive: true }),
      o('dairy', 'لبنیات'),
      o('nuts', 'آجیل'),
      o('egg', 'تخم‌مرغ'),
      o('gluten', 'گلوتن'),
      o('other', 'سایر'),
    ],
    followUp: { whenCodes: ['other'], key: 'allergies_text', placeholder: 'نوع حساسیت را بنویسید', required: true },
    required: true,
    demo: 'all',
    demoTitles: ['به چه غذاهایی حساسیت داری؟'],
  },
  {
    key: 'diet_style',
    group: 'food',
    kind: 'single',
    title: 'سبک تغذیه‌ات چیه؟',
    options: [
      o('omnivore', 'همه‌چیزخواری', { image: 'diet-normal', description: 'غذاهای گیاهی و حیوانی' }),
      o('vegetarian', 'گیاه‌خواری با لبنیات یا تخم‌مرغ', {
        image: 'diet-vegetarian',
        description: 'بدون گوشت، مرغ و ماهی',
      }),
      o('vegan', 'وگان (کاملاً گیاهی)', {
        image: 'diet-vegan',
        description: 'بدون گوشت، لبنیات، تخم‌مرغ و سایر محصولات حیوانی',
      }),
    ],
    required: true,
    demo: 'all',
    demoTitles: ['سبک تغذیه‌ات چیه؟'],
  },
  // ---------------------------------------------------------------- health
  {
    key: 'conditions',
    group: 'health',
    kind: 'multi',
    title: 'بیماری خاص یا شرایط پزشکی داری؟',
    options: [
      o('none', 'خیر', { exclusive: true }),
      o('diabetes', 'دیابت'),
      o('hypertension', 'فشار خون'),
      o('kidney', 'بیماری کلیوی'),
      o('thyroid', 'تیروئید'),
      o('digestive', 'مشکلات گوارشی'),
      o('other', 'سایر'),
    ],
    followUp: { whenCodes: ['other'], key: 'conditions_text', placeholder: 'نوع بیماری را بنویسید', required: true },
    required: true,
    demo: 'all',
    demoTitles: ['بیماری خاص یا شرایط پزشکی داری؟'],
  },
  {
    key: 'medications',
    group: 'health',
    kind: 'single',
    title: 'دارو یا مکمل خاصی مصرف می‌کنی؟',
    subtitle: 'در صورت «بله» نام را در کادر بنویس',
    options: [o('no', 'خیر'), o('yes', 'بله')],
    followUp: { whenCodes: ['yes'], key: 'medications_text', placeholder: 'نام دارو یا مکمل', required: true },
    required: true,
    demo: 'all',
    demoTitles: ['دارو یا مکمل خاصی مصرف می‌کنی؟'],
  },
  {
    key: 'dislikes',
    group: 'food',
    kind: 'text',
    title: 'چه غذاهایی را دوست نداری یا نمی‌خوری؟',
    subtitle: 'اختیاری',
    placeholder: 'مثلاً بادمجان، ماهی…',
    required: false,
    demo: 'all',
    demoTitles: ['چه غذاهایی را دوست نداری یا نمی‌خوری؟'],
  },
  {
    key: 'sleep_wake',
    group: 'lifestyle',
    kind: 'sleep_wake',
    title: 'معمولاً چه ساعت‌هایی می‌خوابی و بیدار می‌شی؟',
    subtitle: 'ساعت خواب و بیداری عادی‌ات',
    required: true,
    demo: 'all',
    demoTitles: ['معمولاً چه ساعت‌هایی می‌خوابی و بیدار می‌شی؟'],
  },
  {
    key: 'prep_time',
    group: 'food',
    kind: 'single',
    title: 'چقدر برای آماده‌کردن غذا وقت داری؟',
    options: [o('lt15', 'کمتر از ۱۵ دقیقه'), o('15_30', '۱۵ تا ۳۰ دقیقه'), o('more', 'بیشتر')],
    required: true,
    demo: 'all',
    demoTitles: ['چقدر برای آماده‌کردن غذا وقت داری؟'],
  },
  {
    key: 'budget',
    group: 'food',
    kind: 'single',
    title: 'بودجه غذایی موردنظرت چقدره؟',
    options: [o('low', 'اقتصادی'), o('medium', 'متوسط'), o('open', 'بدون محدودیت')],
    required: true,
    demo: 'all',
    demoTitles: ['بودجه غذایی موردنظرت چقدره؟'],
  },
  {
    key: 'job_activity',
    group: 'lifestyle',
    kind: 'single',
    title: 'شغل یا فعالیت روزانه‌ات بیشتر چه شکلیه؟',
    options: [
      o('sitting', 'نشسته', { image: 'activity-sedentary' }),
      o('mixed', 'ترکیبی', { image: 'activity-mixed' }),
      o('standing', 'سرپا', { image: 'activity-standing' }),
      o('heavy', 'کار فیزیکی سنگین', { image: 'activity-heavy' }),
    ],
    required: true,
    demo: 'all',
    demoTitles: ['شغل یا فعالیت روزانه‌ات بیشتر چه شکلیه؟'],
  },
  {
    key: 'exercise_days',
    group: 'lifestyle',
    kind: 'single',
    title: 'هفته‌ای چند روز ورزش می‌کنی؟',
    options: [
      o('0', 'ورزش نمی‌کنم'),
      o('1', '۱ روز'),
      o('2', '۲ روز'),
      o('3', '۳ روز'),
      o('4', '۴ روز'),
      o('5', '۵ روز'),
      o('6', '۶ روز'),
      o('7', '۷ روز'),
    ],
    required: true,
    demo: 'all',
    demoTitles: ['هفته‌ای چند روز ورزش می‌کنی؟'],
  },
  {
    key: 'exercise_duration',
    group: 'lifestyle',
    kind: 'single',
    title: 'هر جلسه تقریباً چقدر ورزش می‌کنی؟',
    options: [o('lt30', 'کمتر از ۳۰ دقیقه'), o('30_60', '۳۰ تا ۶۰ دقیقه'), o('gt60', 'بیشتر')],
    required: true,
    demo: 'all',
    showIf: { key: 'exercise_days', notIn: ['0'] },
    demoTitles: ['هر جلسه تقریباً چقدر ورزش می‌کنی؟'],
  },
  {
    key: 'sport_type',
    group: 'lifestyle',
    kind: 'single',
    title: 'چه نوع ورزشی انجام می‌دی؟',
    options: [
      o('strength', 'قدرتی', { image: 'sport-strength' }),
      o('cardio', 'هوازی', { image: 'sport-cardio' }),
      o('combined', 'ترکیبی', { image: 'sport-combined' }),
      o('other', 'سایر', { image: 'sport-other' }),
    ],
    required: true,
    demo: 'all',
    showIf: { key: 'exercise_days', notIn: ['0'] },
    demoTitles: ['چه نوع ورزشی انجام می‌دی؟'],
  },
  // ----------------------------------------------------------- track: loss
  {
    key: 'target_weight_kg',
    group: 'goal',
    kind: 'number',
    title: 'دوست داری به چه وزنی برسی؟',
    subtitle: 'کیلوگرم',
    min: 35,
    max: 240,
    step: 0.5,
    unit: 'کیلوگرم',
    tracks: [...LOSS, ...GAIN],
    required: true,
    demo: [...LOSS, ...GAIN],
    demoTitles: ['دوست داری به چه وزنی برسی؟', 'دوست داری وزنت به چند کیلوگرم برسه؟'],
  },
  {
    key: 'loss_pace',
    group: 'goal',
    kind: 'single',
    title: 'ترجیح می‌دی با چه سرعتی وزن کم کنی؟',
    subtitle: 'سرعت ایمن را سیستم بر اساس شرایط تو پیشنهاد می‌دهد',
    options: [
      o('slow', 'آهسته و تدریجی'),
      o('balanced', 'متعادل و پایدار'),
      o('fast', 'می‌خوام زودتر به نتیجه برسم'),
      o('auto', 'نمی‌دونم، خود برنامه پیشنهاد بده'),
    ],
    tracks: LOSS,
    required: true,
    demo: LOSS,
    demoTitles: ['ترجیح می‌دی با چه سرعتی وزن کم کنی؟'],
  },
  // ----------------------------------------------------------- loss details
  {
    key: 'loss_challenges',
    group: 'goal',
    kind: 'multi',
    title: 'بزرگ‌ترین چالشت برای کاهش وزن چیه؟',
    options: [
      o('snacking', 'ریزه‌خواری در طول روز'),
      o('sweets', 'علاقه زیاد به شیرینی و تنقلات'),
      o('overeating', 'پرخوری در وعده‌های اصلی'),
      o('stress_eating', 'غذا خوردن هنگام استرس'),
      o('low_activity', 'کمبود فعالیت بدنی'),
      o('irregular_meals', 'نامنظم بودن وعده‌های غذایی'),
    ],
    tracks: LOSS,
    required: true,
    demo: LOSS,
    demoTitles: ['بزرگ‌ترین چالشت برای کاهش وزن چیه؟'],
  },
  {
    key: 'hunger_time',
    group: 'goal',
    kind: 'single',
    title: 'معمولاً چه زمانی بیشتر احساس گرسنگی می‌کنی؟',
    options: [
      o('morning', 'صبح'),
      o('noon', 'ظهر'),
      o('afternoon', 'عصر'),
      o('night', 'شب'),
      o('all_day', 'در تمام طول روز'),
    ],
    tracks: LOSS,
    required: true,
    demo: LOSS,
    demoTitles: ['معمولاً چه زمانی بیشتر احساس گرسنگی می‌کنی؟'],
  },
  {
    key: 'fast_food_freq',
    group: 'goal',
    kind: 'single',
    title: 'چقدر از غذاهای بیرون یا فست‌فود استفاده می‌کنی؟',
    options: [
      o('rare', 'به‌ندرت'),
      o('1_2', '۱ تا ۲ بار در هفته'),
      o('3_4', '۳ تا ۴ بار در هفته'),
      o('daily', 'تقریباً هر روز'),
    ],
    tracks: LOSS,
    required: true,
    demo: LOSS,
    demoTitles: ['چقدر از غذاهای بیرون یا فست‌فود استفاده می‌کنی؟'],
  },
  {
    key: 'previous_diet',
    group: 'goal',
    kind: 'single',
    title: 'در گذشته برای کاهش وزن رژیم گرفتی؟',
    options: [
      o('first', 'خیر، اولین بارم است'),
      o('kept', 'بله، نتیجه گرفتم'),
      o('regained', 'بله، ولی وزنم برگشت'),
      o('hard', 'بله، ولی نتونستم ادامه بدم'),
    ],
    tracks: LOSS,
    required: true,
    demo: LOSS,
    demoTitles: ['در گذشته برای کاهش وزن رژیم گرفتی؟'],
  },
  {
    key: 'craving_level',
    group: 'goal',
    kind: 'single',
    title: 'معمولاً در طول روز چقدر احساس گرسنگی یا ولع غذایی داری؟',
    options: [o('very_low', 'خیلی کم'), o('medium', 'متوسط'), o('high', 'زیاد'), o('very_high', 'خیلی زیاد')],
    tracks: LOSS,
    required: true,
    demo: LOSS,
    demoTitles: ['معمولاً در طول روز چقدر احساس گرسنگی یا ولع غذایی داری؟'],
  },
  {
    key: 'binge_history',
    group: 'health',
    kind: 'single',
    title: 'آیا سابقه پرخوری همراه با احساس از دست دادن کنترل، یا محدود کردن شدید غذا داری؟',
    subtitle: 'این پاسخ فقط برای ایمنی تو و بررسی دکتر است',
    options: [o('no', 'خیر'), o('yes', 'بله'), o('skip', 'ترجیح می‌دم پاسخ ندم')],
    tracks: LOSS,
    required: true,
    demo: LOSS,
    demoTitles: [
      'آیا سابقه پرخوری همراه با احساس از دست دادن کنترل، یا محدود کردن شدید غذا داری؟',
    ],
  },
  // ----------------------------------------------------------- gain details
  {
    key: 'gain_goal',
    group: 'goal',
    kind: 'single',
    title: 'هدفت از افزایش وزن بیشتر چیه؟',
    options: [
      o('muscle', 'افزایش حجم عضلات'),
      o('healthy_weight', 'رسیدن به وزن سالم'),
      o('fuller', 'پرتر شدن اندام'),
      o('regain', 'جبران کاهش وزن قبلی'),
    ],
    tracks: GAIN,
    required: true,
    demo: GAIN,
    demoTitles: ['هدفت از افزایش وزن بیشتر چیه؟'],
  },
  {
    key: 'appetite',
    group: 'goal',
    kind: 'single',
    title: 'وضعیت اشتهای خودت را چطور توصیف می‌کنی؟',
    options: [o('very_low', 'خیلی کم'), o('low', 'کم'), o('normal', 'معمولی'), o('high', 'زیاد')],
    tracks: GAIN,
    required: true,
    demo: GAIN,
    demoTitles: ['وضعیت اشتهای خودت را چطور توصیف می‌کنی؟'],
  },
  {
    key: 'gain_obstacle',
    group: 'goal',
    kind: 'single',
    title: 'چرا فکر می‌کنی افزایش وزن برات سخته؟',
    options: [
      o('early_full', 'زود احساس سیری می‌کنم'),
      o('forget_meals', 'معمولاً وعده‌های غذایی را فراموش می‌کنم'),
      o('high_activity', 'فعالیت بدنی زیادی دارم'),
      o('no_gain', 'با وجود غذا خوردن وزنم زیاد نمی‌شود'),
      o('unknown', 'نمی‌دونم'),
    ],
    tracks: GAIN,
    required: true,
    demo: GAIN,
    demoTitles: ['چرا فکر می‌کنی افزایش وزن برات سخته؟'],
  },
  {
    key: 'unintended_loss',
    group: 'health',
    kind: 'single',
    title: 'آیا اخیراً بدون اینکه بخواهی وزن کم کردی؟',
    options: [o('no', 'خیر'), o('little', 'بله، کمی'), o('significant', 'بله، به مقدار قابل‌توجه')],
    tracks: GAIN,
    required: true,
    demo: GAIN,
    demoTitles: ['آیا اخیراً بدون اینکه بخواهی وزن کم کردی؟'],
  },
  {
    key: 'gain_sport',
    group: 'goal',
    kind: 'single',
    title: 'فعالیت ورزشی تو بیشتر از چه نوعیه؟',
    options: [
      o('none', 'ورزش نمی‌کنم'),
      o('bodybuilding', 'تمرینات بدنسازی'),
      o('cardio', 'تمرینات هوازی'),
      o('combined', 'ورزش ترکیبی'),
      o('heavy_work', 'فعالیت بدنی سنگین در کار'),
    ],
    tracks: GAIN,
    required: true,
    demo: GAIN,
    demoTitles: ['فعالیت ورزشی تو بیشتر از چه نوعیه؟'],
  },
  {
    key: 'big_meals',
    group: 'goal',
    kind: 'single',
    title: 'خوردن وعده‌های بزرگ برات چقدر راحته؟',
    options: [
      o('easy', 'راحت است'),
      o('small_pref', 'وعده‌های کوچک را ترجیح می‌دهم'),
      o('full_fast', 'خیلی زود سیر می‌شوم'),
    ],
    tracks: GAIN,
    required: true,
    demo: GAIN,
    demoTitles: ['خوردن وعده‌های بزرگ برات چقدر راحته؟'],
  },
  {
    key: 'snack_readiness',
    group: 'goal',
    kind: 'single',
    title: 'برای اضافه کردن میان‌وعده به برنامه روزانه‌ات آمادگی داری؟',
    options: [
      o('two_plus', 'بله، دو یا چند میان‌وعده'),
      o('one', 'بله، یک میان‌وعده'),
      o('more_main', 'ترجیح می‌دهم وعده‌های اصلی بیشتر شود'),
    ],
    tracks: GAIN,
    required: true,
    demo: GAIN,
    demoTitles: ['برای اضافه کردن میان‌وعده به برنامه روزانه‌ات آمادگی داری؟'],
  },
  // ------------------------------------------------------ pregnancy details
  {
    key: 'life_stage',
    group: 'goal',
    kind: 'single',
    title: 'در چه مرحله‌ای هستی؟',
    options: [o('pregnant', 'باردار هستم'), o('breastfeeding', 'در دوران شیردهی هستم')],
    tracks: PREG,
    required: true,
    demo: PREG,
    demoTitles: ['در چه مرحله‌ای هستی؟'],
  },
  {
    key: 'pregnancy_week',
    group: 'goal',
    kind: 'number',
    title: 'در هفته چندم بارداری هستی؟',
    subtitle: 'هفته بارداری',
    min: 1,
    max: 42,
    step: 1,
    default: 12,
    unit: 'هفته',
    tracks: PREG,
    required: true,
    demo: PREG,
    showIf: { key: 'life_stage', in: ['pregnant'] },
    demoTitles: ['در هفته چندم بارداری هستی؟'],
  },
  {
    key: 'pre_pregnancy_weight_kg',
    group: 'goal',
    kind: 'number',
    title: 'قبل از بارداری چند کیلوگرم وزن داشتی؟',
    subtitle: 'کیلوگرم',
    min: 35,
    max: 240,
    step: 0.5,
    default: 62,
    unit: 'کیلوگرم',
    tracks: PREG,
    required: true,
    demo: PREG,
    demoTitles: ['قبل از بارداری چند کیلوگرم وزن داشتی؟', 'وزنت قبل از بارداری چقدر بوده؟'],
  },
  {
    key: 'babies',
    group: 'goal',
    kind: 'single',
    title: 'بارداری تو از چه نوعیه؟',
    options: [o('singleton', 'تک‌قلو'), o('twins', 'دوقلو'), o('triplets_plus', 'سه‌قلو یا بیشتر')],
    tracks: PREG,
    required: true,
    demo: PREG,
    showIf: { key: 'life_stage', in: ['pregnant'] },
    demoTitles: ['بارداری تو از چه نوعیه؟'],
  },
  {
    key: 'doctor_advice',
    group: 'health',
    kind: 'single',
    title: 'آیا پزشک برای وزن‌گیری یا تغذیه‌ات توصیه خاصی داشته؟',
    options: [
      o('no', 'خیر'),
      o('control_gain', 'بله، کنترل افزایش وزن'),
      o('more_gain', 'بله، نیاز به افزایش وزن بیشتر'),
      o('other', 'بله، محدودیت غذایی یا توصیه پزشکی دیگر'),
    ],
    tracks: PREG,
    required: true,
    demo: PREG,
    showIf: { key: 'life_stage', in: ['pregnant'] },
    demoTitles: ['آیا پزشک برای وزن‌گیری یا تغذیه‌ات توصیه خاصی داشته؟'],
  },
  {
    key: 'preg_symptoms',
    group: 'health',
    kind: 'multi',
    title: 'در دوران بارداری کدام مشکلات را تجربه می‌کنی؟',
    options: [
      o('nausea', 'تهوع'),
      o('vomiting', 'استفراغ'),
      o('constipation', 'یبوست'),
      o('heartburn', 'سوزش معده'),
      o('no_appetite', 'بی‌اشتهایی'),
      o('none', 'هیچ‌کدام', { exclusive: true }),
    ],
    tracks: PREG,
    required: true,
    demo: PREG,
    showIf: { key: 'life_stage', in: ['pregnant'] },
    demoTitles: ['در دوران بارداری کدام مشکلات را تجربه می‌کنی؟'],
  },
  {
    key: 'preg_conditions',
    group: 'health',
    kind: 'multi',
    title: 'آیا به یکی از شرایط زیر مبتلا هستی؟',
    options: [
      o('gestational_diabetes', 'دیابت بارداری'),
      o('preeclampsia', 'فشار خون بالا یا پره‌اکلامپسیا'),
      o('anemia', 'کم‌خونی'),
      o('thyroid', 'بیماری تیروئید'),
      o('other', 'سایر مشکلات پزشکی'),
      o('none', 'هیچ‌کدام', { exclusive: true }),
    ],
    tracks: PREG,
    required: true,
    demo: PREG,
    showIf: { key: 'life_stage', in: ['pregnant'] },
    demoTitles: ['آیا به یکی از شرایط زیر مبتلا هستی؟'],
  },
  {
    key: 'preg_supplements',
    group: 'health',
    kind: 'multi',
    title: 'چه مکمل‌هایی مصرف می‌کنی؟',
    options: [
      o('folic_acid', 'اسید فولیک'),
      o('iron', 'آهن'),
      o('vitamin_d', 'ویتامین D'),
      o('prenatal_multi', 'مولتی‌ویتامین بارداری'),
      o('other', 'سایر'),
      o('none', 'هیچ‌کدام', { exclusive: true }),
    ],
    tracks: PREG,
    required: true,
    demo: PREG,
    showIf: { key: 'life_stage', in: ['pregnant'] },
    demoTitles: ['چه مکمل‌هایی مصرف می‌کنی؟'],
  },
  {
    key: 'doctor_restrictions',
    group: 'health',
    kind: 'single',
    title: 'آیا پزشک مصرف غذا یا مکمل خاصی را برای تو محدود یا توصیه کرده؟',
    options: [o('no', 'خیر'), o('yes', 'بله')],
    followUp: { whenCodes: ['yes'], key: 'doctor_restrictions_text', placeholder: 'توصیهٔ پزشک را بنویس', required: true },
    tracks: PREG,
    required: true,
    demo: PREG,
    showIf: { key: 'life_stage', in: ['pregnant'] },
    demoTitles: ['آیا پزشک مصرف غذا یا مکمل خاصی را برای تو محدود یا توصیه کرده؟'],
  },
  {
    key: 'months_postpartum',
    group: 'goal',
    kind: 'number',
    title: 'چند ماه از زایمانت گذشته؟',
    subtitle: 'ماه',
    min: 0,
    max: 36,
    step: 1,
    default: 4,
    unit: 'ماه',
    tracks: PREG,
    required: true,
    demo: PREG,
    showIf: { key: 'life_stage', in: ['breastfeeding'] },
    demoTitles: ['چند ماه از زایمانت گذشته؟'],
  },
  {
    key: 'feeding_mode',
    group: 'goal',
    kind: 'single',
    title: 'به چه شکلی به نوزادت شیر می‌دی؟',
    options: [
      o('breast_only', 'فقط شیر مادر'),
      o('mixed', 'ترکیبی از شیر مادر و شیر خشک'),
      o('occasional', 'شیردهی کم یا گهگاهی'),
    ],
    tracks: PREG,
    required: true,
    demo: PREG,
    showIf: { key: 'life_stage', in: ['breastfeeding'] },
    demoTitles: ['به چه شکلی به نوزادت شیر می‌دی؟'],
  },
  {
    key: 'months_breastfeeding',
    group: 'goal',
    kind: 'number',
    title: 'چند ماهه که شیردهی را شروع کردی؟',
    subtitle: 'ماه',
    min: 0,
    max: 36,
    step: 1,
    default: 3,
    unit: 'ماه',
    tracks: PREG,
    required: false,
    demo: PREG,
    showIf: { key: 'life_stage', in: ['breastfeeding'] },
    demoTitles: ['چند ماهه که شیردهی را شروع کردی؟'],
  },
  {
    key: 'lactation_goal',
    group: 'goal',
    kind: 'single',
    title: 'هدفت در دوران شیردهی چیه؟',
    options: [
      o('balanced', 'تغذیه سالم و متعادل'),
      o('maintain', 'حفظ وزن فعلی'),
      o('gradual_loss', 'بازگشت تدریجی به وزن قبل از بارداری'),
      o('more_energy', 'تأمین انرژی بیشتر'),
    ],
    tracks: PREG,
    required: true,
    demo: PREG,
    showIf: { key: 'life_stage', in: ['breastfeeding'] },
    demoTitles: ['هدفت در دوران شیردهی چیه؟'],
  },
  {
    key: 'lactation_energy',
    group: 'health',
    kind: 'single',
    title: 'وضعیت انرژی و اشتهای خودت را چطور ارزیابی می‌کنی؟',
    options: [
      o('good', 'انرژی و اشتهای مناسبی دارم'),
      o('tired', 'بیشتر اوقات خسته‌ام'),
      o('big_appetite', 'اشتهای زیادی دارم'),
      o('small_appetite', 'اشتهای کمی دارم'),
    ],
    tracks: PREG,
    required: true,
    demo: PREG,
    showIf: { key: 'life_stage', in: ['breastfeeding'] },
    demoTitles: ['وضعیت انرژی و اشتهای خودت را چطور ارزیابی می‌کنی؟'],
  },
  {
    key: 'baby_concern',
    group: 'health',
    kind: 'single',
    title: 'آیا درباره میزان شیر یا رشد نوزاد نگرانی پزشکی مطرح شده؟',
    options: [o('no', 'خیر'), o('yes', 'بله'), o('reviewing', 'در حال بررسی توسط پزشک هستم')],
    tracks: PREG,
    required: true,
    demo: PREG,
    showIf: { key: 'life_stage', in: ['breastfeeding'] },
    demoTitles: ['آیا درباره میزان شیر یا رشد نوزاد نگرانی پزشکی مطرح شده؟'],
  },
  {
    key: 'lactation_meds',
    group: 'health',
    kind: 'single',
    title: 'آیا مکمل یا داروی خاصی در دوران شیردهی مصرف می‌کنی؟',
    options: [o('no', 'خیر'), o('yes', 'بله')],
    followUp: { whenCodes: ['yes'], key: 'lactation_meds_text', placeholder: 'نام دارو یا مکمل', required: true },
    tracks: PREG,
    required: true,
    demo: PREG,
    showIf: { key: 'life_stage', in: ['breastfeeding'] },
    demoTitles: ['آیا مکمل یا داروی خاصی در دوران شیردهی مصرف می‌کنی؟'],
  },
  // -------------------------------------------------------- detox details
  {
    key: 'health_focus',
    group: 'goal',
    kind: 'multi',
    title: 'بیشتر دوست داری کدام بخش از سلامتت بهتر بشه؟',
    options: [
      o('energy', 'افزایش انرژی روزانه'),
      o('nutrition_quality', 'بهبود کیفیت تغذیه'),
      o('digestive', 'سلامت دستگاه گوارش'),
      o('sleep', 'بهبود کیفیت خواب'),
      o('healthy_weight', 'حفظ وزن سالم'),
      o('less_junk', 'کاهش مصرف غذاهای ناسالم'),
    ],
    tracks: DETOX,
    required: true,
    demo: DETOX,
    demoTitles: ['بیشتر دوست داری کدام بخش از سلامتت بهتر بشه؟'],
  },
  {
    key: 'water',
    group: 'lifestyle',
    kind: 'single',
    title: 'معمولاً در طول روز چقدر آب می‌نوشی؟',
    options: [
      o('under_4', 'کمتر از ۴ لیوان'),
      o('4_6', '۴ تا ۶ لیوان'),
      o('7_9', '۷ تا ۹ لیوان'),
      o('10_plus', 'بیشتر از ۹ لیوان'),
    ],
    tracks: DETOX,
    required: true,
    demo: DETOX,
    demoTitles: ['معمولاً در طول روز چقدر آب می‌نوشی؟'],
  },
  {
    key: 'fruit_veg',
    group: 'food',
    kind: 'single',
    title: 'در طول روز چقدر میوه و سبزیجات مصرف می‌کنی؟',
    options: [
      o('none', 'تقریباً هیچ'),
      o('1_2', '۱ تا ۲ وعده'),
      o('3_4', '۳ تا ۴ وعده'),
      o('5_plus', '۵ وعده یا بیشتر'),
    ],
    tracks: DETOX,
    required: true,
    demo: DETOX,
    demoTitles: ['در طول روز چقدر میوه و سبزیجات مصرف می‌کنی؟'],
  },
  {
    key: 'digestion',
    group: 'health',
    kind: 'multi',
    title: 'وضعیت گوارشت معمولاً چطوره؟',
    options: [
      o('normal', 'طبیعی', { exclusive: true }),
      o('constipation', 'یبوست مکرر'),
      o('bloating', 'نفخ'),
      o('heartburn', 'سوزش معده'),
      o('diarrhea', 'اسهال مکرر'),
      o('other', 'مشکلات دیگر'),
    ],
    tracks: DETOX,
    required: true,
    demo: DETOX,
    demoTitles: ['وضعیت گوارشت معمولاً چطوره؟'],
  },
  {
    key: 'sweets_freq',
    group: 'food',
    kind: 'single',
    title: 'چقدر از خوراکی‌های شیرین یا غذاهای فرآوری‌شده استفاده می‌کنی؟',
    options: [
      o('rare', 'به‌ندرت'),
      o('weekly', 'چند بار در هفته'),
      o('daily', 'تقریباً هر روز'),
      o('multi_daily', 'چند بار در روز'),
    ],
    tracks: DETOX,
    required: true,
    demo: DETOX,
    demoTitles: ['چقدر از خوراکی‌های شیرین یا غذاهای فرآوری‌شده استفاده می‌کنی؟'],
  },
  {
    key: 'sleep_quality',
    group: 'lifestyle',
    kind: 'single',
    title: 'کیفیت خوابت را چطور ارزیابی می‌کنی؟',
    options: [o('very_good', 'خیلی خوب'), o('good', 'خوب'), o('medium', 'متوسط'), o('poor', 'ضعیف')],
    tracks: DETOX,
    required: true,
    demo: DETOX,
    demoTitles: ['کیفیت خوابت را چطور ارزیابی می‌کنی؟'],
  },
  {
    key: 'diet_change',
    group: 'goal',
    kind: 'multi',
    title: 'بیشتر دوست داری چه تغییری در تغذیه‌ات ایجاد کنی؟',
    options: [
      o('regular_meals', 'وعده‌های منظم‌تر'),
      o('more_veg', 'مصرف سبزیجات بیشتر'),
      o('less_sugar', 'کاهش قندهای افزوده'),
      o('home_cooked', 'مصرف غذاهای خانگی بیشتر'),
      o('variety', 'افزایش تنوع غذایی'),
      o('sustainable', 'داشتن یک برنامه متعادل و قابل‌ادامه'),
    ],
    tracks: DETOX,
    required: true,
    demo: DETOX,
    demoTitles: ['بیشتر دوست داری چه تغییری در تغذیه‌ات ایجاد کنی؟'],
  },
  {
    key: 'doctor_diet_advice',
    group: 'health',
    kind: 'multi',
    title: 'آیا پزشک برای بهبود وضعیت سلامتت توصیه غذایی خاصی داشته؟',
    options: [
      o('no', 'خیر', { exclusive: true }),
      o('blood_sugar', 'بله، کنترل قند خون'),
      o('blood_pressure', 'بله، کنترل فشار خون'),
      o('blood_lipids', 'بله، کنترل چربی خون'),
      o('digestive', 'بله، برای مشکلات گوارشی'),
      o('other', 'سایر موارد'),
    ],
    followUp: { whenCodes: ['other'], key: 'doctor_diet_advice_text', placeholder: 'توصیهٔ پزشک را توضیح بده', required: true },
    tracks: DETOX,
    required: true,
    demo: DETOX,
    demoTitles: ['آیا پزشک برای بهبود وضعیت سلامتت توصیه غذایی خاصی داشته؟'],
  },
];

export const SPEC_INSIGHTS: SpecInsight[] = [
  {
    afterKey: 'sex',
    icon: 'sparkle',
    title: 'برنامه‌ات فقط برای خودته',
    body: 'هر پاسخ مستقیم روی کالری، حجم وعده‌ها و غذاهای انتخاب‌شده تأثیر می‌ذاره؛ نه نسخهٔ عمومی.',
  },
  {
    afterKey: 'weight_kg',
    icon: 'scale',
    title: 'با همین دو عدد شروع می‌کنیم',
    body: 'شاخص توده بدنی و نیاز انرژی‌ات از همین قد و وزن محاسبه می‌شه و دکتر هم همین‌ها رو می‌بینه.',
  },
  {
    afterKey: 'meals_per_day',
    icon: 'bowl',
    title: 'ریتم غذایی‌ات مهمه',
    body: 'ساعت وعده‌ها رو طوری می‌چینیم که با خواب، کار و سفرهٔ خونه‌ات جور باشه.',
  },
  {
    afterKey: 'medications',
    icon: 'shield',
    title: 'ایمنی اول',
    body: 'اطلاعات سلامتت رمزنگاری می‌شه و قبل از انتشار، حتماً دکتر برنامه رو بررسی و تأیید می‌کنه.',
  },
];

export const SPEC_GROUP_TITLES: Record<GroupId, string> = {
  basics: 'آشنایی',
  body: 'بدن',
  lifestyle: 'سبک زندگی',
  food: 'غذا',
  goal: 'هدف',
  health: 'سلامت',
  culture: 'سفرهٔ ایرانی',
};

export function onboardingSpecView() {
  return {
    version: ONBOARDING_SPEC_VERSION,
    tracks: SPEC_TRACKS,
    groups: SPEC_GROUP_TITLES,
    questions: SPEC_QUESTIONS,
    insights: [],
  };
}

export function questionByKey(key: string): SpecQuestion | undefined {
  return SPEC_QUESTIONS.find((question) => question.key === key);
}

export type AnswerValue = string | number | string[] | { sleep: number; wake: number } | null;
export type CanonicalAnswers = Record<string, AnswerValue>;

/** Questions the user has to see for a track, in order, after applying showIf rules. */
export function activeQuestions(track: TrackId, answers: CanonicalAnswers): SpecQuestion[] {
  return SPEC_QUESTIONS.filter((question) => {
    if (question.tracks && !question.tracks.includes(track)) return false;
    if (!question.showIf) return true;
    const value = answers[question.showIf.key];
    const text = Array.isArray(value) ? value : value == null ? [] : [String(value)];
    if (question.showIf.in && !question.showIf.in.some((code) => text.includes(code))) return false;
    if (question.showIf.notIn && text.length > 0 && question.showIf.notIn.some((code) => text.includes(code))) {
      return false;
    }
    return true;
  });
}

export function isAnswered(question: SpecQuestion, value: AnswerValue | undefined, answers: CanonicalAnswers): boolean {
  if (value == null) return false;
  if (typeof value === 'string' && value.trim() === '') return false;
  if (Array.isArray(value) && value.length === 0) return false;
  if (question.followUp) {
    const chosen = Array.isArray(value) ? value : [String(value)];
    if (question.followUp.required && chosen.some((code) => question.followUp!.whenCodes.includes(code))) {
      const text = answers[question.followUp.key];
      if (typeof text !== 'string' || text.trim() === '') return false;
    }
  }
  return true;
}

/** Required questions the user still has to answer. */
export function missingRequired(track: TrackId, answers: CanonicalAnswers): string[] {
  return activeQuestions(track, answers)
    .filter((question) => question.required && !isAnswered(question, answers[question.key], answers))
    .map((question) => question.key);
}
