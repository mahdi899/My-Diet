import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { asRecord, asRows, formatFaNumber } from '@shared/utils'
import { AdminIcon as Icon } from '../../components/AdminIcon'
import { staff } from '../../session'
import source from './questions.json'
import './questionnaire.css'

const goals = [
  { id: 'weight_loss', title: 'لاغری', image: 'goal-loss.jpg' },
  { id: 'weight_gain', title: 'افزایش وزن', image: 'goal-gain-v2.png' },
  { id: 'pregnancy', title: 'بارداری و شیردهی', image: 'goal-maternal.jpg' },
  { id: 'detox', title: 'سلامت و پاکسازی بدن', image: 'goal-wellness.jpg' },
] as const
type Goal = typeof goals[number]
type Question = { id: number; q: string; options?: string[]; type?: 'choice' | 'text' }
type Questionnaire = { title: string; questions: Question[] }
type Documents = Partial<Record<Goal['id'], Questionnaire>>
const queryKey = ['admin-web-questionnaire']
const demoKey = 'admin-web-questionnaire-preview'
const maxQuestions = 100

function reference(goal: Goal['id']) {
  const specific = goal === 'pregnancy' ? [
    ...source.maternal_common, ...source.pregnancy.map(question => ({ ...question, branch: 'مخصوص بارداری' })),
    ...source.breastfeeding.map(question => ({ ...question, branch: 'مخصوص شیردهی' })),
  ] : source[goal]
  return [...source.general, ...specific].map((item, index) => ({
    ...item, id: index + 1, branch: 'branch' in item ? String(item.branch) : undefined,
  }))
}

function fallback(goal: Goal): Questionnaire {
  return { title: goal.title, questions: reference(goal.id).map(item => ({ id: item.id, q: item.text })) }
}

function parseDocuments(value: unknown): Documents {
  const document = asRecord(value)
  const result: Documents = {}
  for (const goal of goals) {
    const saved = asRecord(document?.[goal.id])
    if (!saved || typeof saved.title !== 'string' || !Array.isArray(saved.questions)) continue
    const questions = asRows(saved.questions).flatMap<Question>(row => {
      if (typeof row.id !== 'number' || typeof row.q !== 'string') return []
      if (row.id <= 100) return [{ id: row.id, q: row.q }]
      return [{ id: row.id, q: row.q, type: row.type === 'choice' ? 'choice' : 'text',
        options: Array.isArray(row.options) ? row.options.filter((value): value is string => typeof value === 'string') : [] }]
    })
    if (questions.length) result[goal.id] = { title: saved.title, questions }
  }
  return result
}

function readSamples() {
  try { return parseDocuments(JSON.parse(sessionStorage.getItem(demoKey) ?? '{}')) }
  catch { return {} }
}

function Editor({ goal, draft, change, back, preview, save }: {
  goal: Goal; draft: Questionnaire; change: (document: Questionnaire) => void; back: () => void; preview: boolean
  save: (document: Questionnaire) => Promise<void>
}) {
  const heading = useRef<HTMLHeadingElement>(null)
  const fields = useRef(new Map<number, HTMLTextAreaElement>())
  const nextId = useRef(Math.max(100, ...draft.questions.map(question => question.id)) + 1)
  const [focusId, setFocusId] = useState<number | null>(null)
  const mutation = useMutation({ mutationFn: save })
  useEffect(() => heading.current?.focus(), [])
  useEffect(() => { if (focusId !== null) fields.current.get(focusId)?.focus() }, [draft.questions, focusId])
  const meta = new Map(reference(goal.id).map(question => [question.id, question]))

  function update(questions: Question[]) {
    mutation.reset()
    change({ ...draft, questions })
  }
  function changeQuestion(id: number, patch: Partial<Question>) {
    setFocusId(null)
    update(draft.questions.map(question => question.id === id ? { ...question, ...patch } : question))
  }
  function move(index: number, offset: number) {
    const question = draft.questions[index]
    const other = draft.questions[index + offset]
    if (!question || !other) return
    const questions = [...draft.questions]
    questions[index] = other
    questions[index + offset] = question
    setFocusId(question.id)
    update(questions)
  }
  function add() {
    if (nextId.current > 10000) {
      const used = new Set(draft.questions.map(question => question.id))
      nextId.current = Array.from({ length: 9900 }, (_, index) => index + 101).find(id => !used.has(id)) ?? 101
    }
    const id = nextId.current++
    setFocusId(id)
    update([...draft.questions, { id, q: '', type: 'text', options: [] }])
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!mutation.isPending) mutation.mutate(draft)
  }

  return <section className="questionnaire-editor">
    <button type="button" className="secondary questionnaire-back" disabled={mutation.isPending} onClick={back}>بازگشت به دسته‌بندی‌ها</button>
    <h2 ref={heading} tabIndex={-1}>{draft.title || goal.title}</h2>
    <form onSubmit={submit}>
      <fieldset className="questionnaire-fields" disabled={mutation.isPending}>
        <label>عنوان هدف<input value={draft.title} maxLength={120} required onChange={event => {
          mutation.reset(); change({ ...draft, title: event.target.value })
        }} /></label>
        <div className="questionnaire-list">
          {draft.questions.map((question, index) => {
            const original = meta.get(question.id)
            return <fieldset key={question.id} className="questionnaire-question">
              <legend>سؤال {formatFaNumber(index + 1)}{original?.branch ? ' · ' + original.branch : ''}</legend>
              <label>متن سؤال<textarea ref={element => {
                if (element) fields.current.set(question.id, element)
                else fields.current.delete(question.id)
              }} value={question.q} maxLength={500} required onChange={event => changeQuestion(question.id, { q: event.target.value })} /></label>
              {question.id > 100 ? <label>گزینه‌ها (هر گزینه یک خط)<textarea
                value={question.options?.join('\n') ?? ''} placeholder="برای پاسخ متنی خالی بگذارید"
                onChange={event => changeQuestion(question.id, { options: event.target.value.split('\n') })} /></label> :
                original?.answers.length ? <details className="questionnaire-answers">
                  <summary>گزینه‌ها و نوع پاسخ{original.hint ? ' ' + original.hint : ''}</summary>
                  <ul>{original.answers.map(answer => <li key={answer}>{answer}</li>)}</ul>
                </details> : null}
              <div className="questionnaire-actions">
                <button type="button" className="secondary" disabled={index === 0} onClick={() => move(index, -1)}>بالاتر</button>
                <button type="button" className="secondary" disabled={index + 1 === draft.questions.length} onClick={() => move(index, 1)}>پایین‌تر</button>
                <button type="button" className="secondary" disabled={draft.questions.length === 1} onClick={() => {
                  setFocusId(draft.questions[index + 1]?.id ?? draft.questions[index - 1]?.id ?? null)
                  update(draft.questions.filter(item => item.id !== question.id))
                }}>حذف سؤال</button>
              </div>
            </fieldset>
          })}
        </div>
        <button type="button" className="secondary questionnaire-add" disabled={draft.questions.length >= maxQuestions} onClick={add}><Icon name="plus" />افزودن سؤال</button>
      </fieldset>
      {mutation.isError && <p role="alert" className="form-error">{mutation.error.message}</p>}
      {mutation.isSuccess && <p role="status" className="info-note">{preview ? 'پرسش‌نامه در پیش‌نمایش همین زبانه ذخیره شد.' : 'تنظیمات پرسش‌نامه ذخیره شد.'}</p>}
      <div className="questionnaire-actions">
        <button type="submit" disabled={mutation.isPending}><Icon name="check" />{mutation.isPending ? 'در حال ذخیره…' : preview ? 'ذخیرهٔ نمونه' : 'ذخیرهٔ تنظیمات پرسش‌نامه'}</button>
      </div>
    </form>
  </section>
}

