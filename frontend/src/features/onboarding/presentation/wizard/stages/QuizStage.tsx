import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Activity, ArrowLeft, Armchair, Brain, CalendarClock, Circle, CircleCheck, ClipboardPlus, Clock3, Coins, Cookie, CookingPot, Droplet, Dumbbell, Egg, Ellipsis, Footprints, HeartPulse, Infinity, Milk, Moon, Nut, Package, PencilLine, PersonStanding, Pill, ShieldCheck, Shuffle, Sun, Sunrise, Sunset, Timer, UserRound, Utensils, Wallet, Wheat } from 'lucide-react'
import {
  answerOf,
  AGE_MIN,
  AGE_MAX,
  ageForPicker,
  assetUrl,
  faDigits,
  followUpRequired,
  isAnswered,
  isHeightQuestion,
  isWeightQuestion,
  lossPaceText,
  metricConfig,
  needsMedicalReview,
  visibleQuestions,
  type AnswerValue,
  type QuizQuestion,
} from '../../../domain/questionnaire'
import { useWizard } from '../../../application/wizard-store'
import { WeightGauge } from '../metrics'
import { NumberWheel } from '../NumberWheel'
import { StageAction } from '../StageAction'

const summaryIcons = {
  'work-activity': [Armchair, Footprints, PersonStanding, Package],
  'food-budget': [Coins, Wallet, Infinity],
  'prep-time': [Timer, Clock3, CookingPot],
  'sport-type': [Dumbbell, HeartPulse, Shuffle, Ellipsis],
  'hunger-time': [Sunrise, Sun, Sunset, Moon, Clock3],
}

const detailOptionIcons = {
  'allergy-grid': [ShieldCheck, Milk, Nut, Egg, Wheat, Ellipsis],
  'condition-grid': [ShieldCheck, Droplet, HeartPulse, ClipboardPlus, Activity, ClipboardPlus, Ellipsis],
  'medication-choice': [ShieldCheck, Pill],
  'loss-challenges': [Clock3, Cookie, Utensils, Brain, Footprints, CalendarClock],
}

function CheckIcon() {
  return (
    <svg className="demo-check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m5 12 4 4L19 6" />
    </svg>
  )
}

function selectedIndex(question: QuizQuestion, answer: AnswerValue | undefined, index: number) {
  if (question.multi) return Boolean(answer && typeof answer === 'object' && 'choices' in answer && answer.choices.includes(index))
  if (typeof answer === 'number') return answer === index
  return Boolean(answer && typeof answer === 'object' && 'choice' in answer && answer.choice === index)
}

function canAdvanceOnChoice(question: QuizQuestion, index: number) {
  return !question.multi && !followUpRequired(question, index) && !needsMedicalReview(question, index)
}

function numberForPicker(answer: AnswerValue | undefined, slider: ReturnType<typeof metricConfig>) {
  const value = typeof answer === 'string' || typeof answer === 'number' ? Number(answer) : slider.default
  return Math.min(slider.max, Math.max(slider.min, Number.isFinite(value) ? value : slider.default))
}

