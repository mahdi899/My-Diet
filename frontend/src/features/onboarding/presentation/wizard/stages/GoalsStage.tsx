import { ArrowLeft } from 'lucide-react'
import { questionnaireGoals } from '../../../composition'
import { assetUrl, type QuizGoal } from '../../../domain/questionnaire'
import { useWizard } from '../../../application/wizard-store'

export function GoalsStage({ onSelect }: { onSelect: (goal: QuizGoal) => void }) {
  const currentGoal = useWizard((state) => state.goal)
  const goals = questionnaireGoals()

  return (
    <div id="goalSelectionStage" className="w-full max-w-3xl mx-auto">
      <div className="text-center mb-6">
        <h2>هدفت چیه؟</h2>
      </div>
      <div id="goalsGrid">
        {goals.map((goal) => (
          <button
            key={goal.id}
            type="button"
            className="goal-card"
            data-tracking-goal={goal.id}
            aria-pressed={currentGoal?.id === goal.id}
            onClick={() => onSelect(goal)}
          >
            <img className="goal-card-photo" src={assetUrl(goal.image)} alt="" width={960} height={716} />
            <span className="goal-card-body">
              <span className="goal-card-copy">
                <span className="goal-card-title">{goal.title}</span>
              </span>
              <ArrowLeft size={17} aria-hidden="true" />
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
