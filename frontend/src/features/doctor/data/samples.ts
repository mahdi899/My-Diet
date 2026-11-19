import { changeStatuses } from './labels'

export type Ingredient = { name: string; quantity: number | null; unit: string; basis?: string }
export type ClinicalMeal = {
  mealUid: string
  mealType: string
  suggestedTime: string
  title: string
  calories: number | null
  notes: string
  portion: string
  preparationMinutes: number | null
  instructions: string
  quantityBasis: string
  items: Ingredient[]
  alternatives: ClinicalAlternative[]
}
export type ClinicalAlternative = {
  id: string
  source: 'ai' | 'specialist'
  approved: boolean
  reviewedBy: string | null
  reviewedAt: string | null
  meal: ClinicalMeal
}
export type ClinicalDay = { meals: ClinicalMeal[] }
export type ClinicalQuestion = { id: string; prompt: string; required: boolean; status: string; answers: { body: string }[] }
export type ClinicalRequest = {
  id: string
  userId?: string
  weekStart?: string
  displayName?: string
  status: string
  capabilities?: { completeMealEditor?: boolean }
  version?: { status: string; lockVersion: number; versionNumber: number; days: ClinicalDay[] }
  published?: { versionNumber: number; days: ClinicalDay[] } | null
  questions: ClinicalQuestion[]
  history?: { versionNumber: number; status: string; weekStart: string; days?: ClinicalDay[] }[]
  patient?: Record<string, unknown>
}

export type PlanIngredient = { name: string; quantity: number; unit: string }
export type PlanOption = {
  optionId: string
  kind: 'primary' | 'ai_alternative' | 'specialist_alternative'
  title: string
  calories: number
  preparationMinutes: number
  ingredients: PlanIngredient[]
  approved: boolean
}
export type PlanMeal = {
  mealUid: string
  mealType: string
  suggestedTime: string
  title: string
  calories: number
  notes: string
  items: PlanIngredient[]
  options: PlanOption[]
}
export type PlanDay = { meals: PlanMeal[] }
export type PlanRequest = {
  id: string
  displayName: string
  status: string
  riskFlags: string[]
  profile: {
    track: string
    sex: string
    age: number
    heightCm: number
    weightKg: number
    targetWeightKg: number | null
    bmi: number
    dietStyle: string
    budget: string
    allergens: string[]
    conditions: string[]
    safetyTier: string
    energy: { targetKcal: number; bmrKcal: number; tdeeKcal: number; proteinG: number; carbsG: number; fatG: number }
  } | null
  aiReview: {
    status: string
    poolCode: string
    model: string
    costMicros: number
    tokens: number
    attemptNo: number
    promptVersion: string
    skippedReason: string | null
    attempts: { model: string; outcome: string }[]
    validatorWarnings: { message: string }[]
    critic: { verdict: string; issues: { text: string; severity: string }[] } | null
    dayTotals: { proteinG: number; carbsG: number; fatG: number }[]
  } | null
  version: { status: string; lockVersion: number; days: PlanDay[] } | null
}

export type ChangeRequest = {
  id: string
  planRequestId?: string
  answer?: string
  displayName: string
  status: string
  createdAt: string
  reasons: string[]
  details: string
  history: { status: string; at: string; body?: string }[]
  awaitingCustomer: boolean
  clarification?: string
  rejection: string
  version?: { lockVersion: number }
  conversationId?: string
}

export type QueueRow = {
  id: string
  displayName: string
  phone?: string | null
  goal?: string | null
  track?: string | null
  status: string
  kind: string
  createdAt: string
}

const clone = <T>(value: T): T => structuredClone(value)

function recipe(title: string, sourceMeal = false): ClinicalMeal {
  return {
    mealUid: crypto.randomUUID(),
    mealType: 'lunch',
    suggestedTime: '13:30',
    title,
    calories: 600,
    notes: 'نمونهٔ طراحی؛ توصیه پزشکی نیست.',
    portion: 'یک سهم برای همین وعده',
    preparationMinutes: 20,
    instructions: 'مواد آماده را مطابق مقدارهای ثبت‌شده گرم و سرو کن.',
    quantityBasis: 'برنج و مرغ پس از پخت وزن شده‌اند.',
    items: [
      { name: 'برنج پخته', quantity: 150, unit: 'گرم', basis: 'پخته' },
      { name: 'مرغ پخته', quantity: 120, unit: 'گرم', basis: 'پخته' },
    ],
    alternatives: sourceMeal ? [] : [],
  }
}

