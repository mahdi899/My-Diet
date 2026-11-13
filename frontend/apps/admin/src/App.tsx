import { useEffect, useState } from 'react'
import { Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import { Button, StaffShell } from '@shared/ui'
import { adminAuth, staff } from './session'
import { adminNav } from './nav'
import { LoginPage } from './features/auth/LoginPage'
import { WorkspacePage } from './features/workspace/WorkspacePage'

function Panel() {
  const navigate = useNavigate()
  const params = useParams()
  const section = params.section && adminNav.some((item) => item.id === params.section) ? params.section : 'dashboard'

  async function logout() {
    try { await staff.logout() } catch { staff.clear() }
    window.location.href = '/admin/'
  }

  return (
    <StaffShell
      brand="رژیم من"
      section={section}
      nav={adminNav}
      onNavigate={(id) => navigate('/admin/' + id)}
      onLogout={logout}
      actions={<Button variant="secondary" onClick={() => window.location.reload()}>به‌روزرسانی</Button>}
    >
      <WorkspacePage section={section} />
    </StaffShell>
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
    <Routes>
      <Route path="login" element={state === 'in' ? <Navigate to="/admin/dashboard" replace /> : <LoginPage onSuccess={() => setState('in')} />} />
      <Route index element={state === 'in' ? <Navigate to="/admin/dashboard" replace /> : <Navigate to="/admin/login" replace />} />
      <Route path=":section" element={state === 'in' ? <Panel /> : <Navigate to="/admin/login" replace />} />
    </Routes>
  )
}
