import { useEffect, useState } from 'react'
import { Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import { StaffShell } from '@shared/ui'
import { doctorAuth, staff } from './session'
import { doctorNav } from './nav'
import { LoginPage } from './features/auth/LoginPage'
import { DoctorWorkspace } from './features/workspace/DoctorWorkspace'

function Panel() {
  const navigate = useNavigate()
  const params = useParams()
  const section = params.section && doctorNav.some((item) => item.id === params.section) ? params.section : 'dashboard'
  return (
    <StaffShell
      brand="رژیم من"
      section={section}
      nav={doctorNav}
      onNavigate={(id) => navigate('/doctor/' + id)}
      onLogout={async () => {
        try { await staff.logout() } catch { staff.clear() }
        window.location.href = '/doctor/'
      }}
    >
      <DoctorWorkspace section={section} />
    </StaffShell>
  )
}

export default function App() {
  const [state, setState] = useState<'checking' | 'in' | 'out'>('checking')
  useEffect(() => {
    doctorAuth.bindExpiry(() => setState('out'))
    staff.restore().then(() => setState('in')).catch(() => setState('out'))
  }, [])
  if (state === 'checking') return <div className="grid min-h-screen place-items-center">در حال بررسی نشست…</div>
  return (
    <Routes>
      <Route index element={state === 'in' ? <Navigate to="/doctor/dashboard" replace /> : <LoginPage onSuccess={() => setState('in')} />} />
      <Route path=":section" element={state === 'in' ? <Panel /> : <Navigate to="/doctor" replace />} />
    </Routes>
  )
}
