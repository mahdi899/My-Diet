import { useState, type ReactNode } from 'react'
import { Icon } from './Icon'
import { cn } from '../utils'

export interface StaffNavItem {
  id: string
  title: string
  icon: string
  group: string
}

interface StaffShellProps {
  brand: string
  section: string
  nav: StaffNavItem[]
  onNavigate: (id: string) => void
  onLogout: () => void
  children: ReactNode
  description?: string
  actions?: ReactNode
}

export function StaffShell({ brand, section, nav, onNavigate, onLogout, children, description, actions }: StaffShellProps) {
  const [open, setOpen] = useState(false)
  const current = nav.find((item) => item.id === section) ?? nav[0]
  const today = new Date().toLocaleDateString('fa-IR', { timeZone: 'Asia/Tehran', weekday: 'long', day: 'numeric', month: 'long' })
  let lastGroup = ''

  return (
    <div className="min-h-screen bg-[#f5f6f2] text-ink">
      {open && <button className="fixed inset-0 z-30 bg-[#112e29]/70 md:hidden" aria-label="بستن منو" onClick={() => setOpen(false)} />}
      <aside className={cn('fixed inset-y-0 start-0 z-40 flex w-[248px] flex-col bg-forest px-4 py-7 text-[#e1e9df]', open ? 'flex' : 'hidden md:flex')}>
        <div className="mb-6 flex items-center justify-between px-2">
          <strong className="text-xl text-white">{brand}</strong>
          <button className="md:hidden" aria-label="بستن" onClick={() => setOpen(false)}><Icon name="close" /></button>
        </div>
        <nav className="flex flex-1 flex-col gap-3 overflow-y-auto">
          {nav.map((item) => {
            const showGroup = item.group !== lastGroup
            lastGroup = item.group
            const active = item.id === section
            return (
              <div key={item.id}>
                {showGroup && <div className="px-3 pb-1 text-[10px] text-[#a6bcb0]">{item.group}</div>}
                <button
                  type="button"
                  onClick={() => { onNavigate(item.id); setOpen(false) }}
                  className={cn('flex w-full items-center gap-3 rounded-lg px-3 py-2 text-start text-[13px]', active ? 'bg-[#d7e9c8] font-bold text-[#193e2e]' : 'text-[#c8d7cc] hover:bg-white/5')}
                >
                  <Icon name={item.icon} className="h-[18px] w-[18px]" />
                  <span>{item.title}</span>
                </button>
              </div>
            )
          })}
        </nav>
        <button type="button" onClick={onLogout} className="mt-4 flex items-center gap-2 px-2 text-xs text-[#b9cdbf]">
          <Icon name="logout" className="h-4 w-4" />
          خروج از حساب
        </button>
      </aside>
      <div className="md:ps-[248px]">
        <header className="flex h-[72px] items-center justify-between border-b border-line bg-white/80 px-4 md:px-8">
          <div className="flex items-center gap-3 text-sm text-muted">
            <button className="md:hidden" aria-label="منو" onClick={() => setOpen(true)}><Icon name="menu" /></button>
            <span>فضای کاری</span>
            <span>/</span>
            <strong className="font-normal text-ink">{current?.title}</strong>
          </div>
          <time className="text-xs text-muted">{today}</time>
        </header>
        <main className="mx-auto max-w-[1660px] px-4 py-6 md:px-8">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="text-[11px] text-[#72846c]">{current?.group}</div>
              <h1 className="text-[28px] font-bold">{current?.title}</h1>
              {description && <p className="mt-1 text-xs text-muted">{description}</p>}
            </div>
            <div className="flex gap-2">{actions}</div>
          </div>
          {children}
        </main>
      </div>
    </div>
  )
}