export function createClinicalSample() {
  const days: ClinicalDay[] = Array.from({ length: 7 }, (_, index) => {
    const meal = recipe('مرغ و برنج نمونه ' + new Intl.NumberFormat('fa-IR').format(index + 1))
    meal.alternatives = (['ai', 'specialist'] as const).map((source) => ({
      id: crypto.randomUUID(),
      source,
      approved: false,
      reviewedBy: null,
      reviewedAt: null,
      meal: recipe(source === 'ai' ? 'جایگزین نمونه AI' : 'جایگزین نمونه متخصص', true),
    }))
    return { meals: [meal] }
  })
  let request: ClinicalRequest = {
    id: 'clinical-demo',
    userId: 'sample-patient',
    weekStart: '2026-10-31',
    displayName: 'کاربر نمونهٔ آموزشی',
    status: 'in_review',
    capabilities: { completeMealEditor: true },
    version: { status: 'draft', lockVersion: 1, versionNumber: 2, days },
    published: {
      versionNumber: 1,
      days: days.map((day) => ({
        meals: day.meals.map((meal) => ({
          ...clone(meal),
          title: 'برنامهٔ قبلی نمونه',
          alternatives: meal.alternatives.map((alt) => ({ ...clone(alt), approved: true, reviewedBy: 'demo-specialist', reviewedAt: '2026-10-24T08:00:00Z' })),
        })),
      })),
    },
    questions: [{ id: 'question-demo', prompt: 'آیا داروی جدیدی مصرف می‌کنی؟', required: true, status: 'open', answers: [] }],
    patient: {
      name: 'کاربر نمونهٔ آموزشی', age: 32, height: 165, currentWeight: 72, targetWeight: 68, goal: 'کاهش وزن',
      conditions: [], allergies: null, medications: null, pregnancy: { status: 'باردار نیست' },
      questionnaire: [['سلیقه غذایی', 'غذای ایرانی'], ['سطح فعالیت', 'متوسط']],
      weights: [['۲ آبان', '۷۲٫۵ کیلوگرم'], ['۹ آبان', '۷۲ کیلوگرم']],
      consumption: { recorded: 24, adherent: 20, total: 28 },
      substitutions: [['گرانی مواد اولیه', '۲ بار'], ['زمان آماده‌سازی', '۱ بار']],
      feedback: [['هفتهٔ قبل', 'غذاهای سریع‌تر و اقتصادی‌تر ترجیح داده شده‌اند.']],
    },
  }
  const oldPublished = clone(request.published)
  let failSave = false
  let failPublish = false
  const error = (message: string, status = 409) => Object.assign(new Error(message), { status })
  return {
    demo: true as const,
    setFailures(save: boolean, publish: boolean) { failSave = save; failPublish = publish },
    async get() { return clone(request) },
    async save(previous: ClinicalRequest, newDays: ClinicalDay[]) {
      await new Promise((resolve) => setTimeout(resolve, 80))
      if (failSave) throw error('خطای ذخیره در سناریوی نمونه', 503)
      if (previous.version?.lockVersion !== request.version?.lockVersion) throw error('نسخه تغییر کرده است.')
      if (request.status === 'published' && request.version) request.version.versionNumber += 1
      request.status = request.status === 'published' ? 'in_review' : request.status
      request.version = { ...request.version!, days: clone(newDays), lockVersion: request.version!.lockVersion + 1, status: 'draft' }
      return clone(request)
    },
    async publish(previous: ClinicalRequest) {
      if (failPublish) throw error('انتشار نمونه ناموفق بود؛ برنامه قبلی حفظ شد.', 503)
      if (previous.version?.lockVersion !== request.version?.lockVersion) throw error('نسخه تغییر کرده است.')
      if (request.questions.some((question) => question.required && ['open', 'answered'].includes(question.status))) throw error('پاسخ لازم باید بررسی شود.')
      request.published = { versionNumber: request.version!.versionNumber, days: clone(request.version!.days) }
      request.version!.status = 'published'
      request.status = 'published'
      return { status: 'published' }
    },
    async ask(_request: ClinicalRequest, prompt: string) {
      request.questions.push({ id: crypto.randomUUID(), prompt, required: true, status: 'open', answers: [] })
      request.status = 'needs_info'
    },
    async acknowledge(id: string) {
      const question = request.questions.find((item) => item.id === id)
      if (question?.status !== 'answered') throw error('پاسخی دریافت نشده است.')
      question.status = 'acknowledged'
      if (!request.questions.some((item) => item.required && ['open', 'answered'].includes(item.status))) request.status = 'in_review'
    },
    async answer() {
      for (const question of request.questions.filter((item) => item.status === 'open')) {
        question.status = 'answered'
        question.answers = [{ body: 'پاسخ آموزشی: اطلاعات دارو را به‌روز کردم.' }]
      }
    },
    async versions() {
      return [{ id: 'sample-v1', versionNumber: 1, status: 'published', weekStart: '2026-10-24', days: clone(oldPublished?.days) }]
    },
  }
}

