import { useEffect, useState } from 'react'
import { Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import '../admin/styles/reference.css'
import '../admin/styles/react.css'
import './styles/doctor.css'
import { DoctorShell } from './components/DoctorShell'
import { doctorNav } from './nav'
import { doctorAuth, staff } from './session'
import { LoginPage } from './features/auth/LoginPage'
import { DoctorDesk } from './features/desk/DoctorDesk'
import { canLeaveDoctor } from './data/labels'
import { clearDoctorPreview, doctorPreviewEnabled, hasDoctorPreviewSession } from './data/preview'

function Panel() {
  const navigate = useNavigate()
  const params = useParams()
  const section = params.section && doctorNav.some((item) => item.id === params.section) ? params.section : 'dashboard'
  const [refreshKey, setRefreshKey] = useState(0)
  function go(id: string) {
    if (!canLeaveDoctor()) return
    navigate('/doctor/' + id)
  }
  async function logout() {
    if (!canLeaveDoctor()) return
    if (doctorPreviewEnabled()) clearDoctorPreview()
    else { try { await staff.logout() } catch { staff.clear() } }
    window.location.href = '/doctor/' + (doctorPreviewEnabled() ? '?preview=1' : '')
  }
  return (
    <DoctorShell section={section} onNavigate={go} onLogout={logout} onRefresh={() => { if (canLeaveDoctor()) setRefreshKey((value) => value + 1) }}>
      <DoctorDesk section={section} refreshKey={refreshKey} onNavigate={go} />
    </DoctorShell>
  )
}

export default function App() {
  const [state, setState] = useState<'checking' | 'in' | 'out'>('checking')
  useEffect(() => {
    if (doctorPreviewEnabled()) {
      setState(hasDoctorPreviewSession() ? 'in' : 'out')
      return
    }
    doctorAuth.bindExpiry(() => setState('out'))
    staff.restore().then(() => setState('in')).catch(() => setState('out'))
  }, [])
  if (state === 'checking') return <div className="admin-reference doctor-portal"><div className="login-layout">در حال بررسی نشست…</div></div>
  return (
    <div className="admin-reference doctor-portal">
      <Routes>
        <Route index element={state === 'in' ? <Navigate to="/doctor/dashboard" replace /> : <LoginPage onSuccess={() => setState('in')} />} />
        <Route path=":section" element={state === 'in' ? <Panel /> : <Navigate to="/doctor" replace />} />
      </Routes>
    </div>
  )
}
