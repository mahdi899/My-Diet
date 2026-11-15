import { useEffect, useState } from 'react'
import { formatFaNumber } from '@shared/utils'
import { staff } from '../../session'
import { apiError } from '../../data/api'
import { createClinicalSample, type ClinicalDay, type ClinicalMeal, type ClinicalRepository, type ClinicalRequest } from '../../data/samples'
import { formatFaDay, mealSlots, setDirtyGuard, textValue, weekDays } from '../../data/labels'
import { mealProblems } from './MealQuality'

export function ClinicalWorkspace({ demo, requestId, onBack }: { demo?: boolean; requestId?: string; onBack: () => void }) {
  const [repo] = useState<ClinicalRepository | null>(() => demo ? createClinicalSample() : null)
  const [request, setRequest] = useState<ClinicalRequest | null>(null)
  const [days, setDays] = useState<ClinicalDay[]>([])
  const [baseline, setBaseline] = useState('')
  const [tab, setTab] = useState<'patient' | 'editor' | 'compare' | 'questions'>('patient')
  const [day, setDay] = useState(0)
  const [message, setMessage] = useState('')
  const [failure, setFailure] = useState('')
  const [question, setQuestion] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const dirty = JSON.stringify(days) !== baseline

  useEffect(() => {
    let alive = true
    const load = async () => {
      if (repo) return repo.get()
      if (!requestId) throw new Error('شناسهٔ درخواست نیست.')
      return staff.api<ClinicalRequest>('specialist/requests/' + encodeURIComponent(requestId))
    }
    load().then((value) => {
      if (!alive) return
      setRequest(value)
      setDays(structuredClone(value.version?.days ?? []))
      setBaseline(JSON.stringify(value.version?.days ?? []))
    }).catch((cause) => { if (alive) setError(apiError(cause)) })
    return () => { alive = false }
  }, [repo, requestId])
  useEffect(() => {
    setDirtyGuard(() => !dirty || window.confirm('پیش‌نویس ذخیره نشده است. از این بخش خارج شوی؟'))
    return () => setDirtyGuard(null)
  }, [dirty])

  function updateDays(change: (next: ClinicalDay[]) => void) {
    setDays((current) => {
      const next = structuredClone(current)
      change(next)
      return next
    })
  }

  async function perform(action: () => Promise<void>) {
    setBusy(true)
    setFailure('')
    setMessage('در حال انجام…')
    try {
      await action()
      setMessage(demo ? 'عملیات فقط در سناریوی نمونه انجام شد.' : 'پاسخ عملیات از سرور دریافت شد.')
    } catch (cause) {
      setFailure(apiError(cause))
      setMessage('')
    } finally { setBusy(false) }
  }

  async function save() {
    if (!request || days.length !== 7) { setFailure('هفت روز برنامه را کامل کن.'); return }
    await perform(async () => {
      if (repo) {
        const updated = await repo.save(request, days)
        setRequest(updated)
        setDays(structuredClone(updated.version?.days ?? []))
        setBaseline(JSON.stringify(updated.version?.days ?? []))
        return
      }
      const lock = request.version?.lockVersion
      if (!Number.isInteger(lock)) throw new Error('نسخهٔ ویرایش از سرور دریافت نشده است.')
      await staff.api('specialist/requests/' + encodeURIComponent(request.id) + '/draft', 'PUT', { days }, { 'If-Match': String(lock) })
      const updated = await staff.api<ClinicalRequest>('specialist/requests/' + encodeURIComponent(request.id))
      setRequest(updated)
      setDays(structuredClone(updated.version?.days ?? []))
      setBaseline(JSON.stringify(updated.version?.days ?? []))
    })
  }

  if (error) return <section className="card card-pad">{error}</section>
  if (!request) return <section className="card card-pad">در حال بارگذاری…</section>
  const issues = planIssues(request, days, dirty)
  return (
    <div className="clinical-workspace">
      <section className="card card-pad stack">
        <h2>{demo ? 'پرونده و ویرایش برنامه · نمونهٔ آموزشی' : 'پرونده و ویرایش برنامه'}</h2>
        <p>{demo ? 'اطلاعات ساختگی است؛ ذخیره و انتشار فقط در حافظهٔ این نمونه انجام می‌شود.' : 'اطلاعات از API حساب متخصص دریافت شده است.'}</p>
        <div className="actions">
          <button className="secondary" type="button" onClick={() => { if (!dirty || window.confirm('پیش‌نویس ذخیره نشده است. از این بخش خارج شوی؟')) onBack() }}>بازگشت به فهرست</button>
        </div>
        <p>{request.displayName || 'نام ارائه نشده'}</p>
        <p>شروع هفتهٔ برنامه: {request.weekStart ? formatFaDay(request.weekStart) : 'از سرور ارائه نشده'}</p>
        <p>{dirty ? 'تغییرات ذخیره‌نشده' : 'بدون تغییر ذخیره‌نشده'}</p>
      </section>
      {failure && <p className="clinical-error" role="alert">{failure}</p>}
      {message && <p role="status">{message}</p>}
      <div className="section-tabs">
        {([['patient', 'پرونده کاربر'], ['editor', 'ویرایش برنامه'], ['compare', 'مقایسه نسخه‌ها'], ['questions', 'اطلاعات بیشتر']] as const).map(([key, label]) => (
          <button key={key} className="secondary" type="button" aria-pressed={tab === key} onClick={() => setTab(key)}>{label}</button>
        ))}
      </div>
      {tab === 'patient' && <PatientView request={request} />}
      {tab === 'editor' && <Editor days={days} day={day} setDay={setDay} onChange={updateDays} />}
      {tab === 'compare' && <Compare days={days} published={request.published?.days} />}
      {tab === 'questions' && (
        <section className="card card-pad stack">
          <h2>اطلاعات بیشتر و پاسخ کاربر</h2>
          {request.questions.map((item) => (
            <section key={item.id} className="card card-pad">
              <h3>{item.prompt}</h3>
              <p>وضعیت: {{ open: 'در انتظار پاسخ کاربر', answered: 'پاسخ دریافت شده؛ نیازمند بررسی', acknowledged: 'بررسی‌شده', withdrawn: 'پس گرفته شده' }[item.status] || 'نامشخص'}</p>
              {item.answers.map((answer, index) => <p key={index}>{answer.body}</p>)}
              {item.status === 'answered' && repo && <button className="secondary" type="button" disabled={busy} onClick={() => perform(async () => { await repo.acknowledge(item.id); setRequest(await repo.get()) })}>پاسخ را خواندم و بررسی کردم</button>}
            </section>
          ))}
          <label>سؤال ضروری از کاربر
            <textarea maxLength={500} value={question} onChange={(event) => setQuestion(event.target.value)} />
          </label>
          <button className="secondary" type="button" disabled={busy} onClick={() => {
            if (dirty) { setFailure('پیش از ارسال سؤال، پیش‌نویس را ذخیره کن.'); return }
            if (!question.trim() || !repo) { setFailure(repo ? 'سؤال را بنویس.' : 'ارسال سؤال در این نما به API وصل است.'); return }
            void perform(async () => { await repo.ask(request, question.trim()); setRequest(await repo.get()); setQuestion('') })
          }}>ارسال سؤال ضروری</button>
          {repo && <button className="secondary" type="button" disabled={busy} onClick={() => perform(async () => { await repo.answer(); setRequest(await repo.get()) })}>شبیه‌سازی پاسخ کاربر در نمونه</button>}
        </section>
      )}
      {request.version && (
        <section className="card card-pad stack">
          <h3>بررسی پیش از انتشار</h3>
          {issues.map((issue) => <p key={issue}>{issue}</p>)}
          <div className="actions">
            <button type="button" disabled={busy} onClick={save}>ذخیره پیش‌نویس</button>
            <button type="button" disabled={busy || dirty || issues.length > 0} onClick={() => {
              if (!window.confirm(demo ? 'این برنامه فقط در نمونه منتشر شود؟' : 'این نسخهٔ بررسی‌شده برای کاربر منتشر شود؟')) return
              void perform(async () => {
                if (repo) { await repo.publish(request); setRequest(await repo.get()) }
                else await staff.api('specialist/requests/' + encodeURIComponent(request.id) + '/publish', 'POST', undefined, { 'If-Match': String(request.version?.lockVersion) })
              })
            }}>{demo ? 'تأیید و انتشار نمونه' : 'تأیید و انتشار برنامه'}</button>
          </div>
        </section>
      )}
      {repo && (
        <section className="card card-pad">
          <h2>سناریوهای نمونه</h2>
          <div className="actions">
            <button className="secondary" type="button" onClick={() => { repo.setFailures(false, false); setMessage('سناریو: موفق') }}>موفق</button>
            <button className="secondary" type="button" onClick={() => { repo.setFailures(true, false); setMessage('سناریو: خطای ذخیره') }}>خطای ذخیره</button>
            <button className="secondary" type="button" onClick={() => { repo.setFailures(false, true); setMessage('سناریو: خطای انتشار') }}>خطای انتشار</button>
          </div>
        </section>
      )}
    </div>
  )
}

