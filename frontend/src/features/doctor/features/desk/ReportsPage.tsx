import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { formatFaNumber } from '@shared/utils'
import { staff } from '../../session'
import { doctorPreviewEnabled } from '../../data/preview'
import { weeklySamples, weeklyStatus, type WeeklyReport } from '../../data/samples'
import { formatFaDay } from '../../data/labels'

export function ReportsPage() {
  const people = useQuery({
    queryKey: ['doctor', 'weekly-people', doctorPreviewEnabled()],
    queryFn: async () => {
      const samples = [...new Set(weeklySamples.map((report) => report.patient))].map((name) => ({ name }))
      if (doctorPreviewEnabled() || !staff.active) return samples
      try {
        const queue = await staff.api<{ displayName?: string; id: string }[]>('specialist/queue')
        const rows = Array.isArray(queue) ? queue : []
        const seen = new Set<string>()
        const fromQueue = []
        for (const row of rows) {
          const name = (row.displayName || '').trim()
          if (!name || seen.has(name)) continue
          seen.add(name)
          fromQueue.push({ name })
        }
        return fromQueue.length ? fromQueue : samples
      } catch {
        return samples
      }
    },
  })
  const [person, setPerson] = useState<string | null>(null)
  if (people.isLoading) return <section className="card card-pad">در حال دریافت اطلاعات…</section>
  const list = people.data ?? []
  if (!person) {
    if (!list.length) return <p>هنوز کاربری نیست.</p>
    return (
      <div className="weekly-users">
        {list.map((item) => (
          <button key={item.name} className="weekly-user" type="button" onClick={() => setPerson(item.name)}>
            <strong>{item.name}</strong><span aria-hidden>‹</span>
          </button>
        ))}
      </div>
    )
  }
  return <WeeklySheet name={person} onBack={() => setPerson(null)} />
}

function WeeklySheet({ name, onBack }: { name: string; onBack: () => void }) {
  const weeks = weeklySamples.filter((report) => report.patient === name)
  const [id, setId] = useState(weeks[0]?.id ?? '')
  const report = weeks.find((item) => item.id === id) ?? weeks[0]
  return (
    <article className="weekly-report">
      <div className="report-actions"><button className="secondary" type="button" onClick={onBack}>فهرست</button></div>
      <h2>{name}</h2>
      {!report && <p>برای این کاربر هنوز گزارش هفته ثبت نشده.</p>}
      {weeks.length > 1 && (
        <div className="week-switch">
          {weeks.map((item) => <button key={item.id} className={`secondary${item.id === report?.id ? ' active' : ''}`} type="button" onClick={() => setId(item.id)}>{formatFaDay(item.week)}</button>)}
        </div>
      )}
      {report && <ReportBody report={report} />}
    </article>
  )
}

function ReportBody({ report }: { report: WeeklyReport }) {
  return (
    <div>
      <p className="report-meta">{formatFaDay(report.week)} تا {formatFaDay(report.end)} · {weeklyStatus[report.status]}</p>
      {(report.status === 'pending' || report.status === 'failed') && <p>{report.status === 'failed' ? 'گزارش این هفته آماده نشده.' : 'گزارش این هفته هنوز آماده نیست.'}</p>}
      {report.status !== 'pending' && report.status !== 'failed' && (
        <>
          <div className="report-stats">
            <Stat value={ratio(report.recorded, report.expected)} label="ثبت وعده" />
            <Stat value={ratio(report.adherent, report.expected)} label="طبق برنامه" />
            <Stat value={report.previous ? ratio(report.previous.adherent, report.previous.expected) : '—'} label="رعایت هفتهٔ قبل" />
          </div>
          <Block title="غذا" rows={[
            ['غذاهای محبوب', report.favorites?.join('، ')],
            ['غذاهای نامطلوب', report.disliked?.join('، ')],
            ['جایگزینی', report.reasons?.map(([label, count]) => `${label} ${formatFaNumber(count)} بار`).join('، ')],
          ]} />
          <Block title="تجربهٔ هفته" rows={[['آماده‌سازی', report.preparation], ['هزینه', report.budget], ['مواد', report.availability], ['مقدار وعده', report.portion], ['ارتباط', report.service]]} />
          <WeightTable items={report.weights ?? []} />
          <Block title="پیگیری" rows={[['سلامت', report.health], ['پیشنهاد', report.suggestions?.join('، ')]]} />
        </>
      )}
    </div>
  )
}

function ratio(count: number, total: number) {
  return total > 0 ? `${formatFaNumber(count)} از ${formatFaNumber(total)} (${formatFaNumber(Math.round(100 * count / total))}٪)` : 'قابل محاسبه نیست'
}
function Stat({ value, label }: { value: string; label: string }) {
  return <div className="report-stat"><strong>{value}</strong><span>{label}</span></div>
}
function Block({ title, rows }: { title: string; rows: [string, string | undefined][] }) {
  const filled = rows.filter((row): row is [string, string] => Boolean(row[1]))
  return (
    <section className="report-block">
      <h3>{title}</h3>
      {!filled.length ? <p>موردی ثبت نشده.</p> : (
        <div className="table-wrap"><table><thead><tr><th>موضوع</th><th>جزئیات</th></tr></thead><tbody>{filled.map(([label, value]) => <tr key={label}><td>{label}</td><td>{value}</td></tr>)}</tbody></table></div>
      )}
    </section>
  )
}
function WeightTable({ items }: { items: string[] }) {
  let previous: number | null = null
  const rows = items.map((item) => {
    const parts = item.split(':')
    const when = parts.length > 1 ? parts[0]!.trim() : item
    const amount = parts.length > 1 ? parts.slice(1).join(':').trim() : '—'
    const kilos = Number(amount.replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit))).replace(/[^\d.]/g, ''))
    let change = '—'
    if (previous != null && Number.isFinite(kilos)) {
      const delta = Math.round((kilos - previous) * 10) / 10
      change = (delta > 0 ? '+' : '') + formatFaNumber(delta) + ' کیلوگرم'
    }
    if (Number.isFinite(kilos)) previous = kilos
    return [when, amount, change]
  })
  return (
    <section className="report-block">
      <h3>تغییر وزن</h3>
      {!rows.length ? <p>وزنی ثبت نشده.</p> : (
        <div className="table-wrap"><table><thead><tr><th>تاریخ</th><th>وزن</th><th>تغییر</th></tr></thead><tbody>{rows.map((cells) => <tr key={cells[0]}>{cells.map((cell) => <td key={cell}>{cell}</td>)}</tr>)}</tbody></table></div>
      )}
    </section>
  )
}
