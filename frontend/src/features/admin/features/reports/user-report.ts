export const retentionWindows = [
  { key: 'week1', days: 7, label: 'هفتهٔ اول' },
  { key: 'week2', days: 14, label: 'هفتهٔ دوم' },
  { key: 'week4', days: 28, label: 'هفتهٔ چهارم' },
] as const

export const retentionEvents = {
  activity: 'بازگشت به برنامه، بدون الزام ثبت وعده یا خرید',
  tracking: 'ثبت حداقل یک وعده در همان پنجره',
  purchase: 'خرید دوبارهٔ برنامه در همان پنجره',
} as const

export type RetentionEvent = keyof typeof retentionEvents

const foodTitles = [
  ['selected', 'بیشترین انتخاب'],
  ['alternative', 'بیشترین جایگزین'],
  ['disliked', 'بیشترین غذای نامطلوب'],
  ['reason', 'دلایل رایج جایگزینی'],
] as const

export type FoodKind = (typeof foodTitles)[number][0]

type Counts = Record<RetentionEvent, Record<(typeof retentionWindows)[number]['key'], number>>

const cohorts: Array<{ id: string; label: string; startedOn: string; size: number; counts: Counts }> = [
  { id: 'sep', label: 'گروه ۱۲ شهریور', startedOn: '2026-09-03', size: 40, counts: { activity: { week1: 28, week2: 18, week4: 11 }, tracking: { week1: 22, week2: 14, week4: 8 }, purchase: { week1: 6, week2: 4, week4: 3 } } },
  { id: 'oct', label: 'گروه ۲۸ مهر', startedOn: '2026-10-20', size: 12, counts: { activity: { week1: 9, week2: 0, week4: 0 }, tracking: { week1: 7, week2: 0, week4: 0 }, purchase: { week1: 1, week2: 0, week4: 0 } } },
  { id: 'new', label: 'گروه ۶ آبان', startedOn: '2026-10-28', size: 5, counts: { activity: { week1: 0, week2: 0, week4: 0 }, tracking: { week1: 0, week2: 0, week4: 0 }, purchase: { week1: 0, week2: 0, week4: 0 } } },
  { id: 'quiet', label: 'گروه بدون بازگشت', startedOn: '2026-08-01', size: 10, counts: { activity: { week1: 0, week2: 0, week4: 0 }, tracking: { week1: 0, week2: 0, week4: 0 }, purchase: { week1: 0, week2: 0, week4: 0 } } },
]

const foodEvents: Array<{ date: string; foodId: string; label: string; kind: FoodKind }> = [
  { date: '2026-10-04', foodId: 'rice', label: 'مرغ و برنج', kind: 'selected' },
  { date: '2026-10-06', foodId: 'rice', label: 'مرغ و برنج', kind: 'selected' },
  { date: '2026-10-08', foodId: 'lentil', label: 'عدسی', kind: 'selected' },
  { date: '2026-10-11', foodId: 'lentil', label: 'عدسی', kind: 'alternative' },
  { date: '2026-10-12', foodId: 'yogurt', label: 'ماست و خیار', kind: 'alternative' },
  { date: '2026-10-18', foodId: 'soup', label: 'سوپ جو', kind: 'disliked' },
  { date: '2026-10-19', foodId: 'soup', label: 'سوپ جو', kind: 'disliked' },
  { date: '2026-10-21', foodId: 'time', label: 'زمان آماده‌سازی', kind: 'reason' },
  { date: '2026-10-22', foodId: 'cost', label: 'هزینهٔ مواد', kind: 'reason' },
  { date: '2026-10-22', foodId: 'time', label: 'زمان آماده‌سازی', kind: 'reason' },
]

const feedbackFixture = { eligible: 40, submitted: 17, continued: 12 }

export type ReportQuery = { from: string; to: string; event: RetentionEvent }

export type ReportLine = { key: string; text: string; ratio: number | null }

export type UserReport = {
  status: 'ready' | 'empty' | 'invalid'
  definition: string
  cohorts: Array<{ id: string; title: string; lines: ReportLine[] }>
  foods: Array<{ title: string; rows: Array<{ label: string; ratio: number }> | null }>
  feedback: { participation: string; continuation: string } | null
}

function ageDays(start: string, asOf: string) {
  const [ys, ms, ds] = start.split('-').map(Number)
  const [ye, me, de] = asOf.split('-').map(Number)
  return Math.round((Date.UTC(ye!, me! - 1, de!) - Date.UTC(ys!, ms! - 1, ds!)) / 86400000)
}

function percent(count: number, denominator: number) {
  return Math.round((100 * count) / denominator)
}

const fa = (value: number) => new Intl.NumberFormat('fa-IR').format(value)

export function measuredText(count: number, denominator: number, share = percent(count, denominator)) {
  return `${fa(count)} از ${fa(denominator)} (${fa(share)}٪)`
}

function cellText(cell: { state: string; count?: number; denominator?: number; percent?: number }) {
  if (cell.state === 'not_yet_measurable') return 'هنوز قابل سنجش نیست'
  if (cell.state === 'no_denominator') return 'مخرج گروه مشخص نیست'
  return measuredText(cell.count ?? 0, cell.denominator ?? 0, cell.percent)
}

