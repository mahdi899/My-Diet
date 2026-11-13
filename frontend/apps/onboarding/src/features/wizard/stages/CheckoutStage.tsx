import { useState } from 'react'
import { publicRequest, StaffError } from '@shared/api/staff-session'
import { plans } from '../../../engine'
import { useWizard } from '../../../stores/wizard'

const descriptions: Record<string, string> = {
  weekly: 'شروع مسیر با برنامهٔ غذایی ۱۵ روزه',
  monthly: 'همراهی یک‌ماهه و بررسی متخصص',
  quarterly: 'مسیر کامل ۹۰ روزه با پشتیبانی',
}

export function CheckoutStage() {
  const wizard = useWizard()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [method, setMethod] = useState<'gateway' | 'transfer'>('transfer')
  const [order, setOrder] = useState<{ id: string; amount_toman: number; expires_at: string; confirmed_at?: string | null } | null>(null)

  async function createOrder(plan: string) {
    if (!wizard.token) {
      setError('اول شماره را تأیید کن.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const created = await publicRequest<NonNullable<typeof order>>('me/onboarding-transfers', 'POST', {
        plan,
        submissionId: wizard.submissionId,
      }, wizard.token)
      setOrder(created)
      wizard.setPlan(plan as typeof wizard.plan)
    } catch (cause) {
      setError(cause instanceof StaffError ? cause.message : 'ساخت سفارش انجام نشد.')
    } finally {
      setBusy(false)
    }
  }

  async function payOnline() {
    if (!order || !wizard.token) return
    setBusy(true)
    setError('')
    try {
      const payment = await publicRequest<{ url?: string }>('me/onboarding-transfers/' + order.id + '/zibal', 'POST', {}, wizard.token)
      if (!payment.url) throw new StaffError('درگاه لینک ورود نداد.', 502)
      window.location.assign(payment.url)
    } catch (cause) {
      setError(cause instanceof StaffError ? cause.message : 'ارتباط با درگاه برقرار نشد.')
      setBusy(false)
    }
  }

  function copyCard() {
    navigator.clipboard.writeText('5859831818609595')
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  return (
    <div id="twoStepModalBackdrop">
      <div id="twoStepModalCard" data-plan={wizard.plan}>
        <div className="modal-topbar"><span id="modalHeaderTitle">انتخاب پلن</span></div>
        <div className="modal-scroll-body">
          <div id="modalStep1Content">
            <div className="plans-intro">
              <h2>یک قدم تا شروع مسیرت</h2>
              <p>پلنی را انتخاب کن. بعد می‌توانی آنلاین یا کارت‌به‌کارت پرداخت کنی.</p>
            </div>
            <div className="plans-stack">
              {plans.map((plan) => {
                const open = wizard.plan === plan.id
                return (
                  <article key={plan.id} className={'plan-tier' + (open ? ' is-open' : '')} data-tier={plan.id}>
                    {plan.id === 'monthly' && <span className="plan-recommendation">پیشنهاد برنامه</span>}
                    <button type="button" className="plan-option-card" onClick={() => wizard.setPlan(plan.id)}>
                      <span className="plan-heading">
                        <strong>{plan.title}</strong>
                        <span className="plan-duration">{plan.days}</span>
                        <span className="plan-chevron" aria-hidden="true">⌄</span>
                      </span>
                      <span className="plan-description">{descriptions[plan.id]}</span>
                    </button>
                    <div className="plan-purchase">
                      <span className="plan-price"><strong>{plan.price}</strong><span>تومان</span></span>
                      <button type="button" className="plan-continue" disabled={busy || !wizard.token} onClick={() => createOrder(plan.id)}>
                        {order && wizard.plan === plan.id ? 'سفارش ساخته شد' : 'ادامهٔ خرید'}
                        <span>←</span>
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>

            {order && (
              <div className="checkout-panel" style={{ marginTop: 28 }}>
                <p className="checkout-timer">مهلت واریز تا <b>{new Date(order.expires_at).toLocaleString('fa-IR', { timeZone: 'Asia/Tehran' })}</b></p>
                <p style={{ textAlign: 'center', fontWeight: 900, fontSize: 22, margin: '14px 0' }}>{order.amount_toman.toLocaleString('fa-IR')} تومان</p>
                {order.confirmed_at ? <p style={{ textAlign: 'center' }}>پرداخت شما تأیید شد.</p> : (
                  <>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 16 }}>
                      <button type="button" className="quiz-green-btn px-4 py-2 rounded-xl" onClick={() => setMethod('transfer')} style={{ opacity: method === 'transfer' ? 1 : 0.55 }}>کارت‌به‌کارت</button>
                      <button type="button" className="quiz-green-btn px-4 py-2 rounded-xl" onClick={() => setMethod('gateway')} style={{ opacity: method === 'gateway' ? 1 : 0.55 }}>پرداخت آنلاین</button>
                    </div>
                    {method === 'gateway' ? (
                      <button type="button" className="quiz-green-btn w-full py-3 rounded-xl font-bold" disabled={busy} onClick={payOnline}>پرداخت</button>
                    ) : (
                      <div className="transfer-card">
                        <div className="transfer-card-top"><span>رژیم من</span><span>پرداخت کارت‌به‌کارت</span></div>
                        <span className="transfer-chip" />
                        <button type="button" className="transfer-number" onClick={copyCard}>
                          <b>5859 8318 1860 9595</b>
                          <span>{copied ? 'شماره کارت کپی شد' : 'برای کپی لمس کن'}</span>
                        </button>
                        <div className="transfer-owner"><small>به نام</small><strong>بهرام رستمی</strong></div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
            {error && <p id="morphErrorText">{error}</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
