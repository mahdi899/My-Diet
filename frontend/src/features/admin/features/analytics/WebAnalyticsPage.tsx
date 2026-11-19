import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { StaffError } from '@shared/api/staff-session'
import { asRecord, asRows, formatFaNumber } from '@shared/utils'
import { AdminIcon as Icon } from '../../components/AdminIcon'
import { staff } from '../../session'
import { campaignLinksQuery } from '../campaigns/campaign-links'
import '../campaigns/campaign-links.css'
import './web-analytics.css'

type Session = { id: string; page: string; step: string; campaign: string; lastSeen: string; phone: string; paid?: boolean; reachedPayment?: boolean }
type Goal = { goal: string; clicks: number; visits: number; percent: number }
type Exit = { step: string; visits: number; percent: number }
type Source = { source: string; campaign: string; visits: number }
type StageTiming = { step: string; views: number; averageSeconds: number }
type Report = { visits: number; goals: Goal[]; exits: Exit[]; funnel: Exit[]; stages: StageTiming[]; sources: Source[] }

const goals: Record<string, string> = { weight_loss: 'لاغری', weight_gain: 'افزایش وزن', pregnancy: 'بارداری و شیردهی', detox: 'سلامت و پاکسازی' }
const pages: Record<string, string> = { '/onboarding/': 'شروع', '/onboarding': 'شروع', '/onboarding/goals.html': 'اهداف', '/onboarding/goals': 'اهداف', '/onboarding/quiz.html': 'پرسش‌نامه', '/onboarding/quiz': 'پرسش‌نامه', '/onboarding/payment.html': 'پرداخت', '/onboarding/payment': 'پرداخت' }
const steps: Record<string, string> = { intro: 'شروع', goals: 'انتخاب هدف', quiz: 'شروع پرسش‌نامه', preparing: 'آماده‌سازی برنامه', specialists: 'انتخاب پزشک', otp: 'وارد کردن کد تأیید', payment_gateway: 'پرداخت آنلاین', payment_transfer: 'کارت‌به‌کارت', payment_success: 'پرداخت تأیید شد', plans: 'انتخاب برنامه', contact: 'ثبت شماره', payment: 'پرداخت' }
const previewLinks = [{ slug: 'hale', name: 'hale' }, { slug: 'telegram', name: 'تلگرام' }, { slug: 'instagram', name: 'اینستا' }]
const milestones: Record<string, string> = { entry: 'ورود به آنبوردینگ', goals: 'دیدن هدف‌ها', quiz: 'شروع پرسش‌نامه', completed: 'تکمیل پرسش‌نامه', plans: 'دیدن پلن‌ها', contacted: 'ثبت شماره', registered: 'تأیید شماره', payment: 'رسیدن به پرداخت', paid: 'پرداخت تأییدشده' }
const pageSize = 10
const fa = (value: number) => formatFaNumber(value)

function stepLabel(step: string) {
  if (steps[step]) return steps[step]
  const parts = step.split(':')
  return parts[0] === 'question' ? `سؤال ${fa(Number(parts[2] ?? 0))} · ${goals[parts[1] ?? ''] ?? parts[1]}` : step || '—'
}
function pageLabel(page: string) { return pages[page] ?? page }
function phoneLabel(phone: string) { return !phone ? '—' : phone.startsWith('+98') ? `0${phone.slice(3)}` : phone }
function seenLabel(value: string, withDate: boolean) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('fa-IR', { timeZone: 'Asia/Tehran', timeStyle: 'medium', ...(withDate ? { dateStyle: 'short' } : {}) })
}

