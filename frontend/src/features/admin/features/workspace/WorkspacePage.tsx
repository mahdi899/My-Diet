import { FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { StaffError } from '@shared/api/staff-session'
import { Button, Card, CardBody, DataTable, DefinitionList, Input } from '@shared/ui'
import { AdminIcon as Icon } from '../../components/AdminIcon'
import { asRecord, asRows, formatFaNumber } from '@shared/utils'
import { staff } from '../../session'
import { adminSectionPath } from '../../nav'
import { UsersTable } from '../users/UsersTable'
import { SpecialistsPage } from '../specialists/SpecialistsPage'
import { adminPreviewEnabled, previewSection } from '../../data/preview'

async function loadSection(section: string) {
  if (adminPreviewEnabled()) return previewSection(section)
  if (section === 'settings') return { kind: 'settings' as const }
  if (section === 'dashboard') {
    const [stats, payments] = await Promise.all([staff.api('admin/dashboard'), staff.api('admin/payments')])
    return { kind: 'dashboard' as const, stats, payments: asRows(payments) }
  }
  if (section === 'payments') {
    const [payments, transfers] = await Promise.all([
      staff.api('admin/payments'),
      staff.api('admin/onboarding-transfers'),
    ])
    return { kind: 'payments' as const, payments: asRows(payments), transfers: asRows(transfers) }
  }
  const path = adminSectionPath(section)
  if (!path) return { kind: 'empty' as const }
  const payload = await staff.api(path)
  const rows = asRows(payload)
  if (rows.length || Array.isArray(payload)) return { kind: 'table' as const, rows }
  const record = asRecord(payload)
  return record ? { kind: 'object' as const, value: record } : { kind: 'table' as const, rows: [] }
}

function Metric({ label, value, note, icon, tone, unit }: { label: string; value: unknown; note: string; icon: string; tone: string; unit?: string }) {
  const shown = typeof value === 'number' ? formatFaNumber(value) : String(value ?? '—')
  return (
    <section className="card metric-card"><div className="metric-top"><p>{label}</p><span className={`icon-tile tone-${tone}`}><Icon name={icon} className="icon" /></span></div><div className="metric-value">{shown}{unit && <small>{unit}</small>}</div><div className="metric-foot">{note}</div></section>
  )
}

function SettingsForm() {
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function savePrice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    setError('')
    try {
      await staff.api('admin/prices', 'PUT', {
        serviceCode: String(data.get('serviceCode') ?? ''),
        amountToman: Number(data.get('amountToman')),
      })
      setMessage('تعرفه ذخیره شد')
    } catch (cause) {
      setError(cause instanceof StaffError ? cause.message : 'ذخیره انجام نشد')
    }
  }

  async function saveReward(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    setError('')
    try {
      await staff.api('admin/reward', 'PUT', { amountToman: Number(data.get('amountToman')) })
      setMessage('پاداش ذخیره شد')
    } catch (cause) {
      setError(cause instanceof StaffError ? cause.message : 'ذخیره انجام نشد')
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <form onSubmit={savePrice} className="p-6">
          <h2 className="mb-4 text-base font-bold">تعرفه خدمات</h2>
          <label className="text-sm font-semibold">خدمت
            <select name="serviceCode" required className="mb-4 mt-2 w-full rounded-[9px] border border-line-strong px-3 py-3">
              <option value="new_plan">برنامه جدید</option>
              <option value="ai_revision">بازنگری هوش مصنوعی</option>
              <option value="specialist_revision">بازنگری پزشک</option>
            </select>
          </label>
          <label className="text-sm font-semibold">مبلغ (تومان)
            <Input name="amountToman" type="number" min={1} required className="mt-2" />
          </label>
          <Button type="submit">ذخیره تعرفه</Button>
        </form>
      </Card>
      <Card>
        <form onSubmit={saveReward} className="p-6">
          <h2 className="mb-4 text-base font-bold">پاداش هفتگی</h2>
          <label className="text-sm font-semibold">مبلغ پاداش (تومان)
            <Input name="amountToman" type="number" min={0} required className="mt-2" />
          </label>
          <Button type="submit">ذخیره پاداش</Button>
        </form>
      </Card>
      {message && <p className="text-sm text-green">{message}</p>}
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  )
}

export function SpecialistForm({ onCreated }: { onCreated: () => void }) {
  const [error, setError] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = Object.fromEntries(new FormData(event.currentTarget))
    setError('')
    try {
      await staff.api('admin/specialists', 'POST', {
        phone: data.phone,
        firstName: data.firstName,
        lastName: data.lastName,
        username: data.username || undefined,
        password: data.password || undefined,
        capacity: Number(data.capacity || 20),
      })
      event.currentTarget.reset()
      onCreated()
    } catch (cause) {
      setError(cause instanceof StaffError ? cause.message : 'ثبت پزشک انجام نشد')
    }
  }
  return (
    <Card className="mb-4">
      <form onSubmit={submit} className="grid gap-3 p-6 md:grid-cols-2">
        <h2 className="md:col-span-2 text-base font-bold">افزودن پزشک</h2>
        <Input name="firstName" required placeholder="نام" maxLength={40} />
        <Input name="lastName" required placeholder="نام خانوادگی" maxLength={40} />
        <Input name="phone" required dir="ltr" placeholder="09123456789" maxLength={13} />
        <Input name="capacity" type="number" min={0} max={500} placeholder="ظرفیت" defaultValue={20} />
        <Input name="username" dir="ltr" placeholder="نام کاربری" maxLength={32} />
        <Input name="password" type="password" dir="ltr" placeholder="رمز عبور" maxLength={256} />
        {error && <p className="text-sm text-danger md:col-span-2">{error}</p>}
        <Button type="submit">ثبت پزشک</Button>
      </form>
    </Card>
  )
}

