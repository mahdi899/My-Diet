import { StaffError, publicRequest } from '@shared/api/staff-session'
import type { OnboardingGateway, SubmissionAnswer, TransferOrder } from '../application/ports'
import { readCheckoutSession, writeCheckoutSession } from './checkout-session'

export type { TransferOrder }

export class OnboardingApi implements OnboardingGateway {
  submit(body: { id: string; phone: string; goal?: string; specialistId: string; answers: SubmissionAnswer[] }) {
    return publicRequest('onboarding/submissions', 'POST', body)
  }

  requestOtp(phone: string) {
    return publicRequest('auth/otp/request', 'POST', { phone })
  }

  async verifyOtp(phone: string, code: string) {
    const session = await publicRequest<{ accessToken?: string; role?: string; detail?: string }>('auth/otp/verify', 'POST', {
      phone,
      code,
      platform: 'demo-web',
    })
    if (!session.accessToken || session.role !== 'user') {
      throw new StaffError(session.detail || 'کد تأیید معتبر نیست.', 400)
    }
    return session.accessToken
  }

  verifySubmission(id: string, token: string, journeyId: string) {
    return publicRequest('onboarding/submissions/' + id + '/verify', 'POST', journeyId ? { journeyId } : {}, token)
  }

  async refreshToken(current: string) {
    const response = await fetch('/v1/auth/refresh', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'x-sabzine-client': 'web' },
      body: '{}',
    })
    const data = await response.json() as { accessToken?: string; role?: string }
    if (!response.ok || !data.accessToken || data.role !== 'user') return current
    const saved = readCheckoutSession()
    if (saved) writeCheckoutSession({ ...saved, token: data.accessToken })
    return data.accessToken
  }

  async transfer<T>(path: string, body: unknown, token: string): Promise<T> {
    try {
      return await publicRequest<T>('me/onboarding-transfers' + path, body === undefined ? 'GET' : 'POST', body, token)
    } catch (cause) {
      if (cause instanceof StaffError && cause.status === 401) {
        const next = await this.refreshToken(token)
        if (next !== token) return publicRequest<T>('me/onboarding-transfers' + path, body === undefined ? 'GET' : 'POST', body, next)
      }
      throw cause
    }
  }

  async communityCount() {
    const response = await fetch('/v1/public/onboarding/community-join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
    if (!response.ok) return null
    const data = await response.json() as { count?: number }
    const count = Number(data.count)
    return Number.isFinite(count) && count > 0 ? count : null
  }
}

export const onboardingApi = new OnboardingApi()
