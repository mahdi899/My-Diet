import { useRef, useState } from 'react'
import { AiModels } from './AiModels'
import { AiBudget, AiQuality } from './AiReports'
import { AiPrompts } from './AiPrompts'
import '../users/users.css'
import '../onboarding/onboarding.css'
import './ai.css'

const tabs = [
  ['models', 'سرویس‌ها و استخرها', AiModels], ['budget', 'هزینه و بودجه', AiBudget],
  ['prompts', 'پرامپت‌ها', AiPrompts], ['quality', 'کیفیت پیش‌نویس‌ها', AiQuality],
] as const

export function AiPage({ preview }: { preview: boolean }) {
  const [active, setActive] = useState(0)
  const buttons = useRef<(HTMLButtonElement | null)[]>([])
  return <div className="ai-admin">
    <div className="onboarding-tabs ai-tabs" role="tablist" aria-label="هوش مصنوعی" onKeyDown={event => {
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1
        : event.key === 'ArrowLeft' ? (active + 1) % tabs.length
        : event.key === 'ArrowRight' ? (active + tabs.length - 1) % tabs.length : null
      if (next === null) return
      event.preventDefault()
      setActive(next)
      buttons.current[next]?.focus()
    }}>
      {tabs.map(([key, title], index) => <button type="button" role="tab" key={key} id={`ai-tab-${key}`}
        ref={element => { buttons.current[index] = element }} aria-controls={`ai-panel-${key}`}
        aria-selected={index === active} tabIndex={index === active ? 0 : -1} onClick={() => setActive(index)}>{title}</button>)}
    </div>
    {tabs.map(([key, , Panel], index) => <div key={key} id={`ai-panel-${key}`} role="tabpanel" aria-labelledby={`ai-tab-${key}`} hidden={index !== active}>
      {index === active && <div className="ai-stack"><Panel preview={preview} /></div>}
    </div>)}
  </div>
}
