import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import {
  answerLabel,
  followUpRequired,
  isAnswered,
  metricConfig,
  needsMedicalReview,
  prepareQuestions,
  visibleQuestions,
  type AnswerValue,
  type QuizGoal,
  type QuizQuestion,
} from '../../../frontend/src/features/onboarding/engine.ts'

const sandbox = { window: {} as { SABZINE_QUESTIONNAIRE?: { goals: QuizGoal[] } } }
vm.runInNewContext(
  readFileSync(new URL('../../../frontend/public/onboarding/questionnaire-data.js', import.meta.url), 'utf8'),
  sandbox,
)
const goals = sandbox.window.SABZINE_QUESTIONNAIRE?.goals ?? []

function goal(id: string) {
  const found = goals.find((item) => item.id === id)
  assert.ok(found, id)
  return found
}

function questions(id: string) {
  return prepareQuestions(goal(id))
}

test('unintentional weight loss still requires medical review', () => {
  const list = questions('weight_gain')
  const question = list.find((item) => item.originalNumber === 24)
  assert.ok(question)
  assert.equal(needsMedicalReview(question, undefined), false)
  assert.equal(needsMedicalReview(question, 0), false)
  assert.equal(needsMedicalReview(question, 1), true)
  assert.equal(needsMedicalReview(question, 2), true)
  assert.equal(needsMedicalReview(question, { choice: 2 }), true)
  assert.equal(needsMedicalReview(list[0] as QuizQuestion, 1), false)
})

test('allergy answers keep the written detail', () => {
  const list = questions('weight_loss')
  const question = list.find((item) => item.originalNumber === 8)
  assert.ok(question?.options)
  question.options.forEach((option, choice) => {
    const needsDetail = option.label !== 'بدون حساسیت'
    assert.equal(followUpRequired(question, choice), needsDetail, option.label)
    const empty = { choices: [choice], detail: '  ' }
    assert.equal(isAnswered(question, empty), !needsDetail, option.label)
    assert.equal(isAnswered(question, { choices: [choice], detail: 'فقط شیر' }), true, option.label)
  })
  const answer = { choices: [1, 2], detail: 'لبنیات: فقط شیر؛ آجیل: بادام' }
  assert.equal(answerLabel(question, answer), 'لبنیات، آجیل — لبنیات: فقط شیر؛ آجیل: بادام')
})

test('no exercise hides the follow-up sport questions on weight gain', () => {
  const list = questions('weight_gain')
  const hidden = visibleQuestions('weight_gain', list, { 17: 0 })
  for (const number of [18, 19, 25]) {
    assert.equal(hidden.some((item) => item.originalNumber === number), false)
  }
  const shown = visibleQuestions('weight_gain', list, { 17: 2 })
  for (const number of [18, 19, 25]) {
    assert.equal(shown.some((item) => item.originalNumber === number), true)
  }
})

test('question 25 stays on the other tracks when exercise is none', () => {
  for (const id of ['weight_loss', 'pregnancy', 'detox']) {
    const list = questions(id)
    const visible = visibleQuestions(id, list, { 17: 0 })
    assert.equal(visible.some((item) => item.originalNumber === 25), true, id)
  }
})

test('weight targets stay on the correct side of the current weight', () => {
  const current = { originalNumber: 5, metric: 'current-weight', q: 'وزن', type: 'number' as const }
  for (const weight of [40, 68, 90, 240]) {
    const gain = metricConfig(
      { q: 'وزن هدف', metric: 'target-gain', type: 'number' },
      { 5: String(weight) },
      [current],
    )
    assert.equal(gain.min, weight)
    assert.equal(gain.default, weight)
    assert.ok(gain.max > weight)
  }
  const lossAt68 = metricConfig({ q: 'وزن هدف', metric: 'target-loss', type: 'number' }, { 5: '68' }, [current])
  assert.equal(lossAt68.max, 67)
  const lossAt60 = metricConfig({ q: 'وزن هدف', metric: 'target-loss', type: 'number' }, { 5: '60' }, [current])
  assert.equal(lossAt60.max, 59)
})

test('a saved no-exercise answer does not keep the hidden follow-ups', () => {
  const list = questions('weight_gain')
  const answers: Record<number, AnswerValue | undefined> = { 17: 0, 18: 1, 19: 2, 25: 3, 26: 1 }
  const visible = visibleQuestions('weight_gain', list, answers)
  for (const number of [18, 19, 25]) {
    assert.equal(visible.some((item) => item.originalNumber === number), false)
  }
  assert.equal(answers[17], 0)
  assert.equal(answers[26], 1)
})
