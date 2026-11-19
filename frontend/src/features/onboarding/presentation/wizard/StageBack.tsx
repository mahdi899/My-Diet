import { ArrowRight } from 'lucide-react'

export function StageBack({ id, label, onClick }: { id?: string; label: string; onClick: () => void }) {
  return (
    <button id={id} type="button" className="onboarding-stage-back" aria-label={label} title={label} onClick={onClick}>
      <ArrowRight size={19} aria-hidden="true" />
    </button>
  )
}
