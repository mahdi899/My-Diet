import { useDeferredValue, useMemo, useState } from 'react'
import { AdminIcon as Icon } from '../../components/AdminIcon'
import { StatusFilter } from '../../components/StatusFilter'
import { adminPreviewEnabled } from '../../data/preview'
import { staff } from '../../session'
import './users.css'

const labels: Record<string, string> = { active: 'فعال', pending: 'در انتظار', suspended: 'تعلیق‌شده', deleted: 'حذف‌شده' }
const fa = (value: number) => value.toLocaleString('fa-IR')
const normalize = (value: unknown) => String(value ?? '').replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit))).toLowerCase()

export function UsersTable({ rows, onChanged }: { rows: Record<string, unknown>[]; onChanged: () => void }) {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null)
  const [action, setAction] = useState<'edit' | 'delete'>('edit')
  const [nextStatus, setNextStatus] = useState('active')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const preview = adminPreviewEnabled()
  const deferredSearch = useDeferredValue(search)
  const filtered = useMemo(() => rows.filter(row => (!status || row.status === status) && normalize([row.displayName, row.phone, row.id].join(' ')).includes(normalize(deferredSearch))), [rows, status, deferredSearch])
  const pages = Math.max(1, Math.ceil(filtered.length / 10))
  const current = Math.min(page, pages)
  const visible = filtered.slice((current - 1) * 10, current * 10)
  function open(row: Record<string, unknown>, mode: 'edit' | 'delete') {
    setSelected(row); setAction(mode); setNextStatus(String(row.status ?? 'pending')); setError('')
  }
  async function save() {
    if (!selected || preview) return
    setBusy(true); setError('')
    try {
      await staff.api(`admin/users/${encodeURIComponent(String(selected.id))}/${action === 'delete' ? 'delete' : 'status'}`, 'POST', action === 'delete' ? { confirmation: 'حذف حساب' } : { status: nextStatus })
      setSelected(null); onChanged()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'ذخیره انجام نشد') }
    finally { setBusy(false) }
  }
  return <section className="users-table-card" aria-label="فهرست کاربران">
    <div className="users-toolbar">
      <div className="users-controls">
        <label className="users-search"><Icon name="search" /><span className="sr-only">جست‌وجو در کاربران</span><input type="search" placeholder="نام، موبایل یا شناسه…" value={search} onChange={event => { setSearch(event.target.value); setPage(1) }} /></label>
        <div className="users-filter-actions">
        {(search || status) && <button type="button" className="users-clear-filters" onClick={() => { setSearch(''); setStatus(''); setPage(1) }}>حذف فیلترها<Icon name="close" /></button>}
        <StatusFilter label="فیلترها" value={status} options={Object.entries(labels)}
          onChange={value => { setStatus(value); setPage(1) }} />
        </div>
      </div>
    </div>
    {(search || status) && <span className="sr-only" role="status">{fa(filtered.length)} کاربر پیدا شد</span>}
    <div className="users-table-scroll"><table><thead><tr><th>کاربر</th><th>وضعیت حساب</th><th>شناسه</th><th>عملیات</th></tr></thead><tbody>{visible.map(row => {
      const name = String(row.displayName || 'بدون نام')
      const state = String(row.status ?? 'pending')
      return <tr key={String(row.id)}><td><div className="users-person"><span className="users-avatar">{name.trim()[0]}</span><div><strong>{name}</strong><small dir="ltr">{String(row.phone ?? '—')}</small></div></div></td><td><span className={`users-status users-status-${state}`}><i />{labels[state] ?? state}</span></td><td><span className="users-id" dir="ltr" title={String(row.id)}>{String(row.id).slice(0, 8)}</span></td><td><div className="users-actions"><button className="users-action" aria-label={`ویرایش ${name}`} onClick={() => open(row, 'edit')}><Icon name="pencil" /></button><button className="users-action users-delete" aria-label={`حذف ${name}`} onClick={() => open(row, 'delete')}><Icon name="trash" /></button></div></td></tr>
    })}{!visible.length && <tr><td colSpan={4} className="users-empty">کاربری با این مشخصات یافت نشد.</td></tr>}</tbody></table></div>
    <footer className="users-pagination"><span>{filtered.length ? `${fa((current - 1) * 10 + 1)} تا ${fa(Math.min(current * 10, filtered.length))} از ${fa(filtered.length)} مورد` : '۰ مورد'}</span><div><button className="users-page-button" disabled={current === 1} onClick={() => setPage(current - 1)}><Icon name="chevron-right" />قبلی</button><span className="users-current" aria-current="page">{fa(current)}</span><button className="users-page-button" disabled={current === pages} onClick={() => setPage(current + 1)}>بعدی<Icon name="chevron-left" /></button></div></footer>
    {selected && <div className="users-dialog-backdrop" onClick={() => !busy && setSelected(null)}><section role="dialog" aria-modal="true" aria-labelledby="user-dialog-title" className="users-dialog" onClick={event => event.stopPropagation()} onKeyDown={event => { if (event.key === 'Escape' && !busy) setSelected(null) }}><h2 id="user-dialog-title">{action === 'edit' ? 'ویرایش وضعیت حساب' : 'حذف حساب کاربر'}</h2><p>{String(selected.displayName || 'بدون نام')}</p>{preview && <p>این مورد آزمایشی است؛ تغییرات ذخیره نمی‌شوند.</p>}{action === 'edit' ? <label>وضعیت حساب<select value={nextStatus} onChange={event => setNextStatus(event.target.value)}>{Object.entries(labels).filter(([key]) => key !== 'deleted').map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label> : <p>حساب این کاربر حذف شود؟</p>}{error && <p role="alert">{error}</p>}<div className="actions"><button autoFocus className="secondary" disabled={busy} onClick={() => setSelected(null)}>بستن</button><button disabled={busy || preview} onClick={save}>{busy ? 'در حال ذخیره…' : action === 'edit' ? 'ذخیره وضعیت' : 'تأیید حذف'}</button></div></section></div>}
  </section>
}
