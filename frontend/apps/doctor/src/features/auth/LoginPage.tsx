import { FormEvent, useState } from 'react'
import { StaffError } from '@shared/api/staff-session'
import { Button, Input } from '@shared/ui'
import { toEnglishDigits } from '@shared/utils'
import { staff } from '../../session'

export function LoginPage({ onSuccess }: { onSuccess: () => void }) {
  const [mode, setMode] = useState<'phone' | 'password' | 'code' | 'totp'>('phone')
  const [phone, setPhone] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [totpToken, setTotpToken] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function finish(session: { totpRequired?: boolean; totpToken?: string; role?: string; accessToken?: string; sessionExpiresAt?: string }) {
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
      if (mode === 'phone') {
        const value = toEnglishDigits(phone).trim()
        if (!/^09\d{9}$/.test(value)) throw new StaffError('شماره تلفن ۱۱ رقمی با ۰۹ وارد کنید.', 400)
        await staff.login('auth/otp/request', { phone: value })
        setPhone(value)
        setMode('code')
        return
      }
      if (mode === 'password') {
        await finish(await staff.login('auth/specialist/login', { username: username.trim().toLowerCase(), password }))
        return
      }
      if (mode === 'code') {
        const value = toEnglishDigits(code).trim()
        if (!/^\d{6}$/.test(value)) throw new StaffError('کد شش‌رقمی را وارد کنید.', 400)
        await finish(await staff.login('auth/otp/verify', { phone, code: value, platform: 'web', deviceLabel: 'Specialist workspace' }))
        return
      }
      const value = toEnglishDigits(code).trim()
      await finish(await staff.login('auth/totp', { code: value, totpToken }))
    } catch (cause) {
      setError(cause instanceof StaffError ? cause.message : 'ورود انجام نشد.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center bg-cream px-6">
      <h1 className="mb-6 text-2xl font-bold">متخصص گرامی خوش آمدید!</h1>
      {mode === 'phone' && (
        <label className="text-sm font-semibold">شماره تلفن
          <Input className="mt-2" dir="ltr" inputMode="tel" required maxLength={13} value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="09123456789" />
        </label>
      )}
      {mode === 'password' && (
        <>
          <label className="text-sm font-semibold">نام کاربری
            <Input className="mt-2" dir="ltr" required maxLength={32} value={username} onChange={(event) => setUsername(event.target.value)} />
          </label>
          <label className="text-sm font-semibold">رمز عبور
            <Input className="mt-2" dir="ltr" type="password" required maxLength={256} value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
        </>
      )}
      {(mode === 'code' || mode === 'totp') && (
        <label className="text-sm font-semibold">{mode === 'totp' ? 'کد دومرحله‌ای' : 'کد ورود'}
          <Input className="mt-2" dir="ltr" inputMode="numeric" required maxLength={6} value={code} onChange={(event) => setCode(event.target.value)} />
        </label>
      )}
      {error && <p className="mb-4 text-sm text-danger" role="alert">{error}</p>}
      <Button type="submit" disabled={busy}>{mode === 'phone' ? 'دریافت کد ورود' : 'ورود به پنل'}</Button>
      {mode !== 'code' && mode !== 'totp' && (
        <button type="button" className="mt-4 text-sm text-green" onClick={() => setMode(mode === 'phone' ? 'password' : 'phone')}>
          {mode === 'phone' ? 'ورود با نام کاربری و رمز' : 'ورود با شماره تلفن و کد'}
        </button>
      )}
    </form>
  )
}