export type ClinicalRepository = ReturnType<typeof createClinicalSample>

function option(kind: PlanOption['kind'], title: string, calories: number): PlanOption {
  return {
    optionId: crypto.randomUUID(),
    kind,
    title,
    calories,
    preparationMinutes: kind === 'primary' ? 25 : 15,
    ingredients: [
      { name: 'نان سنگک', quantity: 60, unit: 'گرم' },
      { name: 'تخم‌مرغ', quantity: 2, unit: 'عدد' },
    ],
    approved: kind !== 'specialist_alternative',
  }
}

function planMeal(type: string, time: string, title: string, calories: number, withSpecialist: boolean): PlanMeal {
  const primary = option('primary', title, calories)
  const ai = option('ai_alternative', 'جایگزین ' + title, Math.round(calories * 0.9))
  const options = withSpecialist ? [primary, ai, option('specialist_alternative', 'گزینهٔ متخصص ' + title, calories)] : [primary, ai]
  return { mealUid: crypto.randomUUID(), mealType: type, suggestedTime: time, title, calories, notes: '', items: primary.ingredients, options }
}

export function samplePlanRequest(id = 'plan-demo'): PlanRequest {
  const days: PlanDay[] = weekTitles().map((title, index) => ({
    meals: [
      planMeal('breakfast', '08:00', index === 0 ? 'نان سبوس‌دار و تخم‌مرغ' : title, 340, index > 0),
      planMeal('lunch', '13:30', 'مرغ و برنج با سبزیجات', 540, index > 0),
    ],
  }))
  return {
    id,
    displayName: id === 'plan-demo' ? 'سارا احمدی' : 'امیر حسینی',
    status: 'in_review',
    riskFlags: [],
    profile: {
      track: 'weight_loss', sex: 'female', age: 32, heightCm: 165, weightKg: 72, targetWeightKg: 68, bmi: 26.4,
      dietStyle: 'omnivore', budget: 'medium', allergens: [], conditions: [], safetyTier: 'ai_ok',
      energy: { targetKcal: 1600, bmrKcal: 1420, tdeeKcal: 1860, proteinG: 96, carbsG: 170, fatG: 53 },
    },
    aiReview: {
      status: 'drafted', poolCode: 'default', model: 'preview', costMicros: 18400, tokens: 920, attemptNo: 1, promptVersion: 'week-3',
      skippedReason: null, attempts: [{ model: 'preview', outcome: 'ok' }], validatorWarnings: [], critic: { verdict: 'clear', issues: [] },
      dayTotals: days.map(() => ({ proteinG: 90, carbsG: 160, fatG: 48 })),
    },
    version: { status: 'draft', lockVersion: 1, days },
  }
}

function weekTitles() {
  return ['نان و پنیر', 'املت سبزی', 'عدسی', 'جو دوسر', 'ماست و گردو', 'املت گوجه', 'نان و تخم‌مرغ']
}

