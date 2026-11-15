import { useEffect, useMemo, useState } from 'react'
import { formatFaNumber } from '@shared/utils'
import { StaffError } from '@shared/api/staff-session'
import { staff } from '../../session'
import { apiError, loadPlan } from '../../data/api'
import { doctorPreviewEnabled } from '../../data/preview'
import { composePreviewOption, searchPreviewFoods, type PlanMeal, type PlanOption, type PlanRequest } from '../../data/samples'
import { aiStatusLabels, budgetLabels, dietLabels, mealSlots, optionKinds, setDirtyGuard, trackLabels, weekDays } from '../../data/labels'

const defaultTime: Record<string, string> = { breakfast: '08:00', lunch: '13:30', dinner: '20:00', snack: '16:30' }

export function PlanReview({ requestId, onBack }: { requestId: string; onBack: () => void }) {
  const preview = doctorPreviewEnabled()
  const [request, setRequest] = useState<PlanRequest | null>(null)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [busy, setBusy] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [day, setDay] = useState(0)
  const [picker, setPicker] = useState<{ meal: PlanMeal; kind: PlanOption['kind'] } | null>(null)

  useEffect(() => {
    let alive = true
    loadPlan(requestId).then((value) => { if (alive) setRequest(value) }).catch((cause) => { if (alive) setError(apiError(cause)) })
    return () => { alive = false }
  }, [requestId])
  useEffect(() => {
    setDirtyGuard(() => !dirty || window.confirm('تغییرات ذخیره‌نشده از بین می‌رود. خارج می‌شوید؟'))
    return () => setDirtyGuard(null)
  }, [dirty])

  const days = request?.version?.days ?? []
  const missing = useMemo(() => days.reduce((sum, item) => sum + item.meals.reduce((mealSum, meal) => mealSum + optionKinds.filter(([kind]) => !(meal.options || []).some((option) => option.kind === kind && option.approved)).length, 0), 0), [days])
  const emptyDays = days.filter((item) => !item.meals.length).length
  const missingSpecialist = days.flatMap((item) => item.meals).filter((meal) => !(meal.options || []).some((option) => option.kind === 'specialist_alternative')).length

  function patch(change: (draft: PlanRequest) => void) {
    setRequest((current) => {
      if (!current) return current
      const next = structuredClone(current)
      change(next)
      return next
    })
    setDirty(true)
  }

  async function save() {
    if (!request?.version) return
    const withoutPrimary = days.some((item) => item.meals.some((meal) => !(meal.options || []).some((option) => option.kind === 'primary')))
    if (withoutPrimary) { setToast('هر وعدهٔ تازه باید دست‌کم گزینهٔ اصلی داشته باشد.'); return }
    setBusy(true)
    try {
      if (preview) {
        request.version.lockVersion += 1
        setDirty(false)
        setToast('تغییرات در نمونه ذخیره شد.')
      } else {
        await staff.api('specialist/requests/' + encodeURIComponent(requestId) + '/draft', 'PUT', { days: request.version.days }, { 'If-Match': String(request.version.lockVersion) })
        setRequest(await loadPlan(requestId))
        setDirty(false)
        setToast('تغییرات ذخیره شد.')
      }
    } catch (cause) { setToast(apiError(cause)) } finally { setBusy(false) }
  }

  async function publish() {
    if (!request?.version || dirty || missing || emptyDays || request.status !== 'in_review') return
    setBusy(true)
    try {
      if (preview) {
        request.version.status = 'published'
        request.status = 'published'
        setRequest({ ...request })
        setToast('برنامه در نمونه منتشر شد.')
      } else {
        await staff.api('specialist/requests/' + encodeURIComponent(requestId) + '/publish', 'POST', undefined, { 'If-Match': String(request.version.lockVersion) })
        setRequest(await loadPlan(requestId))
        setToast('برنامه منتشر شد و برای کاربر فعال شد.')
      }
    } catch (cause) { setToast(apiError(cause)) } finally { setBusy(false) }
  }

  if (error) return <p className="pr-error">{error}</p>
  if (!request) return <p>در حال بارگذاری…</p>
  const published = request.version?.status === 'published'
  return (
    <div className="pr-root">
      <header className="pr-bar">
        <button className="secondary" type="button" onClick={() => { if (!dirty || window.confirm('تغییرات ذخیره‌نشده از بین می‌رود. خارج می‌شوید؟')) onBack() }}>بازگشت به فهرست</button>
        <h2>بررسی برنامهٔ {request.displayName || 'کاربر'}</h2>
      </header>
      {request.status === 'generating' && <section className="card card-pad"><h2>در حال ساخت پیش‌نویس تازه…</h2><p>هوش مصنوعی در حال نوشتن هفته است.</p></section>}
      <Profile request={request} />
      <AiCard request={request} />
      {request.version && (
        <>
          <div className="pr-actions">
            <button className="secondary" type="button" disabled={busy || published} onClick={() => patch((draft) => { for (const meal of draft.version?.days.flatMap((item) => item.meals) ?? []) for (const option of meal.options || []) option.approved = true })}>تأیید همهٔ گزینه‌ها</button>
            <button className="secondary" type="button" disabled={busy || published || missingSpecialist === 0} onClick={() => patch((draft) => fillSpecialist(draft))}>تکمیل گزینهٔ متخصص</button>
            <button type="button" disabled={busy || !dirty} onClick={save}>ذخیره تغییرات</button>
            <button type="button" disabled={busy || published || dirty || missing > 0 || emptyDays > 0 || request.status !== 'in_review'} onClick={publish}>{published ? 'منتشرشده' : 'انتشار برای کاربر'}</button>
          </div>
          <p className="pr-meta">{published ? 'این نسخه منتشر شده است.' : dirty ? 'تغییرات ذخیره‌نشده دارید؛ پیش از انتشار ذخیره کنید.' : emptyDays ? `برای ${formatFaNumber(emptyDays)} روز هنوز وعده‌ای ثبت نشده.` : missingSpecialist ? `${formatFaNumber(missingSpecialist)} وعده هنوز گزینهٔ متخصص ندارد.` : missing ? `${formatFaNumber(missing)} گزینه هنوز تأیید نشده.` : 'همه چیز کامل است؛ می‌توانید منتشر کنید.'}</p>
          <div className="pr-tabs section-tabs" role="tablist">
            {days.map((_, index) => <button key={index} className={`secondary pr-tab${index === day ? ' on' : ''}`} type="button" role="tab" aria-selected={index === day} onClick={() => setDay(index)}>{weekDays[index]}</button>)}
          </div>
          {days[day] && <DayView request={request} dayIndex={day} busy={busy} onAdd={(type) => patch((draft) => { draft.version?.days[day]?.meals.push({ mealUid: crypto.randomUUID(), mealType: type, suggestedTime: defaultTime[type] || '12:00', title: '', calories: 0, notes: '', items: [], options: [] }) })} onRemove={(meal) => patch((draft) => { const list = draft.version?.days[day]?.meals; const index = list?.findIndex((item) => item.mealUid === meal.mealUid) ?? -1; if (list && index >= 0) list.splice(index, 1) })} onToggle={(mealUid, kind, approved) => patch((draft) => { const option = draft.version?.days.flatMap((item) => item.meals).find((meal) => meal.mealUid === mealUid)?.options.find((item) => item.kind === kind); if (option) option.approved = approved })} onPick={setPicker} />}
        </>
      )}
      {toast && <p className="workspace-note" role="status">{toast}</p>}
      {picker && <FoodPicker meal={picker.meal} kind={picker.kind} preview={preview} onClose={() => setPicker(null)} onChoose={(option) => { patch((draft) => setOption(draft, picker.meal.mealUid, option)); setPicker(null) }} />}
    </div>
  )
}

