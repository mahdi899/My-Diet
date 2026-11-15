export const specialistSorts = {
  rating: 'بیشترین امتیاز',
  response: 'سریع‌ترین پاسخ پیام',
  workload: 'بیشترین کار باز',
} as const

export type SpecialistSort = keyof typeof specialistSorts

type Person = {
  id: string
  name: string
  ratings: number[]
  messageResponseMinutes: number[]
  reviewMinutes: number[]
  pendingMessages: number
  pendingChanges: number
}

const people: Person[] = [
  { id: 's-a', name: 'متخصص نمونهٔ الف', ratings: [5, 4, 5, 4, 3], messageResponseMinutes: [20, 40, 15], reviewMinutes: [180, 240], pendingMessages: 2, pendingChanges: 1 },
  { id: 's-b', name: 'متخصص نمونهٔ ب', ratings: [5], messageResponseMinutes: [12], reviewMinutes: [90], pendingMessages: 0, pendingChanges: 4 },
  { id: 's-c', name: 'متخصص بدون امتیاز', ratings: [], messageResponseMinutes: [], reviewMinutes: [60], pendingMessages: 1, pendingChanges: 0 },
]

export type SpecialistCard = {
  id: string
  name: string
  rating: string
  smallSample: boolean
  stars: Array<{ star: number; label: string; ratio: number }>
  message: string
  review: string
  pending: string
}

const fa = (value: number) => new Intl.NumberFormat('fa-IR').format(value)

function average(values: number[]) {
  if (!values.length) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function minutesText(value: number | null, samples: number, empty: string) {
  if (value == null || !samples) return empty
  return `${fa(Math.round(value))} دقیقه · ${fa(samples)} نمونه`
}

function ratingText(averageRating: number | null, count: number) {
  if (averageRating == null) return 'بدون امتیاز'
  return `${fa(Math.round(averageRating * 10) / 10)} از ۵ · ${fa(count)} نظر`
}

export function sampleSpecialistReport(sort: SpecialistSort): SpecialistCard[] {
  const rows = people.map((person) => {
    const count = person.ratings.length
    return {
      id: person.id,
      name: person.name,
      ratingCount: count,
      ratingAverage: count ? average(person.ratings) : null,
      distribution: [1, 2, 3, 4, 5].map((star) => ({ star, count: person.ratings.filter((value) => value === star).length })),
      messageResponse: average(person.messageResponseMinutes),
      messageSamples: person.messageResponseMinutes.length,
      reviewTime: average(person.reviewMinutes),
      reviewSamples: person.reviewMinutes.length,
      pendingMessages: person.pendingMessages,
      pendingChanges: person.pendingChanges,
      pending: person.pendingMessages + person.pendingChanges,
    }
  })
  const read = { rating: (row: typeof rows[number]) => row.ratingAverage, response: (row: typeof rows[number]) => row.messageResponse, workload: (row: typeof rows[number]) => row.pending }[sort]
  const direction = sort === 'response' ? 1 : -1
  rows.sort((a, b) => {
    const left = read(a)
    const right = read(b)
    if (left == null && right == null) return a.name.localeCompare(b.name, 'fa')
    if (left == null) return 1
    if (right == null) return -1
    return left === right ? a.name.localeCompare(b.name, 'fa') : (left - right) * direction
  })
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    rating: ratingText(row.ratingAverage, row.ratingCount),
    smallSample: row.ratingCount > 0 && row.ratingCount < 5,
    stars: row.distribution.map((bucket) => ({
      star: bucket.star,
      label: `${fa(bucket.star)} ستاره · ${fa(bucket.count)}`,
      ratio: row.ratingCount ? (bucket.count / row.ratingCount) * 100 : 0,
    })),
    message: `پاسخ پیام: ${minutesText(row.messageResponse, row.messageSamples, 'نمونه‌ای برای پاسخ پیام در این بازه نیست')}`,
    review: `بررسی تغییر برنامه: ${minutesText(row.reviewTime, row.reviewSamples, 'نمونه‌ای برای تصمیم تغییر برنامه در این بازه نیست')}`,
    pending: `کار باز: ${fa(row.pendingMessages)} پیام و ${fa(row.pendingChanges)} درخواست تغییر. کار باز داخل میانگین زمان‌ها حساب نمی‌شود.`,
  }))
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? value as Record<string, unknown> : null
}

export function specialistReportFromApi(payload: unknown): SpecialistCard[] {
  const rows = Array.isArray(asRecord(payload)?.rows) ? asRecord(payload)!.rows as unknown[] : []
  return rows.flatMap((item) => {
    const row = asRecord(item)
    if (!row || typeof row.id !== 'string' || typeof row.name !== 'string') return []
    const ratingCount = typeof row.ratingCount === 'number' ? row.ratingCount : 0
    const ratingAverage = typeof row.ratingAverage === 'number' ? row.ratingAverage : null
    const distribution = Array.isArray(row.distribution) ? row.distribution.flatMap((bucket) => {
      const cell = asRecord(bucket)
      return cell && typeof cell.star === 'number' && typeof cell.count === 'number' ? [{ star: cell.star, count: cell.count }] : []
    }) : [1, 2, 3, 4, 5].map((star) => ({ star, count: 0 }))
    const messageSamples = typeof row.messageSamples === 'number' ? row.messageSamples : 0
    const reviewSamples = typeof row.reviewSamples === 'number' ? row.reviewSamples : 0
    return [{
      id: row.id,
      name: row.name,
      rating: ratingText(ratingAverage, ratingCount),
      smallSample: Boolean(row.smallSample),
      stars: distribution.map((bucket) => ({
        star: bucket.star,
        label: `${fa(bucket.star)} ستاره · ${fa(bucket.count)}`,
        ratio: ratingCount ? (bucket.count / ratingCount) * 100 : 0,
      })),
      message: `پاسخ پیام: ${minutesText(typeof row.messageResponse === 'number' ? row.messageResponse : null, messageSamples, 'نمونه‌ای برای پاسخ پیام در این بازه نیست')}`,
      review: `بررسی تغییر برنامه: ${minutesText(typeof row.reviewTime === 'number' ? row.reviewTime : null, reviewSamples, 'نمونه‌ای برای تصمیم تغییر برنامه در این بازه نیست')}`,
      pending: `کار باز: ${fa(Number(row.pendingMessages) || 0)} پیام و ${fa(Number(row.pendingChanges) || 0)} درخواست تغییر. کار باز داخل میانگین زمان‌ها حساب نمی‌شود.`,
    }]
  })
}
