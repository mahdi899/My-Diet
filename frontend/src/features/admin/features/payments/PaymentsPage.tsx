import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { asRows, formatFaDate, formatFaNumber, statusLabels, toEnglishDigits } from '@shared/utils'
import { AdminIcon as Icon } from '../../components/AdminIcon'
import { StatusFilter } from '../../components/StatusFilter'
import { staff } from '../../session'
import '../users/users.css'
import './payments.css'

type Row = Record<string, unknown>
type Column = { title: string; render: (row: Row) => ReactNode }
const plans: Record<string, string> = { weekly: 'شروع', monthly: 'همراه', quarterly: 'VIP' }
const smsLabels: Record<string, string> = { sent: 'ارسال شد', failed: 'ارسال ناموفق', sending: 'در حال ارسال' }
const normalize = (value: string) => toEnglishDigits(value).toLowerCase().trim()
const show = (value: unknown) => String(value ?? '') || '—'
const planName = (value: unknown) => plans[String(value)] ?? show(value)
const amount = (value: unknown) => typeof value === 'number' ? <span className="payments-amount"><strong>{formatFaNumber(value)}</strong> <small>تومان</small></span> : '—'
const phone = (value: unknown) => <bdi dir="ltr">{show(value)}</bdi>
const deliveryStatus: Record<string, string> = {
  queued: 'در صف ساخت',
  generating: 'در حال ساخت',
  in_review: 'در بررسی متخصص',
  awaiting_user: 'منتظر پاسخ کاربر',
  response_received: 'پاسخ کاربر رسید',
  published: 'منتشر شد',
  cancelled: 'لغو شد',
  profile: 'منتظر تکمیل پرونده',
  consent: 'منتظر موافقت کاربر',
  reconcile: 'نیازمند تطبیق',
  first_meal: 'اولین وعده ثبت شد',
  received: 'دریافت شد',
}

function PaymentTable({ title, description, rows, columns, searchFields, statusFilter = false }: {
  title: string
  description: string
  rows: Row[]
  columns: Column[]
  searchFields: (row: Row) => unknown[]
  statusFilter?: boolean
}) {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const options = new Set(['pending', 'credited', 'failed', ...rows.map(row => String(row.status ?? '')).filter(Boolean)])
  const query = normalize(search)
  const filtered = rows.filter(row => (!status || row.status === status)
    && searchFields(row).some(value => normalize(String(value ?? '')).includes(query)))
  const pageSize = 10
  const last = Math.max(1, Math.ceil(filtered.length / pageSize))
  const current = Math.min(last, page)
  const start = (current - 1) * pageSize
  const visible = filtered.slice(start, start + pageSize)

  return <section className="users-table-card payments-card" aria-label={title}>
    <header className="payments-card-heading"><h2>{title}</h2><p>{description}</p></header>
    <div className="users-toolbar"><div className="users-controls">
      <label className="users-search"><Icon name="search" /><span className="sr-only">جست‌وجو در {title}</span>
        <input type="search" placeholder={`جست‌وجو در ${title}…`} value={search}
          onChange={event => { setSearch(event.target.value); setPage(1) }} />
      </label>
      {statusFilter && <StatusFilter label="فیلتر وضعیت پرداخت" value={status}
        options={Array.from(options, value => [value, deliveryStatus[value] ?? statusLabels[value] ?? value] as const)}
        onChange={value => { setStatus(value); setPage(1) }} />}
    </div></div>
    <div className="users-table-scroll" tabIndex={0} role="region" aria-label={`جدول ${title}`}>
      <table><thead><tr>{columns.map(column => <th key={column.title} scope="col">{column.title}</th>)}</tr></thead>
        <tbody>
          {visible.map(row => <tr key={String(row.id)}>{columns.map(column => <td key={column.title}>{column.render(row)}</td>)}</tr>)}
          {!visible.length && <tr><td colSpan={columns.length} className="users-empty">موردی برای نمایش یافت نشد.</td></tr>}
        </tbody>
      </table>
    </div>
    <footer className="users-pagination">
      <span role="status">{filtered.length ? `${formatFaNumber(start + 1)} تا ${formatFaNumber(start + visible.length)} از ${formatFaNumber(filtered.length)} مورد` : '۰ مورد'}</span>
      <div>
        <button type="button" className="users-page-button" disabled={current === 1} onClick={() => setPage(current - 1)}><Icon name="chevron-right" />قبلی</button>
        <span className="users-current" aria-current="page">{formatFaNumber(current)}</span>
        <button type="button" className="users-page-button" disabled={current === last} onClick={() => setPage(current + 1)}>بعدی<Icon name="chevron-left" /></button>
      </div>
    </footer>
  </section>
}

