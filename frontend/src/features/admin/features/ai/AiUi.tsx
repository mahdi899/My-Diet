import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { asRecord, asRows, formatFaDate, formatFaNumber } from '@shared/utils'
import { AdminIcon as Icon } from '../../components/AdminIcon'
import { staff } from '../../session'

export type Row = Record<string, unknown>
export type Column = [string, (row: Row) => ReactNode]
export const str = (value: unknown) => String(value ?? '')
export const num = (value: unknown) => formatFaNumber(Number(value ?? 0))
export const usd = (value: unknown, digits = 4) => '$' + (Number(value ?? 0) / 1e6).toFixed(digits)
export const date = (value: unknown) => formatFaDate(value) ?? '—'
export const errorText = (error: unknown) => error instanceof Error ? error.message : 'عملیات انجام نشد.'
export const aiApi = async (path: string, method = 'GET', body?: Record<string, unknown>) =>
  asRecord(await staff.api('admin/ai/' + path, method, body)) ?? {}
export const itemRows = (data?: Row) => asRows(data?.items)
export const id = (value: unknown) => encodeURIComponent(str(value))
export const versionTitles: Record<string, string> = {
  plan_draft: 'پرامپت پیش‌نویس برنامه', plan_critic: 'پرامپت بازبین', coach_system: 'پرامپت مربی تغذیه (گفتگو)',
  coach_vision: 'پرامپت تحلیل عکس غذا', coach_memory: 'پرامپت حافظهٔ مربی',
}
export const poolTitles: Record<string, string> = {
  coach_memory: 'مربی تغذیه (حافظه)', nutrition_coach: 'مربی تغذیه (گفتگو)', nutrition_vision: 'مربی تغذیه (عکس غذا)',
  plan_critic: 'بازبینی فرهنگی و بالینی', plan_draft: 'پیش‌نویس برنامهٔ غذایی',
}
export const outcomes: Record<string, string> = {
  ok: 'موفق', rate_limited: 'محدودیت نرخ', auth_failed: 'خطای اعتبار', rejected: 'رد شد', timeout: 'مهلت تمام شد',
  invalid_json: 'JSON نامعتبر', invalid_plan: 'برنامهٔ نامعتبر', outcome_unknown: 'نامشخص', budget_blocked: 'سقف هزینه',
}
export function useAiData(path: string, fixture: Row, preview: boolean) {
  return useQuery({ queryKey: ['admin-ai', path, preview], queryFn: () => preview ? Promise.resolve(fixture) : aiApi(path) })
}

export function AiCard({ title, description, action, children }: { title: string; description?: ReactNode; action?: ReactNode; children?: ReactNode }) {
  return <section className="users-table-card ai-card">
    <header className="ai-card-heading"><div><h2>{title}</h2>{description && <p>{description}</p>}</div>{action}</header>
    {children}
  </section>
}

export function AiBadge({ tone = 'good', children }: { tone?: 'good' | 'warn' | 'bad' | 'neutral'; children: ReactNode }) {
  return <span className="ai-badge" data-tone={tone}><i aria-hidden="true" />{children}</span>
}

export function AiNote({ children }: { children: ReactNode }) {
  return <p className="ai-note"><Icon name="info" />{children}</p>
}

export function AiLoad({ error, retry }: { error: unknown; retry: () => void }) {
  return <div className="users-table-card ai-feedback">{error ? <><p role="alert">{errorText(error)}</p>
    <button type="button" className="secondary" onClick={retry}>تلاش دوباره</button></> : <p role="status">در حال دریافت…</p>}</div>
}

export function AiForm({ submit, label = 'ذخیره', preview, close, children }: {
  submit: (data: FormData) => Promise<void>; label?: string; preview: boolean; close?: () => void; children: ReactNode
}) {
  const mutation = useMutation({ mutationFn: submit })
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!preview && !mutation.isPending) mutation.mutate(new FormData(event.currentTarget))
  }
  return <form className="ai-form" onSubmit={save} aria-busy={mutation.isPending}>
    {children}
    {mutation.isError && <p role="alert" className="form-error">{errorText(mutation.error)}</p>}
    <div className="ai-form-actions"><button type="submit" disabled={preview || mutation.isPending}><Icon name="check" />{mutation.isPending ? 'در حال انجام…' : label}</button>
      {close && <button type="button" className="secondary" disabled={mutation.isPending} onClick={close}>انصراف</button>}
    </div>
  </form>
}