function ReviewActions({ id, onDone }: { id: string; onDone: () => void }) {
  const [error, setError] = useState('')
  async function setStatus(status: 'approved' | 'rejected') {
    try {
      await staff.api('admin/reviews/' + encodeURIComponent(id), 'POST', { status })
      onDone()
    } catch (cause) {
      setError(cause instanceof StaffError ? cause.message : 'بررسی انجام نشد')
    }
  }
  return (
    <div className="flex gap-2">
      <Button type="button" variant="secondary" onClick={() => setStatus('approved')}>تأیید</Button>
      <Button type="button" variant="danger" onClick={() => setStatus('rejected')}>رد</Button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  )
}

export function WorkspacePage({ section, createSpecialist = false, onCloseCreate = () => {} }: { section: string; createSpecialist?: boolean; onCloseCreate?: () => void }) {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: ['admin', section, adminPreviewEnabled() ? 'preview' : 'live'],
    queryFn: () => loadSection(section),
  })

  if (query.isLoading) return <Card><CardBody>در حال دریافت…</CardBody></Card>
  if (query.isError) {
    const message = query.error instanceof StaffError ? query.error.message : 'ارتباط با سرور برقرار نشد'
    return (
      <Card>
        <CardBody>
          <p className="mb-3 text-sm text-danger">{message}</p>
          <Button variant="secondary" onClick={() => query.refetch()}>تلاش دوباره</Button>
        </CardBody>
      </Card>
    )
  }

  const data = query.data
  if (!data) return null
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin', section] })

  if (data.kind === 'settings') return <SettingsForm />
  if (data.kind === 'dashboard') {
    const stats = asRecord(data.stats) ?? {}
    return (
      <div className="dashboard-page">
        <section className="dashboard-hero"><div className="hero-copy"><span className="eyebrow">هر روز، یک قدم به سلامت نزدیک‌تر</span><h2>رژیم من را با یک نگاه مدیریت کنید.</h2><p>از پیگیری درخواست‌ها تا ارتباط با کاربران؛ همهٔ مسیرهای مهم، همین‌جا در دسترس شماست.</p><Link className="hero-action" to="/admin/requests">مشاهده درخواست‌ها <Icon name="arrow" className="icon" /></Link></div><div className="hero-decoration" aria-hidden="true"><Icon name="leaf" className="icon" /></div></section>
        <div className="metrics-grid">
          <Metric icon="users" tone="green" label="کاربران" value={stats.users} note={`${formatFaNumber(Number(stats.newUsers ?? 0))} عضو جدید در ۷ روز اخیر`} />
          <Metric icon="wallet" tone="amber" unit="تومان" label="درآمد ۳۰ روز اخیر" value={stats.revenueToman} note={`${formatFaNumber(Number(stats.paidOrders ?? 0))} خرید پکیج`} />
          <Metric icon="message" tone="blue" label="پیام‌های خوانده‌نشده" value={stats.unreadMessages} note="پیام‌های پشتیبانی در انتظار بررسی" />
          <Metric icon="sparkles" tone="rose" label="درخواست‌های امروز AI" value={stats.aiToday} note="تلاش‌های ثبت‌شده امروز · وقت تهران" />
        </div>
        <div className="dashboard-lower"><section className="card">
          <div className="section-head"><div><h2>آخرین پرداخت‌ها</h2><p>پنج خرید اخیر پکیج</p></div><Link to="/admin/payments">همه پرداخت‌ها <Icon name="arrow" className="icon" /></Link></div>
          <DataTable rows={data.payments.slice(0, 5)} />
        </section><section className="card quick-panel"><div className="section-head"><div><h2>دسترسی سریع</h2><p>از کجا شروع می‌کنید؟</p></div></div><div className="quick-links">{[
          ['users', 'کاربران', 'حساب‌ها و اطلاعات کاربران', 'users'], ['payments', 'پرداخت‌ها', 'خرید پکیج‌ها', 'wallet'], ['messages', 'پیام‌ها', 'گفت‌وگو با کاربران', 'message'], ['tickets', 'تیکت‌ها', 'درخواست‌های پشتیبانی', 'headphones'],
        ].map(([id, title, description, icon]) => <Link className="quick-link" key={id} to={`/admin/${id}`}><span className="icon-tile"><Icon name={icon!} className="icon" /></span><div><strong>{title}</strong><small>{description}</small></div><Icon name="arrow" className="icon" /></Link>)}</div></section></div>
      </div>
    )
  }
  if (data.kind === 'payments') {
    return (
      <div className="space-y-5">
        <Card>
          <h2 className="border-b border-line px-6 py-4 text-base font-bold">واریزهای آنبوردینگ</h2>
          <DataTable rows={data.transfers} />
        </Card>
        <Card>
          <h2 className="border-b border-line px-6 py-4 text-base font-bold">پرداخت‌ها</h2>
          <DataTable rows={data.payments} />
        </Card>
      </div>
    )
  }
  if (data.kind === 'object') {
    return <Card><DefinitionList value={data.value} /></Card>
  }
  if (data.kind === 'empty') return null
  if (section === 'users') return <UsersTable rows={data.rows} onChanged={refresh} />
  if (section === 'specialists') return <SpecialistsPage rows={data.rows} onChanged={refresh} creating={createSpecialist} onCloseCreate={onCloseCreate} />

  return (
    <div>
      <Card>
        <DataTable rows={data.rows} />
        {section === 'reviews' && (
          <div className="space-y-3 border-t border-line p-4">
            {data.rows.map((row) => (
              typeof row.id === 'string' ? <ReviewActions key={row.id} id={row.id} onDone={refresh} /> : null
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
