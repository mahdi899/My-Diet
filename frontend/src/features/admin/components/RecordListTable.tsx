import { useId, useState, type ReactNode } from 'react'
import { formatFaNumber, toEnglishDigits } from '@shared/utils'
import { AdminIcon as Icon } from './AdminIcon'
import '../features/users/users.css'
import './record-list.css'

type Row = Record<string, unknown>
export type RecordColumn = { title: string; value: (row: Row) => unknown; render?: (value: unknown) => ReactNode }
const normalize = (value: string) => toEnglishDigits(value).trim().toLowerCase()

export function ShortRecordId({ value }: { value: unknown }) {
  const id = String(value ?? '')
  return <bdi className="users-id" dir="ltr" title={id}>{id.slice(0, 8) || '—'}</bdi>
}

export function RecordListTable({ title, rows, columns, pageSize, emptyText, noMatchesText, variant }: {
  title: string; rows: Row[]; columns: RecordColumn[]; pageSize: number; emptyText: string; noMatchesText: string; variant: 'tickets' | 'audit'
}) {
  const titleId = useId()
  const searchLabel = 'جست‌وجو در ' + title
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const term = normalize(search)
  const matches = rows.filter(row => !term || [row.createdAt, ...columns.map(column => column.value(row))]
    .some(value => normalize(String(value ?? '')).includes(term)))
  const last = Math.max(1, Math.ceil(matches.length / pageSize))
  const current = Math.min(page, last)
  const start = (current - 1) * pageSize
  const visible = matches.slice(start, start + pageSize)

  return <section className="users-table-card record-list-card" data-variant={variant} aria-labelledby={titleId}>
    <header className="record-list-heading">
      <h2 id={titleId}>{title}</h2>
      <p>{formatFaNumber(rows.length)} مورد در فهرست</p>
    </header>
    <div className="users-toolbar">
      <label className="users-search">
        <Icon name="search" />
        <span className="sr-only">{searchLabel}</span>
        <input type="search" placeholder={searchLabel + '…'} value={search}
          onChange={event => { setSearch(event.target.value); setPage(1) }} />
      </label>
    </div>
    <div className="users-table-scroll" role="region" aria-label={'جدول ' + title} tabIndex={0}>
      <table>
        <thead><tr>{columns.map(column => <th key={column.title} scope="col">{column.title}</th>)}</tr></thead>
        <tbody>
          {visible.map(row => <tr key={String(row.id)}>
            {columns.map(column => {
              const value = column.value(row)
              return <td key={column.title}>{column.render ? column.render(value) : String(value ?? '') || '—'}</td>
            })}
          </tr>)}
          {!visible.length && <tr><td colSpan={columns.length} className="users-empty">
            {rows.length ? noMatchesText : emptyText}
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
