import { useQuery } from '@tanstack/react-query'
import { apiError, loadProfile } from '../../data/api'
import { verificationStatus } from '../../data/labels'

export function ProfilePage() {
  const query = useQuery({ queryKey: ['doctor', 'profile'], queryFn: loadProfile })
  if (query.isLoading) return <section className="card card-pad">در حال دریافت اطلاعات…</section>
  if (query.isError || !query.data) return <section className="card card-pad">{apiError(query.error)}</section>
  const profile = query.data
  const rows: [string, string][] = [
    ['نام', profile.displayName || 'ثبت نشده'],
    ['تخصص', profile.credential || 'ثبت نشده'],
    ['کد نظام پزشکی', profile.councilNo || 'ثبت نشده'],
    ['وضعیت تأیید', verificationStatus[profile.verificationStatus] || 'ثبت نشده'],
    ['معرفی', profile.bio || 'ثبت نشده'],
  ]
  return (
    <section className="card card-pad">
      <h2>هویت حرفه‌ای</h2>
      <dl className="definition-list">
        {rows.map(([label, value]) => <span key={label} style={{ display: 'contents' }}><dt>{label}</dt><dd>{value}</dd></span>)}
      </dl>
      <p className="workspace-note">ویرایش مشخصات حرفه‌ای به API مدیریت پروفایل وابسته است.</p>
    </section>
  )
}