export function QuestionnairePage({ preview }: { preview: boolean }) {
  const [goal, setGoal] = useState<Goal | null>(null)
  const [drafts, setDrafts] = useState<Documents>({})
  const [samples, setSamples] = useState(readSamples)
  const cards = useRef(new Map<Goal['id'], HTMLButtonElement>())
  const backTo = useRef<Goal['id'] | null>(null)
  const client = useQueryClient()
  const query = useQuery({
    queryKey,
    enabled: !preview,
    queryFn: async () => {
      const response = await fetch('/v1/public/onboarding-questionnaire', { cache: 'no-store' })
      if (!response.ok) throw new Error('دریافت تنظیمات پرسش‌نامه ممکن نشد.')
      return parseDocuments(await response.json())
    },
  })
  useEffect(() => {
    if (!goal && backTo.current) {
      cards.current.get(backTo.current)?.focus()
      backTo.current = null
    }
  }, [goal])
  const saved = preview ? samples : query.data ?? {}
  async function save(active: Goal, draft: Questionnaire) {
    const title = draft.title.trim()
    if (!title || draft.questions.some(question => !question.q.trim())) throw new Error('عنوان هدف و متن همهٔ سؤال‌ها را وارد کنید.')
    const document = { title, questions: draft.questions.map(question => {
      const item = { id: question.id, q: question.q.trim() }
      if (question.id <= 100) return item
      const options = (question.options ?? []).map(option => option.trim()).filter(Boolean)
      if (options.length === 1 || options.length > 12 || options.some(option => option.length > 120)) {
        throw new Error('برای سؤال انتخابی، ۲ تا ۱۲ گزینه وارد کنید. هر گزینه حداکثر ۱۲۰ نویسه.')
      }
      return options.length ? { ...item, type: 'choice' as const, options } : { ...item, type: 'text' as const }
    }) }
    if (preview) {
      const next = { ...samples, [active.id]: document }
      sessionStorage.setItem(demoKey, JSON.stringify(next))
      setSamples(next)
    } else {
      await staff.api('admin/onboarding-questionnaire/' + active.id, 'PUT', document)
      client.setQueryData<Documents>(queryKey, previous => ({ ...previous, [active.id]: document }))
    }
    setDrafts(previous => ({ ...previous, [active.id]: document }))
  }
  if (!preview && !query.data) return <section className="questionnaire-editor questionnaire-feedback">
    {query.isError ? <><p role="alert">{query.error.message}</p><button type="button" className="secondary" onClick={() => void query.refetch()}>تلاش دوباره</button></> :
      <p role="status">در حال دریافت پرسش‌نامه…</p>}
  </section>
  if (goal) return <Editor key={goal.id} goal={goal} draft={drafts[goal.id] ?? saved[goal.id] ?? fallback(goal)} preview={preview}
    change={document => setDrafts(previous => ({ ...previous, [goal.id]: document }))} save={document => save(goal, document)}
    back={() => { backTo.current = goal.id; setGoal(null) }} />
  return <div className="questionnaire-goals" aria-label="دسته‌بندی‌های پرسش‌نامه">
    {goals.map(item => <button type="button" key={item.id} ref={element => {
      if (element) cards.current.set(item.id, element)
      else cards.current.delete(item.id)
    }} className="questionnaire-goal" style={{ backgroundImage: `linear-gradient(#0c17118a,#0c17118a),url("/onboarding/assets/${item.image}")` }}
      onClick={() => setGoal(item)}>{saved[item.id]?.title ?? item.title}</button>)}
  </div>
}
