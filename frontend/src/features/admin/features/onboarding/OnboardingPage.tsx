import { useDeferredValue, useEffect, useRef, useState, type ReactNode } from 'react'
import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query'
import { asRecord, asRows, formatFaDate, formatFaNumber, statusLabels, toEnglishDigits } from '@shared/utils'
import { AdminIcon as Icon } from '../../components/AdminIcon'
import { staff } from '../../session'
import { demoProfiles, demoLeads, demoFunnel } from './preview'
import '../users/users.css'
import './onboarding.css'

type Row = Record<string, unknown>
type Columns = readonly [string, (row: Row) => ReactNode][]
const root = 'admin/onboarding'
const goals: Record<string, string> = { weight_loss: 'کاهش وزن', weight_gain: 'افزایش وزن', pregnancy: 'بارداری و شیردهی', detox: 'پاکسازی و تعادل' }
const sources: Record<string, string> = { app: 'اپلیکیشن', demo: 'آنبوردینگ وب' }
const tiers: Record<string, string> = { ai_ok: 'مناسب پیش‌نویس AI', doctor_only: 'فقط پزشک' }
const diets: Record<string, string> = { omnivore: 'همه‌چیزخوار', vegetarian: 'گیاه‌خوار', vegan: 'وگان' }
const allergens = { gluten: 'گلوتن', dairy: 'لبنیات', nuts: 'آجیل', egg: 'تخم‌مرغ', seafood: 'غذای دریایی', soy: 'سویا', sesame: 'کنجد' }
const tabs = [['profiles', 'پروفایل‌ها'], ['funnel', 'قیف ثبت‌نام'], ['leads', 'سرنخ‌های دمو']] as const
const stages = [
  ['onboardingLeads', 'سرنخ آنبوردینگ وب'], ['onboardingVerified', 'تلفن تأییدشده', 'onboardingLeads'],
  ['onboardingClaimed', 'ورود به اپ', 'onboardingVerified'], ['drafts', 'در حال تکمیل (پیش‌نویس باز)'],
  ['profiles', 'پروفایل کامل'], ['consented', 'رضایت‌نامه', 'profiles'],
  ['requests', 'درخواست برنامه', 'consented'], ['published', 'برنامهٔ منتشرشده', 'requests'],
] as const
const show = (value: unknown) => String(value ?? '') || '—'
const label = (names: Record<string, string>, value: unknown) => names[String(value)] ?? show(value)
const number = (value: unknown) => value == null ? '—' : formatFaNumber(Number(value))
const date = (value: unknown) => formatFaDate(value) ?? '—'
const list = (value: unknown) => Array.isArray(value) ? value.map(show).join('، ') || '—' : show(value)
const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'دریافت اطلاعات انجام نشد.'

function Badge({ good, children }: { good: boolean; children: ReactNode }) {
  return <span className="onboarding-badge" data-good={good}><i aria-hidden="true" />{children}</span>
}

