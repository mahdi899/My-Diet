import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { formatFaNumber } from '@shared/utils'
import { apiError, loadActivityNutrition, loadMemberActivity, type ActivityDay, type ActivityNutrition, type MemberActivity } from '../../data/api'
import { formatFaDay } from '../../data/labels'
import './progress-calendar.css'

const persian = 'fa-IR-u-ca-persian'
const monthFormat = new Intl.DateTimeFormat(persian, { month: 'long', year: 'numeric', timeZone: 'UTC' })
const dayFormat = new Intl.DateTimeFormat(persian, { day: 'numeric', timeZone: 'UTC' })
const weekdays = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه']
const statusLabels = { complete: 'کامل', partial: 'ناقص', activity: 'فعالیت ثبت‌شده', empty: 'بدون ثبت' }
const mealLabels: Record<string, string> = {
  as_planned: 'طبق برنامه', less: 'کمتر از برنامه', more: 'بیشتر از برنامه',
  different: 'غذای متفاوت', skipped: 'وعده حذف شد',
}

function shift(date: string, days: number) {
  return new Date(Date.parse(date) + days * 86_400_000).toISOString().slice(0, 10)
}

function month(date: string) {
  return monthFormat.format(new Date(date))
}

function status(day?: ActivityDay) {
  if (day?.planned && day.recorded === day.planned) return 'complete'
  if (day?.planned && (day.recorded || Object.keys(day.mealStates).length || day.foods.length || day.waterMl != null || day.weightKg != null)) return 'partial'
  if (day && (Object.keys(day.mealStates).length || day.foods.length || day.waterMl != null || day.weightKg != null)) return 'activity'
  return 'empty'
}

export function ProgressCalendar({ userId, onBack }: { userId: string; onBack: () => void }) {
  const query = useQuery({ queryKey: ['doctor', 'activity', userId], queryFn: () => loadMemberActivity(userId) })
  return <section className="doctor-progress">
    <header className="progress-toolbar">
      <h2>تقویم فعالیت{query.data?.displayName ? ` · ${query.data.displayName}` : ''}</h2>
      <button type="button" className="secondary" onClick={onBack}>بازگشت به گزارش پیشرفت</button>
    </header>
    {query.isPending && <p role="status">در حال دریافت فعالیت‌ها…</p>}
    {query.isError && <div role="alert"><p>{apiError(query.error)}</p><button type="button" className="secondary" onClick={() => void query.refetch()}>تلاش دوباره</button></div>}
    {query.data && <Calendar key={userId} userId={userId} report={query.data} />}
  </section>
}

function Calendar({ userId, report }: { userId: string; report: MemberActivity }) {
  const [selected, setSelected] = useState(report.today)
  const label = month(selected)
  let start = selected
  while (month(shift(start, -1)) === label) start = shift(start, -1)
  const dates: string[] = []
  for (let date = start; month(date) === label; date = shift(date, 1)) dates.push(date)
  const offset = (new Date(start).getUTCDay() + 1) % 7
  const previous = shift(start, -1)
  const next = shift(start, dates.length)
  const day = report.days[selected]

  return <>
    <div className="card progress-overview">
      <div><span>روزهای کامل از ثبت‌نام</span><strong>{formatFaNumber(report.completedDays)} روز</strong></div>
      <div><span>تاریخ ثبت‌نام</span><strong>{formatFaDay(report.registeredOn)}</strong></div>
      <p>معیار روز کامل، ثبت همهٔ وعده‌های برنامه است.</p>
    </div>
    <div className="progress-columns">
      <section className="card progress-month" aria-label="تقویم ماهانه">
        <div className="progress-toolbar">
          <button type="button" className="secondary" disabled={previous < report.registeredOn} onClick={() => setSelected(previous)}>ماه قبل</button>
          <h3 aria-live="polite">{label}</h3>
          <button type="button" className="secondary" disabled={next > report.today} onClick={() => setSelected(next)}>ماه بعد</button>
        </div>
        <div className="progress-grid">
          {weekdays.map(name => <span className="progress-weekday" key={name} title={name} aria-label={name}>{name}</span>)}
          {Array.from({ length: offset }, (_, index) => <span key={index} aria-hidden="true" />)}
          {dates.map(date => {
            const state = status(report.days[date])
            return <button type="button" key={date} className="progress-date" data-status={state}
              disabled={date < report.registeredOn || date > report.today} aria-pressed={date === selected}
              aria-label={`${formatFaDay(date)}، ${statusLabels[state]}`} onClick={() => setSelected(date)}>
              {dayFormat.format(new Date(date))}<span aria-hidden="true">{state === 'complete' ? '✓' : state === 'partial' ? '◐' : state === 'activity' ? '•' : '–'}</span>
            </button>
          })}
        </div>
        <p className="progress-legend">✓ کامل · ◐ ناقص · • فعالیت ثبت‌شده · – بدون ثبت</p>
      </section>
      <section className="card progress-day" aria-live="polite">
        <span>خلاصهٔ روز</span>
        <h3>{formatFaDay(selected)}</h3>
        <p className="progress-status">{statusLabels[status(day)]}</p>
        <DayNutrition userId={userId} date={selected} />
        <dl>
          <div><dt>وعده‌های برنامه</dt><dd>{day?.planned ? `${formatFaNumber(day.recorded)} از ${formatFaNumber(day.planned)} ثبت شده` : 'بدون برنامه'}</dd></div>
          {Object.entries(day?.mealStates ?? {}).map(([state, count]) => <div key={state}><dt>{mealLabels[state] ?? 'وضعیت دیگر'}</dt><dd>{formatFaNumber(count)} وعده</dd></div>)}
          <div><dt>آب</dt><dd>{day?.waterMl == null ? 'ثبت نشده' : `${formatFaNumber(day.waterMl)} میلی‌لیتر`}</dd></div>
          <div><dt>وزن</dt><dd>{day?.weightKg == null ? 'ثبت نشده' : `${formatFaNumber(day.weightKg)} کیلوگرم`}</dd></div>
          <div><dt>غذاهای ثبت‌شده</dt><dd>{day?.foods.length ? <ul>{day.foods.map((food, index) => <li key={index}>{food}</li>)}</ul> : 'ثبت نشده'}</dd></div>
        </dl>
      </section>
    </div>
  </>
}

