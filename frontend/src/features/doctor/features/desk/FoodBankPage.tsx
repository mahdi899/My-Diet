import { useDeferredValue, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { asRecord, formatFaNumber } from '@shared/utils'
import { AdminIcon as Icon } from '../../../admin/components/AdminIcon'
import { categories, costs, display, foodError, meals, seasons, values, type FoodRow } from '../../../admin/features/foods/catalog'
import { readIngredients, RecipeDetails } from '../../../admin/features/foods/RecipeDetails'
import { doctorPreviewEnabled } from '../../data/preview'
import { staff } from '../../session'
import { DoctorDialog } from './PeoplePage'

const pageSize = 20
const normalize = (value: string) => value.trim().toLowerCase().replace(/ي/g, 'ی').replace(/ك/g, 'ک')
const units: Record<string, string> = { g: 'گرم', kg: 'کیلوگرم', ml: 'میلی‌لیتر', piece: 'عدد' }
const format = (value: unknown, unit: string) => value == null ? '—' : formatFaNumber(Number(value)) + ' ' + unit
const labels = (value: unknown, names: Record<string, string> = {}) => values(value).map(key => names[key] ?? key).join('، ')

async function readFoodBank<T>(suffix: string, preview: boolean): Promise<T> {
  if (!preview) return staff.api<T>('catalog/food-bank' + suffix)
  const response = await fetch('/v1/local-preview/food-bank' + suffix)
  if (!response.ok) throw new Error('دریافت کاتالوگ از سرور محلی ممکن نشد.')
  return response.json()
}

function FoodDetails({ row, preview, close }: { row: FoodRow; preview: boolean; close: () => void }) {
  const query = useQuery({
    queryKey: ['doctor', 'food-bank', 'detail', preview, row.slug],
    queryFn: () => readFoodBank<FoodRow>('/' + encodeURIComponent(String(row.slug)), preview),
  })
  const food = query.data
  const recipe = asRecord(food?.recipe)
  const ingredients = readIngredients(food ?? null)
  const fields = food ? [
    ['دسته', categories[String(food.category)] ?? display(food.category)],
    ['وضعیت کاتالوگ', food.active ? 'فعال' : 'غیرفعال'],
    ['وعده‌ها', labels(food.mealTypes, meals)],
    ['اندازهٔ پرس', food.servingLabel],
    ['وزن هر پرس', format(food.servingG, 'گرم')],
    ['انرژی هر پرس', format(food.kcal, 'کیلوکالری')],
    ['پروتئین', format(food.proteinG, 'گرم')],
    ['کربوهیدرات', format(food.carbsG, 'گرم')],
    ['چربی', format(food.fatG, 'گرم')],
    ['فیبر', format(food.fiberG, 'گرم')],
    ['آلرژن‌های ثبت‌شده', labels(food.allergens)],
    ['منطقه', labels(food.regions)],
    ['فصل', labels(food.seasons, seasons)],
    ['هزینه', costs[String(food.costTier)]],
    ['آماده‌سازی', format(food.prepMinutes, 'دقیقه')],
    ['برچسب‌ها', labels(food.tags)],
  ] : []
  const image = typeof food?.image === 'string' && /^\/(?!\/)/.test(food.image) ? food.image : null

  return <DoctorDialog title={display(row.nameFa)} close={close}>
    {query.isLoading && <p role="status">در حال دریافت جزئیات…</p>}
    {query.isError && <p role="alert">{foodError(query.error)} <button type="button" className="secondary" onClick={() => void query.refetch()}>تلاش دوباره</button></p>}
    {food && <>
      {image && <img className="doctor-food-photo" src={image} alt={display(food.nameFa)} />}
      <dl className="doctor-detail-grid">{fields.map(([label, value]) => <div key={String(label)}><dt>{String(label)}</dt><dd>{display(value)}</dd></div>)}</dl>
      {ingredients.length > 0 && <section><h3>مواد اولیهٔ هر پرس</h3><ul className="doctor-food-ingredients">
        {ingredients.map((item, index) => <li key={index}><span>{item.name}</span><span>{format(item.quantity, units[item.unit] ?? item.unit)}</span></li>)}
      </ul></section>}
      {recipe && <RecipeDetails recipe={recipe} />}
    </>}
  </DoctorDialog>
}

export function FoodBankPage() {
  const preview = doctorPreviewEnabled()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [meal, setMeal] = useState('')
  const [active, setActive] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [cursors, setCursors] = useState([''])
  const [selected, setSelected] = useState<FoodRow | null>(null)
  const term = useDeferredValue(normalize(search))
  const cursor = cursors[cursors.length - 1] ?? ''
  const query = useQuery({
    queryKey: ['doctor', 'food-bank', preview, term, category, meal, active, cursor],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: String(pageSize) })
      if (term) params.set('q', term)
      if (category) params.set('category', category)
      if (meal) params.set('meal', meal)
      if (active) params.set('active', active)
      if (cursor) params.set('cursor', cursor)
      return readFoodBank<{ items: FoodRow[]; nextCursor: string | null }>('?' + params, preview)
    },
  })
  const rows = query.data?.items ?? []
  const nextCursor = query.data?.nextCursor
  const filterCount = [category, meal, active].filter(Boolean).length

  return <section className="doctor-food-bank" aria-label="بانک غذا">
    <header className="doctor-food-toolbar">
      <label className="doctor-food-search">
        <Icon name="search" />
        <input type="search" aria-label="جست‌وجوی غذا" placeholder="نام یا شناسهٔ غذا…" value={search}
          onChange={event => { setSearch(event.target.value); setCursors(['']) }} />
      </label>
      <div className="doctor-food-controls">
        {filterCount > 0 && <button className="secondary" type="button" onClick={() => { setCategory(''); setMeal(''); setActive(''); setCursors(['']) }}>حذف فیلترها</button>}
        <button className="secondary icon-button" type="button" aria-label="فیلترهای بانک غذا" aria-expanded={filtersOpen}
          aria-controls="doctor-food-filters" onClick={() => setFiltersOpen(open => !open)}>
          <Icon name="filter" />{filterCount > 0 && <span>{formatFaNumber(filterCount)}</span>}
        </button>
      </div>
    </header>
    <div id="doctor-food-filters" className="doctor-food-filters" hidden={!filtersOpen}>
      <label>دستهٔ غذا<select value={category} onChange={event => { setCategory(event.target.value); setCursors(['']) }}>
        <option value="">همهٔ دسته‌ها</option>
        {Object.entries(categories).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </select></label>
      <label>وعده<select value={meal} onChange={event => { setMeal(event.target.value); setCursors(['']) }}>
        <option value="">همهٔ وعده‌ها</option>
        {Object.entries(meals).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </select></label>
      <label>وضعیت<select value={active} onChange={event => { setActive(event.target.value); setCursors(['']) }}>
        <option value="">همهٔ وضعیت‌ها</option>
        <option value="true">فعال</option>
        <option value="false">غیرفعال</option>
      </select></label>
    </div>
    <table className="doctor-food-table">
      <thead><tr>{['غذا', 'وزن یک پرس', 'انرژی هر پرس', 'جزئیات'].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead>
      <tbody>{rows.map(food => <tr key={String(food.slug)}>
        <th scope="row">{display(food.nameFa)}<small>{categories[String(food.category)] ?? display(food.category)}{!food.active && ' · غیرفعال'}</small></th>
        <td>{format(food.servingG, 'گرم')}</td>
        <td>{format(food.kcal, 'کیلوکالری')}</td>
        <td><button type="button" className="secondary icon-button" aria-label={`جزئیات ${display(food.nameFa)}`} onClick={() => setSelected(food)}><Icon name="eye" /></button></td>
      </tr>)}
      {!rows.length && <tr><td colSpan={4} className="doctor-food-message">
        {query.isPending ? <span role="status">در حال دریافت غذاها…</span> : query.isError
          ? <span role="alert">{foodError(query.error)} <button type="button" className="secondary" onClick={() => void query.refetch()}>تلاش دوباره</button></span>
          : 'غذایی با این معیارها پیدا نشد.'}
      </td></tr>}</tbody>
    </table>
    {(nextCursor || cursors.length > 1) && <footer className="doctor-food-pagination" aria-label="صفحه‌بندی غذاها">
      <button type="button" className="secondary" disabled={cursors.length === 1} onClick={() => setCursors(previous => previous.slice(0, -1))}>قبلی</button>
      <span>صفحهٔ {formatFaNumber(cursors.length)}</span>
      <button type="button" className="secondary" disabled={!nextCursor || query.isFetching || term !== normalize(search)}
        onClick={() => { if (nextCursor) setCursors(previous => [...previous, nextCursor]) }}>بعدی</button>
    </footer>}
    {selected && <FoodDetails row={selected} preview={preview} close={() => setSelected(null)} />}
  </section>
}
