import { useDeferredValue, useEffect, useRef, useState, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AdminIcon as Icon } from '../../components/AdminIcon'
import { adminPreviewEnabled } from '../../data/preview'
import { staff } from '../../session'
import { asRecord, asRows } from '@shared/utils'
import './specialists.css'

type Row = Record<string, unknown>
const fa = (n: number) => n.toLocaleString('fa-IR')
const normalize = (text: unknown) => String(text ?? '').replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit))).toLowerCase()
const digits = (value: unknown) => normalize(value).replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))

async function preparePortrait(file: File) {
  if (!['image/jpeg', 'image/png'].includes(file.type) || file.size > 5_000_000) {
    throw new Error('یک تصویر JPG یا PNG کوچک‌تر از ۵ مگابایت انتخاب کنید.')
  }
  const image = await createImageBitmap(file)
  try {
    const scale = Math.min(1, 256 / Math.max(image.width, image.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.width * scale))
    canvas.height = Math.max(1, Math.round(image.height * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('تصویر قابل پردازش نیست.')
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.82)
  } finally {
    image.close()
  }
}

function PortraitField() {
  const [photo, setPhoto] = useState<File | null>(null)
  const [url, setUrl] = useState('')
  useEffect(() => {
    if (!photo) { setUrl(''); return }
    const source = URL.createObjectURL(photo)
    setUrl(source)
    return () => URL.revokeObjectURL(source)
  }, [photo])
  return <section className="specialist-form-card specialist-photo-card">
    <label className="specialist-portrait">
      {url ? <img src={url} alt="" /> : <Icon name="plus" />}
      <input type="file" name="portrait" accept="image/jpeg,image/png" aria-label="انتخاب تصویر پروفایل" onChange={event => setPhoto(event.target.files?.[0] ?? null)} />
    </label>
    <div><h3>تصویر پروفایل</h3><p>برای انتخاب یا تغییر عکس کلیک کنید. فرمت JPG یا PNG.</p>{photo && <small>{photo.name}</small>}</div>
  </section>
}

function SpecialistMembers({ id, preview, onChanged }: { id: string; preview: boolean; onChanged: () => void }) {
  const [available, setAvailable] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const client = useQueryClient()
  const key = ['specialist-members', preview, id]
  const path = `admin/specialists/${encodeURIComponent(id)}/members`
  const members = useQuery({
    queryKey: [...key, available],
    refetchInterval: !available && !preview ? 86_400_000 : false,
    queryFn: async () => preview
      ? [{ id: 'preview-member', displayName: 'سارا آزمایشی', phone: '۰۹۱۲۰۰۰۰۰۰۰', week: 2, weightChangeKg: -1.2 }]
      : asRows(await staff.api(path + (available ? '?available=1' : ''))),
  })
  async function change(userId: string) {
    if (busy || preview) return
    setBusy(true)
    setError('')
    try {
      if (available) await staff.api(path, 'POST', { userId })
      else await staff.api(path + '/' + encodeURIComponent(userId), 'DELETE')
      await client.invalidateQueries({ queryKey: key })
      onChanged()
      setAvailable(false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تغییر زیرمجموعه انجام نشد.')
    } finally {
      setBusy(false)
    }
  }
  return <section className="specialist-form-card specialist-members-section">
    <div className="specialist-members-heading"><h3>{available ? 'کاربران قابل افزودن' : 'زیرمجموعه‌ها'}</h3>
      <button type="button" className="secondary" disabled={busy} onClick={() => { setError(''); setAvailable(!available) }}>
        <Icon name={available ? 'chevron-right' : 'plus'} />{available ? 'بازگشت به زیرمجموعه‌ها' : 'افزودن زیرمجموعه'}
      </button>
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
    {members.isPending ? <p role="status">در حال دریافت…</p> : members.isError ? <div>
      <p className="form-error" role="alert">دریافت کاربران انجام نشد.</p>
      <button type="button" className="secondary" onClick={() => void members.refetch()}>تلاش دوباره</button>
    </div> : members.data.length ? <ul className="specialist-members-list">{members.data.map(member => {
      const name = String(member.displayName || 'بدون نام')
      const action = available ? 'افزودن' : 'حذف'
      const week = member.week == null ? 'برنامه شروع نشده' : 'هفتهٔ ' + Number(member.week).toLocaleString('fa-IR')
      const weight = member.weightChangeKg == null ? 'ثبت وزن کافی نیست' :
        'تغییر وزن ' + Number(member.weightChangeKg).toLocaleString('fa-IR', { signDisplay: 'exceptZero' }) + ' کیلوگرم'
      return <li key={String(member.id)}><div><strong>{name}</strong><bdi dir="ltr">{String(member.phone || '—')}</bdi></div>
        {!available && <small>{week} · {weight}</small>}
        <button type="button" className="secondary" disabled={busy || preview} aria-label={`${action} ${name}`} onClick={() => void change(String(member.id))}>{action}</button>
      </li>
    })}</ul> : <p>{available ? 'کاربری برای افزودن پیدا نشد.' : 'هنوز زیرمجموعه‌ای ثبت نشده است.'}</p>}
  </section>
}

function SpecialistDialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { const el = dialog.current; el?.showModal(); return () => el?.close() }, [])
  return <dialog ref={dialog} className="specialist-dialog" aria-label={title} onCancel={event => { event.preventDefault(); onClose() }} onClick={event => { if (event.target === event.currentTarget) onClose() }}><div className="specialist-dialog-content"><header><h2><span className="icon-tile"><Icon name="medical" /></span>{title}</h2><button type="button" className="icon-button" aria-label="بستن" onClick={onClose}><Icon name="close" /></button></header>{children}</div></dialog>
}