function ConfirmTransfer({ row, close, confirmed }: { row: Row; close: () => void; confirmed: (message: string) => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => element?.close()
  }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const data = new FormData(event.currentTarget)
    setBusy(true)
    setError('')
    try {
      const result = await staff.api(`admin/onboarding-transfers/${encodeURIComponent(String(row.id))}/confirm`, 'POST', {
        reference: toEnglishDigits(String(data.get('reference') ?? '')).trim(),
        amountToman: Number(data.get('amount')),
      })
      const sent = result && typeof result === 'object' && 'smsStatus' in result && result.smsStatus === 'sent'
      confirmed(sent ? 'واریز تأیید و پیامک ارسال شد.' : 'واریز تأیید شد. پیامک ارسال نشد.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تأیید واریز انجام نشد.')
    } finally {
      setBusy(false)
    }
  }

  return <dialog ref={dialog} className="payment-confirm-dialog" aria-labelledby="confirm-transfer-title"
    onCancel={event => { event.preventDefault(); if (!busy) close() }}>
    <form onSubmit={submit}>
      <h2 id="confirm-transfer-title">تأیید واریز کارت‌به‌کارت</h2>
      <p>مبلغ مورد انتظار {amount(row.amount_toman)} است. مبلغ و شناسه را از گردش حساب وارد کنید.</p>
      <label>مبلغ واریزشده (تومان)<input name="amount" type="number" min={1} max={Number.MAX_SAFE_INTEGER} required /></label>
      <label>شناسه پیگیری بانکی<input name="reference" dir="ltr" minLength={4} maxLength={80} required /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="actions">
        <button type="submit" disabled={busy}>{busy ? 'در حال تأیید…' : 'ثبت تأیید'}</button>
        <button type="button" className="secondary" disabled={busy} onClick={close}>انصراف</button>
      </div>
    </form>
  </dialog>
}