const previewCatalog = [
  { slug: 'sangak-egg', nameFa: 'نان سنگک و تخم‌مرغ', servingLabel: 'یک پرس', kcal: 340 },
  { slug: 'chicken-rice', nameFa: 'مرغ و برنج', servingLabel: 'یک پرس', kcal: 540 },
  { slug: 'adas', nameFa: 'عدسی', servingLabel: 'یک کاسه', kcal: 280 },
  { slug: 'salad', nameFa: 'سالاد فصل', servingLabel: 'یک بشقاب', kcal: 120 },
  { slug: 'yogurt', nameFa: 'ماست کم‌چرب', servingLabel: 'یک لیوان', kcal: 90 },
]

export function searchPreviewFoods(query: string) {
  const text = query.trim()
  return previewCatalog.filter((food) => !text || food.nameFa.includes(text))
}

export function composePreviewOption(kind: PlanOption['kind'], items: { slug: string; servings: number }[]) {
  const foods = items.map((item) => ({ ...previewCatalog.find((food) => food.slug === item.slug)!, servings: item.servings }))
  const calories = Math.round(foods.reduce((sum, food) => sum + food.kcal * food.servings, 0))
  return {
    option: {
      optionId: crypto.randomUUID(),
      kind,
      title: foods.map((food) => food.nameFa).join(' و '),
      calories,
      preparationMinutes: 20,
      ingredients: foods.map((food) => ({ name: food.nameFa, quantity: food.servings, unit: 'پرس' })),
      approved: true,
    } satisfies PlanOption,
  }
}

export const previewReviewQueue: QueueRow[] = [
  { id: 'plan-demo', displayName: 'سارا احمدی', phone: '+989120000001', track: 'weight_loss', status: 'awaiting_review', kind: 'new_plan', createdAt: '2026-11-12T08:00:00+03:30' },
  { id: 'plan-demo-2', displayName: 'امیر حسینی', phone: '+989120000002', track: 'weight_gain', status: 'in_review', kind: 'revision', createdAt: '2026-11-11T09:30:00+03:30' },
]

export function createChangeSample() {
  const requests: ChangeRequest[] = [
    {
      id: 'change-demo', displayName: 'کاربر نمونهٔ آموزشی', status: 'awaiting_review', createdAt: '2026-11-01T07:05:00Z',
      reasons: ['تهیه غذا زمان‌بر است'], details: 'شام‌های سریع‌تر ترجیح می‌دهم.', awaitingCustomer: false, rejection: '',
      history: [{ status: 'awaiting_review', at: '2026-11-01T07:05:00Z' }],
    },
    {
      id: 'change-demo-2', displayName: 'کاربر نمونهٔ دوم', status: 'awaiting_review', createdAt: '2026-11-03T08:20:00Z',
      reasons: ['هزینه غذا بالاست', 'مواد اولیه موجود نیست'], details: 'وعده‌های ارزان‌تر و با مواد در دسترس می‌خواهم.', awaitingCustomer: false, rejection: '',
      history: [{ status: 'awaiting_review', at: '2026-11-03T08:20:00Z' }],
    },
  ]
  const find = (id: string) => {
    const row = requests.find((item) => item.id === id)
    if (!row) throw new Error('درخواست پیدا نشد.')
    return row
  }
  const transition = (row: ChangeRequest, status: string, body?: string) => {
    row.status = status
    row.history.push({ status, at: new Date().toISOString(), body })
  }
  return {
    demo: true as const,
    revisions: true as const,
    statuses: changeStatuses,
    async changes() { return clone(requests) },
    async detail(id: string) { return clone(find(id)) },
    async start(id: string) {
      const row = find(id)
      if (row.status !== 'awaiting_review') throw new Error('این درخواست قبلاً بررسی شده است.')
      transition(row, 'under_review')
      return clone(row)
    },
    async reject(id: string, explanation: string) {
      const row = find(id)
      if (row.status !== 'under_review' || !explanation.trim()) throw new Error('بررسی را شروع و دلیل رد را بنویسید.')
      row.rejection = explanation.trim()
      row.awaitingCustomer = false
      transition(row, 'rejected', row.rejection)
      return clone(row)
    },
    async clarify(id: string, prompt: string) {
      const row = find(id)
      if (row.status !== 'under_review' || !prompt.trim()) throw new Error('بررسی را شروع و سؤال را بنویسید.')
      row.awaitingCustomer = true
      row.clarification = prompt.trim()
      row.history.push({ status: row.status, at: new Date().toISOString(), body: 'در انتظار پاسخ کاربر: ' + prompt })
      return clone(row)
    },
    async answer(id: string) {
      const row = find(id)
      row.awaitingCustomer = false
      row.history.push({ status: row.status, at: new Date().toISOString(), body: 'پاسخ نمونه کاربر: شام زیر ۲۰ دقیقه ترجیح می‌دهم.' })
      return clone(row)
    },
  }
}

