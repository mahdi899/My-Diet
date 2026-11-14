import { useEffect, useState } from 'react'
import { Navigate, Route, Routes, useParams } from 'react-router-dom'
import { AdminShell } from './components/AdminShell'
import './styles/reference.css'
import './styles/react.css'
import { adminAuth, staff } from './session'
import { adminNav } from './nav'
import { LoginPage } from './features/auth/LoginPage'
import { WorkspacePage } from './features/workspace/WorkspacePage'
import { adminPreviewEnabled } from './data/preview'
import { AdminIcon } from './components/AdminIcon'

function Panel() {
  const [createSpecialist, setCreateSpecialist] = useState(false)
  const preview = adminPreviewEnabled()
  const params = useParams()
  const section = params.section && adminNav.some((item) => item.id === params.section) ? params.section : 'dashboard'

  async function logout() {
    try { await staff.logout() } catch { staff.clear() }
    window.location.href = '/admin/'
  }

  return (
    <AdminShell
      section={section}
      description={section === 'specialists' ? 'پزشکان فعال و اطلاعات تخصصی آن‌ها.' : undefined}
      actions={section === 'specialists' ? <button onClick={() => setCreateSpecialist(true)}><AdminIcon name="plus" />افزودن</button> : undefined}
      onLogout={logout}
    >
      {preview && <div className="info-note preview-notice" role="status"><p>حالت پیش‌نمایش: داده‌های این صفحه آزمایشی هستند؛ عملیات ثبت و تغییر غیرفعال است.</p><a href={`/admin/${section}?preview=0`}>بازگشت به داده‌های واقعی</a></div>}
      <fieldset disabled={preview && !['users', 'specialists'].includes(section)} className="preview-content"><WorkspacePage section={section} createSpecialist={createSpecialist} onCloseCreate={() => setCreateSpecialist(false)} /></fieldset>
    </AdminShell>
  )
}

export default function App() {
  const [state, setState] = useState<'checking' | 'in' | 'out'>('checking')

  useEffect(() => {
    adminAuth.bindExpiry(() => setState('out'))
    staff.restore().then(() => setState('in')).catch(() => setState('out'))
  }, [])

  if (state === 'checking') {
    return <div className="grid min-h-screen place-items-center text-muted">در حال بررسی نشست…</div>
  }

  return (
    <div className="admin-reference" dir="rtl"><Routes>
      <Route path="login" element={state === 'in' ? <Navigate to="/admin/dashboard" replace /> : <LoginPage onSuccess={() => setState('in')} />} />
      <Route index element={state === 'in' ? <Navigate to="/admin/dashboard" replace /> : <Navigate to="/admin/login" replace />} />
      <Route path=":section" element={state === 'in' ? <Panel /> : <Navigate to="/admin/login" replace />} />
    </Routes></div>
  )
}
