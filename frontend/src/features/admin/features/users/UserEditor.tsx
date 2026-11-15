import { useEffect, useState } from 'react'
import { AdminIcon as Icon } from '../../components/AdminIcon'
import { staff } from '../../session'

type Answer = { question: string; answer: string }
type Registration = { label: string; link: string | null; source: string | null }
type Detail = {
  id: string
  phone: string
  displayName: string
  status: string
  role: string
  photo: string | null
  packageTitle: string | null
  daysRemaining: number | null
  registration: Registration
  goal: string
  answers: Answer[]
}

const statusText: Record<string, string> = { active: 'فعال', pending: 'در انتظار', suspended: 'غیرفعال', deleted: 'حذف‌شده' }
const statusChoices = [
  ['active', 'فعال', 'check'],
  ['pending', 'در انتظار', 'clock'],
  ['suspended', 'غیرفعال', 'lock'],
] as const
const sampleAnswers: Answer[] = ([
  ['اسم شما چیست؟', 'زهره ارجمندی'],
  ['چند سال داری؟', '۴۰ تا ۵۰ سال'],
  ['جنسیت چیه؟', 'زن'],
  ['قدت چقدره؟', '۱۶۸'],
  ['وزن فعلیت چقدره؟', '۶۸'],
  ['میزان فعالیت روزانه‌ات چقدره؟', 'متوسط'],
  ['معمولاً چند وعده در روز غذا می‌خوری؟', '۲ وعده'],
  ['به چه غذاهایی حساسیت داری؟', 'سایر – خورشت دوس ندارم غذاهای نفخ دار نمی خورم سردی ورم معده نمی خورم'],
  ['سبک تغذیه‌ات چیه؟', 'همه‌چیزخواری'],
  ['بیماری خاص یا شرایط پزشکی داری؟', 'تیروئید'],
  ['دارو یا مکمل خاصی مصرف می‌کنی؟', 'خیر'],
  ['معمولاً چه ساعت‌هایی می‌خوابی و بیدار می‌شی؟', 'خواب ۲۱ – بیداری ۵'],
  ['چقدر برای آماده‌کردن غذا وقت داری؟', 'بیشتر'],
  ['بودجه غذایی موردنظرت چقدره؟', 'بدون محدودیت'],
  ['شغل یا فعالیت روزانه‌ت بیشتر چه شکلیه؟', 'ترکیبی'],
  ['هفته‌ای چند روز ورزش می‌کنی؟', 'ورزش نمی‌کنم'],
  ['دوست داری به چه وزنی برسی؟', '۶۵'],
  ['ترجیح می‌دی با چه سرعتی وزن کم کنی؟', 'می‌خوام زودتر به نتیجه برسم'],
  ['بزرگ‌ترین چالش برای کاهش وزن چیه؟', 'نامنظم بودن وعده‌های غذایی'],
  ['معمولاً چه زمانی بیشتر احساس گرسنگی می‌کنی؟', 'عصر'],
  ['چقدر از غذاهای بیرون یا فست‌فود استفاده می‌کنی؟', 'به‌ندرت'],
  ['در گذشته برای کاهش وزن رژیم گرفتی؟', 'بله، ولی وزنم برگشت'],
  ['معمولاً در طول روز چقدر احساس گرسنگی یا ولع غذایی داری؟', 'متوسط'],
  ['آیا سابقه پرخوری همراه با احساس از دست دادن کنترل، یا محدود کردن شدید غذا داری؟', 'بله'],
] as const).map(([question, answer]) => ({ question, answer }))

