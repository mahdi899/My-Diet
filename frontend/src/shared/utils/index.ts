import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function toEnglishDigits(value: string) {
  return value.replace(/[۰-۹٠-٩]/g, (digit) => {
    const code = digit.charCodeAt(0)
    return String(code - (digit <= '٩' ? 0x0660 : 0x06f0))
  })
}

export function formatFaNumber(value: number) {
  return new Intl.NumberFormat('fa-IR').format(value)
}

export function formatFaDate(value: unknown) {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleString('fa-IR', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export const statusLabels: Record<string, string> = {
  active: 'فعال',
  suspended: 'غیرفعال',
  deleted: 'حذف‌شده',
  paid: 'پرداخت‌شده',
  refunded: 'بازپرداخت‌شده',
  credited: 'واریزشده',
  pending: 'در انتظار',
  failed: 'ناموفق',
  queued: 'در صف',
  generating: 'در حال تولید',
  in_review: 'در حال بررسی',
  awaiting_user: 'در انتظار کاربر',
  awaiting_review: 'منتظر بررسی',
  response_received: 'پاسخ دریافت‌شده',
  published: 'منتشرشده',
  cancelled: 'لغوشده',
  approved: 'تأییدشده',
  rejected: 'ردشده',
  verified: 'تأییدشده',
  draft: 'پیش‌نویس',
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>
  return null
}

export function asRows(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value.filter((row): row is Record<string, unknown> => !!row && typeof row === 'object' && !Array.isArray(row))
  }
  const record = asRecord(value)
  if (!record) return []
  for (const key of ['items', 'rows', 'data', 'results', 'links', 'questions', 'profiles']) {
    if (Array.isArray(record[key])) return asRows(record[key])
  }
  return []
}
