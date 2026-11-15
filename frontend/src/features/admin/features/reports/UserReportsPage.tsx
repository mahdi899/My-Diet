import { FormEvent, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { StaffError } from '@shared/api/staff-session'
import { staff } from '../../session'
import { rangeLabel, retentionEvents, sampleUserReport, userReportFromApi, type ReportQuery, type RetentionEvent, type UserReport } from './user-report'
import './user-reports.css'

const initial: ReportQuery = { from: '2026-08-01', to: '2026-10-30', event: 'activity' }
const foodKinds = ['selected', 'alternative', 'disliked', 'reason'] as const

function isEvent(value: string): value is RetentionEvent {
  return value in retentionEvents
}

async function loadLive(query: ReportQuery): Promise<UserReport> {
  const range = `from=${encodeURIComponent(query.from)}&to=${encodeURIComponent(query.to)}`
  const [retention, ...foods] = await Promise.all([
    staff.api(`admin/reports/retention?${range}&event=${query.event}`),
    ...foodKinds.map((kind) => staff.api(`admin/reports/foods?${range}&kind=${kind}`)),
  ])
  const feedback = await staff.api(`admin/reports/feedback?${range}`)
  return userReportFromApi(retention, foods, feedback, query.event)
}

function Meter({ text, ratio }: { text: string; ratio: number }) {
  const width = Math.max(0, Math.min(100, ratio))
  return (
    <div className="user-report-metric">
      <p>{text}</p>
      <div className="user-report-meter" aria-hidden="true"><span style={{ width: `${width}%` }} /></div>
    </div>
  )
}

function ReportBody({ report, query }: { report: UserReport; query: ReportQuery }) {
  return (
    <>
      <section className="user-report-card">
        <h3>ماندگاری گروه‌ها</h3>
        <p>بازه: {rangeLabel(query.from, query.to)}. تعریف: {report.definition}. مخرج، تعداد کاربران همان گروه در شروع است.</p>
        {report.status === 'invalid' && <p>بازهٔ تاریخ را بررسی کن.</p>}
        {report.status === 'empty' && <p>در این بازه گروهی برای سنجش نیست. این حالت به معنی ماندگاری صفر نیست.</p>}
        {report.cohorts.map((cohort) => (
          <div className="user-report-cohort" key={cohort.id}>
            <strong>{cohort.title}</strong>
            {cohort.lines.map((line) => line.ratio == null
              ? <p className="user-report-plain" key={line.key}>{line.text}</p>
              : <Meter key={line.key} text={line.text} ratio={line.ratio} />)}
          </div>
        ))}
      </section>
      <section className="user-report-card">
        <h3>غذاها، جایگزین‌ها و دلایل</h3>
        {report.foods.map((group) => (
          <div key={group.title}>
            <h4>{group.title}</h4>
            {group.rows ? group.rows.map((item) => <Meter key={item.label} text={item.label} ratio={item.ratio} />) : <p>در این بازه موردی ثبت نشده است.</p>}
          </div>
        ))}
        <h4>بازخورد و ادامهٔ برنامه</h4>
        <div className="user-report-feedback">
          <p>شرکت در بازخورد، ارسال نظر برای برنامهٔ همان بازه است. ادامهٔ برنامه خرید یا تمدید است و از روی شرکت در بازخورد حدس زده نمی‌شود.</p>
          {report.feedback
            ? <><p>شرکت در بازخورد: {report.feedback.participation}</p><p>ادامهٔ برنامه: {report.feedback.continuation}</p></>
            : <p>مخرج این بخش مشخص نیست.</p>}
        </div>
      </section>
    </>
  )
}

export function UserReportsPage({ preview }: { preview: boolean }) {
  const [draft, setDraft] = useState(initial)
  const [applied, setApplied] = useState(initial)
  const live = useQuery({
    queryKey: ['admin', 'user-reports', applied],
    queryFn: () => loadLive(applied),
    enabled: !preview,
  })
  const report = preview ? sampleUserReport(applied) : live.data

  function submit(event: FormEvent) {
    event.preventDefault()
    setApplied(draft)
  }

  return (
    <div className="user-reports">
      <h2>گزارش کاربران</h2>
      {preview && <p className="user-report-note">فاز ۹ · این اعداد نمونهٔ طراحی هستند و گزارش زندهٔ سرور نیستند. بازگشت به برنامه، ثبت وعده و خرید دوباره سه رویداد جدا هستند.</p>}
      <form className="user-report-filters" onSubmit={submit}>
        <input type="date" aria-label="شروع بازه" value={draft.from} required onChange={(event) => setDraft({ ...draft, from: event.target.value })} />
        <input type="date" aria-label="پایان بازه" value={draft.to} required onChange={(event) => setDraft({ ...draft, to: event.target.value })} />
        <select aria-label="رویداد بازگشت" value={draft.event} onChange={(event) => { if (isEvent(event.target.value)) setDraft({ ...draft, event: event.target.value }) }}>
          {Object.entries(retentionEvents).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <button type="submit">به‌روزرسانی گزارش</button>
      </form>
      {!preview && live.isLoading && <p>در حال آماده‌سازی گزارش</p>}
      {!preview && live.isError && <p>{live.error instanceof StaffError ? live.error.message : 'گزارش دریافت نشد.'}</p>}
      {report && <ReportBody report={report} query={applied} />}
    </div>
  )
}
