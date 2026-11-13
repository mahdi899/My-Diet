import { create } from 'zustand'
import {
  prepareQuestions,
  sampleSpecialists,
  type AnswerValue,
  type QuizGoal,
  type QuizQuestion,
} from '../engine'

export type Stage = 'intro' | 'goals' | 'quiz' | 'preparing' | 'specialists' | 'verify' | 'checkout'

interface WizardStore {
  stage: Stage
  goal: QuizGoal | null
  allQuestions: QuizQuestion[]
  questions: QuizQuestion[]
  answers: Record<number, AnswerValue | undefined>
  index: number
  maxUnlocked: number
  phone: string
  submissionId: string
  token: string
  specialistId: string
  offered: { id: string; name: string; focus: string }[]
  plan: 'weekly' | 'monthly' | 'quarterly'
  setStage: (stage: Stage) => void
  chooseGoal: (goal: QuizGoal) => void
  setQuestions: (questions: QuizQuestion[]) => void
  setAnswer: (number: number, value: AnswerValue | undefined) => void
  setIndex: (index: number) => void
  unlock: (index: number) => void
  setPhone: (phone: string) => void
  setToken: (token: string) => void
  setSpecialist: (id: string) => void
  setPlan: (plan: WizardStore['plan']) => void
  resetSubmission: (phone: string) => void
}

export const useWizard = create<WizardStore>((set, get) => ({
  stage: 'intro',
  goal: null,
  allQuestions: [],
  questions: [],
  answers: {},
  index: 0,
  maxUnlocked: 0,
  phone: '',
  submissionId: crypto.randomUUID(),
  token: '',
  specialistId: '',
  offered: [],
  plan: 'monthly',
  setStage: (stage) => set({ stage }),
  chooseGoal: (goal) => set({
    goal,
    allQuestions: prepareQuestions(goal),
    questions: prepareQuestions(goal),
    answers: {},
    index: 0,
    maxUnlocked: 0,
    stage: 'quiz',
    offered: sampleSpecialists(),
    specialistId: '',
  }),
  setQuestions: (questions) => set({ questions }),
  setAnswer: (number, value) => set({ answers: { ...get().answers, [number]: value } }),
  setIndex: (index) => set({ index }),
  unlock: (index) => set({ maxUnlocked: Math.max(get().maxUnlocked, index) }),
  setPhone: (phone) => set({ phone }),
  setToken: (token) => set({ token }),
  setSpecialist: (specialistId) => set({ specialistId }),
  setPlan: (plan) => set({ plan }),
  resetSubmission: (phone) => {
    if (get().phone === phone) return
    set({ phone, submissionId: crypto.randomUUID() })
  },
}))