export function QuizStage({ onSubmit }: { onSubmit: () => void }) {
  const navigate = useNavigate()
  const wizard = useWizard()
  const question = wizard.questions[wizard.index]
  const answer = question ? answerOf(question, wizard.answers) : undefined
  const storedDetail = answer && typeof answer === 'object' && 'detail' in answer ? String(answer.detail ?? '') : ''
  const [detail, setDetail] = useState(storedDetail)
  const title = useRef<HTMLHeadingElement>(null)
  const questionNumber = question?.originalNumber
  useEffect(() => { title.current?.focus({ preventScroll: true }) }, [questionNumber])
  const detailKey = question?.originalNumber + ':' + storedDetail
  const [seenDetailKey, setSeenDetailKey] = useState(detailKey)
  if (detailKey !== seenDetailKey) {
    setSeenDetailKey(detailKey)
    setDetail(storedDetail)
  }

  function refreshVisible(changed?: QuizQuestion) {
    const state = useWizard.getState()
    if (!state.goal) return state.questions
    const next = visibleQuestions(state.goal.id, state.allQuestions, state.answers)
    state.setQuestions(next)
    if (changed) {
      const at = next.findIndex((item) => item.originalNumber === changed.originalNumber)
      if (at >= 0) state.setIndex(at)
    }
    return next
  }

  function goNext(current: QuizQuestion) {
    const list = refreshVisible(current)
    const at = list.findIndex((item) => item.originalNumber === current.originalNumber)
    if (at < list.length - 1) {
      wizard.unlock(at + 1)
      wizard.setIndex(at + 1)
    } else {
      const answers = useWizard.getState().answers
      const missing = list.findIndex((item) => !isAnswered(item, answerOf(item, answers)))
      if (missing >= 0) wizard.setIndex(missing)
      else onSubmit()
    }
  }

  function chooseOption(optionIndex: number) {
    if (!question) return
    const number = question.originalNumber ?? -1
    if (question.multi) {
      const current = answer && typeof answer === 'object' && 'choices' in answer ? answer.choices : []
      const label = question.options?.[optionIndex]?.label ?? ''
      const exclusive = question.exclusiveLabels ?? []
      const choices = current.includes(optionIndex)
        ? current.filter((item) => item !== optionIndex)
        : exclusive.includes(label)
          ? [optionIndex]
          : [...current.filter((item) => !exclusive.includes(question.options?.[item]?.label ?? '')), optionIndex]
      wizard.setAnswer(number, { choices, detail })
      return
    }
    const value: AnswerValue = followUpRequired(question, optionIndex) ? { choice: optionIndex, detail } : optionIndex
    wizard.setAnswer(number, value)
    if (canAdvanceOnChoice(question, optionIndex)) goNext(question)
  }

  function continueIfAnswered() {
    if (!question) return
    const state = useWizard.getState()
    const number = question.originalNumber ?? -1
    let current = answerOf(question, state.answers)
    if (question.ui === 'age-range') current = String(ageForPicker(current))
    else if (question.ui === 'sleep-wake' && !current) current = { sleep: 23, wake: 7 }
    else if (question.type === 'number') {
      const slider = metricConfig(question, state.answers, state.questions)
      if (slider.max < slider.min) return
      current = String(numberForPicker(current, slider))
    }
    if (!isAnswered(question, current)) return
    state.setAnswer(number, current)
    goNext(question)
  }

  if (!question || !wizard.goal) {
    return (
      <section className="mx-auto max-w-md px-4 py-16 text-center">
        <p>اول هدفت را انتخاب کن.</p>
        <button type="button" className="quiz-green-btn mt-4 px-6 py-3 rounded-xl" onClick={() => navigate('/onboarding/goals')}>انتخاب هدف</button>
      </section>
    )
  }

  const slider = question.type === 'number' ? metricConfig(question, wizard.answers, wizard.questions) : null
  const canContinue = slider ? slider.max >= slider.min
    : question.ui === 'age-range' || question.ui === 'sleep-wake' || isAnswered(question, answer)
  const medicalReview = needsMedicalReview(question, answer)
  const selectedChoice = typeof answer === 'number' ? answer
    : answer && typeof answer === 'object' && 'choice' in answer ? answer.choice : undefined
  const immediate = !question.multi && !question.type && question.ui !== 'age-range' && question.ui !== 'sleep-wake'
    && Boolean(question.options?.length) && (selectedChoice == null || canAdvanceOnChoice(question, selectedChoice))

  return (
    <section id="page2Container" data-immediate={immediate || undefined}>
      <section className="relative">
        <div id="quizScrollViewport" className="quiz-single-view">
          <div id="questionsVerticalList" className="quiz-question-stack">
            <article key={questionNumber} className="question-card state-active" aria-labelledby="quiz-question-title">
              <div className="quiz-step-content">
              {question.originalNumber === 1 && <span className="quiz-name-emblem" aria-hidden="true"><UserRound size={31} /></span>}
              <h3 id="quiz-question-title" tabIndex={-1} ref={title}>{question.displayTitle ?? question.q}</h3>
              {question.multi && <p className="quiz-step-hint">می‌تونی چند گزینه انتخاب کنی</p>}
              <QuestionBody
                key={questionNumber}
                question={question}
                answer={answer}
                questions={wizard.questions}
                answers={wizard.answers}
                detail={detail}
                onDetail={(value) => {
                  setDetail(value)
                  if (answer && typeof answer === 'object' && 'choices' in answer) wizard.setAnswer(question.originalNumber ?? -1, { choices: answer.choices, detail: value })
                  if (answer && typeof answer === 'object' && 'choice' in answer) wizard.setAnswer(question.originalNumber ?? -1, { choice: answer.choice, detail: value })
                }}
                onOption={chooseOption}
                onValue={(value) => wizard.setAnswer(question.originalNumber ?? -1, value)}
                onContinue={continueIfAnswered}
              />
              {medicalReview && (
                <div className="weight-guidance" role="alert">
                  <strong>پیش از برنامهٔ غذایی، بررسی پزشک لازم است</strong>
                  <p>کاهش وزن ناخواسته باید توسط پزشک بررسی شود. این پاسخ در پرونده ثبت می‌شود.</p>
                </div>
              )}
              </div>
            </article>
          </div>
        </div>
      </section>
      {!immediate && <StageAction data-field-submit="" disabled={!canContinue} onClick={continueIfAnswered}>
        {medicalReview ? 'متوجه شدم؛ ادامهٔ پرسش‌نامه' : wizard.index === wizard.questions.length - 1 ? 'ثبت پاسخ‌ها' : 'بعدی'}
      </StageAction>}
    </section>
  )
}