function planIssues(request: ClinicalRequest, days: ClinicalDay[], dirty: boolean) {
  const result: string[] = []
  if (!Number.isInteger(request.version?.lockVersion)) result.push('نسخهٔ قفل ویرایش دریافت نشده است.')
  if (request.version?.status !== 'draft') result.push('برای انتشار باید پیش‌نویس ذخیره‌شده داشته باشی.')
  if (days.length !== 7) result.push('برنامه باید دقیقاً هفت روز داشته باشد.')
  days.forEach((item, index) => {
    if (!item.meals.length) result.push(`${weekDays[index]}: وعده‌ای ثبت نشده`)
    for (const meal of item.meals) for (const problem of mealProblems(meal)) result.push(`${weekDays[index]} · ${meal.title || 'بدون نام'}: ${problem}`)
  })
  if (request.questions.some((item) => item.required && !['acknowledged', 'withdrawn'].includes(item.status))) result.push('پاسخ لازم کاربر باید دریافت و توسط متخصص بررسی شود.')
  if (request.status !== 'in_review') result.push('وضعیت درخواست برای انتشار آماده نیست.')
  if (dirty) result.push('تغییرات هنوز ذخیره نشده‌اند.')
  return [...new Set(result)]
}

function PatientView({ request }: { request: ClinicalRequest }) {
  const patient = (request.patient ?? {}) as Record<string, unknown>
  const fields: [string, unknown][] = [
    ['نام', patient.name ?? request.displayName], ['سن', patient.age], ['قد (سانتی‌متر)', patient.height],
    ['وزن فعلی (کیلوگرم)', patient.currentWeight], ['وزن هدف', patient.targetWeight], ['هدف', patient.goal],
    ['بیماری‌ها', patient.conditions], ['آلرژی‌ها', patient.allergies], ['داروها', patient.medications],
  ]
  const consumption = patient.consumption as { recorded?: number; adherent?: number; total?: number } | undefined
  return (
    <div className="stack">
      <section className="card card-pad">
        <h2>پروندهٔ کاربر</h2>
        <dl className="definition-list">{fields.map(([label, value]) => <span key={label} style={{ display: 'contents' }}><dt>{label}</dt><dd>{textValue(value)}</dd></span>)}</dl>
        <p>{request.capabilities?.completeMealEditor ? 'نمونهٔ آموزشی است.' : 'فقط اطلاعات دریافت‌شده از API نشان داده می‌شود.'}</p>
      </section>
      <section className="card card-pad">
        <h2>خلاصهٔ ثبت وعده و رعایت برنامه</h2>
        <p>{consumption ? `ثبت‌شده: ${formatFaNumber(consumption.recorded ?? 0)} از ${formatFaNumber(consumption.total ?? 0)} · طبق برنامه: ${formatFaNumber(consumption.adherent ?? 0)} از ${formatFaNumber(consumption.total ?? 0)}` : 'اطلاعات مصرف ارائه نشده است.'}</p>
      </section>
    </div>
  )
}