const liveSessions: Session[] = ([
  ['c5e7a1b2', '/onboarding/', 'intro', '', ''],
  ['a91c33d0', '/onboarding/goals.html', 'goals', '', ''],
  ['b70e14aa', '/onboarding/quiz.html', 'question:weight_loss:1', '', ''],
  ['d4f20891', '/onboarding/quiz.html', 'question:detox:3', 'hale', ''],
  ['e12ab670', '/onboarding/', 'intro', '', ''],
  ['f88c0d33', '/onboarding/goals.html', 'goals', '', ''],
  ['91aa77c1', '/onboarding/quiz.html', 'quiz', '', ''],
  ['66b1e904', '/onboarding/quiz.html', 'question:weight_loss:4', '', ''],
  ['30c8d512', '/onboarding/', 'intro', 'instagram', ''],
  ['77e4a0b8', '/onboarding/goals.html', 'goals', '', ''],
  ['ab19c6e2', '/onboarding/quiz.html', 'question:weight_gain:2', '', ''],
  ['c0d73f41', '/onboarding/payment.html', 'plans', '', ''],
  ['58a2bb10', '/onboarding/', 'intro', '', ''],
  ['e6d19077', '/onboarding/quiz.html', 'question:pregnancy:1', 'hale', ''],
  ['19f4c8aa', '/onboarding/goals.html', 'goals', '', ''],
  ['b3a75d09', '/onboarding/quiz.html', 'specialists', '', ''],
] as const).map(([id, page, step, campaign, phone], index) => ({
  id, page, step, campaign, phone, lastSeen: new Date(Date.now() - index * 45_000).toISOString(),
}))

const departedSessions: Session[] = liveSessions.map((session, index) => ({
  ...session, id: `d${session.id.slice(1)}`, campaign: session.campaign || 'hale', lastSeen: new Date(Date.now() - (index + 3) * 3600_000).toISOString(), reachedPayment: session.step === 'plans',
}))

const sampleReport: Report = {
  visits: 424,
  stages: [{ step: 'intro', views: 424, averageSeconds: 14 }, { step: 'goals', views: 269, averageSeconds: 8.6 }, { step: 'question:weight_loss:1', views: 132, averageSeconds: 12.3 }],
  funnel: Object.keys(milestones).map((step, index) => {
    const visits = [424, 269, 215, 137, 104, 89, 78, 56, 23][index] ?? 0
    return { step, visits, percent: Math.round(visits / 424 * 1000) / 10 }
  }),
  goals: [
    { goal: 'weight_loss', clicks: 199, visits: 163, percent: 67.7 },
    { goal: 'detox', clicks: 59, visits: 33, percent: 30.1 },
    { goal: 'weight_gain', clicks: 34, visits: 19, percent: 8.3 },
    { goal: 'pregnancy', clicks: 12, visits: 11, percent: 4.1 },
  ],
  exits: [
    ['intro', 155, 35.6], ['goals', 54, 12.4], ['specialists', 41, 9.4], ['quiz', 28, 6.4],
    ['question:weight_loss:1', 22, 5], ['plans', 18, 4.1], ['question:detox:2', 16, 3.7],
    ['question:weight_loss:4', 14, 3.2], ['preparing', 12, 2.8], ['otp', 9, 2.1],
    ['question:pregnancy:1', 8, 1.8], ['payment', 6, 1.4],
  ].map(([step, visits, percent]) => ({ step: String(step), visits: Number(visits), percent: Number(percent) })),
  sources: [
    ['instagram', 'hale', 25], ['direct', '', 64], ['com.google.android.googlequicksearchbox', 'PCI', 1],
    ['l.instagram.com', '', 1], ['sep.shaparak.ir', '', 1], ['telegram', 'telegram', 4],
    ['instagram', 'instagram', 6], ['google', '', 3], ['bale', '', 2], ['sms', 'hale', 2], ['whatsapp', '', 1], ['direct', 'hale', 8],
  ].map(([source, campaign, visits]) => ({ source: String(source), campaign: String(campaign), visits: Number(visits) })),
}

