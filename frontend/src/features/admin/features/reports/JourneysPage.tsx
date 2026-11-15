import { FormEvent, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { StaffError } from '@shared/api/staff-session'
import { staff } from '../../session'
import { journeyReport, journeyReportFromApi, platforms, screenLabel, screenPlaces, versions, type JourneyQuery, type JourneyReport, type SessionType } from './journey-report'
import './user-reports.css'
import './journeys.css'

const initial: JourneyQuery = { from: '2026-10-01', to: '2026-10-31', platform: 'all', appVersion: 'all', sessionType: 'first_visit' }
const fa = (value: number) => new Intl.NumberFormat('fa-IR').format(value)

function Graph({ report }: { report: JourneyReport }) {
  return (
    <svg className="journey-graph" viewBox="0 0 560 260" role="img" aria-label="گراف گذار بین صفحه‌ها">
      {report.edges.length === 0 && <text x="20" y="40">گذاری برای رسم گراف ثبت نشده است.</text>}
      {report.edges.map((edge) => {
        const [x1, y1] = screenPlaces[edge.fromScreenId] ?? [40, 40]
        const [x2, y2] = screenPlaces[edge.toScreenId] ?? [200, 200]
        return (
          <g key={`${edge.fromScreenId}-${edge.toScreenId}`}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#1f6b4a" strokeWidth="2" />
            <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 8} textAnchor="middle">{fa(edge.count)} · {edge.percent == null ? '—' : `${fa(edge.percent)}٪`}</text>
          </g>
        )
      })}
      {report.nodes.map((node) => {
        const [x, y] = screenPlaces[node.screenId] ?? [40, 40]
        return (
          <g key={node.screenId}>
            <circle cx={x} cy={y} r="28" fill="#e7f2ea" stroke="#1f6b4a" />
            <text x={x} y={y - 4} textAnchor="middle">{screenLabel(node.screenId)}</text>
            <text x={x} y={y + 14} textAnchor="middle">{fa(node.count)}</text>
          </g>
        )
      })}
    </svg>
  )
}

function Lines({ title, rows }: { title: string; rows: string[] }) {
  return (
    <section className="user-report-card journey-list">
      <h3>{title}</h3>
      {rows.length ? rows.map((row) => <p key={row}>{row}</p>) : <p>موردی در این نما نیست.</p>}
    </section>
  )
}

