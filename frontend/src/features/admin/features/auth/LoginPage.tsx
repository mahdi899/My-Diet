import { FormEvent, useState } from 'react'
import { StaffError } from '@shared/api/staff-session'
import { AdminIcon as Icon } from '../../components/AdminIcon'
import { AdminBrand } from '../../components/AdminShell'
import { staff } from '../../session'
import { adminPreviewEnabled, loginToPreview } from '../../data/preview'

export function LoginPage({ onSuccess }: { onSuccess: () => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [totpToken, setTotpToken] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const preview = adminPreviewEnabled()

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      if (preview) {
        if (loginToPreview(username, password)) onSuccess()
        else setError('نام کاربری یا رمز عبور آزمایشی اشتباه است.')
        return
      }
      if (totpToken) {
        const session = await staff.login('auth/totp', { code, totpToken })
        staff.accept(session)
        onSuccess()
        return
      }
      const session = await staff.login('auth/admin/login', { username, password })
      if (session.totpRequired && session.totpToken) {
        setTotpToken(session.totpToken)
        return
      }
      staff.accept(session)
      onSuccess()
    } catch (cause) {
      setError(cause instanceof StaffError ? cause.message : 'ورود انجام نشد.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section id="login" className="login-layout" aria-label="ورود به پنل مدیریت">
      <div className="login-story">
        <AdminBrand />
        <div className="login-story-copy"><span className="eyebrow">مراقبت، با نگاهی دقیق‌تر</span><h2>رشد رژیم من،<br />از اینجا شروع می‌شود.</h2><p>کاربران، برنامه‌ها و ارتباطات را در یک فضای یکپارچه مدیریت کنید.</p></div>
        <div className="botanical-art" aria-hidden="true"><div className="art-orbit" /><div className="art-orbit second" /><Icon name="leaf" className="icon" /></div>
        <span className="login-story-footer">یک فضای منظم برای تصمیم‌های بهتر</span>
      </div>
      <div className="login-form-area"><div className="login-form-wrap">
        <span className="login-lock icon-tile"><Icon name="lock" className="icon" /></span><span className="eyebrow">پنل مدیریت رژیم من</span>
        <h1>{totpToken ? 'ورود دومرحله‌ای' : 'خوش برگشتید'}</h1>
        <p className="login-intro">{preview ? 'برای دیدن داده‌های نمونه، با حساب آزمایشی وارد شوید.' : totpToken ? 'کد شش‌رقمی برنامه احراز هویت را وارد کنید.' : 'برای ادامه، وارد حساب مدیریت خود شوید.'}</p>
      <form onSubmit={submit}>
        {!totpToken && (
          <>
            <label>نام کاربری
              <input name="username" placeholder="نام کاربری شما" dir="ltr" autoComplete="username" required maxLength={80} value={username} onChange={(event) => setUsername(event.target.value)} />
            </label>
            <label>رمز عبور
              <div className="password-field"><input name="password" placeholder="رمز عبور شما" dir="ltr" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required maxLength={256} value={password} onChange={(event) => setPassword(event.target.value)} /><button type="button" className="icon-button" aria-label={showPassword ? 'پنهان کردن رمز عبور' : 'نمایش رمز عبور'} aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)}><Icon name="eye" className="icon" /></button></div>
            </label>
          </>
        )}
        {totpToken && (
          <label className="text-sm font-semibold">کد ورود
            <input dir="ltr" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={(event) => setCode(event.target.value)} />
          </label>
        )}
        <p className="form-error" role="alert">{error}</p>
        <button className="login-submit" type="submit" disabled={busy}>{busy ? 'در حال بررسی…' : 'ورود به پنل'}<Icon name="arrow" className="icon" /></button>
      </form>
      <p className="login-footnote"><Icon name="shield" className="icon" /> دسترسی ویژهٔ مدیران رژیم من</p>
      </div></div>
    </section>
  )
}