function previewReport(campaign: string, days: string): Report {
  const day = days === '1' ? 0.2 : days === '30' ? 3 : days === '90' ? 6 : 1
  const sources = campaign ? sampleReport.sources.filter((row) => row.campaign === campaign) : sampleReport.sources
  const matched = sources.reduce((sum, row) => sum + row.visits, 0)
  const share = (campaign && sampleReport.visits ? matched / sampleReport.visits : 1) * day
  const scale = (value: number) => Math.round(value * share)
  return {
    visits: scale(sampleReport.visits),
    funnel: sampleReport.funnel.map((row) => ({ ...row, visits: scale(row.visits) })),
    goals: sampleReport.goals.map((goal) => ({ ...goal, clicks: scale(goal.clicks), visits: scale(goal.visits) })),
    exits: sampleReport.exits.map((row) => ({ ...row, visits: scale(row.visits) })),
    stages: sampleReport.stages.map((row) => ({ ...row, views: scale(row.views) })),
    sources: sources.map((row) => ({ ...row, visits: Math.round(row.visits * day) })),
  }
}

function readSessions(payload: unknown): Session[] {
  const sessions = asRows(asRecord(payload)?.sessions)
  return sessions.flatMap((row) => typeof row.id === 'string' ? [{
    id: row.id, page: String(row.page ?? ''), step: String(row.step ?? ''), campaign: String(row.campaign ?? ''),
    lastSeen: String(row.lastSeen ?? ''), phone: String(row.phone ?? ''), paid: row.paid === true, reachedPayment: row.reachedPayment === true,
  }] : [])
}

function readReport(payload: unknown): Report {
  const record = asRecord(payload) ?? {}
  const summary = asRecord(record.summary) ?? {}
  const numberOf = (value: unknown) => typeof value === 'number' ? value : 0
  const readSteps = (value: unknown) => asRows(value).flatMap((row) => typeof row.step === 'string' ? [{ step: row.step, visits: numberOf(row.visits), percent: numberOf(row.percent) }] : [])
  return {
    visits: numberOf(summary.visits), funnel: readSteps(record.funnel),
    goals: asRows(record.goals).flatMap((row) => typeof row.goal === 'string' ? [{ goal: row.goal, clicks: numberOf(row.clicks), visits: numberOf(row.visits), percent: numberOf(row.percent) }] : []),
    exits: readSteps(record.exits),
    stages: asRows(record.stages).flatMap((row) => typeof row.step === 'string' ? [{ step: row.step, views: numberOf(row.views), averageSeconds: numberOf(row.averageSeconds) }] : []),
    sources: asRows(record.sources).flatMap((row) => typeof row.source === 'string' ? [{ source: row.source, campaign: String(row.campaign ?? ''), visits: numberOf(row.visits) }] : []),
  }
}

function DataTable({ title, description, searchLabel, headers, rows }: { title: string; description: string; searchLabel: string; headers: string[]; rows: ReactNode[][] }) {
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const filtered = rows.filter((row) => row.some((cell) => String(cell).toLocaleLowerCase('fa').includes(query.trim().toLocaleLowerCase('fa'))))
  const safePage = Math.min(page, Math.max(0, Math.ceil(filtered.length / pageSize) - 1))
  const visible = filtered.slice(safePage * pageSize, (safePage + 1) * pageSize)
  return (
    <section className="card data-panel">
      <div className="section-head"><div><h2>{title}</h2><p>{description}</p></div></div>
      <div className="table-toolbar"><div className="search-field"><Icon name="search" /><input type="search" aria-label={searchLabel} placeholder={searchLabel} value={query} onChange={(event) => { setQuery(event.target.value); setPage(0) }} /></div></div>
      <div className="table-wrap" tabIndex={0} role="region" aria-label={title}>
        <table>
          <thead><tr>{headers.map((header) => <th key={header} scope="col">{header}</th>)}</tr></thead>
          <tbody>{visible.length ? visible.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>) : <tr><td className="empty-cell" colSpan={headers.length}><div className="empty-state"><h3>{query ? 'نتیجه‌ای پیدا نشد' : 'داده‌ای ثبت نشده'}</h3><p>{query ? 'عبارت جستجو را تغییر دهید.' : 'پس از فعالیت کاربران، گزارش این بخش تکمیل می‌شود.'}</p></div></td></tr>}</tbody>
        </table>
      </div>
      <div className="campaign-footer">
        <span>{filtered.length ? `${fa(safePage * pageSize + 1)} تا ${fa(Math.min((safePage + 1) * pageSize, filtered.length))} از ${fa(filtered.length)} مورد` : '۰ مورد'}</span>
        <div className="campaign-pager">
          <button type="button" className="secondary" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}><Icon name="chevron-right" />قبلی</button>
          <span className="page-number">{fa(safePage + 1)}</span>
          <button type="button" className="secondary" disabled={(safePage + 1) * pageSize >= filtered.length} onClick={() => setPage(safePage + 1)}>بعدی<Icon name="chevron-left" /></button>
        </div>
      </div>
    </section>
  )
}

