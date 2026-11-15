import { FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { StaffError } from '@shared/api/staff-session'
import { Button, Card, CardBody, DataTable, DefinitionList, Input } from '@shared/ui'
import { AdminIcon as Icon } from '../../components/AdminIcon'
import { asRecord, asRows, formatFaDate, formatFaNumber, statusLabels } from '@shared/utils'
import { staff } from '../../session'
import { adminSectionPath } from '../../nav'
import { UsersTable } from '../users/UsersTable'
import { RequestsTable } from '../requests/RequestsTable'
import { ReviewsTable } from '../reviews/ReviewsTable'
import { TicketsTable } from '../tickets/TicketsTable'
import { AuditLogsTable } from '../audit/AuditLogsTable'
import { PaymentsPage } from '../payments/PaymentsPage'
import { SpecialistsPage } from '../specialists/SpecialistsPage'
import { adminPreviewEnabled, previewSection } from '../../data/preview'

async function loadSection(section: string) {
  if (adminPreviewEnabled()) return previewSection(section)
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

const planNames: Record<string, string> = { weekly: 'شروع', monthly: 'همراه', quarterly: 'VIP' }

function paymentStatusTone(status: string) {
  if (['active', 'paid', 'credited', 'approved', 'verified', 'published'].includes(status)) return 'success'
  if (['failed', 'rejected', 'suspended', 'deleted'].includes(status)) return 'danger'
  if (['pending', 'queued', 'in_review', 'generating'].includes(status)) return 'warning'
  return 'neutral'
}

function RecentPayments({ rows }: { rows: Record<string, unknown>[] }) {
  const recent = rows.slice(0, 5)
  return (
    <section className="card data-panel compact-panel dashboard-payments">
      <div className="section-head">
        <div><h2>آخرین پرداخت‌ها</h2><p>پنج خرید اخیر پکیج</p></div>
        <Link className="secondary" to="/admin/payments">همه پرداخت‌ها <Icon name="arrow" className="icon" /></Link>
      </div>
      <div className="table-wrap" tabIndex={0} role="region" aria-label="آخرین پرداخت‌ها">
        <table>
          <thead>
            <tr>
              <th scope="col">کاربر</th>
              <th scope="col">پکیج</th>
              <th scope="col">مبلغ</th>
              <th scope="col">وضعیت</th>
              <th scope="col">زمان پرداخت</th>
            </tr>
          </thead>
          <tbody>
            {recent.map(row => {
              const name = String(row.user ?? '').trim() || 'بدون نام'
              const status = String(row.status ?? '')
              const amount = typeof row.amountToman === 'number' ? row.amountToman : Number(row.amountToman)
              const code = String(row.packageCode ?? '')
              return (
                <tr key={String(row.id)}>
                  <td>
                    <div className="person-cell">
                      <span className="avatar avatar-soft" aria-hidden="true">{name.charAt(0) || 'ک'}</span>
                      <div>
                        <strong>{name}</strong>
                        <small>پرداخت <bdi>{String(row.id ?? '').slice(0, 8) || '—'}</bdi></small>
                      </div>
                    </div>
                  </td>
                  <td>{planNames[code] ?? (code || '—')}</td>
                  <td>{Number.isFinite(amount) ? <span className="money">{formatFaNumber(amount)}<small>تومان</small></span> : '—'}</td>
                  <td><span className={`badge badge-${paymentStatusTone(status)}`}><span className="badge-dot" />{statusLabels[status] ?? (status || '—')}</span></td>
                  <td className="cell-nowrap">{formatFaDate(row.paidAt ?? row.createdAt) ?? '—'}</td>
                </tr>
              )
            })}
            {!recent.length && (
              <tr>
                <td className="empty-cell" colSpan={5}>
                  <div className="empty-state">
                    <span className="icon-tile"><Icon name="wallet" className="icon" /></span>
                    <h3>هنوز پرداختی ثبت نشده</h3>
                    <p>با خرید اولین پکیج، جزئیات آن را اینجا خواهید دید.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function Metric({ label, value, note, icon, tone, unit }: { label: string; value: unknown; note: string; icon: string; tone: string; unit?: string }) {
  const shown = typeof value === 'number' ? formatFaNumber(value) : String(value ?? '—')
  return (
    <section className="card metric-card"><div className="metric-top"><p>{label}</p><span className={`icon-tile tone-${tone}`}><Icon name={icon} className="icon" /></span></div><div className="metric-value">{shown}{unit && <small>{unit}</small>}</div><div className="metric-foot">{note}</div></section>
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
        <div className="dashboard-lower">
          <RecentPayments rows={data.payments} />
          <section className="card quick-panel"><div className="section-head"><div><h2>دسترسی سریع</h2><p>از کجا شروع می‌کنید؟</p></div></div><div className="quick-links">{[
          ['users', 'کاربران', 'حساب‌ها و اطلاعات کاربران', 'users'], ['payments', 'پرداخت‌ها', 'خرید پکیج‌ها', 'wallet'], ['messages', 'پیام‌ها', 'گفت‌وگو با کاربران', 'message'], ['tickets', 'تیکت‌ها', 'درخواست‌های پشتیبانی', 'headphones'],
        ].map(([id, title, description, icon]) => <Link className="quick-link" key={id} to={`/admin/${id}`}><span className="icon-tile"><Icon name={icon!} className="icon" /></span><div><strong>{title}</strong><small>{description}</small></div><Icon name="arrow" className="icon" /></Link>)}</div></section></div>
      </div>
    )
  }
  if (data.kind === 'payments') {
    return <PaymentsPage transfers={data.transfers} payments={data.payments} preview={adminPreviewEnabled()} onChanged={refresh} />
  }
  if (data.kind === 'object') {
    return <Card><DefinitionList value={data.value} /></Card>
  }
  if (data.kind === 'empty') return null
  if (section === 'users') return <UsersTable rows={data.rows} onChanged={refresh} />
  if (section === 'requests') return <RequestsTable rows={data.rows} />
  if (section === 'specialists') return <SpecialistsPage rows={data.rows} onChanged={refresh} creating={createSpecialist} onCloseCreate={onCloseCreate} />

  if (section === 'reviews') return <ReviewsTable rows={data.rows} preview={adminPreviewEnabled()} onChanged={refresh} />
  if (section === 'tickets') return <TicketsTable rows={data.rows} />
  if (section === 'audit-logs') return <AuditLogsTable rows={data.rows} />

  return <Card><DataTable rows={data.rows} /></Card>
}