function Search({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="users-search"><Icon name="search" /><span className="sr-only">{label}</span>
    <input type="search" placeholder={label + '…'} value={value} onChange={event => onChange(event.target.value)} />
  </label>
}

function Table({ title, description, rows, columns, pageSize, search, rowKey }: {
  title: string; description?: string; rows: Row[]; columns: Columns; pageSize: number; search?: (resetPage: () => void) => ReactNode; rowKey: (row: Row) => string
}) {
  const [page, setPage] = useState(1)
  const last = Math.max(1, Math.ceil(rows.length / pageSize))
  const current = Math.min(page, last)
  const start = (current - 1) * pageSize
  const visible = rows.slice(start, start + pageSize)
  return <section className="users-table-card onboarding-card" aria-label={title}>
    <header className="onboarding-card-heading"><div><h2>{title}</h2>{description && <p>{description}</p>}</div></header>
    {search && <div className="users-toolbar">{search(() => setPage(1))}</div>}
    <div className="users-table-scroll" role="region" tabIndex={0} aria-label={`جدول ${title}`}>
      <table><thead><tr>{columns.map(([heading]) => <th key={heading} scope="col">{heading || <span className="sr-only">جزئیات</span>}</th>)}</tr></thead>
        <tbody>
          {visible.map(row => <tr key={rowKey(row)}>{columns.map(([heading, render]) => <td key={heading}>{render(row)}</td>)}</tr>)}
          {!visible.length && <tr><td colSpan={columns.length} className="users-empty">موردی برای نمایش یافت نشد.</td></tr>}
        </tbody>
      </table>
    </div>
    <footer className="users-pagination"><span role="status">{rows.length ? `${number(start + 1)} تا ${number(start + visible.length)} از ${number(rows.length)} مورد` : '۰ مورد'}</span>
      <div><button type="button" className="users-page-button" disabled={current === 1} onClick={() => setPage(current - 1)}><Icon name="chevron-right" />قبلی</button>
        <span className="users-current" aria-current="page">{number(current)}</span>
        <button type="button" className="users-page-button" disabled={current === last} onClick={() => setPage(current + 1)}>بعدی<Icon name="chevron-left" /></button></div>
    </footer>
  </section>
}

function Pending({ error, retry }: { error: unknown; retry: () => void }) {
  return <div className="users-table-card onboarding-message">{error ? <>
    <p role="alert">{errorMessage(error)}</p><button type="button" className="secondary" onClick={retry}>تلاش دوباره</button>
  </> : <p role="status">در حال دریافت…</p>}</div>
}

function useOnboardingList(endpoint: string, params: string, previewRows?: Row[]) {
  return useInfiniteQuery({
    queryKey: ['admin-onboarding', endpoint, params, previewRows !== undefined],
    initialPageParam: '',
    queryFn: async ({ pageParam }) => {
      if (previewRows) return { items: previewRows, cursor: '' }
      const query = new URLSearchParams(params)
      if (pageParam) query.set('cursor', pageParam)
      const payload = asRecord(await staff.api(`${root}/${endpoint}?${query}`))
      return { items: asRows(payload?.items), cursor: typeof payload?.nextCursor === 'string' ? payload.nextCursor : '' }
    },
    getNextPageParam: last => last.cursor || undefined,
  })
}

function LoadMore({ query }: { query: ReturnType<typeof useOnboardingList> }) {
  if (!query.hasNextPage) return null
  return <div>{query.isFetchNextPageError && <p role="alert">{errorMessage(query.error)}</p>}
    <button type="button" className="secondary" disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>
      {query.isFetchingNextPage ? 'در حال دریافت…' : 'بارگذاری بیشتر'}
    </button>
  </div>
}

function DetailSection({ title, entries }: { title: string; entries: [string, ReactNode][] }) {
  const visible = entries.filter(([, value]) => value != null && value !== '—' && value !== '')
  if (!visible.length) return null
  return <section><h3>{title}</h3><dl>{visible.map(([name, value], index) => <div key={`${name}-${index}`}><dt>{name}</dt><dd>{value}</dd></div>)}</dl></section>
}

function ProfileDetail({ row, preview, close }: { row: Row; preview: boolean; close: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [previewOpening, setPreviewOpening] = useState(preview)
  useEffect(() => { const element = dialog.current; element?.showModal(); return () => element?.close() }, [])
  useEffect(() => {
    if (!preview) return
    const timer = window.setTimeout(() => setPreviewOpening(false), 420)
    return () => window.clearTimeout(timer)
  }, [preview])
  const query = useQuery({
    queryKey: ['admin-onboarding', 'detail', row.userId, preview],
    queryFn: async () => preview ? {
      name: row.name, phone: row.phone,
      profile: { ...row, sex: 'female', heightCm: 165, weightKg: 72, targetWeightKg: 68, bmrKcal: 1415, tdeeKcal: 2497,
        proteinG: 108, carbsG: 235, fatG: 56, dietStyle: 'vegan', mealsPerDay: 3, budget: 'انعطاف‌پذیر' },
      submission: { answers: { sex: 'female', goal: row.track, preference: 'vegan', cooking: 'under_30' } },
      planRequests: [{ id: 'preview-request-001', created_at: row.updatedAt, status: 'queued' }],
    } :
      asRecord(await staff.api(`${root}/profiles/${encodeURIComponent(String(row.userId))}`)),
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
  const data = asRecord(query.data)
  const profile = asRecord(data?.profile) ?? {}
  const answers = asRecord(asRecord(data?.submission)?.answers) ?? {}
  const withUnit = (value: unknown, unit: string) => value == null ? null : `${number(value)} ${unit}`
  const macros = [['پروتئین', profile.proteinG], ['کربوهیدرات', profile.carbsG], ['چربی', profile.fatG]]
    .filter(([, value]) => value != null).map(([name, value]) => `${name} ${number(value)} گرم`).join(' · ')
  const textAnswers: [string, string][] = Object.entries(answers).flatMap(([name, value]) => typeof value === 'string' && value.trim() ? [[name, value]] : [])
  const requests = asRows(data?.planRequests)
  const loading = query.isPending || previewOpening
  return <dialog ref={dialog} className="onboarding-detail" aria-labelledby="onboarding-detail-title"
    onCancel={event => { event.preventDefault(); close() }}>
    <header>
      <h2 id="onboarding-detail-title"><span className="icon-tile tone-green"><Icon name="users" /></span>پروندهٔ تغذیه‌ای</h2>
      <button type="button" className="icon-button" aria-label="بستن" onClick={close}><Icon name="close" /></button>
    </header>
    <div className="onboarding-detail-body" aria-busy={loading}>
      {loading ? <div className="onboarding-detail-skeleton" role="status">
        <span className="sr-only">در حال دریافت پروندهٔ تغذیه‌ای</span>
        {Array.from({ length: 5 }, (_, index) => <div key={index} aria-hidden="true" />)}
      </div> : query.isError ? <Pending error={query.error} retry={() => void query.refetch()} /> : <>
        <p className="info-note"><Icon name="info" />{preview ? 'این پرونده حاوی داده‌های آزمایشی است.' :
          'مشاهدهٔ این اطلاعات در تاریخچهٔ فعالیت ثبت شد. شمارهٔ تماس و پاسخ‌های متنی فقط برای بررسی بالینی هستند.'}</p>
        <DetailSection title={data?.name ? show(data.name) : 'بدون نام'} entries={[
          ['تلفن', data?.phone ? <bdi dir="ltr">{show(data.phone)}</bdi> : null], ['هدف', label(goals, profile.track)],
          ['منبع', label(sources, profile.source)], ['سطح ایمنی', label(tiers, profile.safetyTier)], ['دلایل ایمنی', list(profile.safetyReasons)],
        ]} />
        <DetailSection title="بدن و انرژی" entries={[
          ['جنسیت', label({ male: 'مرد', female: 'زن' }, profile.sex)], ['سن', number(profile.age)], ['قد', withUnit(profile.heightCm, 'سانتی‌متر')],
          ['وزن', withUnit(profile.weightKg, 'کیلوگرم')], ['وزن هدف', withUnit(profile.targetWeightKg, 'کیلوگرم')], ['BMI', number(profile.bmi)],
          ['BMR', withUnit(profile.bmrKcal, 'کیلوکالری')], ['TDEE', withUnit(profile.tdeeKcal, 'کیلوکالری')],
          ['هدف روزانه', withUnit(profile.targetKcal, 'کیلوکالری')], ['درشت‌مغذی‌ها', macros],
        ]} />
        <DetailSection title="تغذیه" entries={[
          ['سبک', label(diets, profile.dietStyle)], ['تعداد وعده', number(profile.mealsPerDay)], ['بودجه', show(profile.budget)],
          ['منطقه', show(profile.region)], ['آلرژی‌ها', list(profile.allergens)], ['بیماری‌ها', list(profile.conditions)], ['پرچم‌های خطر', list(profile.riskFlags)],
        ]} />
        <DetailSection title="پاسخ‌های متنی کاربر" entries={textAnswers} />
        <DetailSection title="درخواست‌های برنامه" entries={requests.map(request => [date(request.created_at), label(statusLabels, request.status)])} />
      </>}
    </div>
  </dialog>
}

const selectors = [
  ['track', 'همهٔ اهداف', goals], ['tier', 'همهٔ سطوح ایمنی', tiers],
  ['source', 'همهٔ منابع', sources], ['allergen', 'همهٔ آلرژی‌ها', allergens],
] as const

function Profiles({ preview }: { preview: boolean }) {
  const [filters, setFilters] = useState({ track: '', tier: '', source: '', allergen: '' })
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Row | null>(null)
  const term = useDeferredValue(search.trim())
  const params = new URLSearchParams({ limit: '50' })
  for (const [key, value] of Object.entries({ ...filters, q: term })) if (value) params.set(key, value)
  const fixture = preview ? demoProfiles.filter(row => (!filters.track || row.track === filters.track)
    && (!filters.tier || row.safetyTier === filters.tier) && (!filters.source || row.source === filters.source)
    && (!filters.allergen || row.allergens.includes(filters.allergen)) && row.name.includes(term)) : undefined
  const query = useOnboardingList('profiles', params.toString(), fixture)
  const rows = query.data?.pages.flatMap(page => page.items) ?? []
  const columns: Columns = [
    ['کاربر', row => <div className="users-person"><span className="users-avatar" aria-hidden="true">{show(row.name).trim()[0]}</span>
      <div><strong>{row.name ? show(row.name) : 'بدون نام'}</strong><small dir="ltr">{show(row.phone)}</small></div></div>],
    ['هدف', row => label(goals, row.track)], ['منبع', row => label(sources, row.source)],
    ['سن/BMI', row => `${number(row.age)} · ${number(row.bmi)}`], ['کالری هدف', row => number(row.targetKcal)],
    ['ایمنی', row => <Badge good={row.safetyTier === 'ai_ok'}>{label(tiers, row.safetyTier)}</Badge>],
    ['ریسک‌ها', row => list(row.riskFlags)], ['رضایت', row => row.consented ? 'ثبت‌شده' : '—'],
    ['به‌روزرسانی', row => <span className="onboarding-nowrap">{date(row.updatedAt)}</span>],
    ['', row => <button type="button" className="secondary" onClick={() => setSelected(row)}><Icon name="chevron-left" />جزئیات</button>],
  ]
  return <>
    <div className="onboarding-filters">
      {selectors.map(([key, title, options]) => <select key={key} aria-label={title} value={filters[key]} onChange={event => setFilters({ ...filters, [key]: event.target.value })}>
        <option value="">{title}</option>{Object.entries(options).map(([value, name]) => <option key={value} value={value}>{name}</option>)}
      </select>)}
      <Search label="جست‌وجوی نام کاربر" value={search} onChange={setSearch} />
    </div>
    {!query.data ? <Pending error={query.error} retry={() => void query.refetch()} /> : <>
      <Table key={params.toString()} title="پروفایل‌های تغذیه‌ای" description={`${number(rows.length)} پروفایل بارگذاری شد`}
        rows={rows} columns={columns} pageSize={15} rowKey={row => String(row.userId)} />
      <LoadMore query={query} />
    </>}
    {selected && <ProfileDetail row={selected} preview={preview} close={() => setSelected(null)} />}
  </>
}

function Funnel({ preview }: { preview: boolean }) {
  const query = useQuery({ queryKey: ['admin-onboarding', 'funnel', preview], queryFn: async () => preview ? demoFunnel : asRecord(await staff.api(root + '/funnel')) })
  const refresh = useMutation({
    mutationFn: async () => { if (!preview) await staff.api(root + '/funnel/refresh', 'POST') },
    onSuccess: () => query.refetch(),
  })
  if (query.isPending || query.isError) return <Pending error={query.error} retry={() => void query.refetch()} />
  const data = asRecord(query.data) ?? {}
  const counts = asRecord(data.stages) ?? {}
  const maximum = Math.max(1, ...stages.map(([key]) => Number(counts[key] ?? 0)))
  const columns: Columns = [
    ['روز', row => <bdi>{show(row.day)}</bdi>], ['هدف', row => label(goals, row.track)], ['منبع', row => label(sources, row.source)],
    ['پروفایل', row => number(row.profiles)], ['میانگین BMI', row => number(row.avg_bmi)], ['فقط پزشک', row => number(row.doctor_only)],
  ]
  return <>
    <section className="users-table-card onboarding-card">
      <header className="onboarding-card-heading"><div><h2>قیف از دموی وب تا برنامهٔ تأییدشده</h2><p>هر مرحله شمارش یکتا از دیتابیس است.</p></div>
        <button type="button" className="secondary" disabled={preview || refresh.isPending} onClick={() => refresh.mutate()}>
          <Icon name="history" />{refresh.isPending ? 'در حال تازه‌سازی…' : 'تازه‌سازی نمودار روزانه'}
        </button>
      </header>
      {refresh.isError && <p role="alert" className="onboarding-message">{errorMessage(refresh.error)}</p>}
      <ul className="onboarding-funnel">{stages.map(([key, title, previous]) => {
        const count = Number(counts[key] ?? 0)
        const baseline = previous ? Number(counts[previous] ?? 0) : 0
        return <li key={key}><strong>{title}</strong><div aria-hidden="true" className="onboarding-bar"><span style={{ inlineSize: `${count / maximum * 100}%` }} /></div>
          <span>{number(count)}{baseline > 0 && ` · ${number(Math.round(count / baseline * 100))}٪ از مرحلهٔ قبل`}</span></li>
      })}</ul>
    </section>
    <section className="users-table-card onboarding-card onboarding-doctor">
      <div><h2>فقط پزشک</h2><span className="icon-tile tone-rose"><Icon name="users" /></span></div>
      <strong>{number(counts.doctorOnly)}</strong><p>پروفایل‌هایی که پیش‌نویس AI ندارند و مستقیم به پزشک می‌روند.</p>
    </section>
    <Table title="ثبت‌نام روزانه" rows={asRows(data.daily)} columns={columns} pageSize={10} rowKey={row => [row.day, row.track, row.source].join('/')} />
  </>
}

function Leads({ preview }: { preview: boolean }) {
  const [search, setSearch] = useState('')
  const query = useOnboardingList('onboarding-leads', 'limit=100', preview ? demoLeads : undefined)
  const term = toEnglishDigits(search.trim())
  const rows = (query.data?.pages.flatMap(page => page.items) ?? []).filter(row => [show(row.phone), label(goals, row.goal)].some(value => toEnglishDigits(value).includes(term)))
  const columns: Columns = [
    ['تلفن', row => <bdi dir="ltr">{show(row.phone)}</bdi>], ['هدف', row => label(goals, row.goal)],
    ['تأیید تلفن', row => <Badge good={!!row.phoneVerified}>{row.phoneVerified ? 'تأییدشده' : 'تأییدنشده'}</Badge>],
    ['انتقال به اپ', row => <Badge good={!!row.claimedUserId}>{row.claimedUserId ? 'وارد اپ شد' : 'منتظر ورود'}</Badge>],
    ['زمان ثبت', row => date(row.createdAt)],
  ]
  if (!query.data) return <Pending error={query.error} retry={() => void query.refetch()} />
  return <>
    <Table title="سرنخ‌های دموی وب" description="کاربرانی که در دمو پرسش‌نامه را پر کرده‌اند. با ورود با همان شماره، پاسخ‌ها خودکار به اپ منتقل می‌شود."
      rows={rows} columns={columns} pageSize={12} rowKey={row => String(row.id)} search={resetPage => <Search label="جست‌وجو در سرنخ‌های دموی وب" value={search}
        onChange={value => { setSearch(value); resetPage() }} />} />
    <LoadMore query={query} />
  </>
}

export function OnboardingPage({ preview }: { preview: boolean }) {
  const [active, setActive] = useState(0)
  const tabButtons = useRef<(HTMLButtonElement | null)[]>([])
  return <div className="onboarding-admin">
    <div role="tablist" aria-label="ثبت‌نام و پروفایل‌ها" className="onboarding-tabs"
      onKeyDown={event => {
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 :
          event.key === 'ArrowLeft' ? (active + 1) % tabs.length : event.key === 'ArrowRight' ? (active + tabs.length - 1) % tabs.length : null
        if (next === null) return
        event.preventDefault()
        setActive(next)
        tabButtons.current[next]?.focus()
      }}>
      {tabs.map(([key, title], index) => <button key={key} ref={element => { tabButtons.current[index] = element }} type="button"
        role="tab" id={`ob-tab-${key}`} aria-controls={`ob-panel-${key}`} aria-selected={active === index} tabIndex={active === index ? 0 : -1}
        onClick={() => setActive(index)}>{title}</button>)}
    </div>
    {tabs.map(([key], index) => <div key={key} id={`ob-panel-${key}`} role="tabpanel" aria-labelledby={`ob-tab-${key}`} hidden={active !== index}>
      {active === index && <div className="onboarding-stack">{key === 'profiles' ? <Profiles preview={preview} /> : key === 'funnel' ? <Funnel preview={preview} /> : <Leads preview={preview} />}</div>}
    </div>)}
  </div>
}