function SessionTable({ label, stepHeading, sessions, withDate, names }: { label: string; stepHeading: string; sessions: Session[]; withDate: boolean; names: Map<string, string> }) {
  return (
    <div className="tracking-live-table" role="region" aria-label={label}>
      <table>
        <thead><tr>{['نشست', 'لینک ورودی', 'صفحه', stepHeading, 'وضعیت پرداخت', 'شماره تلفن', 'آخرین فعالیت'].map((header) => <th key={header} scope="col">{header}</th>)}</tr></thead>
        <tbody>
          {sessions.length ? sessions.map((session) => (
            <tr key={session.id}>
              <td className="tracking-id">{session.id.slice(0, 8)}</td>
              <td>{names.get(session.campaign) || session.campaign || 'مستقیم / نامشخص'}</td>
              <td>{pageLabel(session.page)}</td>
              <td>{stepLabel(session.step)}</td>
              <td><span className="tracking-payment-status" data-state={session.paid ? 'paid' : session.reachedPayment ? 'pending' : 'none'}>{session.paid ? 'پرداخت شد' : session.reachedPayment ? 'تأیید نشده' : 'به پرداخت نرسید'}</span></td>
              <td className={session.phone ? 'tracking-id' : undefined}>{phoneLabel(session.phone)}</td>
              <td>{seenLabel(session.lastSeen, withDate)}</td>
            </tr>
          )) : <tr><td colSpan={7}>{label}</td></tr>}
        </tbody>
      </table>
    </div>
  )
}

function ResetDialog({ preview, close, done }: { preview: boolean; close: () => void; done: (message: string) => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => { const element = dialog.current; element?.showModal(); return () => element?.close() }, [])
  return (
    <dialog ref={dialog} className="campaign-dialog" aria-labelledby="tracking-reset-title" onCancel={(event) => { event.preventDefault(); if (!busy) close() }}>
      <header><h2 id="tracking-reset-title"><span className="icon-tile tone-green"><Icon name="history" /></span>ریست گزارش رهگیری</h2><button type="button" className="icon-button" aria-label="بستن" disabled={busy} onClick={close}><Icon name="close" /></button></header>
      <form onSubmit={async (event) => {
        event.preventDefault()
        if (preview) { done('در پیش‌نمایش داده‌های نمونه پاک نمی‌شوند.'); return }
        setBusy(true)
        try { await staff.api('admin/web-analytics/reset', 'POST', {}); done('گزارش رهگیری ریست شد') }
        catch (cause) { done(cause instanceof StaffError ? cause.message : 'ریست گزارش انجام نشد.') }
        finally { setBusy(false) }
      }}>
        <p>گزارش از همین لحظه دوباره شروع می‌شود. رویدادهای قبلی در گزارش نمایش داده نمی‌شوند.</p>
        <div className="campaign-dialog-actions"><button type="button" className="secondary" disabled={busy} onClick={close}>انصراف</button><button type="submit" disabled={busy}>{busy ? 'در حال انجام…' : 'ریست گزارش'}</button></div>
      </form>
    </dialog>
  )
}

