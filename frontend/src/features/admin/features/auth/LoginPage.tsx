import { FormEvent, useState } from 'react'
import { StaffError } from '@shared/api/staff-session'
import { Button, Input } from '@shared/ui'
import { staff } from '../../session'

export function LoginPage({ onSuccess }: { onSuccess: () => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [totpToken, setTotpToken] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
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
    <section className="grid min-h-screen bg-cream lg:grid-cols-2">
      <div className="hidden bg-forest p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="text-2xl font-bold">رژیم من<small className="mt-2 block text-xs font-normal text-[#bdd0be]">پنل مدیریت</small></div>
        <div>
          <p className="text-sm text-[#c3d0bb]">مراقبت، با نگاهی دقیق‌تر</p>
          <h2 className="mt-3 text-4xl font-bold leading-relaxed">رشد رژیم من، از اینجا شروع می‌شود.</h2>
        </div>
        <p className="text-xs text-[#a9be9e]">یک فضای منظم برای تصمیم‌های بهتر</p>
      </div>
      <form onSubmit={submit} className="mx-auto flex w-full max-w-md flex-col justify-center px-6 py-12">
        <h1 className="mb-2 text-3xl font-bold">{totpToken ? 'ورود دومرحله‌ای' : 'خوش برگشتید'}</h1>
        <p className="mb-6 text-sm text-muted">{totpToken ? 'کد شش‌رقمی برنامه احراز هویت را وارد کنید.' : 'برای ادامه، وارد حساب مدیریت خود شوید.'}</p>
        {!totpToken && (
          <>
            <label className="text-sm font-semibold">نام کاربری
              <Input className="mt-2" dir="ltr" autoComplete="username" required maxLength={80} value={username} onChange={(event) => setUsername(event.target.value)} />
            </label>
            <label className="text-sm font-semibold">رمز عبور
              <Input className="mt-2" dir="ltr" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required maxLength={256} value={password} onChange={(event) => setPassword(event.target.value)} />
            </label>
            <button type="button" className="mb-4 text-xs text-green" onClick={() => setShowPassword((value) => !value)}>
              {showPassword ? 'پنهان کردن رمز' : 'نمایش رمز'}
            </button>
          </>
        )}
        {totpToken && (
          <label className="text-sm font-semibold">کد ورود
            <Input className="mt-2" dir="ltr" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={(event) => setCode(event.target.value)} />
          </label>
        )}
        {error && <p className="mb-4 text-sm text-danger" role="alert">{error}</p>}
        <Button type="submit" disabled={busy}>{busy ? 'در حال بررسی…' : 'ورود به پنل'}</Button>
      </form>
    </section>
  )
}
