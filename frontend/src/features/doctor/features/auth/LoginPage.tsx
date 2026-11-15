import { FormEvent, useState } from 'react'
import { StaffError } from '@shared/api/staff-session'
import { AdminIcon as Icon } from '../../../admin/components/AdminIcon'
import { toEnglishDigits } from '@shared/utils'
import { staff } from '../../session'
import { doctorPreviewEnabled, loginToDoctorPreview } from '../../data/preview'

export function LoginPage({ onSuccess }: { onSuccess: () => void }) {
  const [mode, setMode] = useState<'phone' | 'password' | 'code' | 'totp'>('phone')
  const [phone, setPhone] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [totpToken, setTotpToken] = useState('')
  const [shown, setShown] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  function finish(session: { totpRequired?: boolean; totpToken?: string; role?: string; accessToken?: string; sessionExpiresAt?: string }) {
    if (session.totpRequired && session.totpToken) {
      setTotpToken(session.totpToken)
      setMode('totp')
      return
    }
    staff.accept(session)
    onSuccess()
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      if (doctorPreviewEnabled() && mode !== 'password') throw new StaffError('در پیش‌نمایش فقط ورود با نام کاربری نمونه ممکن است.', 400)
      if (mode === 'phone') {
        const value = toEnglishDigits(phone).trim()
        if (!/^09\d{9}$/.test(value)) throw new StaffError('شماره تلفن ۱۱ رقمی با ۰۹ وارد کنید.', 400)
        await staff.login('auth/otp/request', { phone: value })
        setPhone(value)
        setMode('code')
        return
      }
      if (mode === 'password') {
        const name = username.trim().toLowerCase()
        if (loginToDoctorPreview(name, password)) { onSuccess(); return }
        if (!/^[a-z][a-z0-9._-]{2,31}$/.test(name)) throw new StaffError('نام کاربری درست نیست.', 400)
        if (password.length < 8) throw new StaffError('رمز عبور درست نیست.', 400)
        if (doctorPreviewEnabled()) throw new StaffError('نام کاربری یا رمز پیش‌نمایش درست نیست.', 401)
        finish(await staff.login('auth/specialist/login', { username: name, password }))
        return
      }
      const value = toEnglishDigits(code).trim()
      if (!/^\d{6}$/.test(value)) throw new StaffError('کد شش‌رقمی را وارد کنید.', 400)
      if (mode === 'code') finish(await staff.login('auth/otp/verify', { phone, code: value, platform: 'web', deviceLabel: 'Specialist workspace' }))
      else finish(await staff.login('auth/totp', { code: value, totpToken }))
    } catch (cause) {
      setError(cause instanceof StaffError ? cause.message : 'ورود انجام نشد.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="login-layout" aria-label="ورود به پنل پزشک">
      <div className="login-form-area"><div className="login-form-wrap">
        <h1>متخصص گرامی خوش آمدید!</h1>
        <p className="form-error" role="alert">{error}</p>
        <form onSubmit={submit}>
          {mode === 'phone' && (
            <label>شماره تلفن
              <input dir="ltr" inputMode="tel" autoComplete="tel" required maxLength={13} placeholder="۰۹۱۲۳۴۵۶۷۸۹" value={phone} onChange={(event) => setPhone(event.target.value)} />
            </label>
          )}
          {mode === 'password' && (
            <>
              <label>نام کاربری
                <input dir="ltr" autoComplete="username" required maxLength={32} placeholder="doctor.name" value={username} onChange={(event) => setUsername(event.target.value)} />
              </label>
              <label>رمز عبور
                <div className="password-field">
                  <input dir="ltr" type={shown ? 'text' : 'password'} autoComplete="current-password" required maxLength={256} placeholder="رمز عبور شما" value={password} onChange={(event) => setPassword(event.target.value)} />
                  <button type="button" className="icon-button" aria-label={shown ? 'پنهان کردن رمز عبور' : 'نمایش رمز عبور'} aria-pressed={shown} onClick={() => setShown((value) => !value)}><Icon name="eye" /></button>
                </div>
              </label>
            </>
          )}
          {mode === 'code' && (
            <label>کد ورود
              <input dir="ltr" inputMode="numeric" autoComplete="one-time-code" required maxLength={6} placeholder="کد شش‌رقمی" value={code} onChange={(event) => setCode(event.target.value)} />
            </label>
          )}
          {mode === 'totp' && (
            <>
              <div className="info-note"><Icon name="shield" /><p>کد شش‌رقمی برنامهٔ احراز هویت خود را وارد کنید.</p></div>
              <label>کد ورود دومرحله‌ای
                <input dir="ltr" inputMode="numeric" autoComplete="one-time-code" required maxLength={6} value={code} onChange={(event) => setCode(event.target.value)} />
              </label>
            </>
          )}
          <button className="login-submit" type="submit" disabled={busy}>{mode === 'phone' ? 'دریافت کد ورود' : mode === 'totp' ? 'تأیید و ورود' : 'ورود به پنل'} <Icon name="arrow-left" /></button>
          {mode === 'code' && <button className="secondary" type="button" onClick={() => { setMode('phone'); setCode('') }}>تغییر شماره</button>}
        </form>
        {mode !== 'code' && mode !== 'totp' && (
          <button className="secondary login-switch" type="button" onClick={() => setMode(mode === 'phone' ? 'password' : 'phone')}>
            {mode === 'phone' ? 'ورود با نام کاربری و رمز' : 'ورود با شماره تلفن و کد'}
          </button>
        )}
      </div></div>
    </section>
  )
}
