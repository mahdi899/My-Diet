import { Link, NavLink } from 'react-router-dom'
import { useState, type ReactNode } from 'react'

const links = [
  ['/', 'خانه'],
  ['/pricing.html', 'خدمات و تعرفه‌ها'],
  ['/about.html', 'دربارهٔ ما'],
  ['/articles.html', 'مقالات'],
  ['/contact.html', 'تماس با ما'],
] as const

function Leaf() {
  return (
    <svg className="h-10 w-9 text-pine" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <path d="M12 22V10M12 15C3 15 1 8 2 3c8 0 12 4 10 12ZM12 20c0-8 4-12 11-12 1 7-3 12-11 12Z" />
    </svg>
  )
}

export function SiteFrame({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [download, setDownload] = useState(false)
  return (
    <div className="min-h-screen bg-cream text-ink">
      <header className="sticky top-0 z-10 border-b border-pine/5 bg-cream/95 backdrop-blur-sm">
        <div className="mx-auto flex h-24 max-w-[1180px] items-center justify-between gap-6 px-6">
          <Link to="/" className="flex items-center gap-2 text-[28px] font-bold tracking-tight">
            <Leaf />
            رژیم من
          </Link>
          <nav className={`${open ? 'absolute inset-x-0 top-24 flex flex-col gap-4 bg-cream p-6 shadow-lg' : 'hidden'} md:static md:flex md:flex-row md:gap-9 md:bg-transparent md:p-0 md:shadow-none text-sm`}>
            {links.map(([to, label]) => (
              <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => isActive ? 'text-pine' : 'hover:text-pine/70'} onClick={() => setOpen(false)}>
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/onboarding" className="rounded-xl bg-pine px-5 py-3 text-sm font-bold text-white">
              شروع پرسش‌نامه
            </Link>
            <button type="button" className="hidden rounded-xl border border-pine/15 px-4 py-3 text-sm font-bold text-pine lg:inline-flex" onClick={() => setDownload(true)}>
              دانلود اپ
            </button>
          </div>
          <button type="button" className="md:hidden" aria-label="منو" onClick={() => setOpen((value) => !value)}>منو</button>
        </div>
      </header>
      {children}
      <footer className="mt-16 bg-[#173f2a] py-12 text-[#eef3e4]">
        <div className="mx-auto flex max-w-[1180px] flex-wrap justify-between gap-6 px-6 text-xs text-[#c9d6be]">
          <div>
            <div className="mb-3 text-lg font-bold text-white">رژیم من</div>
            <p className="max-w-sm leading-7">غذای خوب، متناسب با زندگی تو.</p>
          </div>
          <div className="flex flex-col gap-2">
            {links.map(([to, label]) => <Link key={to} to={to}>{label}</Link>)}
            <Link to="/terms.html">شرایط خرید</Link>
            <Link to="/refund.html">لغو و بازگشت وجه</Link>
            <Link to="/onboarding">پرسش‌نامه</Link>
            <Link to="/doctor">ورود پزشک</Link>
            <Link to="/admin">ورود مدیریت</Link>
          </div>
          <p className="w-full border-t border-white/20 pt-4 text-[10px] text-[#a9be9e]">طراحی شده با عشق توسط آکادمی رستمی</p>
        </div>
      </footer>
      {download && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#123321]/50 p-4" onClick={() => setDownload(false)}>
          <div className="max-w-md rounded-3xl bg-cream p-8" onClick={(event) => event.stopPropagation()}>
            <h2 className="text-2xl font-bold">شروع یک مسیر سبز</h2>
            <p className="mt-3 text-sm text-muted">در اپلیکیشن رژیم من می‌توانی اطلاعاتت را تکمیل کنی، برنامه بگیری و با متخصص گفتگو کنی.</p>
            <button type="button" className="mt-6 rounded-xl bg-sage px-5 py-3 text-sm font-bold text-pine" onClick={() => setDownload(false)}>متوجه شدم</button>
          </div>
        </div>
      )}
    </div>
  )
}