function fillSpecialist(draft: PlanRequest) {
  for (const meal of draft.version?.days.flatMap((day) => day.meals) ?? []) {
    if ((meal.options || []).some((option) => option.kind === 'specialist_alternative')) continue
    const source = (meal.options || []).find((option) => option.kind === 'ai_alternative') || (meal.options || []).find((option) => option.kind === 'primary')
    if (!source) continue
    meal.options = [...(meal.options || []), { ...structuredClone(source), optionId: crypto.randomUUID(), kind: 'specialist_alternative', approved: true }]
  }
}

function setOption(draft: PlanRequest, mealUid: string, option: PlanOption) {
  const meal = draft.version?.days.flatMap((day) => day.meals).find((item) => item.mealUid === mealUid)
  if (!meal) return
  meal.options = [...(meal.options || []).filter((item) => item.kind !== option.kind), option]
  if (option.kind === 'primary') {
    meal.title = option.title
    meal.calories = option.calories
    meal.items = option.ingredients
  }
}

function Profile({ request }: { request: PlanRequest }) {
  const profile = request.profile
  return (
    <section className="card card-pad">
      <h2>پروندهٔ تغذیه‌ای</h2>
      {!profile ? <p>این کاربر مشخصات تغذیه‌ای ثبت‌شده ندارد.</p> : (
        <>
          <div className="pr-stats">
            <Stat label="مسیر" value={trackLabels[profile.track] || profile.track} />
            <Stat label="جنسیت و سن" value={`${profile.sex === 'male' ? 'مرد' : 'زن'}، ${formatFaNumber(profile.age)} ساله`} />
            <Stat label="قد / وزن" value={`${formatFaNumber(profile.heightCm)} / ${formatFaNumber(profile.weightKg)}`} />
            <Stat label="وزن هدف" value={profile.targetWeightKg ? formatFaNumber(profile.targetWeightKg) : '—'} />
            <Stat label="BMI" value={formatFaNumber(profile.bmi)} />
            <Stat label="هدف انرژی" value={formatFaNumber(profile.energy.targetKcal) + ' کیلوکالری'} />
            <Stat label="سبک تغذیه" value={dietLabels[profile.dietStyle] || profile.dietStyle} />
            <Stat label="بودجه" value={budgetLabels[profile.budget] || profile.budget} />
          </div>
          <div className="pr-chips">
            {request.riskFlags.map((flag) => <span key={flag} className="pr-chip bad">هشدار: {flag}</span>)}
            {profile.allergens.map((item) => <span key={item} className="pr-chip warn">حساسیت: {item}</span>)}
            {profile.safetyTier === 'doctor_only' && <span className="pr-chip bad">فقط با نظر پزشک</span>}
            {!request.riskFlags.length && !profile.allergens.length && <span className="pr-chip ok">هشدار یا حساسیتی ثبت نشده</span>}
          </div>
        </>
      )}
    </section>
  )
}