export function SpecialistsPage({ rows, onChanged, creating, onCloseCreate }: { rows: Row[]; onChanged: () => void; creating: boolean; onCloseCreate: () => void }) {
  const [search, setSearch] = useState('')
  const deferred = useDeferredValue(search)
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<Row | null>(null)
  const [createdId, setCreatedId] = useState<string | null>(null)
  const createdNotice = useRef<HTMLParagraphElement>(null)
  useEffect(() => { if (createdId) createdNotice.current?.focus() }, [createdId])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const preview = adminPreviewEnabled()
  const filtered = rows.filter(row => normalize([row.displayName, row.phone, row.councilNo].join(' ')).includes(normalize(deferred)))
  const pages = Math.max(1, Math.ceil(filtered.length / 10))
  const current = Math.min(page, pages)
  function close() {
    if (saving) return
    setEditing(null)
    setCreatedId(null)
    setError('')
    onCloseCreate()
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (preview || saving) return
    const fields = Object.fromEntries(new FormData(event.currentTarget))
    setSaving(true); setError('')
    try {
      if (editing) {
        await staff.api(`admin/specialists/${encodeURIComponent(String(editing.id))}`, 'PATCH', {
          displayName: String(fields.displayName), credential: String(fields.credential),
          capacity: Number(fields.capacity), bio: String(fields.bio), active: fields.active === 'on',
        })
        setEditing(null)
        onCloseCreate()
      } else {
        const phone = digits(fields.phone)
        const councilNo = digits(fields.councilNo)
        if (!/^09\d{9}$/.test(phone)) throw new Error('شماره تلفن باید ۱۱ رقم و با ۰۹ شروع شود.')
        if (councilNo && !/^\d{6}$/.test(councilNo)) throw new Error('کد نظام پزشکی باید دقیقاً ۶ رقم باشد.')
        const portrait = fields.portrait instanceof File && fields.portrait.size ? await preparePortrait(fields.portrait) : undefined
        const result = asRecord(await staff.api('admin/specialists', 'POST', {
          firstName: fields.firstName, lastName: fields.lastName, phone, councilNo,
          birthDate: fields.birthDate || undefined, education: fields.education, portrait,
          capacity: Number(fields.capacity), username: String(fields.username || '').trim() || undefined,
          password: fields.password || undefined,
        }))
        if (typeof result?.id !== 'string') {
          setEditing(null)
          onCloseCreate()
        } else {
          setCreatedId(result.id)
        }
      }
      onChanged()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'ذخیره پزشک انجام نشد') }
    finally { setSaving(false) }
  }
  return <>
    <section className="specialists-card" aria-label="فهرست پزشکان">
      <div className="specialists-toolbar"><label className="specialists-search"><Icon name="search" /><span className="sr-only">جست‌وجو در پزشکان</span><input type="search" placeholder="جست‌وجو در پزشکان..." value={search} onChange={event => { setSearch(event.target.value); setPage(1) }} /></label></div>
      <div className="specialists-table-scroll"><table><thead><tr>{['نام', 'شماره تلفن', 'کد نظام پزشکی', 'تعداد زیرمجموعه', 'عملیات'].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{filtered.slice((current - 1) * 10, current * 10).map(row => {
        const name = String(row.displayName || 'بدون نام')
        return <tr key={String(row.id)}><td><div className="specialist-person">{typeof row.portrait === 'string' && /^data:image\/(jpeg|png);base64,/.test(row.portrait) ? <img className="specialist-avatar" src={row.portrait} alt="" /> : <span className="specialist-avatar">{name[0]}</span>}<span>{name}</span></div></td><td><bdi dir="ltr">{String(row.phone || '—')}</bdi></td><td><bdi dir="ltr">{String(row.councilNo || '—')}</bdi></td><td>{fa(Number(row.subordinateCount ?? 0))}</td><td><button className="specialist-edit-button" onClick={() => { setError(''); setEditing(row) }}><Icon name="pencil" />ویرایش</button></td></tr>
      })}{!filtered.length && <tr><td colSpan={5} className="specialists-empty">پزشکی با این مشخصات یافت نشد.</td></tr>}</tbody></table></div>
      <footer className="specialists-pagination"><span role="status">{filtered.length ? `${fa((current - 1) * 10 + 1)} تا ${fa(Math.min(current * 10, filtered.length))} از ${fa(filtered.length)} مورد` : '۰ مورد'}</span><div><button className="secondary" disabled={current === 1} onClick={() => setPage(current - 1)}><Icon name="chevron-right" />قبلی</button><span aria-current="page">{fa(current)}</span><button className="secondary" disabled={current === pages} onClick={() => setPage(current + 1)}>بعدی<Icon name="chevron-left" /></button></div></footer>
    </section>
    {(creating || editing) && <SpecialistDialog
      key={editing ? String(editing.id) : 'create'}
      title={editing ? 'ویرایش پزشک' : createdId ? 'حساب پزشک ایجاد شد' : 'افزودن پزشک'}
      onClose={close}
    >
      {createdId ? <div className="specialist-dialog-body">
        <p className="info-note" role="status" tabIndex={-1} ref={createdNotice}>حساب پزشک ایجاد شد. می‌توانید زیرمجموعه‌ها را اضافه کنید.</p>
        <SpecialistMembers id={createdId} preview={false} onChanged={onChanged} />
        <div className="specialist-dialog-actions"><button type="button" onClick={close}><Icon name="check" />پایان</button></div>
      </div> : <form className="specialist-dialog-body" onSubmit={save}>
        {preview && <p className="info-note">حالت پیش‌نمایش؛ اطلاعات این فرم ذخیره نمی‌شود.</p>}
        <section className="specialist-form-card">
          <h3>اطلاعات فردی و حرفه‌ای</h3>
          {!editing && <p>مشخصات پزشک را مطابق مدارک وارد کنید.</p>}
          <div className="specialist-form-grid">
            {editing ? <>
              <label>نام پزشک<input name="displayName" defaultValue={String(editing.displayName ?? '')} maxLength={80} required /></label>
              <label>مدرک تحصیلی<input name="credential" defaultValue={String(editing.credential ?? '')} maxLength={120} /></label>
            </> : <>
              <label>نام<input name="firstName" required maxLength={40} autoFocus /></label>
              <label>نام خانوادگی<input name="lastName" required maxLength={40} /></label>
              <label>تاریخ تولد<input name="birthDate" type="date" min="1920-01-01" max={new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())} /></label>
              <label>کد نظام پزشکی<input name="councilNo" dir="ltr" inputMode="numeric" maxLength={6} placeholder="۱۲۳۴۵۶" aria-describedby="specialist-council-hint" /><small id="specialist-council-hint">دقیقاً ۶ رقم.</small></label>
              <label>تحصیلات<input name="education" maxLength={120} /></label>
              <label>شماره تلفن<input name="phone" type="tel" dir="ltr" inputMode="numeric" maxLength={11} placeholder="۰۹۱۲۳۴۵۶۷۸۹" aria-describedby="specialist-phone-hint" required /><small id="specialist-phone-hint">۱۱ رقم، با شروع ۰۹.</small></label>
            </>}
            {editing ? <>
              <label>ظرفیت<input name="capacity" type="number" min={0} max={500} defaultValue={Number(editing.capacity ?? 20)} required /></label>
              <label className="specialist-checkbox"><input type="checkbox" name="active" defaultChecked={editing.active !== false} />فعال</label>
              <label className="specialist-form-wide">درباره پزشک<textarea name="bio" maxLength={500} defaultValue={String(editing.bio ?? '')} /></label>
            </> : <details className="specialist-form-wide"><summary>ظرفیت پذیرش</summary><label>تعداد کاربران<input name="capacity" type="number" min={0} max={500} defaultValue={20} required /></label></details>}
          </div>
        </section>
        {!editing && <>
          <PortraitField />
          <section className="specialist-form-card">
            <h3>دسترسی به پنل پزشک</h3>
            <div className="specialist-form-grid">
              <label>نام کاربری<input name="username" dir="ltr" placeholder="doctor.name" pattern="[A-Za-z][A-Za-z0-9._\-]{2,31}" maxLength={32} autoComplete="off" aria-describedby="specialist-username-hint" /><small id="specialist-username-hint">۳ تا ۳۲ نویسهٔ انگلیسی، با شروع حرف.</small></label>
              <label>رمز عبور<input name="password" type="password" dir="ltr" minLength={8} maxLength={256} autoComplete="new-password" aria-describedby="specialist-password-hint" /><small id="specialist-password-hint">حداقل ۸ نویسه. پزشک می‌تواند با شماره و کد پیامکی هم وارد شود.</small></label>
            </div>
          </section>
        </>}
        {editing ? <SpecialistMembers id={String(editing.id)} preview={preview} onChanged={onChanged} /> : <section className="specialist-form-card">
          <h3>زیرمجموعه‌ها</h3><p>بعد از ایجاد حساب، کاربران را همین‌جا به زیرمجموعهٔ پزشک اضافه کنید.</p>
        </section>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="specialist-dialog-actions">
          <button type="submit" disabled={saving || preview}><Icon name="check" />{saving ? 'در حال ذخیره…' : editing ? 'ذخیره پزشک' : 'ایجاد حساب پزشک'}</button>
          <button type="button" className="secondary" disabled={saving} onClick={close}>انصراف</button>
        </div>
      </form>}
    </SpecialistDialog>}
  </>
}
