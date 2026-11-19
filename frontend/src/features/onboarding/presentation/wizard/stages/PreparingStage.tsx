import { useEffect, useState } from 'react'
import { Check, ClipboardCheck, Target, Utensils } from 'lucide-react'
import { BrandLogo } from '@shared/ui/BrandLogo'
import { useWizard } from '../../../application/wizard-store'
import { answerOf, faDigits, isAnswered } from '../../../domain/questionnaire'

const preparationDuration = 10_000
const phases = [
  { label: 'هدف تو', icon: Target },
  { label: 'سبک تغذیه', icon: Utensils },
  { label: 'جمع‌بندی', icon: ClipboardCheck },
] as const

export function PreparingStage({ onDone }: { onDone: () => void }) {
  const [progress, setProgress] = useState(0)
  const goalTitle = useWizard((state) => state.goal?.title)
  const questions = useWizard((state) => state.questions)
  const answers = useWizard((state) => state.answers)
  const dietQuestion = questions.find((question) => question.ui === 'diet-options')
  const dietAnswer = dietQuestion ? answerOf(dietQuestion, answers) : undefined
  const diet = typeof dietAnswer === 'number' ? dietQuestion?.options?.[dietAnswer] : undefined
  const answered = questions.filter((question) => {
    const answer = answerOf(question, answers)
    return answer !== '__skipped__' && isAnswered(question, answer)
  }).length
  const phase = progress < 34 ? 0 : progress < 67 ? 1 : 2
  const details = [goalTitle, diet?.displayLabel ?? diet?.label, answered ? `${faDigits(answered)} پاسخ` : undefined]
  const CurrentIcon = phases[phase].icon

  useEffect(() => {
    const started = performance.now()
    const ticker = window.setInterval(() => {
      setProgress(Math.min(99, Math.floor((performance.now() - started) / preparationDuration * 100)))
    }, 80)
    const done = window.setTimeout(() => {
      window.clearInterval(ticker)
      setProgress(100)
      onDone()
    }, preparationDuration)
    return () => {
      window.clearInterval(ticker)
      window.clearTimeout(done)
    }
  }, [onDone])

  return (
    <div id="aiPreparingPhase" className="prep-screen">
      <div className="prep-radar" role="progressbar" aria-label="پیشرفت آماده‌سازی" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
        <div className="prep-radar-sweep" aria-hidden="true" />
        <svg className="prep-radar-grid" viewBox="0 0 280 280" fill="none" aria-hidden="true">
          <circle cx="140" cy="140" r="128" />
          <circle cx="140" cy="140" r="106" strokeDasharray="2 5" />
          <circle cx="140" cy="140" r="80" />
          <path d="M12 140h256M140 12v256" strokeDasharray="2 6" />
          <circle className="prep-radar-progress" cx="140" cy="140" r="128" pathLength={100} strokeDasharray="100" strokeDashoffset={100 - progress} transform="rotate(-90 140 140)" />
        </svg>
        <span className="prep-radar-brand"><BrandLogo variant="symbol" size={54} decorative /></span>
        {phases.map(({ label, icon: Icon }, index) => (
          <span className="prep-radar-node" data-node={index} data-status={index < phase ? 'done' : index === phase ? 'active' : 'pending'} key={label} aria-hidden="true">
            {index < phase ? <Check size={18} /> : <Icon size={18} />}
          </span>
        ))}
        <span className="prep-percent" aria-hidden="true">{faDigits(progress)}٪</span>
      </div>
      <h2 className="prep-title">داریم پاسخ‌هات رو مرور می‌کنیم</h2>
      <div className="prep-status" role="status" aria-atomic="true">
        <div className="prep-status-inner" key={phase}>
          <span className="prep-status-label"><CurrentIcon size={15} aria-hidden="true" />{phases[phase].label}</span>
          {details[phase] && <strong>{details[phase]}</strong>}
        </div>
      </div>
    </div>
  )
}