function AiCard({ request }: { request: PlanRequest }) {
  const review = request.aiReview
  return (
    <section className="card card-pad">
      <h2>گزارش هوش مصنوعی</h2>
      {!review ? <p>برای این درخواست هنوز تولید AI ثبت نشده است.</p> : (
        <div className="pr-stats">
          <Stat label="وضعیت" value={aiStatusLabels[review.status] || review.status} />
          <Stat label="استخر / مدل" value={`${review.poolCode || '—'} / ${review.model || '—'}`} />
          <Stat label="توکن" value={formatFaNumber(review.tokens)} />
          <Stat label="پرامپت" value={review.promptVersion} />
        </div>
      )}
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="pr-stat"><small>{label}</small><strong>{value}</strong></div>
}

function DayView({ request, dayIndex, busy, onAdd, onRemove, onToggle, onPick }: {
  request: PlanRequest
  dayIndex: number
  busy: boolean
  onAdd: (type: string) => void
  onRemove: (meal: PlanMeal) => void
  onToggle: (mealUid: string, kind: PlanOption['kind'], approved: boolean) => void
  onPick: (value: { meal: PlanMeal; kind: PlanOption['kind'] }) => void
}) {
  const day = request.version!.days[dayIndex]!
  const target = request.profile?.energy.targetKcal
  const total = day.meals.reduce((sum, meal) => sum + (meal.options.find((option) => option.kind === 'primary')?.calories ?? meal.calories ?? 0), 0)
  const [type, setType] = useState('breakfast')
  return (
    <div className="stack">
      <p className="pr-meta">مجموع این روز: {formatFaNumber(total)} کیلوکالری{target ? ` از هدف ${formatFaNumber(target)}` : ''}</p>
      {!day.meals.length && <p className="pr-error">برای این روز وعده‌ای نیست.</p>}
      {day.meals.map((meal) => (
        <section key={meal.mealUid} className="card card-pad">
          <header className="pr-bar">
            <h3>{mealSlots[meal.mealType] || meal.mealType}</h3>
            <span className="pr-meta">{meal.suggestedTime} · {formatFaNumber(meal.options.find((option) => option.kind === 'primary')?.calories ?? meal.calories)} کیلوکالری</span>
            {request.version?.status !== 'published' && <button className="secondary" type="button" disabled={busy} onClick={() => { if (window.confirm('این وعده با همهٔ گزینه‌هایش حذف شود؟')) onRemove(meal) }}>حذف وعده</button>}
          </header>
          <div className="pr-options">
            {optionKinds.map(([kind, label]) => {
              const option = meal.options.find((item) => item.kind === kind)
              return (
                <div key={kind} className={`pr-option${option ? '' : ' empty'}${option?.approved ? ' approved' : ''}`}>
                  <small>{label}</small>
                  {option ? <strong>{option.title}</strong> : <p>هنوز ثبت نشده</p>}
                  {option && <span className="pr-meta">{formatFaNumber(option.calories)} کیلوکالری · {option.ingredients.slice(0, 4).map((item) => item.name).join('، ')}</span>}
                  {option && <label className="pr-approve"><input type="checkbox" checked={option.approved} onChange={(event) => onToggle(meal.mealUid, kind, event.target.checked)} /> تأیید متخصص</label>}
                  <button className="secondary" type="button" disabled={busy} onClick={() => onPick({ meal, kind })}>{option ? 'تغییر از کاتالوگ' : 'افزودن از کاتالوگ'}</button>
                </div>
              )
            })}
          </div>
        </section>
      ))}
      {request.version?.status !== 'published' && (
        <div className="pr-actions">
          <select aria-label="نوع وعده" value={type} onChange={(event) => setType(event.target.value)}>
            {Object.entries(mealSlots).filter(([key]) => ['breakfast', 'lunch', 'dinner', 'snack'].includes(key)).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
          <button className="secondary" type="button" disabled={busy || day.meals.length >= 8} onClick={() => onAdd(type)}>افزودن وعده</button>
        </div>
      )}
    </div>
  )
}

function FoodPicker({ meal, kind, preview, onClose, onChoose }: {
  meal: PlanMeal
  kind: PlanOption['kind']
  preview: boolean
  onClose: () => void
  onChoose: (option: PlanOption) => void
}) {
  const [query, setQuery] = useState('')
  const [foods, setFoods] = useState(preview ? searchPreviewFoods('') : [])
  const [picks, setPicks] = useState<{ slug: string; nameFa: string; kcal: number; servings: number }[]>([])
  const [error, setError] = useState('')
  async function find(value: string) {
    if (preview) { setFoods(searchPreviewFoods(value)); return }
    try {
      const page = await staff.api<{ items: { slug: string; nameFa: string; kcal: number; servingLabel: string }[] }>('catalog/foods?limit=12&q=' + encodeURIComponent(value.trim()))
      setFoods(page.items ?? [])
    } catch (cause) { setError(cause instanceof StaffError ? cause.message : 'جست‌وجو انجام نشد.') }
  }
  const total = Math.round(picks.reduce((sum, pick) => sum + pick.kcal * pick.servings, 0))
  return (
    <dialog className="modal" open>
      <div className="modal-header"><h2>{mealSlots[meal.mealType] || meal.mealType} — {optionKinds.find((item) => item[0] === kind)?.[1]}</h2><button className="icon-button" type="button" aria-label="بستن" onClick={onClose}>×</button></div>
      <div className="modal-body stack">
        <input type="search" aria-label="جست‌وجوی غذا" placeholder="جست‌وجوی غذا: قیمه، آش، کوکو…" value={query} onChange={(event) => { setQuery(event.target.value); void find(event.target.value) }} />
        {error && <p className="pr-error">{error}</p>}
        <div className="stack">
          {foods.map((food) => (
            <button key={food.slug} className="secondary" type="button" onClick={() => { if (picks.length < 5 && !picks.some((pick) => pick.slug === food.slug)) setPicks([...picks, { slug: food.slug, nameFa: food.nameFa, kcal: food.kcal, servings: 1 }]) }}>
              <strong>{food.nameFa}</strong> <small>{formatFaNumber(food.kcal)} کیلوکالری</small>
            </button>
          ))}
        </div>
        <h3>انتخاب‌شده</h3>
        {picks.map((pick) => <p key={pick.slug}>{pick.nameFa}</p>)}
        <p>{picks.length ? `مجموع: ${formatFaNumber(total)} کیلوکالری` : 'حداقل یک غذا انتخاب کنید.'}</p>
        <div className="actions">
          <button type="button" disabled={!picks.length} onClick={async () => {
            if (preview) { onChoose(composePreviewOption(kind, picks).option); return }
            try {
              const composed = await staff.api<{ option: PlanOption }>('catalog/compose', 'POST', { kind, items: picks.map((pick) => ({ slug: pick.slug, servings: pick.servings })) })
              onChoose({ ...composed.option, kind, approved: true })
            } catch (cause) { setError(cause instanceof StaffError ? cause.message : 'ثبت گزینه انجام نشد.') }
          }}>ثبت این گزینه</button>
          <button className="secondary" type="button" onClick={onClose}>انصراف</button>
        </div>
      </div>
    </dialog>
  )
}