function text(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function photoSource(value: unknown) {
  if (typeof value !== 'string' || !/^(?:\/9j\/|iVBORw0KGgo)[A-Za-z0-9+/=]+$/.test(value)) return null
  return `data:image/${value.startsWith('/9j/') ? 'jpeg' : 'png'};base64,${value}`
}

function registrationOf(value: unknown, fallback: string): Registration {
  const record = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  return {
    label: text(record.label, fallback),
    link: text(record.link) || null,
    source: text(record.source) || null,
  }
}

function sampleDetail(row: Record<string, unknown>): Detail {
  const name = text(row.displayName, 'زهره ارجمندی')
  return {
    id: String(row.id),
    phone: text(row.phone, '+989194460014'),
    displayName: name,
    status: text(row.status, 'pending'),
    role: 'user',
    photo: null,
    packageTitle: null,
    daysRemaining: null,
    registration: { label: 'آنبوردینگ وب', link: 'بهار', source: 'تلگرام' },
    goal: 'لاغری',
    answers: sampleAnswers.map(item => item.question === 'اسم شما چیست؟' ? { ...item, answer: name } : item),
  }
}

function detailFrom(payload: unknown, row: Record<string, unknown>): Detail {
  const record = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {}
  const intake = record.intake && typeof record.intake === 'object' ? record.intake as Record<string, unknown> : {}
  const personal = record.personalDetails && typeof record.personalDetails === 'object' ? record.personalDetails as Record<string, unknown> : {}
  const answers = Array.isArray(intake.answers) ? intake.answers.flatMap(item => {
    if (!item || typeof item !== 'object') return []
    const pair = item as Record<string, unknown>
    const question = text(pair.question)
    const answer = text(pair.answer)
    return question && answer ? [{ question, answer }] : []
  }) : []
  const days = record.daysRemaining
  return {
    id: text(record.id, String(row.id)),
    phone: text(record.phone, text(row.phone, '—')),
    displayName: text(record.displayName, text(row.displayName, 'بدون نام')),
    status: text(record.status, text(row.status, 'pending')),
    role: text(record.role, text(row.role, 'user')),
    photo: photoSource(personal.photo ?? row.photo),
    packageTitle: text(record.packageTitle, text(row.packageTitle)) || null,
    daysRemaining: typeof days === 'number' ? days : typeof row.daysRemaining === 'number' ? row.daysRemaining : null,
    registration: registrationOf(record.registration, text(row.registrationLabel, text(intake.source) === 'demo' ? 'آنبوردینگ وب' : 'اپلیکیشن')),
    goal: text(intake.trackLabel, '—'),
    answers,
  }
}

export function UserEditor({ row, preview, close, saved }: { row: Record<string, unknown>; preview: boolean; close: () => void; saved: () => void }) {
  const [detail, setDetail] = useState<Detail | null>(preview ? sampleDetail(row) : null)
  const [days, setDays] = useState('')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (preview) return
    let cancel = false
    staff.api(`admin/users/${encodeURIComponent(String(row.id))}`)
      .then(payload => {
        if (cancel) return
        const next = detailFrom(payload, row)
        setDetail(next)
        setDays(next.daysRemaining == null ? '' : String(next.daysRemaining))
      })
      .catch(cause => { if (!cancel) setError(cause instanceof Error ? cause.message : 'پرونده کاربر دریافت نشد') })
    return () => { cancel = true }
  }, [preview, row])

  async function run(name: string, work: () => Promise<void>) {
    if (preview) { setError('این مورد آزمایشی است؛ تغییرات ذخیره نمی‌شوند.'); return }
    setBusy(name)
    setError('')
    try { await work(); saved() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'ذخیره انجام نشد') }
    finally { setBusy('') }
  }

  const name = detail?.displayName || text(row.displayName, 'بدون نام')
  const linkLine = detail?.registration.link ? `${detail.registration.link}${detail.registration.source ? ` · ${detail.registration.source}` : ''}` : ''

  return <div className="users-dialog-backdrop" onClick={() => !busy && close()}><section role="dialog" aria-modal="true" aria-labelledby="user-editor-title" className="user-editor" onClick={event => event.stopPropagation()} onKeyDown={event => { if (event.key === 'Escape' && !busy) close() }}>
    <header className="user-editor-header">
      <div><span className="icon-tile"><Icon name="users" className="icon" /></span><h2 id="user-editor-title">ویرایش کاربر</h2></div>
      <button type="button" className="icon-button" aria-label="بستن" disabled={!!busy} onClick={close}><Icon name="close" /></button>
    </header>
    <div className="user-editor-body">
      {!detail && !error && <p>در حال دریافت پرونده…</p>}
      {detail && <>
        <div className="user-editor-identity">
          {detail.photo ? <img className="user-editor-avatar" src={detail.photo} alt="" /> : <span className="user-editor-avatar" aria-hidden="true">{name.trim()[0] || 'ک'}</span>}
          <strong>{name}</strong>
          <small dir="ltr">{detail.phone}</small>
          <span className={`badge badge-${detail.status === 'active' ? 'success' : detail.status === 'suspended' || detail.status === 'deleted' ? 'danger' : 'warning'}`}><span className="badge-dot" />{statusText[detail.status] ?? detail.status}</span>
        </div>
        <div className="user-editor-grid">
          <div><small>نام</small><strong>{name}</strong></div>
          <div><small>شماره ورود</small><strong className="ltr">{detail.phone}</strong></div>
          <div><small>هدف انتخاب‌شده</small><strong>{detail.goal}</strong></div>
          <div><small>ثبت‌نام از طریق</small><strong>{detail.registration.label}</strong>{linkLine && <em>{linkLine}</em>}</div>
          <div><small>وضعیت حساب</small><strong>{statusText[detail.status] ?? detail.status}</strong></div>
          <div><small>پکیج فعال</small><strong>{detail.packageTitle || 'پکیج فعالی ندارد'}</strong></div>
        </div>
        {detail.answers.length ? <section className="user-editor-card">
          <header><h3>پاسخ‌های پرسش‌نامه</h3><p>اطلاعاتی که کاربر در دمو یا اپ ثبت کرده است.</p></header>
          <dl className="user-editor-pairs">{detail.answers.map(item => <div key={item.question}><dt>{item.question}</dt><dd>{item.answer}</dd></div>)}</dl>
        </section> : <p className="user-editor-note">هنوز پاسخ پرسش‌نامه‌ای برای این حساب در دسترس نیست.</p>}
        <form className="user-editor-card user-editor-package" onSubmit={event => {
          event.preventDefault()
          const value = Number(days)
          if (!Number.isInteger(value) || value < 0 || value > 3650) { setError('تعداد روز درست نیست'); return }
          void run('package', async () => { await staff.api(`admin/users/${encodeURIComponent(detail.id)}/package`, 'PUT', { daysRemaining: value }) })
        }}>
          <header><h3>مدیریت پکیج</h3><p>{detail.packageTitle || 'پکیج فعالی ندارد'}</p></header>
          <label>روزهای مانده از پکیج<input name="daysRemaining" inputMode="numeric" min={0} max={3650} step={1} value={days} onChange={event => setDays(event.target.value)} /></label>
          <p>عدد جدید از همین لحظه محاسبه می‌شود. صفر یعنی دسترسی پکیج همین حالا تمام شود.</p>
          <button type="submit" disabled={!!busy}><Icon name="check" className="icon" />{busy === 'package' ? 'در حال ذخیره…' : 'ذخیره روزهای مانده'}</button>
        </form>
        {detail.status !== 'deleted' && detail.role !== 'admin' && <div className="user-editor-actions">
          {statusChoices.filter(([status]) => status !== detail.status).map(([status, label, icon]) => <button key={status} type="button" className="secondary" disabled={!!busy} onClick={() => void run(status, async () => { await staff.api(`admin/users/${encodeURIComponent(detail.id)}/status`, 'POST', { status }) })}><Icon name={icon} className="icon" />{busy === status ? 'در حال ذخیره…' : `تنظیم وضعیت: ${label}`}</button>)}
          <button type="button" className="danger" disabled={!!busy} onClick={() => setConfirmDelete(true)}><Icon name="trash" className="icon" />حذف حساب این شماره</button>
        </div>}
      </>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {confirmDelete && detail && <div className="user-editor-confirm" role="alertdialog" aria-labelledby="user-delete-title">
        <h3 id="user-delete-title">حذف حساب کاربری</h3>
        <p>حساب «{name}» و داده‌های وابسته‌اش حذف می‌شود.</p>
        <div>
          <button type="button" className="secondary" disabled={!!busy} onClick={() => setConfirmDelete(false)}>انصراف</button>
          <button type="button" className="danger" disabled={!!busy} onClick={() => void run('delete', async () => { await staff.api(`admin/users/${encodeURIComponent(detail.id)}/delete`, 'POST', { confirmation: 'حذف حساب' }) })}>{busy === 'delete' ? 'در حال حذف…' : 'حذف حساب'}</button>
        </div>
      </div>}
    </div>
  </section></div>
}
