import { useEffect, useState } from 'react'
import { needsMedicalReview, answerOf } from '../../../domain/questionnaire'
import { onboarding } from '../../../composition'
import { useWizard } from '../../../application/wizard-store'
import { StageAction } from '../StageAction'

const doctorSheets = [
  { group: 'women', columns: 3, ids: ['sara', 'nazanin', 'maryam', 'elham', 'hanieh', 'niloofar'] },
  { group: 'men', columns: 2, ids: ['amir', 'reza', 'parsa', 'kian'] },
]

function doctorPortrait(id: string) {
  const sheet = doctorSheets.find(({ ids }) => ids.includes(id))
  if (!sheet) return undefined
  const at = sheet.ids.indexOf(id)
  const column = at % sheet.columns
  return {
    backgroundImage: `url('/onboarding/assets/specialists-studio-${sheet.group}.jpg')`,
    backgroundSize: `${sheet.columns * 100}% 200%`,
    backgroundPosition: `${column * 100 / (sheet.columns - 1)}% ${at >= sheet.columns ? 100 : 0}%`,
  }
}

export function SpecialistsStage({ onContinue }: { onContinue: () => void }) {
  const offered = useWizard((state) => state.offered)
  const specialistId = useWizard((state) => state.specialistId)
  const setSpecialist = useWizard((state) => state.setSpecialist)
  const questions = useWizard((state) => state.questions)
  const answers = useWizard((state) => state.answers)
  const completionId = useWizard((state) => state.communityCompletionId)
  const needsReview = questions.some((question) => needsMedicalReview(question, answerOf(question, answers)))
  const [memberCount, setMemberCount] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    onboarding.communityCount(completionId)
      .then((count) => {
        if (!cancelled) setMemberCount(count)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [completionId])

  return (
    <div id="aiReadyPhase" className="ai-prep-phase ai-prep-phase--ready">
      <div className="community-hero">
        <p className="community-hero-number" aria-live="polite">{(memberCount ?? 1622).toLocaleString('fa-IR')}</p>
        <p className="community-hero-copy">نفری هستی که عضو<br />جامعه رژیم من میشی</p>
      </div>
      <p className="matching-section-lead">۲ متخصص تغذیه برات اختصاص دادیم، یکیشو انتخاب کن</p>
      {needsReview && (
        <p id="medicalReviewSummary" className="weight-guidance">
          با توجه به کاهش وزن ناخواسته، پیش از دریافت برنامهٔ غذایی به بررسی پزشک نیاز داری. انتخاب پلن جایگزین مشاوره و علت‌یابی پزشکی نیست.
        </p>
      )}
      <div id="specialistList" className="specialist-list" role="group" aria-label="انتخاب متخصص">
        {offered.map((person) => {
          const selected = specialistId === person.id
          return (
            <button
              key={person.id}
              type="button"
              className={'specialist-card' + (selected ? ' is-selected' : '')}
              aria-pressed={selected}
              onClick={() => {
                setSpecialist(person.id)
                if (!needsReview) onContinue()
              }}
            >
              <span className="specialist-portrait-group">
                <span className="specialist-portrait specialist-portrait--generated" style={doctorPortrait(person.id)} aria-hidden="true" />
                <span className="specialist-rating" aria-label="امتیاز نمایشی: ۴٫۸ از ۵">
                  <span className="stars" aria-hidden="true"><i /><i /><i /><i /><i className="is-partial" /></span>
                  <span className="star-score" aria-hidden="true">۴٫۸</span>
                </span>
              </span>
              <span className="specialist-copy">
                <span className="specialist-name">{person.name}</span>
                <span className="specialist-role">متخصص تغذیه</span>
                <span className="specialist-focus">{person.focus}</span>
              </span>
              <span className="specialist-mark" aria-hidden="true" />
            </button>
          )
        })}
      </div>
      {needsReview && <StageAction id="aiReadyGoBtn" disabled={!specialistId} onClick={onContinue}>انتخاب پلن و ادامه</StageAction>}
    </div>
  )
}