const mealTypes: Record<string, string> = { breakfast: 'صبحانه', lunch: 'ناهار', dinner: 'شام', snack: 'میان‌وعده', side: 'کنار غذا' }
const kcal = (value: number) => `${formatFaNumber(value)} کیلوکالری`

function DayNutrition({ userId, date }: { userId: string; date: string }) {
  const day = useQuery({
    queryKey: ['doctor', 'activity-nutrition', userId, date],
    queryFn: () => loadActivityNutrition(userId, date),
  })
  if (day.isPending) return <p role="status">در حال دریافت وعده‌ها و کالری…</p>
  if (day.isError) return <div role="alert"><p>{apiError(day.error)}</p><button type="button" className="secondary" onClick={() => void day.refetch()}>تلاش دوباره</button></div>
  const { targetKcal, consumedKcal, hasUnknownCalories, meals } = day.data
  return <>
    <section className="progress-energy">
      <h4>کالری روز</h4>
      <div className="progress-energy-values">
        <div><span>دریافت ثبت‌شده</span><strong>{consumedKcal == null ? 'نامشخص' : kcal(consumedKcal)}</strong></div>
        <div><span>هدف روزانه</span><strong>{targetKcal == null ? 'تعیین نشده' : kcal(targetKcal)}</strong></div>
      </div>
      {targetKcal != null && targetKcal > 0 && consumedKcal != null && <>
        <progress aria-label="دریافت ثبت‌شده نسبت به هدف" max={targetKcal} value={Math.min(consumedKcal, targetKcal)} />
        <small>{formatFaNumber(Math.round(consumedKcal / targetKcal * 100))}٪ از هدف روزانه</small>
      </>}
      {hasUnknownCalories && <small>کالری بعضی از غذاهای ثبت‌شده مشخص نیست.</small>}
    </section>
    <section className="progress-meals">
      <h4>وعده‌های برنامه</h4>
      {meals.length ? meals.map(meal => <MealCard key={meal.id} meal={meal} />) : <p>برای این روز برنامهٔ غذایی منتشرشده‌ای وجود ندارد.</p>}
    </section>
  </>
}

function MealCard({ meal }: { meal: ActivityNutrition['meals'][number] }) {
  const eatenHere = meal.consumed && meal.options.some(option =>
    option.id === meal.consumed?.id && option.kind === meal.consumed.kind && option.title === meal.consumed.title)
  return <article className="progress-meal">
    <header><h5>{mealTypes[meal.type] ?? 'وعدهٔ غذایی'}</h5><span>{mealLabels[meal.state] ?? 'مصرف ثبت نشده'}</span></header>
    <div className="progress-options">
      {meal.options.map((option, index) => {
        const eaten = eatenHere && option.id === meal.consumed?.id && option.kind === meal.consumed.kind
        return <div key={option.id ?? index} data-eaten={Boolean(eaten)}>
          <span>{option.kind === 'primary' ? 'غذای اصلی' : 'غذای جایگزین'}{eaten && ' · مصرف‌شده'}</span>
          <strong>{option.title}</strong>
          {option.kcal != null && <small>{kcal(option.kcal)}</small>}
        </div>
      })}
    </div>
    {meal.consumed && !eatenHere && <p>مصرف از نسخهٔ قبلی برنامه ({meal.consumed.kind === 'primary' ? 'اصلی' : 'جایگزین'}) · {meal.consumed.title}</p>}
    {meal.otherFood && <p>غذای مصرف‌شده · {meal.otherFood}</p>}
    {meal.consumedKcal != null && <p>کالری مصرفی · {kcal(meal.consumedKcal)}</p>}
  </article>
}