export function JourneysPage({ preview }: { preview: boolean }) {
  const [draft, setDraft] = useState(initial)
  const [applied, setApplied] = useState(initial)
  const live = useQuery({
    queryKey: ['admin', 'journeys', applied],
    queryFn: async () => journeyReportFromApi(await staff.api(`admin/reports/journeys?from=${applied.from}&to=${applied.to}&platform=${encodeURIComponent(applied.platform)}&appVersion=${encodeURIComponent(applied.appVersion)}&sessionType=${applied.sessionType}`)),
    enabled: !preview,
  })
  const report = preview ? journeyReport(applied) : live.data

  function apply(sessionType: SessionType) {
    setDraft((current) => ({ ...current, sessionType }))
    setApplied({ ...draft, sessionType })
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    setApplied(draft)
  }

  const ready = report?.status === 'ready'

  return (
    <div className="journey-reports">
      <h2>مسیر کاربران</h2>
      {preview && <p className="user-report-note">فاز ۱۰ · اعداد نمونه هستند. ورود اول با اولین ورود بعد از ساخت حساب یکی نیست. وصل کردن نشست ناشناس به حساب کار سرور است. زمان‌ها فقط پیش‌زمینهٔ فعال را می‌شمارند و گراف فقط از گذارهای ثبت‌شده رسم می‌شود.</p>}
      <form className="user-report-filters" onSubmit={submit}>
        <input type="date" aria-label="شروع بازه" required value={draft.from} onChange={(event) => setDraft({ ...draft, from: event.target.value })} />
        <input type="date" aria-label="پایان بازه" required value={draft.to} onChange={(event) => setDraft({ ...draft, to: event.target.value })} />
        <select aria-label="سکوی برنامه" value={draft.platform} onChange={(event) => setDraft({ ...draft, platform: event.target.value })}>
          {Object.entries(platforms).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select aria-label="نسخهٔ برنامه" value={draft.appVersion} onChange={(event) => setDraft({ ...draft, appVersion: event.target.value })}>
          {versions.map((value) => <option key={value} value={value}>{value === 'all' ? 'همهٔ نسخه‌ها' : value}</option>)}
        </select>
        <div className="journey-actions">
          <button type="button" aria-pressed={applied.sessionType === 'first_visit'} onClick={() => apply('first_visit')}>ورود اول</button>
          <button type="button" aria-pressed={applied.sessionType === 'returning'} onClick={() => apply('returning')}>بازدیدهای بعدی</button>
          <button type="submit">به‌روزرسانی گزارش</button>
        </div>
      </form>
      {!preview && live.isLoading && <p>در حال چیدن مسیرها</p>}
      {!preview && live.isError && <p>{live.error instanceof StaffError ? live.error.message : 'گزارش دریافت نشد.'}</p>}
      {report && (
        <section className="user-report-card journey-card">
          <h3>{applied.sessionType === 'first_visit' ? 'گراف ورود اول' : 'گراف بازدیدهای بعدی'}</h3>
          {report.status === 'invalid' && <p>بازه یا نوع نشست را بررسی کن.</p>}
          {report.status === 'too_large' && <p>این بازه برای ساخت گراف بزرگ است. بازه را کوتاه‌تر کن.</p>}
          {report.status === 'empty' && <p>در این صافی مسیری نیست. این حالت به معنی صفر بودن گذارها نیست.</p>}
          {ready && <>
            <p>{fa(report.sessions)} نشست در این نما.</p>
            <Graph report={report} />
            <h3>جدول گذارها</h3>
            <table className="journey-table">
              <thead><tr><th>از</th><th>به</th><th>تعداد</th><th>درصد خروج از مبدأ</th></tr></thead>
              <tbody>
                {report.edges.length ? report.edges.map((edge) => (
                  <tr key={`${edge.fromScreenId}-${edge.toScreenId}`}>
                    <td>{screenLabel(edge.fromScreenId)}</td>
                    <td>{screenLabel(edge.toScreenId)}</td>
                    <td>{fa(edge.count)}</td>
                    <td>{edge.percent == null ? '—' : `${fa(edge.percent)}٪`}</td>
                  </tr>
                )) : <tr><td colSpan={4}>جدول گذار خالی است چون رویداد ناوبری ثبت نشده.</td></tr>}
              </tbody>
            </table>
          </>}
        </section>
      )}
      {ready && report && <>
        <Lines title="مسیرهای پرتکرار" rows={report.journeys.map((row) => `${row.path} · ${fa(row.count)} (${row.percent == null ? '—' : `${fa(row.percent)}٪`})`)} />
        <Lines title="صفحه‌های ورود" rows={report.entries.map((row) => `${screenLabel(row.screenId)} · ${fa(row.count)}`)} />
        <Lines title="صفحه‌های خروج" rows={report.exits.map((row) => `${screenLabel(row.screenId)} · ${fa(row.count)}`)} />
        <Lines title="نقاط رها کردن" rows={report.dropOff.map((row) => `${screenLabel(row.screenId)} · ${fa(row.count)} خروج از ${fa(row.visits)} بازدید (${row.percent == null ? '—' : `${fa(row.percent)}٪`})`)} />
        <Lines title="زمان فعال" rows={report.active.map((row) => `${screenLabel(row.screenId)} · ${fa(Math.round(row.milliseconds / 1000))} ثانیه`)} />
      </>}
    </div>
  )
}
