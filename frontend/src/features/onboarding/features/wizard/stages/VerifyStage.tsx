import { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { publicRequest, StaffError } from '@shared/api/staff-session'
import { toEnglishDigits } from '@shared/utils'
import { answerLabel, answerOf, faDigits, plans, type AnswerValue, type QuizQuestion } from '../../../engine'
import { useWizard } from '../../../stores/wizard'

function canonical(question: QuizQuestion, answer: AnswerValue | undefined) {
  return window.SabzineKeys?.canonical(question, answer) ?? {}
}

export function VerifyStage() {
  const navigate = useNavigate()
  const wizard = useWizard()
  const [mode, setMode] = useState<'phone' | 'otp'>('phone')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const plan = plans.find((item) => item.id === wizard.plan) ?? plans[1]

  async function sendPhone(event: FormEvent) {
    event.preventDefault()
    if (!wizard.goal) return
    let phone = toEnglishDigits(wizard.phone).replace(/\D/g, '')
    if (phone.length === 10 && phone.startsWith('9')) phone = '0' + phone
    if (!/^09\d{9}$/.test(phone)) {
      setError('لطفاً یک شماره موبایل معتبر ۱۱ رقمی (شروع با ۰۹) وارد کنید.')
      return
    }
    setBusy(true)
    setError('')
    try {
      wizard.resetSubmission(phone)
      const state = useWizard.getState()
      const answers = state.questions.map((item) => {
        const value = answerOf(item, state.answers)
        return { question: item.q, answer: answerLabel(item, value), ...canonical(item, value) }
      })
      await publicRequest('onboarding/submissions', 'POST', {
        id: state.submissionId,
        phone,
        goal: state.goal?.id,
        specialistId: state.specialistId,
        answers,
      })
      await publicRequest('auth/otp/request', 'POST', { phone })
      wizard.setPhone(phone)
      setMode('otp')
    } catch (cause) {
      setError(cause instanceof StaffError ? cause.message : 'ارسال کد انجام نشد.')
    } finally {
      setBusy(false)
    }
  }

  async function verifyCode(event: FormEvent) {
    event.preventDefault()
    const value = toEnglishDigits(code).replace(/\D/g, '')
    if (!/^\d{6}$/.test(value)) {
      setError('کد شش‌رقمی پیامک‌شده را وارد کنید.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const session = await publicRequest<{ accessToken?: string; role?: string; detail?: string }>('auth/otp/verify', 'POST', {
        phone: wizard.phone,
        code: value,
        platform: 'demo-web',
      })
      if (!session.accessToken || session.role !== 'user') throw new StaffError(session.detail || 'کد تأیید معتبر نیست.', 400)
      await publicRequest('onboarding/submissions/' + wizard.submissionId + '/verify', 'POST', {}, session.accessToken)
      wizard.setToken(session.accessToken)
      sessionStorage.setItem('mydiet.checkout', JSON.stringify({
        token: session.accessToken,
        submissionId: wizard.submissionId,
        plan: wizard.plan,
      }))
      wizard.setStage('checkout')
      navigate('/onboarding/payment')
    } catch (cause) {
      setError(cause instanceof StaffError ? cause.message : 'تأیید شماره ذخیره نشد.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div id="twoStepModalBackdrop">
      <div id="twoStepModalCard" data-plan={wizard.plan}>
        <div className="modal-topbar">
          <span id="modalHeaderTitle">تأیید شماره</span>
        </div>
        <div className="modal-scroll-body">
          <form id="modalStep2Content" onSubmit={mode === 'phone' ? sendPhone : verifyCode}>
            <div id="morphingInputWrapper" className="input-morph-shell">
              <label id="morphInputLabel" htmlFor="morphSingleInput">
                <span id="morphInputLabelText">{mode === 'phone' ? 'شماره همراهت' : 'کد تأیید'}</span>
              </label>
              <p id="morphInputSubtitle">{mode === 'phone' ? 'برای ذخیرهٔ پاسخ‌ها و ادامهٔ خرید، کد تأیید می‌فرستیم.' : `ارسال شد به ${faDigits(wizard.phone)}`}</p>
              <div className={mode === 'otp' ? 'otp-morph' : undefined}>
                <input
                  id="morphSingleInput"
                  dir="ltr"
                  inputMode={mode === 'phone' ? 'tel' : 'numeric'}
                  autoComplete={mode === 'phone' ? 'tel' : 'one-time-code'}
                  maxLength={mode === 'phone' ? 11 : 6}
                  placeholder={mode === 'phone' ? '09123456789' : '------'}
                  value={mode === 'phone' ? wizard.phone : code}
                  onChange={(event) => mode === 'phone' ? wizard.setPhone(event.target.value) : setCode(event.target.value)}
                />
              </div>
              {error && <p id="morphErrorText">{error}</p>}
              <button id="morphConfirmBtn" type="submit" disabled={busy}>
                <span id="morphConfirmBtnText">{busy ? 'در حال ارسال…' : mode === 'phone' ? 'دریافت کد تأیید' : 'تأیید و ادامه'}</span>
              </button>
              {mode === 'otp' && (
                <button id="editPhoneInOtpModeBtn" type="button" onClick={() => { setMode('phone'); setCode(''); setError('') }}>
                  ویرایش شماره
                </button>
              )}
            </div>
            <div className="modal-plan-line">
              <p className="modal-plan-summary-inline">
                <strong>{plan.title}</strong>
                <span className="modal-plan-sep">·</span>
                <span>{plan.days}</span>
                <span className="modal-plan-sep">·</span>
                <span id="step2PlanPrice">{plan.price} تومان</span>
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
