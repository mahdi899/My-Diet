const screenLabels: Record<string, string> = {
  home: 'خانه',
  plan_purchase: 'خرید برنامه',
  questionnaire: 'پرسش‌نامه',
  plan_day: 'برنامه روز',
  feedback: 'بازخورد',
  login: 'ورود',
}

export const screenPlaces: Record<string, [number, number]> = {
  home: [90, 70],
  plan_purchase: [270, 70],
  questionnaire: [450, 70],
  plan_day: [180, 190],
  feedback: [360, 190],
  login: [90, 190],
}

type JourneyEvent = { type: 'screen_viewed'; screenId: string; activeMs: number } | { type: 'navigation'; fromScreenId: string; toScreenId: string }
type JourneySession = { id: string; date: string; platform: string; appVersion: string; sessionType: 'first_visit' | 'returning'; events: JourneyEvent[] }

const viewed = (screenId: string, activeMs: number): JourneyEvent => ({ type: 'screen_viewed', screenId, activeMs })
const moved = (fromScreenId: string, toScreenId: string): JourneyEvent => ({ type: 'navigation', fromScreenId, toScreenId })

const sessions: JourneySession[] = [
  { id: 'a', date: '2026-10-24', platform: 'android', appVersion: '1.0.0', sessionType: 'first_visit', events: [viewed('home', 8000), moved('home', 'plan_purchase'), viewed('plan_purchase', 20000), moved('plan_purchase', 'questionnaire'), viewed('questionnaire', 40000)] },
  { id: 'b', date: '2026-10-24', platform: 'android', appVersion: '1.0.0', sessionType: 'first_visit', events: [viewed('home', 6000), moved('home', 'plan_purchase'), viewed('plan_purchase', 15000), moved('plan_purchase', 'questionnaire'), viewed('questionnaire', 30000)] },
  { id: 'c', date: '2026-10-25', platform: 'android', appVersion: '1.0.0', sessionType: 'first_visit', events: [viewed('home', 5000), moved('home', 'plan_purchase'), viewed('plan_purchase', 9000)] },
  { id: 'd', date: '2026-10-26', platform: 'ios', appVersion: '1.1.0', sessionType: 'first_visit', events: [viewed('home', 4000), moved('home', 'questionnaire'), viewed('questionnaire', 12000)] },
  { id: 'e', date: '2026-10-28', platform: 'android', appVersion: '1.0.0', sessionType: 'returning', events: [viewed('home', 7000), moved('home', 'plan_day'), viewed('plan_day', 25000), moved('plan_day', 'feedback'), viewed('feedback', 11000)] },
  { id: 'f', date: '2026-10-29', platform: 'android', appVersion: '1.0.0', sessionType: 'returning', events: [viewed('home', 3000), moved('home', 'plan_day'), viewed('plan_day', 18000)] },
]

export const platforms = { all: 'همهٔ سکوها', android: 'اندروید', ios: 'iOS', web: 'وب' } as const
export const versions = ['all', '1.0.0', '1.1.0'] as const
export type SessionType = 'first_visit' | 'returning'
export type JourneyQuery = { from: string; to: string; platform: string; appVersion: string; sessionType: SessionType }

export type JourneyEdge = { fromScreenId: string; toScreenId: string; count: number; percent: number | null }
export type JourneyReport = {
  status: 'invalid' | 'empty' | 'ready' | 'too_large'
  sessions: number
  nodes: Array<{ screenId: string; count: number }>
  edges: JourneyEdge[]
  journeys: Array<{ path: string; count: number; percent: number | null }>
  entries: Array<{ screenId: string; count: number }>
  exits: Array<{ screenId: string; count: number }>
  dropOff: Array<{ screenId: string; count: number; visits: number; percent: number | null }>
  active: Array<{ screenId: string; milliseconds: number }>
}

const empty = (status: Exclude<JourneyReport['status'], 'ready'>): JourneyReport => ({
  status, sessions: 0, nodes: [], edges: [], journeys: [], entries: [], exits: [], dropOff: [], active: [],
})

function percent(count: number, total: number) {
  return total ? Math.round((100 * count) / total) : null
}

export function screenLabel(screenId: string) {
  return screenLabels[screenId] ?? screenId
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? value as Record<string, unknown> : null
}

function listed<T>(value: unknown, map: (row: Record<string, unknown>) => T | null): T[] {
  return Array.isArray(value) ? value.flatMap((item) => {
    const row = asRecord(item)
    const mapped = row ? map(row) : null
    return mapped ? [mapped] : []
  }) : []
}

