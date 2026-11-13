import { useNavigate } from 'react-router-dom'
import { assetUrl, questionnaireGoals } from '../../../engine'
import { useWizard } from '../../../stores/wizard'

export function GoalsStage() {
  const navigate = useNavigate()
  const chooseGoal = useWizard((state) => state.chooseGoal)
  const goals = questionnaireGoals()

  return (
    <div id="goalSelectionStage" className="w-full max-w-3xl mx-auto">
      <div className="text-center mb-6">
        <h2>هدفت چیه؟</h2>
      </div>
      <div id="goalsGrid" className="flex flex-col sm:grid sm:grid-cols-2">
        {goals.map((goal) => (
          <button
            key={goal.id}
            type="button"
            className="goal-card"
            onClick={() => {
              chooseGoal(goal)
              navigate('/onboarding/quiz?goal=' + goal.id)
            }}
          >
            <img className="goal-card-photo" src={assetUrl(goal.image)} alt="" width={1200} height={600} />
            <span className="goal-card-body">
              <span className="goal-card-copy">
                <span className="goal-card-title">{goal.title}</span>
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