let changeSample: ReturnType<typeof createChangeSample> | null = null
export function messagingSample() {
  changeSample ??= createChangeSample()
  return changeSample
}

export type WeeklyReport = {
  id: string
  patient: string
  week: string
  end: string
  status: 'ready' | 'partial' | 'pending' | 'failed'
  expected: number
  recorded: number
  adherent: number
  previous: { recorded: number; adherent: number; expected: number } | null
  favorites?: string[]
  disliked?: string[]
  reasons?: [string, number][]
  preparation?: string
  budget?: string
  availability?: string
  portion?: string
  service?: string
  weights?: string[]
  health?: string
  suggestions?: string[]
}

export const weeklySamples: WeeklyReport[] = [
  {
    id: 'sample-01', patient: 'کاربر نمونه الف', week: '2026-10-24T00:00:00+03:30', end: '2026-10-30T23:59:59+03:30', status: 'ready',
    expected: 28, recorded: 24, adherent: 20, previous: { recorded: 18, adherent: 15, expected: 28 },
    favorites: ['عدسی', 'مرغ و برنج'], disliked: ['سوپ جو'], reasons: [['زمان آماده‌سازی', 3], ['گران بودن', 1]],
    preparation: 'دو وعده برای محل کار زمان‌بر بوده است.', budget: 'تهیهٔ بعضی مواد برای کاربر گران بوده است.',
    availability: 'برخی سبزیجات در دسترس نبوده است.', portion: 'مناسب', service: 'خوب',
    weights: ['۲ آبان: ۷۲ کیلوگرم', '۸ آبان: ۷۱٫۶ کیلوگرم'], health: 'تغییر جدیدی در نمونه گزارش نشده؛ این به معنی نبود بیماری نیست.',
    suggestions: ['وعده‌های سریع‌تر برای محل کار بررسی شوند.', 'جایگزین اقتصادی‌تر با بررسی متخصص در نظر گرفته شود.'],
  },
  {
    id: 'sample-02', patient: 'کاربر نمونه الف', week: '2026-10-17T00:00:00+03:30', end: '2026-10-23T23:59:59+03:30', status: 'partial',
    expected: 28, recorded: 18, adherent: 15, previous: null, favorites: ['نان و پنیر'], disliked: [], reasons: [['مواد اولیه موجود نیست', 2]],
    preparation: 'اطلاعات کامل نیست', budget: 'بازخورد ثبت نشده', availability: 'بازخورد ثبت نشده', portion: 'ثبت نشده', service: 'ثبت نشده',
    weights: [], health: 'اطلاعات تغییرات سلامت ارائه نشده', suggestions: ['قبل از نتیجه‌گیری، بازخورد هفته دریافت شود.'],
  },
  { id: 'sample-03', patient: 'کاربر نمونه ب', week: '2026-10-24T00:00:00+03:30', end: '2026-10-30T23:59:59+03:30', status: 'pending', expected: 28, recorded: 0, adherent: 0, previous: null },
  { id: 'sample-04', patient: 'کاربر نمونه ب', week: '2026-10-17T00:00:00+03:30', end: '2026-10-23T23:59:59+03:30', status: 'failed', expected: 28, recorded: 0, adherent: 0, previous: null },
]

export const weeklyStatus: Record<WeeklyReport['status'], string> = {
  ready: 'آماده', partial: 'داده ناقص', pending: 'در انتظار آماده‌سازی', failed: 'آماده‌سازی ناموفق',
}
