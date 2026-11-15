import { useState } from 'react'
import { formatFaNumber, statusLabels, toEnglishDigits } from '@shared/utils'
import { AdminIcon as Icon } from '../../components/AdminIcon'
import { staff } from '../../session'
import '../users/users.css'
import './reviews.css'

const headings = ['کاربر', 'امتیاز', 'نظر', 'وضعیت', 'بررسی']
const pageSize = 12
const normalize = (value: unknown) => toEnglishDigits(String(value ?? '')).trim().toLowerCase().replace(/ي/g, 'ی').replace(/ك/g, 'ک')

export function ReviewsTable({ rows, preview, onChanged }: { rows: Record<string, unknown>[]; preview: boolean; onChanged: () => Promise<unknown> }) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const term = normalize(search)
  const matches = rows.filter(row => [row.userId, row.body, row.rating, statusLabels[String(row.status)]].some(value => normalize(value).includes(term)))
  const last = Math.max(1, Math.ceil(matches.length / pageSize))
  const current = Math.min(page, last)
  const start = (current - 1) * pageSize
  const visible = matches.slice(start, start + pageSize)

  async function review(id: string, status: 'approved' | 'rejected') {
    if (busy || preview) return
    setBusy(id)
    setError('')
    try {
      await staff.api('admin/reviews/' + encodeURIComponent(id), 'POST', { status })
      await onChanged()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'بررسی نظر انجام نشد.')
    } finally {
      setBusy(null)
    }
  }

  return <section className="reviews-card users-table-card" aria-label="نظرات در انتظار بررسی">
    <div className="users-toolbar">
      <label className="users-search"><Icon name="search" /><span className="sr-only">جست‌وجو در نظرات</span>
        <input type="search" placeholder="جست‌وجو در نظرات…" value={search} onChange={event => { setSearch(event.target.value); setPage(1) }} />
      </label>
    </div>
    {error && <p className="form-error reviews-error" role="alert">{error}</p>}
    <div className="users-table-scroll" role="region" aria-label="جدول نظرات" tabIndex={0}>
      <table><thead><tr>{headings.map(heading => <th key={heading} scope="col">{heading}</th>)}</tr></thead>
        <tbody>
          {visible.map(row => {
            const id = typeof row.id === 'string' ? row.id : ''
            const user = String(row.userId ?? '')
            const status = String(row.status ?? '')
            return <tr key={id}>
              <td><bdi className="users-id" dir="ltr" title={user}>{user ? user.slice(0, 8) : '—'}</bdi></td>
              <td>{typeof row.rating === 'number' ? `${formatFaNumber(row.rating)} از ۵` : '—'}</td>
              <td className="reviews-text">{String(row.body ?? '') || '—'}</td>
              <td><span className="reviews-status"><i aria-hidden="true" />{statusLabels[status] ?? (status || '—')}</span></td>
              <td>{id && <div className="reviews-actions" aria-busy={busy === id}>
                <button type="button" className="secondary" disabled={preview || busy !== null} onClick={() => void review(id, 'approved')}><Icon name="check" />تأیید</button>
                <button type="button" className="secondary reviews-reject" disabled={preview || busy !== null} onClick={() => void review(id, 'rejected')}><Icon name="close" />رد</button>
              </div>}</td>
            </tr>
          })}
          {!visible.length && <tr><td colSpan={headings.length} className="reviews-empty-cell">
            <div className="reviews-empty">
              <span><Icon name={term && rows.length ? 'search' : 'star'} /></span>
              <h2>{term && rows.length ? 'نظری پیدا نشد' : 'همه‌چیز بررسی شده است'}</h2>
              <p>{term && rows.length ? 'عبارت دیگری را جست‌وجو کنید.' : 'نظر جدیدی که به بررسی شما نیاز داشته باشد، اینجا نمایش داده می‌شود.'}</p>
            </div>
          </td></tr>}
        </tbody>
      </table>
    </div>
    <footer className="users-pagination">
      <span role="status">{matches.length ? `${formatFaNumber(start + 1)} تا ${formatFaNumber(start + visible.length)} از ${formatFaNumber(matches.length)} مورد` : '۰ مورد'}</span>
      <div>
        <button type="button" className="users-page-button" disabled={current === 1} onClick={() => setPage(current - 1)}><Icon name="chevron-right" />قبلی</button>
        <span className="users-current" aria-current="page">{formatFaNumber(current)}</span>
        <button type="button" className="users-page-button" disabled={current === last} onClick={() => setPage(current + 1)}>بعدی<Icon name="chevron-left" /></button>
      </div>
    </footer>
  </section>
}