export function journeyReportFromApi(payload: unknown): JourneyReport {
  const record = asRecord(payload)
  const status = record?.status === 'invalid' || record?.status === 'empty' || record?.status === 'ready' || record?.status === 'too_large' ? record.status : 'empty'
  if (!record || status !== 'ready') return empty(status === 'ready' ? 'empty' : status)
  const screen = (row: Record<string, unknown>) => {
    const screenId = typeof row.screenId === 'string' ? row.screenId : typeof row.screen === 'string' ? row.screen : ''
    return screenId && typeof row.count === 'number' ? { screenId, count: row.count } : null
  }
  return {
    status,
    sessions: typeof record.sessions === 'number' ? record.sessions : 0,
    nodes: listed(record.nodes, screen),
    edges: listed(record.edges, (row) => {
      const fromScreenId = typeof row.fromScreenId === 'string' ? row.fromScreenId : ''
      const toScreenId = typeof row.toScreenId === 'string' ? row.toScreenId : ''
      return fromScreenId && toScreenId && typeof row.count === 'number' ? { fromScreenId, toScreenId, count: row.count, percent: typeof row.percent === 'number' ? row.percent : null } : null
    }),
    journeys: listed(record.journeys, (row) => typeof row.path === 'string' && typeof row.count === 'number' ? { path: row.path, count: row.count, percent: typeof row.percent === 'number' ? row.percent : null } : null),
    entries: listed(record.entries, screen),
    exits: listed(record.exits, screen),
    dropOff: listed(record.dropOff, (row) => {
      const base = screen(row)
      return base && typeof row.visits === 'number' ? { ...base, visits: row.visits, percent: typeof row.percent === 'number' ? row.percent : null } : null
    }),
    active: listed(record.active, (row) => typeof row.screenId === 'string' && typeof row.milliseconds === 'number' ? { screenId: row.screenId, milliseconds: row.milliseconds } : null),
  }
}

export function journeyReport(query: JourneyQuery, source = sessions): JourneyReport {
  const { from, to, platform, appVersion, sessionType } = query
  if (!from || !to || from > to || (sessionType !== 'first_visit' && sessionType !== 'returning')) return empty('invalid')
  const rows = source.filter((item) => item.date >= from && item.date <= to && (platform === 'all' || item.platform === platform) && (appVersion === 'all' || item.appVersion === appVersion) && item.sessionType === sessionType)
  if (!rows.length) return empty('empty')
  const visits = new Map<string, number>()
  const active = new Map<string, number>()
  const exits = new Map<string, number>()
  const entries = new Map<string, number>()
  const edges = new Map<string, number>()
  const paths = new Map<string, number>()
  for (const item of rows) {
    const screens = item.events.filter((event) => event.type === 'screen_viewed')
    const path = screens.map((event) => event.screenId).join(' → ')
    paths.set(path, (paths.get(path) ?? 0) + 1)
    const first = screens[0]
    const last = screens.at(-1)
    if (first) entries.set(first.screenId, (entries.get(first.screenId) ?? 0) + 1)
    if (last) exits.set(last.screenId, (exits.get(last.screenId) ?? 0) + 1)
    for (const event of screens) {
      visits.set(event.screenId, (visits.get(event.screenId) ?? 0) + 1)
      active.set(event.screenId, (active.get(event.screenId) ?? 0) + event.activeMs)
    }
    for (const event of item.events) {
      if (event.type !== 'navigation') continue
      const key = `${event.fromScreenId}\t${event.toScreenId}`
      edges.set(key, (edges.get(key) ?? 0) + 1)
    }
  }
  const outgoing = new Map<string, number>()
  for (const [key, count] of edges) {
    const fromScreen = key.split('\t')[0] ?? ''
    outgoing.set(fromScreen, (outgoing.get(fromScreen) ?? 0) + count)
  }
  const ranked = (map: Map<string, number>) => [...map].map(([screenId, count]) => ({ screenId, count, percent: percent(count, rows.length) })).sort((a, b) => b.count - a.count)
  return {
    status: 'ready',
    sessions: rows.length,
    nodes: [...visits].map(([screenId, count]) => ({ screenId, count })).sort((a, b) => b.count - a.count),
    edges: [...edges].map(([key, count]) => {
      const [fromScreenId, toScreenId] = key.split('\t')
      return { fromScreenId: fromScreenId ?? '', toScreenId: toScreenId ?? '', count, percent: percent(count, outgoing.get(fromScreenId ?? '') ?? 0) }
    }).sort((a, b) => b.count - a.count || a.fromScreenId.localeCompare(b.fromScreenId)),
    journeys: [...paths].map(([path, count]) => ({ path, count, percent: percent(count, rows.length) })).sort((a, b) => b.count - a.count || a.path.localeCompare(b.path)),
    entries: ranked(entries),
    exits: ranked(exits),
    dropOff: [...exits].map(([screenId, count]) => ({ screenId, count, visits: visits.get(screenId) ?? 0, percent: percent(count, visits.get(screenId) ?? 0) })).sort((a, b) => (b.percent ?? -1) - (a.percent ?? -1)),
    active: [...active].map(([screenId, milliseconds]) => ({ screenId, milliseconds })).sort((a, b) => b.milliseconds - a.milliseconds),
  }
}
