import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { asRecord, asRows, formatFaDate, formatFaNumber } from '@shared/utils'
import { AdminIcon as Icon } from '../../components/AdminIcon'
import { staff } from '../../session'

export const pushPath = 'admin/push'
export type Campaign = Record<string, unknown>
export type NotificationModal = 'firebase' | 'create' | null
export const campaignStates: Record<string, string> = {
  draft: 'پیش‌نویس', scheduled: 'زمان‌بندی‌شده', sending: 'در حال ارسال', completed: 'پایان ارسال', failed: 'ناموفق',
}
export const audienceLabel = (value: unknown) => value === 'all' ? 'همه کاربران' : 'آزمایشی · یک دستگاه'
export const pushDate = (value: unknown) => formatFaDate(value) ?? '—'
export const pushNumber = (value: unknown) => value == null ? '—' : formatFaNumber(Number(value))
export const pushError = (error: unknown) => error instanceof Error ? error.message : 'عملیات انجام نشد.'

export function PushNote({ children }: { children: ReactNode }) {
  return <p className="push-note"><Icon name="info" /><span>{children}</span></p>
}

export function NotificationDialog({ title, icon, close, busy, children }: {
  title: string; icon: string; close: () => void; busy: boolean; children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    dialog?.showModal()
    dialog?.querySelector<HTMLElement>('[data-initial-focus]')?.focus()
    return () => dialog?.close()
  }, [])
  return <dialog className="push-dialog" ref={ref} aria-labelledby="push-dialog-title" onCancel={event => {
    event.preventDefault()
    if (!busy) close()
  }}>
    <header><h2 id="push-dialog-title"><span className="icon-tile tone-green"><Icon name={icon} /></span>{title}</h2>
      <button type="button" className="icon-button" aria-label="بستن" disabled={busy} onClick={close}><Icon name="close" /></button></header>
    {children}
  </dialog>
}

function FormActions({ label, busy, disabled, close }: { label: string; busy: boolean; disabled: boolean; close: () => void }) {
  return <div className="push-dialog-actions">
    <button type="submit" disabled={busy || disabled}><Icon name="check" />{busy ? 'در حال ذخیره…' : label}</button>
    <button type="button" className="secondary" disabled={busy} onClick={close}>انصراف</button>
  </div>
}

type FormProps = { preview: boolean; close: () => void; saved: (message: string) => void }

export function FirebaseForm({ preview, close, saved }: FormProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (preview || busy) return
    setError('')
    let account: Record<string, unknown>
    try {
      const parsed = asRecord(JSON.parse(String(new FormData(event.currentTarget).get('account') ?? '')))
      if (!parsed || !['project_id', 'client_email', 'private_key'].every(key => typeof parsed[key] === 'string' && String(parsed[key]).trim())) {
        throw new Error()
      }
      account = parsed
    } catch {
      setError('JSON حساب سرویس معتبر نیست. محتوای کامل فایل را وارد کنید.')
      return
    }
    setBusy(true)
    try {
      await staff.api(pushPath + '/firebase', 'PUT', account)
      saved('اتصال Firebase ذخیره شد.')
    } catch (cause) { setError(pushError(cause)) }
    finally { setBusy(false) }
  }
  return <NotificationDialog title="اتصال به Firebase" icon="server" busy={busy} close={close}>
    <form className="push-dialog-form" onSubmit={submit}>
      <PushNote>برای ارسال پوش، اطلاعات حساب سرویس Firebase پروژه را ثبت کنید. کلید خصوصی پس از ذخیره نمایش داده نمی‌شود.</PushNote>
      <label>JSON حساب سرویس
        <textarea name="account" rows={8} className="push-account" dir="ltr" spellCheck={false} autoComplete="off" required
          aria-describedby="push-account-hint" data-initial-focus placeholder={'{ "project_id": "…", "client_email": "…", "private_key": "…" }'} />
        <small id="push-account-hint">محتوای فایل حساب سرویس را به‌طور کامل وارد کنید.</small>
      </label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <FormActions label="ذخیره اتصال" busy={busy} disabled={preview} close={close} />
    </form>
  </NotificationDialog>
}

