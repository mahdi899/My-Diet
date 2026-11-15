import { useState, type FormEvent, type ReactNode } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { asRows, formatFaNumber, toEnglishDigits } from '@shared/utils'
import { AdminIcon as Icon } from '../../components/AdminIcon'
import { staff } from '../../session'
import '../settings/settings.css'
import './streaks.css'

const path = 'admin/streak-campaigns'
type Milestone = { day: number; amountToman: number }
type Campaign = {
  version: number
  consecutiveDays: number
  milestones: Milestone[]
  startsOn: string
  effectiveOn: string
  endsOn: string | null
  repeat: 'cycle' | 'none'
}
type CampaignInput = Omit<Campaign, 'version'>
const sample: Campaign = {
  version: 1, consecutiveDays: 7, milestones: [{ day: 7, amountToman: 200000 }],
  startsOn: '2026-10-24', effectiveOn: '2026-10-24', endsOn: null, repeat: 'cycle',
}
const previewKey = 'admin-streak-preview-versions'
const dateFormat = /^\d{4}-\d{2}-\d{2}$/
function parseVersions(value: unknown): Campaign[] {
  return asRows(value).flatMap<Campaign>(row => {
    const { version, consecutiveDays, startsOn, effectiveOn, endsOn, repeat } = row
    if (typeof version !== 'number' || !Number.isSafeInteger(version) || typeof consecutiveDays !== 'number' ||
      typeof startsOn !== 'string' || !dateFormat.test(startsOn) || typeof effectiveOn !== 'string' || !dateFormat.test(effectiveOn) ||
      (endsOn !== null && (typeof endsOn !== 'string' || !dateFormat.test(endsOn))) || (repeat !== 'cycle' && repeat !== 'none')) return []
    const milestones = asRows(row.milestones).flatMap(item => typeof item.day === 'number' && typeof item.amountToman === 'number'
      ? [{ day: item.day, amountToman: item.amountToman }] : [])
    return [{ version, consecutiveDays, startsOn, effectiveOn, endsOn, repeat, milestones }]
  }).sort((a, b) => a.version - b.version)
}

function readSamples() {
  try {
    const versions = parseVersions(JSON.parse(sessionStorage.getItem(previewKey) ?? 'null'))
    if (versions.length) return versions
  } catch { /* A fresh preview starts with the sample campaign. */ }
  return [sample]
}

function CardHeader({ title, description, icon }: { title: string; description: string; icon: string }) {
  return <header><div><h2>{title}</h2><p>{description}</p></div>
    <span className="icon-tile tone-green"><Icon name={icon} /></span></header>
}

function Note({ children }: { children: ReactNode }) {
  return <p className="settings-note"><Icon name="info" /><span>{children}</span></p>
}

function readNumber(form: FormData, field: string, minimum: number, maximum = Number.MAX_SAFE_INTEGER) {
  const text = toEnglishDigits(String(form.get(field) ?? '')).trim()
  const value = Number(text)
  if (!/^\d+$/.test(text) || !Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error('تعداد روزها و مبلغ پاداش را بررسی کنید.')
  }
  return value
}

function CampaignForm({ current, preview, save }: { current: Campaign; preview: boolean; save: (input: CampaignInput) => Promise<unknown> }) {
  const [validation, setValidation] = useState('')
  const mutation = useMutation({ mutationFn: save })
  const intermediate = current.milestones.find(item => item.day < current.consecutiveDays)
  const otherMilestones = current.milestones.filter(item => item.day < current.consecutiveDays && item.day !== intermediate?.day)
  const final = current.milestones.find(item => item.day === current.consecutiveDays)

  function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (mutation.isPending) return
    setValidation('')
    mutation.reset()
    try {
      const form = new FormData(event.currentTarget)
      const consecutiveDays = readNumber(form, 'days', 1, 30)
      const middleAmount = readNumber(form, 'middleAmount', 0)
      const milestones = [...otherMilestones]
      if (middleAmount > 0) {
        const day = readNumber(form, 'middleDay', 1, consecutiveDays - 1)
        if (milestones.some(item => item.day === day)) throw new Error('روز مایل‌ستون تکراری است.')
        milestones.push({ day, amountToman: middleAmount })
      }
      if (milestones.some(item => item.day >= consecutiveDays)) throw new Error('مایل‌ستون‌های میانی باید قبل از روز پایانی باشند.')
      milestones.push({ day: consecutiveDays, amountToman: readNumber(form, 'finalAmount', 0) })
      const startsOn = String(form.get('startsOn') ?? '')
      const effectiveOn = String(form.get('effectiveOn') ?? '')
      const endsOn = String(form.get('endsOn') ?? '') || null
      if (endsOn && (endsOn < startsOn || endsOn < effectiveOn)) throw new Error('پایان دوره باید در تاریخ شروع و اثر نسخه یا بعد از آن باشد.')
      mutation.mutate({ consecutiveDays, milestones, startsOn, effectiveOn, endsOn, repeat: form.get('repeat') === 'none' ? 'none' : 'cycle' })
    } catch (cause) { setValidation(cause instanceof Error ? cause.message : 'اطلاعات کمپین معتبر نیست.') }
  }
  return <form onSubmit={publish} aria-busy={mutation.isPending}>
    <label>تعداد روزهای پیاپی<input name="days" type="number" min={1} max={30} defaultValue={current.consecutiveDays} required /></label>
    <label>روز مایل‌ستون میانی<input name="middleDay" type="number" min={1} max={29} defaultValue={intermediate?.day ?? Math.min(3, Math.max(1, current.consecutiveDays - 1))} /></label>
    <label>مبلغ مایل‌ستون میانی (تومان)<input name="middleAmount" inputMode="numeric" defaultValue={intermediate?.amountToman ?? 0} required /></label>
    <label>مبلغ روز پایانی (تومان)<input name="finalAmount" inputMode="numeric" defaultValue={final?.amountToman ?? 0} required /></label>
    {otherMilestones.length > 0 && <Note>مایل‌ستون‌های دیگر در نسخهٔ جدید حفظ می‌شوند: {otherMilestones.map(item => `روز ${formatFaNumber(item.day)}، ${formatFaNumber(item.amountToman)} تومان`).join(' · ')}</Note>}
    <label>شروع دوره<input type="date" dir="ltr" name="startsOn" defaultValue={current.startsOn} required /></label>
    <label>تاریخ اثر نسخه<input type="date" dir="ltr" name="effectiveOn" defaultValue={current.effectiveOn} required /></label>
    <label>پایان دوره<input type="date" dir="ltr" name="endsOn" defaultValue={current.endsOn ?? ''} /></label>
    <label>تکرار<select name="repeat" defaultValue={current.repeat}><option value="cycle">هر دوره از نو</option><option value="none">فقط یک دوره</option></select></label>
    <Note>کسی که دوره را شروع کرده، تا پایان همان دوره روی نسخه‌ای که با آن شروع کرده می‌ماند.</Note>
    {(validation || mutation.isError) && <p className="form-error" role="alert">{validation || mutation.error?.message || 'انتشار نسخه انجام نشد.'}</p>}
    <footer><button type="submit" disabled={mutation.isPending}><Icon name="check" />
      {mutation.isPending ? 'در حال انتشار…' : preview ? 'انتشار نسخهٔ نمونه' : 'انتشار نسخهٔ کمپین'}</button></footer>
  </form>
}