export function WebAnalyticsPage({ preview }: { preview: boolean }) {
  const queryClient = useQueryClient()
  const [params, setParams] = useSearchParams()
  const requestedCampaign = params.get('campaign') ?? ''
  const campaign = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(requestedCampaign) && requestedCampaign.length <= 64 ? requestedCampaign : ''
  const [days, setDays] = useState('7')
  const [within, setWithin] = useState('24h')
  const [confirmReset, setConfirmReset] = useState(false)
  const [notice, setNotice] = useState('')
  const [outcome, setOutcome] = useState('all')
  const campaigns = useQuery({ ...campaignLinksQuery, enabled: !preview })
  const links = preview ? previewLinks : campaigns.data ?? []
  const names = new Map(links.map((link) => [link.slug, link.name]))
  const live = useQuery({
    queryKey: ['web-analytics-live', campaign],
    enabled: !preview,
    refetchInterval: 5000,
    queryFn: async () => readSessions(await staff.api(`admin/web-analytics/live${campaign ? `?campaign=${encodeURIComponent(campaign)}` : ''}`)),
  })
  const departed = useQuery({
    queryKey: ['web-analytics-departures', campaign, within],
    enabled: !preview,
    refetchInterval: 15000,
    queryFn: async () => readSessions(await staff.api(`admin/web-analytics/departures?includePaid=1&within=${within}${campaign ? `&campaign=${encodeURIComponent(campaign)}` : ''}`)),
  })
  const history = useQuery({
    queryKey: ['web-analytics-report', campaign, days],
    enabled: !preview,
    refetchInterval: 30000,
    queryFn: async () => readReport(await staff.api(`admin/web-analytics?days=${days}${campaign ? `&campaign=${encodeURIComponent(campaign)}` : ''}`)),
  })
  const liveRows = useMemo(() => (preview ? liveSessions : live.data ?? []).filter((session) => !campaign || session.campaign === campaign), [preview, live.data, campaign])
  const departedRows = useMemo(() => (preview ? departedSessions : departed.data ?? []).filter((session) => (!campaign || session.campaign === campaign)
    && (outcome === 'all' || (outcome === 'paid' && session.paid) || (outcome === 'pending' && session.reachedPayment && !session.paid) || (outcome === 'before' && !session.reachedPayment))), [preview, departed.data, campaign, outcome])
  const report = preview ? previewReport(campaign, days) : history.data
  const count = (step: string) => report?.funnel.find((row) => row.step === step)?.visits ?? 0
  const firstPageExits = report?.exits.find((row) => row.step === 'intro')?.visits ?? 0
  const topGoal = report?.goals[0]

  function selectCampaign(slug: string) {
    const next = new URLSearchParams(params)
    if (slug) next.set('campaign', slug)
    else next.delete('campaign')
    setParams(next, { replace: true })
  }

  return (
    <div className="tracking-page">
      <section className="card tracking-card tracking-overview">
        <div className="section-head"><div><h2>قیف فروش آنبوردینگ</h2><p>مسیر هر کمپین از ورود تا خرید</p></div></div>
        <div className="tracking-filters">
          <label>لینک ورودی<select aria-label="لینک ورودی" value={campaign} onChange={(event) => selectCampaign(event.target.value)}><option value="">همهٔ لینک‌ها و ورودهای مستقیم</option>{campaign && !names.has(campaign) && <option value={campaign}>{campaign}</option>}{links.map((link) => <option key={link.slug} value={link.slug}>{link.name} · /go/{link.slug}</option>)}</select></label>
          {campaign && <a href={`${preview ? 'https://my-diet.ir' : window.location.origin}/go/${campaign}`} target="_blank" rel="noreferrer" dir="ltr">/go/{campaign}</a>}
          <label>بازهٔ گزارش<select aria-label="بازهٔ گزارش" value={days} onChange={(event) => setDays(event.target.value)}>{[['1', '۲۴ ساعت اخیر'], ['7', '۷ روز اخیر'], ['30', '۳۰ روز اخیر'], ['90', '۹۰ روز اخیر']].map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>
        </div>
        {campaigns.isError && <p className="tracking-status" role="alert">فهرست لینک‌های کمپین دریافت نشد.</p>}
        {!preview && history.isLoading && <p className="tracking-status">در حال دریافت قیف فروش…</p>}
        {!preview && history.isError && <p className="tracking-status" role="alert">{history.error instanceof StaffError ? history.error.message : 'گزارش دریافت نشد.'}</p>}
        {report && <div className="tracking-overview-body">
          <div className="tracking-metrics">
            <section className="tracking-metric"><p>مسیرهای ثبت‌شده</p><strong>{fa(count('entry'))}</strong><span>{fa(firstPageExits)} توقف در صفحهٔ اول</span></section>
            <section className="tracking-metric"><p>رسیده به پرداخت</p><strong>{fa(count('payment'))}</strong><span>{fa(count('payment') - count('paid'))} پرداخت تأییدنشده</span></section>
            <section className="tracking-metric" data-highlight="true"><p>پرداخت تأییدشده</p><strong>{fa(count('paid'))}</strong><span>{fa(report.funnel.find((row) => row.step === 'paid')?.percent ?? 0)}٪ از مسیرها</span></section>
            <section className="tracking-metric"><p>محبوب‌ترین هدف</p><strong>{topGoal ? goals[topGoal.goal] ?? topGoal.goal : '—'}</strong><span>{topGoal ? `${fa(topGoal.visits)} مسیر` : 'هنوز هدفی انتخاب نشده'}</span></section>
          </div>
          <ol className="tracking-funnel" aria-label="مراحل قیف فروش">{report.funnel.map((row) => <li key={row.step}>
            <span>{milestones[row.step] ?? row.step}</span><div className="tracking-funnel-track" aria-hidden="true"><i style={{ inlineSize: `${row.percent}%` }} /></div><b>{fa(row.visits)}</b><small>{fa(row.percent)}٪</small>
          </li>)}</ol>
        </div>}
      </section>
      <section className="card tracking-card">
        <div className="section-head"><div><h2>کاربران آنلاین آنبوردینگ</h2><p>به‌روزرسانی هر ۵ ثانیه</p></div></div>
        {!live.isError && <p className="tracking-status">{preview || !live.isLoading ? `${fa(liveRows.length)} نشست فعال` : 'در حال دریافت نشست‌های فعال…'}</p>}
        {!preview && live.isError && <p className="tracking-status">{live.error instanceof StaffError ? live.error.message : 'دریافت موقعیت زنده کاربران ممکن نشد'}</p>}
        {(preview || live.isSuccess) && <SessionTable label={liveRows.length ? 'موقعیت زنده کاربران آنبوردینگ' : 'نشست فعالی برای این انتخاب وجود ندارد.'} stepHeading="مرحلهٔ فعلی" sessions={liveRows} withDate={false} names={names} />}
      </section>
      <section className="card tracking-card">
        <div className="section-head"><div><h2>نتیجهٔ نشست‌ها</h2><p>پرداخت‌های تأییدشده و آخرین مرحله پس از ۲ دقیقه بدون نشانهٔ حضور</p></div></div>
        <div className="tracking-filters">
          <label>بازهٔ زمانی<select aria-label="بازهٔ زمانی نتیجهٔ نشست‌ها" value={within} onChange={(event) => setWithin(event.target.value)}>{[['24h', '۲۴ ساعت اخیر'], ['7d', '۷ روز اخیر'], ['30d', '۳۰ روز اخیر']].map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>
          <label>نتیجه<select value={outcome} onChange={(event) => setOutcome(event.target.value)}><option value="all">همهٔ نتیجه‌ها</option><option value="paid">پرداخت تأییدشده</option><option value="pending">رسیده به پرداخت</option><option value="before">توقف قبل از پرداخت</option></select></label>
        </div>
        <p className="tracking-status">{departed.isError ? 'دریافت نتیجهٔ نشست‌ها ممکن نشد.' : preview || !departed.isLoading ? `${fa(departedRows.length)} نشست · حداکثر ۲۰۰ نشست اخیر` : 'در حال دریافت نتیجهٔ نشست‌ها…'}</p>
        {(preview || departed.isSuccess) && <SessionTable label={departedRows.length ? 'نتیجهٔ نشست‌ها' : 'نشستی با این فیلتر پیدا نشد.'} stepHeading="آخرین مرحله" sessions={departedRows} withDate names={names} />}
      </section>
      <details className="card tracking-history" open>
        <summary>جزئیات هدف‌ها، ریزش و ورودی‌ها</summary>
        <div className="tracking-history-body">
          <div className="tracking-filters">
            <button type="button" className="secondary tracking-reset" onClick={() => setConfirmReset(true)}><Icon name="history" />ریست داده‌ها</button>
          </div>
          {notice && <p className="campaign-notice" role="status">{notice}</p>}
          {report && <>
            {!report.visits && <div className="info-note"><Icon name="info" /><p>هنوز داده‌ای در این بازه ثبت نشده است. آمار فقط از زمان فعال‌سازی رهگیری جمع‌آوری می‌شود.</p></div>}
            <DataTable title="هدف‌های انتخاب‌شده" description="مرتب‌شده بر اساس تعداد مسیرهایی که هر هدف را انتخاب کردند." searchLabel="جستجو در هدف‌ها…" headers={['هدف', 'مسیر', 'تعداد انتخاب', 'سهم از کلیک‌ها']} rows={report.goals.map((goal) => [goals[goal.goal] ?? goal.goal, fa(goal.visits), fa(goal.clicks), `${fa(goal.percent)}٪`])} />
            <DataTable title="ریزش بر اساس صفحه و سؤال" description="آخرین مرحلهٔ مسیرهای بدون پرداخت تأییدشده، پس از ۲ دقیقه بدون نشانهٔ حضور." searchLabel="جستجو در ریزش کاربران…" headers={['صفحه / سؤال', 'مسیر ریزش‌کرده', 'سهم از ریزش‌ها']} rows={report.exits.map((row) => [stepLabel(row.step), fa(row.visits), `${fa(row.percent)}٪`])} />
            {report.stages.length > 0 && <DataTable title="زمان صرف‌شده در هر مرحله" description="میانگین زمان فعال ثبت‌شده در صفحه یا سؤال." searchLabel="جستجو در زمان مراحل…" headers={['صفحه / سؤال', 'دفعات نمایش', 'میانگین زمان فعال']} rows={report.stages.map((row) => [stepLabel(row.step), fa(row.views), row.averageSeconds ? `${fa(row.averageSeconds)} ثانیه` : '—'])} />}
            <DataTable title="کانال‌های ورودی" description="تفکیک بر اساس UTM و دامنهٔ ارجاع؛ مستقیم یعنی منبع قابل تشخیص نیست." searchLabel="جستجو در کانال‌های ورودی…" headers={['منبع', 'کمپین', 'نشست']} rows={report.sources.map((row) => [row.source === 'direct' ? 'مستقیم / نامشخص' : row.source, row.campaign || '—', fa(row.visits)])} />
          </>}
        </div>
      </details>
      {confirmReset && <ResetDialog preview={preview} close={() => setConfirmReset(false)} done={(message) => {
        setConfirmReset(false); setNotice(message)
        void queryClient.invalidateQueries({ predicate: ({ queryKey }) => String(queryKey[0]).startsWith('web-analytics-') })
      }} />}
    </div>
  )
}
