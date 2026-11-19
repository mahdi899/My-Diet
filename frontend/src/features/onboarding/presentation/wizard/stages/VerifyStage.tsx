import { FormEvent, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWizard } from '../../../application/wizard-store'
import { answerLabel, answerOf, faDigits, iranianMobile, otpCode, plans } from '../../../domain/questionnaire'
import { audience, canonicalAnswer, onboarding, writeCheckoutSession } from '../../../composition'
import { StageAction } from '../StageAction'
import { StageBack } from '../StageBack'
import { isLocalOnboardingPreview, localOtpCode } from '../../../infrastructure/local-preview'

const OTP_LENGTH = 6

function latinOtp(raw: string) {
  return raw
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/\D/g, '')
    .slice(0, OTP_LENGTH)
}

function OtpCellField({
  value,
  onChange,
  disabled,
  success,
  shake,
}: {
  value: string
  onChange: (next: string) => void
  disabled?: boolean
  success?: boolean
  shake?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const digits = latinOtp(value)
  const cells = Array.from({ length: OTP_LENGTH }, (_, index) => digits[index] ?? '')

  useEffect(() => {
    if (!success && !disabled) inputRef.current?.focus({ preventScroll: true })
  }, [success, disabled])

  return (
    <div
      dir="ltr"
      className={'otp-morph otp-cells-field' + (success ? ' is-success' : '') + (shake ? ' shake-error' : '')}
      onClick={() => !success && inputRef.current?.focus()}
    >
      <div className="otp-cells" dir="ltr" aria-hidden={success}>
        {cells.map((digit, index) => {
          const active = !success && (index === digits.length || (digits.length === OTP_LENGTH && index === OTP_LENGTH - 1))
          return (
            <span key={index} className={'otp-cell' + (digit ? ' is-filled' : '') + (active ? ' is-active' : '')}>
              {digit ? faDigits(digit) : ''}
            </span>
          )
        })}
      </div>
      <input
        ref={inputRef}
        id="morphOtpInput"
        dir="ltr"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={OTP_LENGTH}
        className="otp-cells-input"
        value={digits}
        disabled={disabled || success}
        onChange={(event) => onChange(latinOtp(event.target.value))}
        onPaste={(event) => {
          event.preventDefault()
          onChange(latinOtp(event.clipboardData.getData('text')))
        }}
        aria-label="کد تأیید شش‌رقمی"
      />
      <span className="otp-morph-mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="m5 12 4 4L19 6" strokeLinecap="round" strokeLinejoin="round" pathLength="1" />
        </svg>
      </span>
    </div>
  )
}

export function VerifyStage() {
  const navigate = useNavigate()
  const wizard = useWizard()
  const [mode, setMode] = useState<'phone' | 'otp'>(wizard.contactMode)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [otpSuccess, setOtpSuccess] = useState(false)
  const [otpShake, setOtpShake] = useState(false)
  const plan = plans.find((item) => item.id === wizard.plan) ?? plans[1]
  const localPreview = isLocalOnboardingPreview()

  useEffect(() => {
    if (useWizard.getState().contactMode !== mode) useWizard.getState().setContactMode(mode)
    audience.step(mode === 'otp' ? 'otp' : 'contact')
  }, [mode])

  async function sendPhone(event: FormEvent) {
    event.preventDefault()
    if (!wizard.goal) return
    const phone = iranianMobile(wizard.phone)
    if (!phone) {
      setError('لطفاً یک شماره موبایل معتبر ۱۱ رقمی (شروع با ۰۹) وارد کنید.')
      return
    }
    if (localPreview) {
      setError('')
      audience.registered()
      wizard.setPhone(phone)
      setMode('otp')
      return
    }
    setBusy(true)
    setError('')
    try {
      wizard.resetSubmission(phone)
      const state = useWizard.getState()
      const answers = state.questions.map((item) => {
        const value = answerOf(item, state.answers)
        return { question: item.q, answer: answerLabel(item, value), ...canonicalAnswer(item, value) }
      })
      await onboarding.requestSms({
        phone,
        submissionId: state.submissionId,
        goalId: state.goal?.id,
        specialistId: state.specialistId,
        answers,
      })
      audience.registered()
      wizard.setPhone(phone)
      setMode('otp')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'ارسال کد انجام نشد.')
    } finally {
      setBusy(false)
    }
  }

  async function verifyCode(event: FormEvent) {
    event.preventDefault()
    const value = otpCode(code)
    if (!value) {
      setError('کد شش‌رقمی پیامک‌شده را وارد کنید.')
      setOtpShake(true)
      window.setTimeout(() => setOtpShake(false), 450)
      return
    }
    setBusy(true)
    setError('')
    try {
      if (localPreview) {
        if (value !== localOtpCode) throw new Error('کد آزمایشی درست نیست.')
      } else {
        const token = await onboarding.confirmSms({
          phone: wizard.phone,
          code: value,
          submissionId: wizard.submissionId,
          journeyId: audience.journeyId(),
        })
        wizard.setToken(token)
        writeCheckoutSession({ token, submissionId: wizard.submissionId, plan: wizard.plan })
      }
      audience.verified()
      setOtpSuccess(true)
      const successHold = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 350 : 1450
      await new Promise((resolve) => window.setTimeout(resolve, successHold))
      wizard.setStage('checkout')
      navigate('/onboarding/payment')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تأیید شماره ذخیره نشد.')
      setOtpShake(true)
      window.setTimeout(() => setOtpShake(false), 450)
      setBusy(false)
    }
  }

  return (
    <div id="twoStepModalBackdrop" className="flex">
      <div id="twoStepModalCard" data-plan={wizard.plan} data-verification={otpSuccess ? 'success' : undefined}>
        <div className="modal-topbar verify-topbar">
          <StageBack
            id="modalBackToPlansBtn"
            label="بازگشت به پلن‌ها"
            onClick={() => wizard.setStage('plans')}
          />
        </div>
        <div className="modal-scroll-body">
          <form id="modalStep2Content" className="verify-flow" onSubmit={mode === 'phone' ? sendPhone : verifyCode}>
            <div className="verify-hero" aria-hidden="true">
              <span className="verify-hero-badge">
                {mode === 'phone' ? (
                  <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
                    <path d="M11 18.5h2" strokeLinecap="round" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                    <rect x="5" y="2.5" width="14" height="19" rx="3" />
                    <path d="M9 8h6m-6 4h.01m2.99 0h.01m2.99 0h.01m-6.01 4h.01m2.99 0h.01m2.99 0h.01" />
                  </svg>
                )}
              </span>
            </div>
            <div id="morphingInputWrapper" className="input-morph-shell verify-input-shell">
              <label id="morphInputLabel" htmlFor={mode === 'phone' ? 'morphPhoneInput' : 'morphOtpInput'}>
                <span id="morphInputLabelText">{mode === 'phone' ? 'شماره همراهت' : 'کد تأیید پیامکی'}</span>
              </label>
              <div className="verify-field-slot" data-mode={mode}>
              {mode === 'phone' ? (
                <input
                  id="morphPhoneInput"
                  className="verify-phone-input"
                  dir="ltr"
                  inputMode="tel"
                  autoComplete="tel"
                  maxLength={11}
                  placeholder="09123456789"
                  value={wizard.phone}
                  onChange={(event) => wizard.setPhone(event.target.value)}
                />
              ) : (
                <OtpCellField
                  value={code}
                  onChange={setCode}
                  disabled={busy}
                  success={otpSuccess}
                  shake={otpShake}
                />
              )}
              </div>
              <div className="verify-field-meta">
                {error && <p id="morphErrorText" role="alert">{error}</p>}
                {mode === 'otp' && !error && <p id="morphInputSubtitle">{localPreview ? `کد آزمایشی: ${faDigits(localOtpCode)}` : `کد به ${faDigits(wizard.phone)} ارسال شد.`}</p>}
                {mode === 'otp' && (
                  <button id="editPhoneInOtpModeBtn" type="button" disabled={otpSuccess} onClick={() => { setMode('phone'); setCode(''); setError(''); setOtpSuccess(false) }}>
                    ویرایش شماره
                  </button>
                )}
              </div>
              <StageAction id="morphConfirmBtn" type="submit" form="modalStep2Content" disabled={busy || otpSuccess}>
                <span id="morphConfirmBtnText">
                  {otpSuccess ? 'تأیید شد' : busy ? 'در حال ارسال…' : mode === 'phone' ? 'دریافت کد تأیید' : 'تأیید و ادامه به پرداخت'}
                </span>
              </StageAction>
            </div>
            <p className="verify-plan-summary">
              <strong>{plan.title}</strong>
              <span>{plan.days}</span>
              <span id="step2PlanPrice">{plan.price} تومان</span>
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}