function Editor({ days, day, setDay, onChange }: { days: ClinicalDay[]; day: number; setDay: (day: number) => void; onChange: (change: (next: ClinicalDay[]) => void) => void }) {
  const meals = days[day]?.meals ?? []
  return (
    <div className="stack">
      <div className="section-tabs">{weekDays.map((label, index) => <button key={label} className="secondary" type="button" aria-pressed={day === index} onClick={() => setDay(index)}>{label}</button>)}</div>
      {meals.map((meal, index) => (
        <section key={meal.mealUid} className="card card-pad">
          <h2>{mealSlots[meal.mealType] || 'وعده'} · {meal.title || 'وعده جدید'}</h2>
          <div className="clinical-grid">
            <label>نام غذا<input value={meal.title} onChange={(event) => onChange((next) => { next[day]!.meals[index]!.title = event.target.value })} /></label>
            <label>ساعت<input type="time" value={meal.suggestedTime} onChange={(event) => onChange((next) => { next[day]!.meals[index]!.suggestedTime = event.target.value })} /></label>
            <label>سهم غذا<input value={meal.portion} onChange={(event) => onChange((next) => { next[day]!.meals[index]!.portion = event.target.value })} /></label>
            <label>کالری سهم<input type="number" value={meal.calories ?? ''} onChange={(event) => onChange((next) => { next[day]!.meals[index]!.calories = event.target.value === '' ? null : Number(event.target.value) })} /></label>
          </div>
          <label>مواد اولیه
            <textarea value={meal.items.map((item) => `${item.name}: ${item.quantity ?? ''} ${item.unit}`).join('\n')} readOnly />
          </label>
          {(meal.alternatives ?? []).map((alt) => <p key={alt.id}>{alt.source === 'ai' ? 'جایگزین هوش مصنوعی' : 'جایگزین متخصص'}: {alt.meal.title} · {alt.approved ? 'تأییدشده' : 'نیازمند بررسی'}</p>)}
          <button className="secondary" type="button" onClick={() => { if (window.confirm('این وعده از پیش‌نویس حذف شود؟')) onChange((next) => { next[day]!.meals.splice(index, 1) }) }}>حذف وعده</button>
        </section>
      ))}
      <button className="secondary" type="button" onClick={() => onChange((next) => { next[day]?.meals.push(emptyMeal()) })}>افزودن وعده</button>
    </div>
  )
}

function emptyMeal(): ClinicalMeal {
  return { mealUid: crypto.randomUUID(), mealType: 'dinner', suggestedTime: '', title: '', calories: null, portion: '', preparationMinutes: null, instructions: '', quantityBasis: '', notes: '', items: [], alternatives: [] }
}

function Compare({ days, published }: { days: ClinicalDay[]; published?: ClinicalDay[] }) {
  if (!published) return <section className="card card-pad"><h2>مقایسهٔ پیش‌نویس و نسخهٔ منتشرشده</h2><p>نسخهٔ منتشرشده برای مقایسه از API ارائه نشده است.</p></section>
  return (
    <section className="card card-pad stack">
      <h2>مقایسهٔ پیش‌نویس و نسخهٔ منتشرشده</h2>
      {weekDays.map((label, index) => (
        <details key={label}>
          <summary>{label}</summary>
          <pre>{(days[index]?.meals ?? []).map((meal) => meal.title).join('\n') || 'وعده‌ای نیست'}</pre>
        </details>
      ))}
    </section>
  )
}
