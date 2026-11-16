import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AdminIcon as Icon } from '../../admin/components/AdminIcon'
import { doctorNav } from '../nav'
import { loadProfile } from '../data/api'
import { canLeaveDoctor } from '../data/labels'
import { doctorPreviewEnabled } from '../data/preview'
import { BrandLogo } from '@shared/ui/BrandLogo'

export function DoctorShell({ section, onNavigate, onLogout, children, onRefresh }: {
  section: string
  onNavigate: (id: string) => void
  onLogout: () => void
  onRefresh: () => void
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [account, setAccount] = useState(false)
  const [name, setName] = useState('پزشک')
  const current = doctorNav.find((item) => item.id === section) ?? doctorNav[0]!
  const groups = [...new Set(doctorNav.map((item) => item.group))]
  useEffect(() => {
    let alive = true
    loadProfile().then((profile) => { if (alive) setName(profile.displayName?.trim() || 'پزشک') }).catch(() => {})
    return () => { alive = false }
  }, [])
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); setAccount(false) } }
    document.addEventListener('keydown', escape)
    return () => document.removeEventListener('keydown', escape)
  }, [])
  const initial = name.charAt(0) || 'پ'
  function go(id: string) {
    if (!canLeaveDoctor()) return
    setOpen(false)
    onNavigate(id)
  }
  return (
    <div id="panel" className={open ? 'menu-open' : ''}>
      <a className="skip-link" href="#main">رفتن به محتوای اصلی</a>
      <button className="sidebar-backdrop" hidden={!open} aria-label="بستن منوی کناری" onClick={() => setOpen(false)} />
      <aside id="sidebar" aria-label="منوی اصلی">
        <div className="sidebar-brand">
          <Link to="/doctor/dashboard" onClick={(event) => { if (!canLeaveDoctor()) event.preventDefault() }}>
            <div className="brand"><BrandLogo variant="symbol" tone="white" size={40} decorative /><div><BrandLogo variant="wordmark" tone="white" size={30} /><small>پنل پزشک</small></div></div>
          </Link>
          <button id="menu-close" className="icon-button" aria-label="بستن منو" onClick={() => setOpen(false)}><Icon name="close" /></button>
        </div>
        <div className="workspace-label"><span className="workspace-dot" />فضای کاری رژیم من <span className="workspace-tag">پزشک</span></div>
        <nav id="nav" aria-label="بخش‌های پنل پزشک">
          {groups.map((group) => (
            <div className="nav-group" key={group}>
              <div className="nav-group-label">{group}</div>
              {doctorNav.filter((item) => item.group === group).map((item) => (
                <Link key={item.id} className={`nav-link${section === item.id ? ' active' : ''}`} to={`/doctor/${item.id}`} aria-current={section === item.id ? 'page' : undefined} onClick={(event) => { event.preventDefault(); go(item.id) }}>
                  <Icon name={item.icon} /><span>{item.title}</span>
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="profile"><span className="avatar">{initial}</span><div><strong>{name}</strong><small>حساب پزشک رژیم من</small></div></div>
          <button className="logout-button" onClick={onLogout}><Icon name="logout" />خروج از حساب</button>
        </div>
      </aside>
      <div className="workspace">
        <div className="topbar">
          <div className="topbar-location">
            <button id="menu-toggle" className="icon-button" aria-label="باز کردن منو" aria-expanded={open} onClick={() => setOpen(true)}><Icon name="menu" /></button>
            <span className="topbar-home"><Icon name="grid" /></span>
            <span>فضای پزشک</span>
            <span className="breadcrumb-divider">/</span>
            <strong>{current.title}</strong>
          </div>
          <div className="topbar-meta">
            <span className="today"><Icon name="calendar" /><time>{new Date().toLocaleDateString('fa-IR', { timeZone: 'Asia/Tehran', weekday: 'long', day: 'numeric', month: 'long' })}</time></span>
            <div className="account-menu">
              <button className="topbar-avatar" aria-label={'حساب ' + name} aria-expanded={account} onClick={() => setAccount((value) => !value)}>{initial}</button>
              {account && <div className="account-dropdown"><button onClick={onLogout}><Icon name="logout" />خروج از حساب</button></div>}
            </div>
          </div>
        </div>
        <main id="main" tabIndex={-1}>
          <header className="page-heading">
            <div>
              <h1>{current.title}</h1>
              <p>{current.description}{doctorPreviewEnabled() ? ' حالت پیش‌نمایش: داده‌های نمونه جدا از حساب واقعی هستند.' : ''}</p>
            </div>
            <div className="actions"><button className="secondary" type="button" onClick={onRefresh}><Icon name="history" />به‌روزرسانی</button></div>
          </header>
          <div id="content" aria-live="polite">{children}</div>
          <footer className="workspace-footer"><span>طراحی شده با عشق توسط اکادمی رستمی</span></footer>
        </main>
      </div>
    </div>
  )
}