function rankFoods(from: string, to: string, kind: FoodKind) {
  if (!from || !to || from > to) return null
  const counts = new Map<string, { label: string; count: number }>()
  for (const event of foodEvents) {
    if (event.kind !== kind || event.date < from || event.date > to) continue
    const current = counts.get(event.foodId) ?? { label: event.label, count: 0 }
    current.count += 1
    counts.set(event.foodId, current)
  }
  const rows = [...counts.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'fa'))
  if (!rows.length) return null
  const top = rows[0]!.count
  return rows.map((item) => ({ label: `${item.label} · ${fa(item.count)}`, ratio: (item.count / top) * 100 }))
}

export function sampleUserReport({ from, to, event }: ReportQuery): UserReport {
  const definition = retentionEvents[event]
  const foods = foodTitles.map(([kind, title]) => ({ title, rows: rankFoods(from, to, kind) }))
  const feedback = feedbackFixture.eligible
    ? {
        participation: measuredText(feedbackFixture.submitted, feedbackFixture.eligible),
        continuation: measuredText(feedbackFixture.continued, feedbackFixture.eligible),
      }
    : null
  if (!from || !to || from > to) return { status: 'invalid', definition, cohorts: [], foods, feedback }
  const cohortsInRange = cohorts.filter((cohort) => cohort.startedOn >= from && cohort.startedOn <= to)
  return {
    status: cohortsInRange.length ? 'ready' : 'empty',
    definition,
    cohorts: cohortsInRange.map((cohort) => ({
      id: cohort.id,
      title: `${cohort.label} · ${fa(cohort.size)} نفر`,
      lines: retentionWindows.map((window) => {
        if (ageDays(cohort.startedOn, to) < window.days) return { key: window.key, text: `${window.label}: هنوز قابل سنجش نیست`, ratio: null }
        if (!cohort.size) return { key: window.key, text: `${window.label}: مخرج گروه مشخص نیست`, ratio: null }
        const count = cohort.counts[event][window.key]
        const share = percent(count, cohort.size)
        return { key: window.key, text: `${window.label}: ${measuredText(count, cohort.size, share)}`, ratio: share }
      }),
    })),
    foods,
    feedback,
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? value as Record<string, unknown> : null
}

function rankedRows(payload: unknown) {
  const record = asRecord(payload)
  if (!record || record.status !== 'ready') return null
  const rows = Array.isArray(record.rows) ? record.rows.flatMap((item) => {
    const row = asRecord(item)
    if (!row || typeof row.label !== 'string' || typeof row.count !== 'number') return []
    return [{ label: row.label, count: row.count }]
  }) : []
  if (!rows.length) return null
  const top = rows[0]!.count || 1
  return rows.map((item) => ({ label: `${item.label} · ${fa(item.count)}`, ratio: (item.count / top) * 100 }))
}

export function userReportFromApi(retention: unknown, foodPayloads: unknown[], feedbackPayload: unknown, event: RetentionEvent): UserReport {
  const record = asRecord(retention)
  const status = record?.status === 'invalid' || record?.status === 'empty' || record?.status === 'ready' ? record.status : 'empty'
  const definition = typeof record?.definition === 'string' ? record.definition : retentionEvents[event]
  const cohortsInRange = status === 'ready' && Array.isArray(record?.rows) ? record.rows.flatMap((item) => {
    const row = asRecord(item)
    const cells = asRecord(row?.cells)
    if (!row || typeof row.id !== 'string' || typeof row.label !== 'string' || typeof row.size !== 'number' || !cells) return []
    return [{
      id: row.id,
      title: `${row.label} · ${fa(row.size)} نفر`,
      lines: retentionWindows.map((window) => {
        const cell = asRecord(cells[window.key])
        const state = cell?.state === 'measured' || cell?.state === 'not_yet_measurable' || cell?.state === 'no_denominator' ? cell.state : 'not_yet_measurable'
        const measured = state === 'measured' && typeof cell?.percent === 'number'
        return { key: window.key, text: `${window.label}: ${cellText({ state, count: Number(cell?.count), denominator: Number(cell?.denominator), percent: Number(cell?.percent) })}`, ratio: measured ? Number(cell?.percent) : null }
      }),
    }]
  }) : []
  const feedbackRecord = asRecord(feedbackPayload)
  const participation = asRecord(feedbackRecord?.participation)
  const continuation = asRecord(feedbackRecord?.continuation)
  return {
    status: status === 'ready' && !cohortsInRange.length ? 'empty' : status,
    definition,
    cohorts: cohortsInRange,
    foods: foodTitles.map(([kind, title], index) => ({ title, rows: foodPayloads[index] && kind ? rankedRows(foodPayloads[index]) : null })),
    feedback: feedbackRecord?.status === 'ready' && typeof participation?.count === 'number' && typeof continuation?.count === 'number'
      ? {
          participation: measuredText(participation.count, Number(participation.denominator), Number(participation.percent)),
          continuation: measuredText(continuation.count, Number(continuation.denominator), Number(continuation.percent)),
        }
      : null,
  }
}

export function rangeLabel(from: string, to: string) {
  const shown = (value: string) => {
    const [year, month, day] = value.split('-')
    return year && month && day ? `${day}-${month}-${year}` : value
  }
  return `${shown(from)} تا ${shown(to)}`
}
