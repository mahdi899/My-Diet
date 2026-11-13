import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { StaffError, publicRequest } from '@shared/api/staff-session'
import { plans, type PlanId } from '../../../engine'
import { useWizard } from '../../../stores/wizard'

interface TransferOrder {
  id: string
  plan: PlanId
  amount_toman: number
  expires_at: string
  confirmed_at?: string | null
  gateway_started?: boolean
}

function readSession() {
  try {
    const raw = sessionStorage.getItem('mydiet.checkout')
    const parsed = raw ? JSON.parse(raw) as { token?: string; submissionId?: string; plan?: PlanId } : null
    if (parsed?.token && parsed.submissionId) return parsed
  } catch { /* private mode */ }
  return null
}

function clock(seconds: number) {
  const left = Math.max(0, seconds)
  return [Math.floor(left / 60), left % 60].map((part) => String(part).padStart(2, '0')).join(':')
}

export function CheckoutStage() {
  const wizard = useWizard()
  const [params] = useSearchParams()
  const [order, setOrder] = useState<TransferOrder | null>(null)
  const [method, setMethod] = useState<'gateway' | 'transfer'>('gateway')
  const [plan, setPlan] = useState<PlanId>(wizard.plan)
  const [status, setStatus] = useState('در حال بررسی نشست پرداخت…')
  const [gatewayNote, setGatewayNote] = useState('')
  const [copied, setCopied] = useState('')
  const [busy, setBusy] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const [token, setToken] = useState(wizard.token)
  const gatewayResult = params.get('gateway')

  async function refreshToken(current: string) {
    const response = await fetch('/v1/auth/refresh', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'x-sabzine-client': 'web' },
      body: '{}',
    })
    const data = await response.json() as { accessToken?: string; role?: string }
    if (!response.ok || !data.accessToken || data.role !== 'user') return current
    const saved = readSession()
    if (saved) sessionStorage.setItem('mydiet.checkout', JSON.stringify({ ...saved, token: data.accessToken }))
    wizard.setToken(data.accessToken)
    setToken(data.accessToken)
    return data.accessToken
  }

  async function call<T>(path: string, body?: unknown, current = token): Promise<T> {
    try {
      return await publicRequest<T>('me/onboarding-transfers' + path, body ? 'POST' : 'GET', body, current)
    } catch (cause) {
      if (cause instanceof StaffError && cause.status === 401) {
        const next = await refreshToken(current)
        if (next !== current) return publicRequest<T>('me/onboarding-transfers' + path, body ? 'POST' : 'GET', body, next)
      }
      throw cause
    }
  }

  useEffect(() => {
    const saved = readSession()
    const access = wizard.token || saved?.token || ''
    const submissionId = wizard.submissionId || saved?.submissionId || ''
    const initialPlan = (saved?.plan ?? wizard.plan) as PlanId
    if (!access || !submissionId) {
      setStatus('برای ورود به صفحه پرداخت، ابتدا شماره همراه را تأیید کنید.')
      return
    }
    setToken(access)
    setPlan(initialPlan)
    const returned = params.get('order')
    const run = returned
      ? call<TransferOrder>('/' + encodeURIComponent(returned), undefined, access)
      : call<TransferOrder>('', { plan: initialPlan, submissionId }, access)
    run.then((created) => {
      setOrder(created)
      setPlan(created.plan)
      setStatus('')
    }).catch((cause) => {
      setStatus(cause instanceof StaffError ? cause.message : 'ارتباط با سرویس پرداخت برقرار نشد. دوباره تلاش کنید.')
    })
    // The order is created once for this checkout visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!order || order.confirmed_at) return
    const timer = window.setInterval(() => {
      call<TransferOrder>('/' + encodeURIComponent(order.id)).then((fresh) => {
        if (fresh.confirmed_at) setOrder(fresh)
      }).catch(() => {})
    }, 8000)
    return () => window.clearInterval(timer)
  }, [order?.id, order?.confirmed_at])

  const remaining = order ? Math.max(0, Math.ceil((Date.parse(order.expires_at) - now) / 1000)) : 0
  const payable = Boolean(order && !order.confirmed_at && (remaining > 0 || order.gateway_started))
  const price = order ? order.amount_toman.toLocaleString('fa-IR') + ' تومان' : ''

  useEffect(() => {
    if (!order) return
    const tracking = window.demoTracking
    if (!tracking) return
    if (order.confirmed_at) tracking.step('payment_success')
    else if (order.gateway_started || method === 'gateway') tracking.step('payment_gateway')
    else tracking.step('payment_transfer')
  }, [order, method])

  useEffect(() => {
    if (!order) return
    if (order.confirmed_at) setStatus('پرداخت شما تأیید شد.')
    else if (gatewayResult === 'cancelled') setStatus('پرداخت آنلاین تکمیل نشد. می‌توانید دوباره به درگاه بروید.')
    else if (gatewayResult === 'pending') setStatus('پرداخت هنوز تأیید نشده است. اگر مبلغ کسر شده، به پشتیبانی پیام دهید.')
    else if (order.gateway_started) setStatus('منتظر تکمیل پرداخت در زیبال')
    else if (remaining && method === 'transfer') setStatus('منتظر واریز و بررسی پشتیبانی')
    else if (!remaining) setStatus('مهلت واریز تمام شد. اگر واریز کرده‌اید با پشتیبانی تماس بگیرید.')
  }, [order, gatewayResult, remaining, method])

  async function changePlan(next: PlanId) {
    const saved = readSession()
    if (!saved?.submissionId || busy) return
    setBusy(true)
    setPlan(next)
    wizard.setPlan(next)
    try {
      const created = await call<TransferOrder>('', { plan: next, submissionId: saved.submissionId })
      setOrder(created)
      sessionStorage.setItem('mydiet.checkout', JSON.stringify({ ...saved, plan: created.plan, token }))
    } catch (cause) {
      setStatus(cause instanceof StaffError ? cause.message : 'تغییر پلن انجام نشد.')
    } finally {
      setBusy(false)
    }
  }

  async function payOnline() {
    if (!order || busy) return
    setBusy(true)
    setGatewayNote('')
    try {
      const payment = await call<{ url?: string }>('/' + encodeURIComponent(order.id) + '/zibal', {})
      if (!payment.url || !/^https:\/\/gateway\.zibal\.ir\/start\/\d{1,20}$/.test(payment.url)) {
        throw new StaffError('درگاه لینک ورود نداد. چند ثانیه بعد یک بار دیگر تلاش کنید.')
      }
      window.location.assign(payment.url)
    } catch (cause) {
      const message = cause instanceof StaffError ? cause.message : 'ارتباط با درگاه برقرار نشد. چند ثانیه بعد یک بار دیگر تلاش کنید.'
      setStatus(message)
      setGatewayNote(message)
      setBusy(false)
    }
  }

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(label)
    } catch {
      setStatus('کپی خودکار ممکن نیست. مقدار را دستی وارد کنید.')
    }
  }

  if (!order) {
    return (
      <main className="checkout-page">
        <section className="checkout-panel">
          <p role="status">{status}</p>
          <Link id="checkout-return" to="/onboarding">بازگشت به آنبوردینگ</Link>
        </section>
      </main>
    )
  }

  return (
    <main className="checkout-page">
      <section className="checkout-panel">
        <p id="checkout-status" role="status" hidden={!status}>{status}</p>
        <section className="checkout-video-panel" aria-labelledby="checkout-video-title">
          <h1 id="checkout-video-title" className="checkout-video-note">قبل پرداخت ویدیو زیر رو ببین <span aria-hidden="true">👇</span></h1>
          <video className="transfer-video" controls playsInline preload="metadata" aria-label="راهنمای پرداخت">
            <source src="/onboarding/payment-guide.mp4" type="video/mp4" />
          </video>
        </section>
        <p className="checkout-timer">مهلت واریز <b dir="ltr">{clock(remaining)}</b></p>
        <dl className="checkout-summary">
          <div><dt>هدف</dt><dd>{wizard.goal?.title ?? 'برنامهٔ غذایی'}</dd></div>
          <div><dt>پلن</dt><dd>{plans.find((item) => item.id === plan)?.title}</dd></div>
          <div><dt>مبلغ</dt><dd>{price}</dd></div>
        </dl>
        <div id="checkout-methods" role="group" aria-label="روش پرداخت" hidden={!payable || order.gateway_started}>
          <button type="button" aria-pressed={method === 'gateway'} onClick={() => setMethod('gateway')}>پرداخت آنلاین</button>
          <button type="button" aria-pressed={method === 'transfer'} onClick={() => setMethod('transfer')}>کارت‌به‌کارت</button>
        </div>
        <div id="checkout-gateway" hidden={!payable || (!order.gateway_started && method !== 'gateway')}>
          <p className="checkout-total"><span>مبلغ پرداخت</span><strong>{price}</strong></p>
          <p><strong>قبل از ورود به درگاه VPN خود را خاموش کنید.</strong></p>
          <button type="button" className="checkout-action" disabled={busy} onClick={payOnline}>{busy ? 'در حال اتصال به درگاه…' : 'پرداخت'}</button>
          <p className="gateway-status" hidden={!gatewayNote}>{gatewayNote}</p>
        </div>
        <div id="checkout-transfer" hidden={!payable || Boolean(order.gateway_started) || method !== 'transfer'}>
          <button id="copy-amount" type="button" className="checkout-action" onClick={() => copy(String(order.amount_toman), 'amount')}>
            {price} · {copied === 'amount' ? 'کپی شد' : 'کپی مبلغ'}
          </button>
          <p>مبلغ را دقیقاً تا آخرین رقم واریز کنید تا پشتیبانی پرداخت را با سفارش تطبیق دهد.</p>
          <div className="transfer-card">
            <div className="transfer-card-top"><span>رژیم من</span><span>پرداخت کارت‌به‌کارت</span></div>
            <span className="transfer-chip" aria-hidden="true" />
            <button type="button" className="transfer-number" aria-label="کپی شماره کارت" onClick={() => copy('5859831818609595', 'card')}>
              <b dir="ltr">5859 8318 1860 9595</b>
              <span>{copied === 'card' ? 'شماره کارت کپی شد' : 'برای کپی شماره کارت لمس کنید'}</span>
            </button>
            <div className="transfer-owner"><small>به نام</small><strong>بهرام رستمی</strong></div>
          </div>
        </div>
        <form id="checkout-plan" hidden={Boolean(order.confirmed_at)} onSubmit={(event) => { event.preventDefault(); void changePlan(plan) }}>
          <label htmlFor="checkout-plan-choice">تغییر پلن</label>
          <select id="checkout-plan-choice" value={plan} onChange={(event) => setPlan(event.target.value as PlanId)}>
            {plans.map((item) => <option key={item.id} value={item.id}>{item.title} · {item.days}</option>)}
          </select>
          <button className="checkout-action checkout-secondary" type="submit" disabled={busy}>تأیید پلن</button>
        </form>
        <footer>
          <p>اگر پرداخت شما تأیید نشد، در تلگرام به پشتیبانی پیام دهید.</p>
          <a href="https://t.me/hale_a" target="_blank" rel="noopener noreferrer">پیام به پشتیبانی در تلگرام</a>
        </footer>
      </section>
    </main>
  )
}