export function StreaksPage({ preview }: { preview: boolean }) {
  const [samples, setSamples] = useState(readSamples)
  const [notice, setNotice] = useState('')
  const query = useQuery({ queryKey: ['admin-streak-campaigns'], queryFn: async () => parseVersions(await staff.api(path)), enabled: !preview })
  const versions = preview ? samples : query.data ?? []
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  const current = versions.at(-1) ?? { ...sample, version: 0, startsOn: today, effectiveOn: today, milestones: [] }
  async function save(input: CampaignInput) {
    if (preview) {
      const next = [...samples, { ...input, version: current.version + 1 }]
      sessionStorage.setItem(previewKey, JSON.stringify(next))
      setSamples(next)
      setNotice('نسخهٔ جدید در پیش‌نمایش همین زبانه ذخیره شد.')
    } else {
      await staff.api(path, 'POST', input)
      const result = await query.refetch()
      setNotice(result.isError ? 'نسخه منتشر شد. به‌روزرسانی فهرست انجام نشد.' : 'نسخهٔ جدید کمپین منتشر شد.')
    }
  }
  if (!preview && !query.data) return <section className="settings-card streaks-feedback">
    {query.isError ? <><p role="alert">{query.error.message}</p><button type="button" className="secondary" onClick={() => void query.refetch()}>تلاش دوباره</button></> :
      <p role="status">در حال دریافت نسخه‌های کمپین…</p>}
  </section>
  return <div className="admin-settings streaks-layout">
    {notice && <p className="info-note streaks-notice" role="status">{notice}</p>}
    <section className="settings-card streaks-editor">
      <CardHeader title="کمپین روزهای پیاپی" icon="calendar"
        description={current.version ? `نسخهٔ ${formatFaNumber(current.version)}${preview ? ' در نمونهٔ همین مرورگر' : ''}.` : 'تنظیم اولین نسخهٔ کمپین.'} />
      <div className="streaks-intro"><Note>{preview ? 'این پیکربندی فقط در نمونهٔ همین مرورگر ذخیره می‌شود. ' : ''}
        روز فقط با ثبت وعده‌ها واجد شرایط می‌شود و ورود کاربر روز را کامل نمی‌کند. پاداش پس از تأیید، یک بار به کیف پول اضافه می‌شود.</Note></div>
      <CampaignForm key={current.version} current={current} preview={preview} save={save} />
      {preview && <div className="streaks-intro streaks-example"><Note>نمونهٔ ورود بدون ثبت وعده‌ها: ۰ روز واجد شرایط. اگر یک روز وعده‌ها ثبت نشود، شمارش روزهای پیاپی از نو شروع می‌شود.</Note></div>}
    </section>
    <section className="settings-card streaks-history">
      <CardHeader title={preview ? 'نسخه‌های منتشرشده در نمونه' : 'نسخه‌های منتشرشده'} icon="history" description="کاربران داخل دوره نسخهٔ قبلی را تمام می‌کنند." />
      {versions.length ? <ul>{versions.slice().reverse().map(version =>
        <li key={version.version}>نسخهٔ {formatFaNumber(version.version)} · {formatFaNumber(version.consecutiveDays)} روز · از <bdi dir="ltr">{version.effectiveOn}</bdi></li>
      )}</ul> : <p className="streaks-feedback">هنوز نسخه‌ای منتشر نشده است.</p>}
    </section>
  </div>
}