export function AiDialog({ title, close, children }: { title: string; close: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const element = ref.current
    element?.showModal()
    element?.querySelector<HTMLElement>('input, select, textarea')?.focus()
    return () => element?.close()
  }, [])
  function dismiss() { if (!ref.current?.querySelector('form[aria-busy="true"]')) close() }
  return <dialog className="ai-dialog" ref={ref} aria-labelledby="ai-dialog-title" onCancel={event => { event.preventDefault(); dismiss() }}>
    <header><h2 id="ai-dialog-title"><span className="icon-tile tone-green"><Icon name="sparkles" /></span>{title}</h2>
      <button type="button" className="icon-button" aria-label="بستن" onClick={dismiss}><Icon name="close" /></button></header>
    {children}
  </dialog>
}

export function AiMetrics({ entries, icon }: { entries: [string, ReactNode, string, string][]; icon: string }) {
  return <div className="ai-metrics">{entries.map(([name, value, note, tone]) => <section className="card metric-card" key={name}>
    <div className="metric-top"><p>{name}</p><span className={`icon-tile tone-${tone}`}><Icon name={icon} /></span></div>
    <div className="metric-value">{value}</div><div className="metric-foot">{note}</div>
  </section>)}</div>
}

export function AiTable({ title, description, rows, columns, searchable = false, empty }: {
  title: string; description?: string; rows: Row[]; columns: Column[]; searchable?: boolean; empty: string
}) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const size = 10
  const term = search.trim().toLowerCase()
  const filtered = rows.filter(row => !term || Object.values(row).some(value => str(value).toLowerCase().includes(term)))
  const last = Math.max(1, Math.ceil(filtered.length / size))
  const current = Math.min(page, last)
  const start = (current - 1) * size
  const visible = filtered.slice(start, start + size)
  return <AiCard title={title} description={description}>
    {searchable && <div className="users-toolbar"><label className="users-search"><Icon name="search" /><span className="sr-only">جست‌وجو در {title}</span>
      <input type="search" placeholder={`جست‌وجو در ${title}…`} value={search} onChange={event => { setSearch(event.target.value); setPage(1) }} /></label></div>}
    <div className="users-table-scroll" role="region" aria-label={title} tabIndex={0}>
      <table style={{ minWidth: Math.max(450, columns.length * 92) }}><thead><tr>{columns.map(([label]) => <th key={label} scope="col">{label}</th>)}</tr></thead>
        <tbody>{visible.map((row, index) => <tr key={row.id == null ? start + index : str(row.id)}>
          {columns.map(([label, render]) => <td key={label}>{render(row)}</td>)}
        </tr>)}{!visible.length && <tr><td colSpan={columns.length} className="ai-empty-cell"><div className="ai-empty">
          <span className="icon-tile tone-green"><Icon name={term ? 'search' : 'sparkles'} /></span><strong>{term ? 'نتیجه‌ای پیدا نشد' : empty}</strong>
          <p>{term ? 'عبارت دیگری را جست‌وجو کنید.' : 'اطلاعات جدید پس از ثبت در این بخش نمایش داده می‌شوند.'}</p>
        </div></td></tr>}</tbody>
      </table>
    </div>
    <footer className="users-pagination"><span role="status">{visible.length ? `${num(start + 1)} تا ${num(start + visible.length)} از ${num(filtered.length)} مورد` : '۰ مورد'}</span>
      <div><button type="button" className="users-page-button" disabled={current === 1} onClick={() => setPage(current - 1)}><Icon name="chevron-right" />قبلی</button>
        <span className="users-current" aria-current="page">{num(current)}</span>
        <button type="button" className="users-page-button" disabled={current === last} onClick={() => setPage(current + 1)}>بعدی<Icon name="chevron-left" /></button></div>
    </footer>
  </AiCard>
}
