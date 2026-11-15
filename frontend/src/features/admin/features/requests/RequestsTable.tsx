import { useState } from 'react'
import { formatFaDate, formatFaNumber, statusLabels, toEnglishDigits } from '@shared/utils'
import { AdminIcon as Icon } from '../../components/AdminIcon'
import { StatusFilter } from '../../components/StatusFilter'
import '../users/users.css'
import './requests.css'

const kindLabels: Record<string, string> = {
  new_plan: 'برنامه جدید',
  ai_revision: 'بازنگری هوش مصنوعی',
  specialist_revision: 'بازنگری پزشک',
}
const pageSize = 10
const requestStatuses = ['queued', 'generating', 'in_review', 'awaiting_user', 'response_received', 'published', 'cancelled']
const normalize = (value: string) => toEnglishDigits(value).trim().toLowerCase().replace(/ي/g, 'ی').replace(/ك/g, 'ک')

export function RequestsTable({ rows }: { rows: Record<string, unknown>[] }) {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const requests = rows.map(row => {
    const kind = String(row.kind ?? '')
    const state = String(row.status ?? '')
    return {
      id: String(row.id ?? ''),
      userId: String(row.userId ?? ''),
      kind: kindLabels[kind] ?? (kind || '—'),
      status: state,
      statusLabel: statusLabels[state] ?? (state || '—'),
      createdAt: row.createdAt,
    }
  })
  const statuses = new Set([...requestStatuses, ...requests.map(request => request.status).filter(Boolean)])
  const query = normalize(search)
  const filtered = requests.filter(request => (!status || request.status === status)
    && [request.id, request.userId, request.kind].some(value => normalize(value).includes(query)))
  const lastPage = Math.max(1, Math.ceil(filtered.length / pageSize))
  const current = Math.min(page, lastPage)
  const start = (current - 1) * pageSize
  const visible = filtered.slice(start, start + pageSize)

  return <section className="users-table-card requests-table-card" aria-label="فهرست درخواست‌ها">
    <div className="users-toolbar">
      <div className="users-controls">
        <label className="users-search">
          <Icon name="search" />
          <span className="sr-only">جست‌وجو در درخواست‌ها</span>
          <input type="search" placeholder="نوع درخواست یا شناسه…" value={search} onChange={event => { setSearch(event.target.value); setPage(1) }} />
        </label>
        <StatusFilter label="فیلتر وضعیت درخواست" value={status}
          options={Array.from(statuses, value => [value, statusLabels[value] ?? value] as const)}
          onChange={value => { setStatus(value); setPage(1) }} />
      </div>
    </div>
    <div className="users-table-scroll">
      <table>
        <thead><tr>{['نوع درخواست', 'وضعیت درخواست', 'شناسه کاربر', 'شناسه درخواست', 'تاریخ ثبت'].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead>
        <tbody>
          {visible.map(request => <tr key={request.id}>
            <td><div className="users-person"><span className="users-avatar"><Icon name="clipboard" /></span><strong>{request.kind}</strong></div></td>
            <td><span className="users-status" data-status={request.status}><i aria-hidden="true" />{request.statusLabel}</span></td>
            <td><bdi className="users-id" dir="ltr" title={request.userId}>{request.userId || '—'}</bdi></td>
            <td><bdi className="users-id" dir="ltr" title={request.id}>{request.id || '—'}</bdi></td>
            <td>{formatFaDate(request.createdAt) ?? '—'}</td>
          </tr>)}
          {!visible.length && <tr><td colSpan={5} className="users-empty">درخواستی با این مشخصات یافت نشد.</td></tr>}
        </tbody>
      </table>
    </div>
    <footer className="users-pagination">
      <span role="status">{filtered.length ? `${formatFaNumber(start + 1)} تا ${formatFaNumber(start + visible.length)} از ${formatFaNumber(filtered.length)} مورد` : '۰ مورد'}</span>
      <div>
        <button type="button" className="users-page-button" disabled={current === 1} onClick={() => setPage(current - 1)}><Icon name="chevron-right" />قبلی</button>
        <span className="users-current" aria-current="page">{formatFaNumber(current)}</span>
        <button type="button" className="users-page-button" disabled={current === lastPage} onClick={() => setPage(current + 1)}>بعدی<Icon name="chevron-left" /></button>
      </div>
    </footer>
  </section>
}
