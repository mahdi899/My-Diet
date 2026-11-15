import { useEffect, useId, useRef, useState } from 'react'
import { AdminIcon as Icon } from './AdminIcon'

export function StatusFilter({ label, value, options, onChange, showSelection = false }: {
  label: string
  value: string
  options: readonly (readonly [string, string])[]
  onChange: (value: string) => void
  showSelection?: boolean
}) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) return
    root.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus()
    function dismiss(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [open])

  function close() {
    setOpen(false)
    trigger.current?.focus()
  }

  return <div className="users-filter-anchor" ref={root}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false) }}
    onKeyDown={event => {
      if (event.key === 'Escape' && open) {
        event.preventDefault()
        close()
      }
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
      event.preventDefault()
      if (!open) {
        setOpen(true)
        return
      }
      const items = Array.from(root.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? [])
      const index = items.indexOf(document.activeElement as HTMLButtonElement)
      const step = event.key === 'ArrowDown' ? 1 : -1
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + step + items.length) % items.length
      items[next]?.focus()
    }}>
    <button ref={trigger} type="button" className={`users-filter-toggle${value ? ' has-filter' : ''}${showSelection ? ' users-filter-labeled' : ''}`}
      aria-label={label} title={label} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined}
      onClick={() => setOpen(!open)}>
      <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" aria-hidden="true"><path d="M3 4h18l-7 8v6l-4 2v-8L3 4Z" /></svg>
      {showSelection ? <><span>{options.find(([option]) => option === value)?.[1] ?? 'همه وضعیت‌ها'}</span><Icon name="chevron-left" className="icon users-filter-chevron" /></> :
        value && <span className="users-filter-dot" />}
    </button>
    {open && <div id={menuId} className="users-status-menu" role="menu" aria-label={label}>
      {([['', 'همه وضعیت‌ها'] as const, ...options]).map(([option, title]) => <button
        key={option} type="button" role="menuitemradio" tabIndex={-1} aria-checked={value === option}
        onClick={() => { onChange(option); close() }}>
        <span>{title}</span>{value === option && <Icon name="check" />}
      </button>)}
    </div>}
  </div>
}
