export const localOtpCode = '123456'

export function isLocalOnboardingPreview() {
  return import.meta.env.DEV && ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)
}