export function PaymentsPage({ transfers, payments, preview, onChanged }: { transfers: Row[]; payments: Row[]; preview: boolean; onChanged: () => void }) {
  const [selected, setSelected] = useState<Row | null>(null)
  const [notice, setNotice] = useState('')
  const [lookup, setLookup] = useState('')
  const [activeLookup, setActiveLookup] = useState('')
  const [retrying, setRetrying] = useState<string | null>(null)
  const deliveries = useQuery({
    queryKey: ['admin-plan-deliveries', activeLookup],
    enabled: !preview,
    refetchInterval: 30_000,
    queryFn: async () => asRows(await staff.api(`admin/plan-deliveries?q=${encodeURIComponent(activeLookup)}`)).map((row) => ({
      ...row,
      status: row.firstMealAt ? 'first_meal' : row.firstReceivedAt ? 'received' : row.publishedAt ? 'published' : row.status ?? row.pendingReason,
    })),
  })
  async function retryDelivery(id: string) {
    setRetrying(id)
    try {
      const result = await staff.api(`admin/plan-deliveries/${encodeURIComponent(id)}/retry`, 'POST', {})
      setNotice(result && typeof result === 'object' && 'linked' in result && result.linked
        ? 'پرداخت به درخواست برنامه متصل شد.'
        : 'اتصال هنوز ممکن نیست. وضعیت پرونده و خریدهای دیگر این حساب را بررسی کنید.')
      void deliveries.refetch()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'تلاش دوباره انجام نشد.')
    } finally {
      setRetrying(null)
    }
  }
  const deliveryColumns: Column[] = [
    { title: 'کاربر', render: row => <>{show(row.customer ?? row.phone)}<br />{phone(row.phone)}</> },
    { title: 'مسیر خرید', render: row => row.source === 'web' ? 'سایت' : 'اپ' },
    { title: 'پلن', render: row => planName(row.plan) },
    { title: 'پرداخت', render: row => <>{amount(row.amount)}<br />{formatFaDate(row.paidAt) ?? '—'}</> },
    { title: 'وضعیت تحویل', render: row => row.generationStatus === 'failed' && row.status === 'in_review' ? 'ساخت خودکار ناموفق · نیازمند بررسی متخصص' : deliveryStatus[String(row.status)] ?? show(row.status) },
    { title: 'مسئول بررسی', render: row => row.requestId ? show(row.specialist ?? 'در انتظار تخصیص') : '—' },
    { title: 'نسخه منتشر شد', render: row => formatFaDate(row.publishedAt) ?? '—' },
    { title: 'اولین دریافت در اپ', render: row => formatFaDate(row.firstReceivedAt) ?? '—' },
    { title: 'اولین وعده ثبت شد', render: row => formatFaDate(row.firstMealAt) ?? '—' },
    { title: 'درخواست', render: row => row.requestId
      ? <bdi title={show(row.requestId)}>{String(row.requestId).slice(0, 8)}</bdi>
      : row.source === 'web' && row.status === 'reconcile'
        ? <button className="secondary" type="button" disabled={retrying !== null} onClick={() => void retryDelivery(String(row.id))}>تلاش دوباره</button>
        : '—' },
  ]
  const transferColumns: Column[] = [
    { title: 'شماره کاربر', render: row => phone(row.phone_e164) },
    { title: 'پلن', render: row => planName(row.plan) },
    { title: 'روش پرداخت', render: row => row.zibal_track_id ? 'زیبال' : 'کارت‌به‌کارت' },
    { title: 'مبلغ', render: row => amount(row.amount_toman) },
    { title: 'مهلت واریز', render: row => formatFaDate(row.expires_at) ?? '—' },
    { title: 'وضعیت', render: row => row.confirmed_at ? 'تأیید شد' : Date.parse(String(row.expires_at)) > Date.now() ? 'در انتظار' : 'مهلت تمام شد' },
    { title: 'پیامک', render: row => smsLabels[String(row.sms_status)] ?? '—' },
    { title: 'پیگیری', render: row => row.confirmed_at ? <bdi>{show(row.bank_reference)}</bdi> : row.zibal_track_id ? 'منتظر زیبال' :
      <button type="button" className="secondary" disabled={preview} onClick={() => setSelected(row)}>تأیید واریز</button> },
  ]
  const paymentColumns: Column[] = [
    { title: 'کاربر', render: row => <div className="users-person"><span className="users-avatar" aria-hidden="true">{show(row.user).trim()[0]}</span>
      <div><strong>{show(row.user)}</strong><small>پرداخت <bdi>{String(row.id ?? '').slice(0, 8)}</bdi></small></div></div> },
    { title: 'شماره همراه', render: row => phone(row.phone) },
    { title: 'پکیج', render: row => planName(row.packageCode) },
    { title: 'مبلغ', render: row => amount(row.amountToman) },
    { title: 'وضعیت', render: row => <span className="payment-status" data-status={row.status}><i aria-hidden="true" />{statusLabels[String(row.status)] ?? show(row.status)}</span> },
    { title: 'زمان پرداخت', render: row => formatFaDate(row.paidAt ?? row.createdAt) ?? '—' },
    { title: 'پیگیری', render: row => <bdi>{show(row.reference)}</bdi> },
  ]

  return <div className="payments-page">
    {notice && <p className="info-note" role="status">{notice}</p>}
    {!preview && <form className="payments-delivery-lookup" onSubmit={(event) => { event.preventDefault(); setActiveLookup(normalize(lookup)) }}>
      <label>جست‌وجو در همهٔ خریدهای برنامه<input type="search" placeholder="شماره، نام یا شناسهٔ خرید" value={lookup} onChange={(event) => setLookup(event.target.value)} /></label>
      <button type="submit">جست‌وجو</button>
    </form>}
    {deliveries.isPending && !preview && <p className="info-note" role="status">در حال دریافت وضعیت تحویل برنامه‌ها…</p>}
    {deliveries.isError && <p className="info-note" role="alert">وضعیت تحویل برنامه‌ها دریافت نشد.</p>}
    {deliveries.data && <PaymentTable title="تحویل برنامه‌های خریداری‌شده" description="حداکثر ۲۵۰ نتیجه، با اولویت خریدهای نیازمند پیگیری. تاریخ انتشار، اولین دریافت و اولین وعدهٔ ثبت‌شده در جدول دیده می‌شود."
      rows={deliveries.data} columns={deliveryColumns} searchFields={row => [row.customer, row.phone, row.id, row.orderId, row.requestId, planName(row.plan), deliveryStatus[String(row.status)]]} statusFilter />}
    <PaymentTable title="واریزهای آنبوردینگ" description="مبلغ را با گردش حساب تطبیق دهید و شناسه پیگیری بانکی را ثبت کنید."
      rows={transfers} columns={transferColumns} searchFields={row => [row.phone_e164, planName(row.plan), row.bank_reference, row.zibal_track_id, row.amount_toman]} />
    <PaymentTable title="پرداخت‌ها" description={`${formatFaNumber(payments.length)} مورد در فهرست`}
      rows={payments} columns={paymentColumns} searchFields={row => [row.user, row.phone, row.id, planName(row.packageCode), row.reference, row.amountToman]} statusFilter />
    {selected && <ConfirmTransfer row={selected} close={() => setSelected(null)} confirmed={message => {
      setSelected(null)
      setNotice(message)
      onChanged()
      void deliveries.refetch()
    }} />}
  </div>
}
