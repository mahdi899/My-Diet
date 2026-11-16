import { useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AdminIcon as Icon } from './AdminIcon'
import { adminNav } from '../nav'
import { BrandLogo } from '@shared/ui/BrandLogo'

export function AdminBrand() {
  return <div className="brand"><BrandLogo variant="symbol" tone="white" size={40} decorative /><div><BrandLogo variant="wordmark" tone="white" size={30} /><small>پنل مدیریت</small></div></div>
}

export function AdminShell({ section, onLogout, children, actions, description }: { section: string; onLogout: () => void; children: ReactNode; actions?: ReactNode; description?: string }) {
  const [open, setOpen] = useState(false)
  const [account, setAccount] = useState(false)
  const navigate = useNavigate()
  const current = adminNav.find(item => item.id === section) ?? adminNav[0]!
  const groups = [...new Set(adminNav.map(item => item.group))]
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); setAccount(false) } }
    document.addEventListener('keydown', escape)
    return () => document.removeEventListener('keydown', escape)
  }, [])
  return <div id="panel" className={open ? 'menu-open' : ''}>
    <a className="skip-link" href="#main">رفتن به محتوای اصلی</a>
    <button className="sidebar-backdrop" hidden={!open} aria-label="بستن منوی کناری" onClick={() => setOpen(false)} />
    <aside id="sidebar" aria-label="منوی اصلی">
      <div className="sidebar-brand"><Link to="/admin/dashboard"><AdminBrand /></Link><button id="menu-close" className="icon-button" aria-label="بستن منو" onClick={() => setOpen(false)}><Icon name="close" className="icon" /></button></div>
      <div className="workspace-label"><span className="workspace-dot" />فضای کاری رژیم من <span className="workspace-tag">مدیریت</span></div>
      <nav id="nav" aria-label="بخش‌های پنل">{groups.map(group => <div className="nav-group" key={group}><div className="nav-group-label">{group}</div>{adminNav.filter(item => item.group === group).map(item => <Link key={item.id} className={`nav-link${section === item.id ? ' active' : ''}`} to={`/admin/${item.id}`} aria-current={section === item.id ? 'page' : undefined} onClick={() => setOpen(false)}><Icon name={item.icon} className="icon" /><span>{item.title}</span></Link>)}</div>)}</nav>
      <div className="sidebar-bottom"><div className="profile"><span className="avatar">م</span><div><strong>مدیر سیستم</strong><small>حساب مدیریت رژیم من</small></div></div><button className="logout-button" onClick={onLogout}><Icon name="logout" className="icon" />خروج از حساب</button></div>
    </aside>
    <div className="workspace"><div className="topbar"><div className="topbar-location"><button id="menu-toggle" className="icon-button" aria-label="باز کردن منو" aria-controls="sidebar" aria-expanded={open} onClick={() => setOpen(true)}><Icon name="menu" className="icon" /></button><span className="topbar-home"><Icon name="grid" className="icon" /></span><span>فضای مدیریت</span><span className="breadcrumb-divider">/</span><strong>{current.title}</strong></div><div className="topbar-meta"><span className="today"><Icon name="calendar" className="icon" /><time>{new Date().toLocaleDateString('fa-IR', { timeZone: 'Asia/Tehran', weekday: 'long', day: 'numeric', month: 'long' })}</time></span><div className="account-menu"><button className="topbar-avatar" aria-label="حساب مدیر" aria-expanded={account} onClick={() => setAccount(!account)}>م</button>{account && <div className="account-dropdown"><button onClick={onLogout}><Icon name="logout" className="icon" />خروج از حساب</button></div>}</div></div></div>
      <main id="main" tabIndex={-1}><header className="page-heading"><div><div className="page-eyebrow">{current.group}</div><h1>{current.title}</h1>{description && <p>{description}</p>}</div>{actions !== null && <div className="actions">{actions ?? <button className="secondary" onClick={() => navigate(0)}>به‌روزرسانی</button>}</div>}</header><div id="content" aria-live="polite">{children}</div><footer className="workspace-footer"><span>رژیم من · همراه مسیر سلامت</span><span>پنل مدیریت</span></footer></main>
    </div>
  </div>
}
