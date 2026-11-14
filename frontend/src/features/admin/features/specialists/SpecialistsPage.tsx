import { useDeferredValue, useEffect, useRef, useState, type FormEvent } from 'react'
import { AdminIcon as Icon } from '../../components/AdminIcon'
import { adminPreviewEnabled } from '../../data/preview'
import { staff } from '../../session'
import { asRows } from '@shared/utils'
import './specialists.css'

type Row = Record<string, unknown>
const fa = (n: number) => n.toLocaleString('fa-IR')
const normalize = (text: unknown) => String(text ?? '').replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit))).toLowerCase()

function SpecialistDialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { const el = dialog.current; el?.showModal(); return () => el?.close() }, [])
  return <dialog ref={dialog} className="specialist-dialog" aria-label={title} onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose() }}><div className="specialist-dialog-content"><header><h2>{title}</h2><button type="button" className="icon-button" aria-label="بستن" onClick={onClose}><Icon name="close" /></button></header>{children}</div></dialog>
}

export function SpecialistsPage({ rows, onChanged, creating, onCloseCreate }: { rows: Row[]; onChanged: () => void; creating: boolean; onCloseCreate: () => void }) {
  const [search, setSearch] = useState('')
  const deferred = useDeferredValue(search)
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<Row | null>(null)
  const [membersOpen, setMembersOpen] = useState(false)
  const [members, setMembers] = useState<Row[]>([])
  const [membersBusy, setMembersBusy] = useState(false)
  const [memberError, setMemberError] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const memberGeneration = useRef(0)
  const preview = adminPreviewEnabled()
  const filtered = rows.filter(row => normalize([row.displayName, row.phone, row.councilNo].join(' ')).includes(normalize(deferred)))
  const pages = Math.max(1, Math.ceil(filtered.length / 10))
  const current = Math.min(page, pages)
  async function showMembers(row: Row) {
    const generation = ++memberGeneration.current
    setMembersOpen(true); setMembers([]); setMemberError(''); setMembersBusy(true)
    try {
      const result = preview ? [{ id: 'preview-member', displayName: 'سارا آزمایشی', phone: '۰۹۱۲۰۰۰۰۰۰۰' }] : asRows(await staff.api(`admin/specialists/${encodeURIComponent(String(row.id))}/members`))
      if (generation === memberGeneration.current) setMembers(result)
    } catch (cause) { if (generation === memberGeneration.current) setMemberError(cause instanceof Error ? cause.message : 'دریافت زیرمجموعه‌ها انجام نشد') }
    finally { if (generation === memberGeneration.current) setMembersBusy(false) }
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (preview || saving) return
    const fields = Object.fromEntries(new FormData(event.currentTarget))
    setSaving(true); setError('')
    const body = editing ? { displayName: String(fields.displayName), credential: String(fields.credential), capacity: Number(fields.capacity), bio: String(fields.bio), active: fields.active === 'on' } : { firstName: String(fields.firstName), lastName: String(fields.lastName), phone: String(fields.phone), councilNo: String(fields.councilNo), education: String(fields.education), capacity: Number(fields.capacity), username: fields.username || undefined, password: fields.password || undefined }
    try {
      await staff.api(editing ? `admin/specialists/${encodeURIComponent(String(editing.id))}` : 'admin/specialists', editing ? 'PATCH' : 'POST', body)
      setEditing(null); onCloseCreate(); onChanged()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'ذخیره پزشک انجام نشد') }
    finally { setSaving(false) }
  }
  return <>
    <section className="specialists-card" aria-label="فهرست پزشکان">
      <div className="specialists-toolbar"><label className="specialists-search"><Icon name="search" /><span className="sr-only">جست‌وجو در پزشکان</span><input type="search" placeholder="جست‌وجو در پزشکان..." value={search} onChange={event => { setSearch(event.target.value); setPage(1) }} /></label></div>
      <div className="specialists-table-scroll"><table><thead><tr>{['نام', 'شماره تلفن', 'کد نظام پزشکی', 'تعداد زیرمجموعه', 'عملیات'].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{filtered.slice((current - 1) * 10, current * 10).map(row => {
        const name = String(row.displayName || 'بدون نام')
        return <tr key={String(row.id)}><td><div className="specialist-person">{typeof row.portrait === 'string' && /^data:image\/(jpeg|png);base64,/.test(row.portrait) ? <img className="specialist-avatar" src={row.portrait} alt="" /> : <span className="specialist-avatar">{name[0]}</span>}<span>{name}</span></div></td><td><bdi dir="ltr">{String(row.phone || '—')}</bdi></td><td><bdi dir="ltr">{String(row.councilNo || '—')}</bdi></td><td>{fa(Number(row.subordinateCount ?? 0))}</td><td><button className="specialist-edit-button" onClick={() => { ++memberGeneration.current; setMembersOpen(false); setError(''); setEditing(row) }}><Icon name="pencil" />ویرایش</button></td></tr>
      })}{!filtered.length && <tr><td colSpan={5} className="specialists-empty">پزشکی با این مشخصات یافت نشد.</td></tr>}</tbody></table></div>
      <footer className="specialists-pagination"><span role="status">{filtered.length ? `${fa((current - 1) * 10 + 1)} تا ${fa(Math.min(current * 10, filtered.length))} از ${fa(filtered.length)} مورد` : '۰ مورد'}</span><div><button className="secondary" disabled={current === 1} onClick={() => setPage(current - 1)}><Icon name="chevron-right" />قبلی</button><span aria-current="page">{fa(current)}</span><button className="secondary" disabled={current === pages} onClick={() => setPage(current + 1)}>بعدی<Icon name="chevron-left" /></button></div></footer>
    </section>
    {(creating || editing) && <SpecialistDialog key={editing ? String(editing.id) : 'create'} title={editing ? 'ویرایش پزشک' : 'افزودن پزشک'} onClose={() => { if (!saving) { setEditing(null); onCloseCreate(); setError('') } }}><form onSubmit={save}>
      {preview && <p className="info-note">حالت پیش‌نمایش؛ اطلاعات این فرم ذخیره نمی‌شود.</p>}
      <div className="specialist-form-grid">{editing ? <><label>نام پزشک<input name="displayName" defaultValue={String(editing.displayName ?? '')} maxLength={80} required /></label><label>مدرک تحصیلی<input name="credential" defaultValue={String(editing.credential ?? '')} maxLength={120} /></label></> : <><label>نام<input name="firstName" required maxLength={40} /></label><label>نام خانوادگی<input name="lastName" required maxLength={40} /></label><label>شماره تلفن<input name="phone" dir="ltr" placeholder="09123456789" pattern="09[0-9]{9}" required /></label><label>کد نظام پزشکی<input name="councilNo" dir="ltr" maxLength={20} /></label><label>مدرک تحصیلی<input name="education" maxLength={120} /></label></>}
      <label>ظرفیت<input name="capacity" type="number" min={0} max={500} defaultValue={Number(editing?.capacity ?? 20)} required /></label>
      {editing ? <><label className="specialist-form-wide">درباره پزشک<textarea name="bio" maxLength={500} defaultValue={String(editing.bio ?? '')} /></label><label className="specialist-checkbox"><input type="checkbox" name="active" defaultChecked={editing.active !== false} />فعال</label></> : <><label>نام کاربری<input name="username" dir="ltr" maxLength={32} autoComplete="off" /></label><label>رمز عبور<input name="password" type="password" dir="ltr" minLength={8} maxLength={256} autoComplete="new-password" /></label></>}
      </div>{error && <p className="form-error" role="alert">{error}</p>}<div className="actions"><button type="submit" disabled={saving || preview}>{saving ? 'در حال ذخیره…' : 'ذخیره پزشک'}</button><button type="button" className="secondary" disabled={saving} onClick={() => { setEditing(null); onCloseCreate(); setError('') }}>انصراف</button></div>
    </form>{editing && <section className="specialist-members-section"><button type="button" className="secondary" aria-expanded={membersOpen} aria-controls="specialist-members" onClick={() => { if (membersOpen) { ++memberGeneration.current; setMembersOpen(false) } else void showMembers(editing) }}><Icon name="users" />زیرمجموعه‌ها</button>{membersOpen && <div id="specialist-members">{membersBusy ? <p role="status">در حال دریافت…</p> : memberError ? <p className="form-error" role="alert">{memberError}</p> : members.length ? <ul className="specialist-members-list">{members.map(member => <li key={String(member.id)}><span>{String(member.displayName || 'بدون نام')}</span><bdi dir="ltr">{String(member.phone || '—')}</bdi></li>)}</ul> : <p>هنوز زیرمجموعه‌ای ثبت نشده است.</p>}</div>}</section>}</SpecialistDialog>}
  </>
}
