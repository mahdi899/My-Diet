const previewModeKey = 'doctor-ui-preview'
const previewSessionKey = 'doctor-ui-preview-session'

export function doctorPreviewEnabled() {
  if (!import.meta.env.DEV) return false
  const choice = new URLSearchParams(window.location.search).get('preview')
  if (choice === '1') sessionStorage.setItem(previewModeKey, '1')
  if (choice === '0') {
    sessionStorage.removeItem(previewModeKey)
    clearDoctorPreview()
  }
  return sessionStorage.getItem(previewModeKey) === '1'
}

export function hasDoctorPreviewSession() {
  return doctorPreviewEnabled() && sessionStorage.getItem(previewSessionKey) === '1'
}

export function loginToDoctorPreview(username: string, password: string) {
  if (!doctorPreviewEnabled() || username.trim().toLowerCase() !== 'specialist-demo' || password !== 'MyDiet-Demo-2026!') return false
  sessionStorage.setItem(previewSessionKey, '1')
  return true
}

export function clearDoctorPreview() {
  sessionStorage.removeItem(previewSessionKey)
}

export const previewProfile = {
  portrait: '',
  education: '',
  displayName: 'دکتر نازنین رضایی',
  credential: 'تغذیه و رژیم‌درمانی',
  councilNo: '۱۳۳۴۵۶',
  verificationStatus: 'verified',
  bio: 'همراه برنامهٔ غذایی کاربران رژیم من. این متن فقط برای نمایش ظاهر پروفایل است.',
}
