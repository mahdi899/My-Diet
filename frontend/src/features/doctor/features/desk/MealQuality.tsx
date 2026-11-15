import { useQuery } from '@tanstack/react-query'
import { staff } from '../../session'
import { doctorPreviewEnabled } from '../../data/preview'
import { createClinicalSample, type ClinicalMeal, type ClinicalRequest } from '../../data/samples'
import { apiError } from '../../data/api'
import { weekDays } from '../../data/labels'

function issues(meal: Partial<ClinicalMeal>) {
  const result: string[] = []
  if (!meal.title?.trim()) result.push('نام غذا ثبت نشده')
  if (!Number.isFinite(meal.calories) || (meal.calories ?? 0) <= 0) result.push('کالری سهم ثبت نشده')
  if (!Number.isFinite(meal.preparationMinutes) || (meal.preparationMinutes ?? -1) < 0) result.push('زمان آماده‌سازی ثبت نشده')
  if (!meal.instructions?.trim()) result.push('روش آماده‌سازی ثبت نشده')
  if (!meal.quantityBasis?.trim()) result.push('مبنای وزن خام یا پخته ثبت نشده')
  if (!meal.items?.length || meal.items.some((item) => !item.name || !(Number(item.quantity) > 0) || !item.unit)) result.push('مواد اولیه یا مقدار ناقص است')
  return result
}

export function mealProblems(meal: ClinicalMeal) {
  const result = issues(meal)
  const options = meal.alternatives ?? []
  if (options.length !== 2 || options.some((item) => !['ai', 'specialist'].includes(item.source))) result.push('دقیقاً دو جایگزین با منبع مشخص لازم است')
  for (const [source, label] of [['ai', 'هوش مصنوعی'], ['specialist', 'متخصص']] as const) {
    const matching = options.filter((item) => item.source === source)
    if (matching.length !== 1) result.push(`یک جایگزین ${label} لازم است`)
    for (const alt of matching) {
      if (!alt.approved || !alt.reviewedBy || !alt.reviewedAt || !Number.isFinite(Date.parse(alt.reviewedAt))) result.push(`جایگزین ${label} تأیید متخصص ندارد`)
      for (const issue of issues(alt.meal || {})) result.push(`جایگزین ${label}: ${issue}`)
    }
  }
  return result
}

export function MealQuality({ requestId, onBack }: { requestId: string; onBack: () => void }) {
  const query = useQuery({
    queryKey: ['doctor', 'meal-quality', requestId],
    queryFn: async (): Promise<ClinicalRequest> => {
      if (doctorPreviewEnabled()) return createClinicalSample().get()
      return staff.api('specialist/requests/' + encodeURIComponent(requestId))
    },
  })
  if (query.isLoading) return <section className="card card-pad">در حال دریافت اطلاعات…</section>
  if (query.isError || !query.data) return <section className="card card-pad">{apiError(query.error)} <button className="secondary" type="button" onClick={onBack}>بازگشت به فهرست</button></section>
  const request = query.data
  const days = request.version?.days ?? []
  let count = days.length === 7 ? 0 : 1
  const groups = days.map((day, index) => {
    const meals = day.meals ?? []
    if (!meals.length) count += 1
    return { index, meals: meals.map((meal) => { const problems = mealProblems(meal); count += problems.length; return { meal, problems } }) }
  })
  return (
    <section className="card card-pad stack">
      <button className="secondary" type="button" onClick={onBack}>بازگشت به فهرست</button>
      <p role="status">{count ? 'برنامه برای انتشار آماده نیست؛ موارد زیر باید تکمیل شوند.' : 'اطلاعات غذا کامل است؛ انتشار همچنان تابع بررسی بالینی و پاسخ‌های لازم کاربر است.'}</p>
      <h2>کامل‌بودن غذاها و جایگزین‌ها پیش از انتشار</h2>
      <p>این بخش وضعیت دادهٔ دریافتی را بررسی می‌کند. جزئیات یا تأیید ثبت‌نشده به‌صورت خودکار ساخته نمی‌شود.</p>
      {!days.length && <p>پیش‌نویس برنامه هنوز موجود نیست.</p>}
      {days.length !== 7 && days.length > 0 && <p>هفت روز برنامه کامل نیست.</p>}
      {groups.map((group) => (
        <details key={group.index} open>
          <summary>{weekDays[group.index] || 'روز خارج از هفته'}</summary>
          {!group.meals.length && <p>وعده‌ای ثبت نشده</p>}
          {group.meals.map(({ meal, problems }) => (
            <section key={meal.mealUid} className="card card-pad">
              <h3>{meal.title || 'بدون نام'}</h3>
              {(meal.items ?? []).map((item, index) => <p key={index}>{item.name || 'بدون نام'}: {item.quantity ?? 'ثبت نشده'} {item.unit ?? ''}</p>)}
              <p>{problems.length ? 'نیازمند تکمیل پیش از انتشار' : 'جزئیات و هر دو تأیید کامل است'}</p>
              {problems.length > 0 && <ul>{problems.map((problem) => <li key={problem}>{problem}</li>)}</ul>}
            </section>
          ))}
        </details>
      ))}
    </section>
  )
}