function QuestionBody({
  question,
  answer,
  questions,
  answers,
  detail,
  onDetail,
  onOption,
  onValue,
  onContinue,
}: {
  question: QuizQuestion
  answer: AnswerValue | undefined
  questions: QuizQuestion[]
  answers: Record<number, AnswerValue | undefined>
  detail: string
  onDetail: (value: string) => void
  onOption: (index: number) => void
  onValue: (value: AnswerValue) => void
  onContinue: () => void
}) {
  if (question.ui === 'sleep-wake') {
    const sleep = answer && typeof answer === 'object' && 'sleep' in answer ? answer.sleep : 23
    const wake = answer && typeof answer === 'object' && 'wake' in answer ? answer.wake : 7
    const setHour = (field: 'sleep' | 'wake', value: number) => {
      const current = answerOf(question, useWizard.getState().answers)
      const hours = current && typeof current === 'object' && 'sleep' in current ? current : { sleep, wake }
      onValue({ ...hours, [field]: value })
    }
    return (
      <div className="quiz-sleep-wheels">
        <div>
          <p><Moon size={17} aria-hidden="true" /> ساعت خواب</p>
          <NumberWheel min={0} max={23} unit="" value={sleep} label="ساعت خواب" clock onChange={(value) => setHour('sleep', value)} />
        </div>
        <div>
          <p><Sun size={17} aria-hidden="true" /> ساعت بیداری</p>
          <NumberWheel min={0} max={23} unit="" value={wake} label="ساعت بیداری" clock onChange={(value) => setHour('wake', value)} />
        </div>
      </div>
    )
  }

  if (question.type === 'number') {
    const slider = metricConfig(question, answers, questions)
    const safe = numberForPicker(answer, slider)
    if (slider.max < slider.min) return <p>با وزن فعلی، در بازهٔ این پرسش‌نامه وزن هدف قابل انتخاب نیست.</p>
    if (isHeightQuestion(question)) {
      return <NumberWheel min={slider.min} max={slider.max} unit="سانتی‌متر" value={safe} onChange={(next) => onValue(String(next))} />
    }
    if (isWeightQuestion(question)) {
      return (
        <WeightGauge min={slider.min} max={slider.max} value={safe} onChange={(next) => onValue(String(Math.round(next)))} />
      )
    }
    const fill = slider.max === slider.min ? 0 : ((safe - slider.min) / (slider.max - slider.min)) * 100
    return (
      <div className="metric-slider-card">
        <div className="metric-slider-display">
          <span className="metric-slider-value">{faDigits(safe)}</span>
          <div className="metric-slider-divider" aria-hidden="true" />
          <span className="metric-slider-unit">{slider.unit}</span>
        </div>
        <div className="metric-slider-track-wrap">
          <input
            className="metric-slider-input"
            aria-labelledby="quiz-question-title"
            type="range"
            dir="ltr"
            min={slider.min}
            max={slider.max}
            step={slider.step}
            value={safe}
            style={{ ['--fill' as string]: fill + '%' }}
            onChange={(event) => onValue(event.target.value)}
          />
        </div>
      </div>
    )
  }

  if (question.type === 'text') {
    const value = typeof answer === 'string' && answer !== '__skipped__' ? answer : ''
    const nameField = question.originalNumber === 1
    const invalidName = nameField && value.trim() !== '' && !isAnswered(question, value)
    const showEnglishHint = invalidName && /\p{Script=Latin}/u.test(value)
    return (
      <div className="quiz-text-entry">
        <label className="quiz-entry-field">
        <input
          className="quiz-line-input"
          aria-labelledby="quiz-question-title"
          aria-invalid={invalidName || undefined}
          aria-describedby={showEnglishHint ? 'quiz-name-language-hint' : undefined}
          autoComplete={question.originalNumber === 1 ? 'name' : undefined}
          enterKeyHint="next"
          dir="auto"
          placeholder={question.placeholder}
          value={value}
          onChange={(event) => onValue(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); onContinue() } }}
        />
        </label>
        {showEnglishHint && <p id="quiz-name-language-hint" className="quiz-name-language-hint" role="status">اسمت رو با حروف فارسی بنویس.</p>}
        {question.optional && (
          <button type="button" data-skip-index="" className="quiz-skip-btn w-full py-3 text-sm" onClick={() => { onValue('__skipped__'); onContinue() }}>رد شدن از این سؤال</button>
        )}
      </div>
    )
  }

  if (question.ui === 'age-range') {
    return <NumberWheel min={AGE_MIN} max={AGE_MAX} unit="سال" value={ageForPicker(answer)} onChange={(age) => onValue(String(age))} />
  }

  if (question.ui === 'gender-cards') {
    return (
      <div className="quiz-gender-options" role="group" aria-labelledby="quiz-question-title">
        {question.options?.map((option, index) => (
          <button key={option.label} type="button" data-q-index={index} onClick={() => onOption(index)} aria-pressed={selectedIndex(question, answer, index)}>
            <span className="quiz-gender-icon" data-portrait={index === 0 ? 'woman' : 'man'} aria-hidden="true" />
            <span>{index === 0 ? 'خانم' : 'آقا'}</span>
          </button>
        ))}
      </div>
    )
  }

  if (question.ui === 'diet-options' || question.ui === 'work-activity' || question.ui === 'food-budget' || question.ui === 'prep-time' || question.ui === 'sport-type' || question.ui === 'hunger-time') {
    const icons = question.ui === 'diet-options' ? undefined : summaryIcons[question.ui]
    return (
      <div className={question.ui === 'hunger-time' ? 'quiz-summary-options quiz-hunger-grid' : 'quiz-summary-options'} role="group" aria-labelledby="quiz-question-title">
        {question.options?.map((option, index) => {
          const Icon = icons?.[index] ?? Circle
          const selected = selectedIndex(question, answer, index)
          return (
            <button key={option.label} type="button" data-q-index={index} className="quiz-option-card quiz-summary-option" aria-pressed={selected} onClick={() => onOption(index)}>
              {question.ui === 'diet-options'
                ? <span className="quiz-diet-photo" data-dish={index} aria-hidden="true" />
                : <span className="quiz-summary-icon" aria-hidden="true"><Icon size={23} /></span>}
              <span className="quiz-summary-copy">
                <strong>{option.displayLabel ?? option.label}</strong>
                {option.description && <small>{option.description}</small>}
              </span>
              {selected ? <CircleCheck className="quiz-choice-arrow" size={17} aria-hidden="true" />
                : <ArrowLeft className="quiz-choice-arrow" size={17} aria-hidden="true" />}
            </button>
          )
        })}
      </div>
    )
  }

  if (question.ui === 'option-cards') {
    return (
      <div className="quiz-flash-grid">
        {question.options?.map((option, index) => {
          const selected = selectedIndex(question, answer, index)
          return (
            <button key={option.label} type="button" aria-pressed={selected} data-q-index={index} className={'quiz-option-card quiz-flash-card' + (selected ? ' quiz-option-card--selected' : '')} onClick={() => onOption(index)}>
              <span className="quiz-flash-photo"><img src={assetUrl(option.image || 'assets/vegetables.jpg')} alt="" /></span>
              <span className="quiz-flash-foot">
                <span className="quiz-flash-label">{option.label}</span>
                {canAdvanceOnChoice(question, index) ? <ArrowLeft className="quiz-choice-arrow" size={17} aria-hidden="true" />
                  : <span className="quiz-choice-dot" aria-hidden="true">{selected ? <CheckIcon /> : null}</span>}
              </span>
            </button>
          )
        })}
      </div>
    )
  }

  const lossChallenges = question.ui === 'loss-challenges'
  const compact = !lossChallenges && (question.options?.length ?? 0) >= 6
  const optionIcons = question.ui === 'allergy-grid' || question.ui === 'condition-grid' || question.ui === 'medication-choice' || question.ui === 'loss-challenges'
    ? detailOptionIcons[question.ui]
    : undefined
  const conditionGrid = question.ui === 'allergy-grid' || question.ui === 'condition-grid'
  const exerciseDays = question.ui === 'exercise-days'
  const meterCount = question.ui === 'activity-level' || question.ui === 'exercise-duration' || question.ui === 'hunger-level'
    ? question.options?.length ?? 0
    : 0
  const needsDetail = Boolean(question.followUpText && answer && typeof answer === 'object' && (
    ('choices' in answer && answer.choices.some((index) => followUpRequired(question, index))) ||
    ('choice' in answer && followUpRequired(question, answer.choice))
  ))

  return (
    <div>
      <div className={exerciseDays ? 'quiz-exercise-days' : conditionGrid ? 'quiz-answer-list quiz-condition-grid' : compact ? 'quiz-choice-grid quiz-choice-grid--compact' : lossChallenges ? 'quiz-answer-list quiz-challenge-list' : 'quiz-answer-list'}>
        {question.options?.map((option, index) => {
          const selected = selectedIndex(question, answer, index)
          const Icon = optionIcons?.[index] ?? (question.ui === 'exercise-duration' ? Timer : null)
          const paceTime = question.ui === 'loss-pace' ? lossPaceText(option.pace, questions, answers) : ''
          return (
            <button
              key={option.label}
              type="button"
              data-q-index={index}
              aria-pressed={selected}
              className={
                'quiz-option-btn w-full text-right p-3.5 rounded-2xl border-2 flex items-center justify-between gap-3'
                + (selected ? ' is-selected' : '')
                + (question.ui === 'loss-pace' && option.pace === 'auto' ? ' quiz-pace-auto' : '')
              }
              onClick={() => onOption(index)}
            >
              {Icon ? <span className="quiz-answer-icon" aria-hidden="true"><Icon size={17} /></span>
                : !meterCount && !exerciseDays && !question.multi && question.ui !== 'loss-pace' && (
                <span className="quiz-answer-icon" aria-hidden="true">
                  {selected ? <CircleCheck size={16} /> : question.ui === 'meal-count' ? <Utensils size={16} /> : <Circle size={13} />}
                </span>
              )}
              <span className="quiz-option-label text-sm leading-snug flex-1">
                {option.displayLabel ?? option.label}
                {paceTime && <small className="loss-pace-description">{paceTime}</small>}
              </span>
              {question.ui === 'loss-pace' && option.pace !== 'auto' && (
                <span className="quiz-activity-meter" dir="ltr" aria-hidden="true">
                  {Array.from({ length: 3 }, (_, level) => <i key={level} data-filled={level <= index} />)}
                </span>
              )}
              {meterCount ? <span className="quiz-activity-meter" dir="ltr" aria-hidden="true">
                {Array.from({ length: meterCount }, (_, level) => <i key={level} data-filled={level <= index} />)}
              </span> : question.ui === 'loss-pace' || (exerciseDays && index > 0) ? null : canAdvanceOnChoice(question, index) ? <ArrowLeft className="quiz-choice-arrow" size={17} aria-hidden="true" />
                : <span className={question.multi ? 'quiz-choice-dot quiz-choice-square' : 'quiz-choice-dot'} aria-hidden="true">{selected ? <CheckIcon /> : null}</span>}
              {option.image && <span className="quiz-option-thumb-wrap"><img className="quiz-option-thumb" src={assetUrl(option.image)} alt="" /></span>}
            </button>
          )
        })}
      </div>
      {question.followUpText && (
        <div className="quiz-follow-up-reveal" data-open={needsDetail} aria-hidden={!needsDetail}>
          <div className="quiz-follow-up-clip">
            <label className="quiz-follow-up">
              <span className="quiz-follow-up-title"><PencilLine size={19} aria-hidden="true" />{question.followUpLabel || question.followUpPlaceholder || 'جزئیات را بنویسید'}</span>
              <textarea disabled={!needsDetail} rows={2} value={detail} placeholder={question.followUpPlaceholder || 'توضیحت رو اینجا بنویس'} onChange={(event) => onDetail(event.target.value)} />
            </label>
          </div>
        </div>
      )}
    </div>
  )
}
