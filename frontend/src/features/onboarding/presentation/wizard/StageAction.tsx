import { useEffect, type ComponentPropsWithoutRef } from 'react'
import { createPortal } from 'react-dom'

export function useActionViewport() {
  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return
    const root = document.documentElement
    let frame = 0
    const sync = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(update)
    }
    const update = () => {
      const field = document.activeElement
      const editing = field instanceof HTMLElement && field.matches('.onboarding-shell :is(input:not([readonly]):not([type="range"]), textarea, [contenteditable="true"])')
      const gap = Math.abs(viewport.scale - 1) < 0.01
        ? Math.max(0, root.clientHeight - viewport.height - viewport.offsetTop)
        : 0
      root.style.setProperty('--onboarding-keyboard-gap', `${Math.round(gap)}px`)
      if (!editing) return
      const dock = document.querySelector('.onboarding-action-dock')
      if (!dock) return
      const fieldBottom = field.getBoundingClientRect().bottom
      if (fieldBottom > dock.getBoundingClientRect().top - 12) {
        field.scrollIntoView({ block: 'center', behavior: 'instant' })
      }
    }
    sync()
    viewport.addEventListener('resize', sync)
    viewport.addEventListener('scroll', sync)
    window.addEventListener('resize', sync)
    document.addEventListener('focusin', sync)
    return () => {
      cancelAnimationFrame(frame)
      viewport.removeEventListener('resize', sync)
      viewport.removeEventListener('scroll', sync)
      window.removeEventListener('resize', sync)
      document.removeEventListener('focusin', sync)
      root.style.removeProperty('--onboarding-keyboard-gap')
    }
  }, [])
}

export function StageAction({ children, type = 'button', ...props }: ComponentPropsWithoutRef<'button'>) {
  return createPortal(
    <div className="onboarding-action-dock" dir="rtl">
      <button {...props} type={type} className="onboarding-action-button">{children}</button>
    </div>,
    document.body,
  )
}