export function CampaignForm({ preview, close, saved }: FormProps) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [audience, setAudience] = useState('device')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const devices = useQuery({
    queryKey: ['admin-push', 'devices', preview],
    queryFn: async () => preview ? [] : asRows(await staff.api(pushPath + '/devices')),
  })
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (preview || busy) return
    const data = new FormData(event.currentTarget)
    const deviceId = String(data.get('deviceId') ?? '')
    const schedule = String(data.get('scheduledAt') ?? '')
    setError('')
    if (!title.trim() || !body.trim() || (audience === 'device' && !deviceId)) {
      setError('عنوان، متن و مخاطب اعلان را تکمیل کنید.')
      return
    }
    setBusy(true)
    try {
      await staff.api(pushPath + '/campaigns', 'POST', {
        title: title.trim(), body: body.trim(), audience,
        ...(audience === 'device' ? { deviceId } : {}),
        ...(schedule ? { scheduledAt: new Date(schedule + ':00+03:30').toISOString() } : {}),
      })
      saved('پیش‌نویس اعلان ذخیره شد.')
    } catch (cause) { setError(pushError(cause)) }
    finally { setBusy(false) }
  }
  return <NotificationDialog title="ساخت اعلان جدید" icon="bell" busy={busy} close={close}>
    <form className="push-dialog-form" onSubmit={submit}>
      <label>عنوان اعلان<input name="title" value={title} onChange={event => setTitle(event.target.value)} required maxLength={120}
        placeholder="عنوان کوتاه و روشن برای پیام شما" data-initial-focus /></label>
      <label>متن اعلان<textarea name="body" rows={3} value={body} onChange={event => setBody(event.target.value)} required maxLength={1000}
        placeholder="چه پیامی برای کاربران دارید؟" /></label>
      <div className="push-preview">
        <span className="icon-tile tone-green"><Icon name="leaf" /></span>
        <div><strong>{title.trim() || 'رژیم من'}</strong><p>{body.trim() || 'پیش‌نمایش پیام شما'}</p></div><small>پیش‌نمایش</small>
      </div>
      <label>مخاطبان<select value={audience} onChange={event => setAudience(event.target.value)}>
        <option value="device">آزمایشی · یک دستگاه</option><option value="all">همه کاربران</option>
      </select></label>
      {audience === 'device' && <div>
        <label>دستگاه آزمایشی<select name="deviceId" defaultValue="" required disabled={devices.isPending || !devices.data?.length} aria-describedby="push-device-hint">
          <option value="">یک دستگاه انتخاب کنید</option>
          {devices.data?.map(device => <option key={String(device.id)} value={String(device.id)}>
            {String(device.displayName || 'کاربر')} · {String(device.platform ?? '—')} · {String(device.id).slice(-6)}
          </option>)}
        </select></label>
        {devices.isError ? <div id="push-device-hint"><p role="alert">{pushError(devices.error)}</p><button type="button" className="secondary" onClick={() => void devices.refetch()}>تلاش دوباره</button></div> :
          <small id="push-device-hint">{devices.isPending ? 'در حال دریافت دستگاه‌ها…' : !devices.data?.length ?
            'هنوز دستگاهی برای دریافت اعلان ثبت نشده است. برای ذخیره پیش‌نویس می‌توانید «همه کاربران» را انتخاب کنید.' : ''}</small>}
      </div>}
      <label>زمان ارسال (اختیاری)<input type="datetime-local" name="scheduledAt" dir="ltr" aria-describedby="push-schedule-hint" />
        <small id="push-schedule-hint">به وقت تهران. برای ارسال بدون زمان‌بندی، این فیلد را خالی بگذارید.</small>
      </label>
      <PushNote>ابتدا پیش‌نویس ذخیره می‌شود. ارسال نهایی را از بخش جزئیات تأیید می‌کنید.</PushNote>
      {error && <p className="form-error" role="alert">{error}</p>}
      <FormActions label="ذخیره پیش‌نویس" busy={busy} disabled={preview || (audience === 'device' && !devices.data?.length)} close={close} />
    </form>
  </NotificationDialog>
}
