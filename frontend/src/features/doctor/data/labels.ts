export const requestStatus: Record<string, string> = {
  in_review: 'در انتظار بررسی',
  response_received: 'پاسخ دریافت شده',
  queued: 'در صف',
  generating: 'در حال تولید',
  awaiting_review: 'منتظر بررسی',
  reviewing: 'در حال بررسی',
  under_review: 'در حال بررسی توسط متخصص',
  awaiting_user: 'در انتظار پاسخ کاربر',
  needs_info: 'نیاز به اطلاعات',
  published: 'منتشرشده',
  cancelled: 'لغوشده',
  rejected: 'رد شده',
  approved: 'تأیید شده',
}

export const changeStatuses: Record<string, string> = {
  awaiting_review: 'در انتظار بررسی',
  under_review: 'در حال بررسی توسط متخصص',
  rejected: 'رد شده',
  approved: 'تأیید شده',
}

export const verificationStatus: Record<string, string> = {
  verified: 'تأییدشده',
  pending: 'در انتظار تأیید',
  rejected: 'تأیید نشده',
  suspended: 'تعلیق‌شده',
}

export const weekDays = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه']
export const mealSlots: Record<string, string> = { breakfast: 'صبحانه', lunch: 'ناهار', dinner: 'شام', snack: 'میان‌وعده', snack1: 'میان‌وعده', snack2: 'میان‌وعده' }
export const optionKinds = [
  ['primary', 'گزینهٔ اصلی'],
  ['ai_alternative', 'جایگزین هوش مصنوعی'],
  ['specialist_alternative', 'جایگزین متخصص'],
] as const

export const trackLabels: Record<string, string> = { weight_loss: 'کاهش وزن', weight_gain: 'افزایش وزن', pregnancy: 'بارداری', detox: 'پاکسازی' }
export const budgetLabels: Record<string, string> = { low: 'اقتصادی', medium: 'متوسط', open: 'بدون محدودیت' }
export const dietLabels: Record<string, string> = { omnivore: 'همه‌چیزخوار', vegetarian: 'گیاه‌خوار', vegan: 'وگان' }
export const aiStatusLabels: Record<string, string> = { drafted: 'پیش‌نویس ساخته شد', skipped: 'AI رد شد', failed: 'ناموفق' }

export function formatFaDay(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('fa-IR-u-ca-persian', { dateStyle: 'medium', timeZone: 'Asia/Tehran' }).format(date)
}

export function textValue(value: unknown): string {
  if (value == null || value === '') return 'ارائه نشده'
  if (Array.isArray(value)) return value.length ? value.map(textValue).join('، ') : 'هیچ موردی گزارش نشده'
  if (typeof value === 'number') return new Intl.NumberFormat('fa-IR').format(value)
  return String(value)
}

export function personName(row: { userName?: string; user?: string; displayName?: string }) {
  return row.userName || row.user || row.displayName || 'نام ثبت نشده'
}

let dirtyGuard: (() => boolean) | null = null

export function setDirtyGuard(guard: (() => boolean) | null) {
  dirtyGuard = guard
}

export function canLeaveDoctor() {
  return dirtyGuard ? dirtyGuard() : true
}
