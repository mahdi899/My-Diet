import { useDeferredValue, useEffect, useState } from 'react'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { asRecord, formatFaNumber } from '@shared/utils'
import { AdminIcon as Icon } from '../../../admin/components/AdminIcon'
import { categories, costs, display, foodError, meals, seasons, values, type FoodRow } from '../../../admin/features/foods/catalog'
import { readIngredients, RecipeDetails } from '../../../admin/features/foods/RecipeDetails'
import { doctorPreviewEnabled } from '../../data/preview'
import { staff } from '../../session'
import { DoctorDialog } from './PeoplePage'
import { FoodImage } from '../../../admin/features/foods/FoodImage'
import '../../../admin/features/users/users.css'
import '../../../admin/features/foods/foods.css'

const pageSize = 15
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
      {image && <FoodImage food={food} />}
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
  const [active, setActive] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<FoodRow | null>(null)
  const term = useDeferredValue(normalize(search))
  const query = useInfiniteQuery({
    queryKey: ['doctor', 'food-bank', preview, term, category, active],
    initialPageParam: '',
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ limit: '100' })
      if (term) params.set('q', term)
      if (category) params.set('category', category)
      if (active) params.set('active', active)
      if (pageParam) params.set('cursor', pageParam)
      return readFoodBank<{ items: FoodRow[]; nextCursor: string | null }>('?' + params, preview)
    },
    getNextPageParam: last => last.nextCursor || undefined,
  })
  useEffect(() => {
    if (query.hasNextPage && !query.isFetching && !query.isFetchNextPageError) void query.fetchNextPage()
  }, [query.hasNextPage, query.isFetching, query.isFetchNextPageError, query.fetchNextPage])
  const rows = query.data?.pages.flatMap(result => result.items) ?? []
  const last = Math.max(1, Math.ceil(rows.length / pageSize))
  const current = Math.min(page, last)
  const start = (current - 1) * pageSize
  const visible = rows.slice(start, start + pageSize)
  return <div className="food-catalog doctor-food-catalog">
    <section className="users-table-card food-catalog-card" aria-label="بانک غذا">
      <header className="food-table-toolbar">
        <div className="food-table-search">
          <label className="users-search"><Icon name="search" /><span className="sr-only">جست‌وجوی نام یا شناسه غذا</span>
            <input type="search" placeholder="جست‌وجوی نام یا slug…" value={search}
              onChange={event => { setSearch(event.target.value); setPage(1) }} /></label>
          {query.data && <p role="status">{formatFaNumber(rows.length)} غذا{query.hasNextPage ? ' تا اینجا؛ در حال بارگذاری…' : ''}</p>}
        </div>
        <div className="food-catalog-filters">
          <select aria-label="دسته غذا" value={category} onChange={event => { setCategory(event.target.value); setPage(1) }}>
            <option value="">همهٔ دسته‌ها</option>{Object.entries(categories).map(([key, name]) => <option key={key} value={key}>{name}</option>)}
          </select>
          <select aria-label="وضعیت غذا" value={active} onChange={event => { setActive(event.target.value); setPage(1) }}>
            <option value="">همهٔ وضعیت‌ها</option><option value="true">فعال</option><option value="false">غیرفعال</option>
          </select>
        </div>
      </header>
      <div className="users-table-scroll" role="region" aria-label="جدول غذاها" tabIndex={0}>
        <table><thead><tr>{['عکس', 'غذا', 'دسته', 'وعده‌ها', 'وضعیت', 'جزئیات'].map(title => <th scope="col" key={title}>{title}</th>)}</tr></thead>
          <tbody>{visible.map(food => <tr key={String(food.slug)}>
            <td><FoodImage key={String(food.image ?? '')} food={food} /></td>
            <td><div className="food-name"><strong>{display(food.nameFa)}</strong><small><bdi>{display(food.slug)}</bdi></small></div></td>
            <td>{categories[String(food.category)] ?? display(food.category)}</td>
            <td>{labels(food.mealTypes, meals) || '—'}</td>
            <td><span className="food-status" data-active={!!food.active}><i aria-hidden="true" />{food.active ? 'فعال' : 'غیرفعال'}</span></td>
            <td><button type="button" className="secondary" aria-label={`جزئیات ${display(food.nameFa)}`} onClick={() => setSelected(food)}><Icon name="eye" />جزئیات</button></td>
          </tr>)}
          {!visible.length && <tr><td colSpan={6} className="users-empty">{query.isPending ? 'در حال دریافت…' : query.isError ? foodError(query.error) : 'غذایی با این مشخصات پیدا نشد.'}</td></tr>}
          </tbody>
        </table>
      </div>
      {query.isError && <div className="food-catalog-message" role="alert"><p>{foodError(query.error)}</p>
        <button type="button" className="secondary" onClick={() => void (query.isFetchNextPageError ? query.fetchNextPage() : query.refetch())}>تلاش دوباره</button></div>}
      <footer className="users-pagination"><span role="status">{rows.length ? `${formatFaNumber(start + 1)} تا ${formatFaNumber(start + visible.length)} از ${formatFaNumber(rows.length)} مورد` : '۰ مورد'}</span>
        <div><button type="button" className="users-page-button" disabled={current === 1} onClick={() => setPage(current - 1)}><Icon name="chevron-right" />قبلی</button>
          <span className="users-current" aria-current="page">{formatFaNumber(current)}</span>
          <button type="button" className="users-page-button" disabled={current === last} onClick={() => setPage(current + 1)}>بعدی<Icon name="chevron-left" /></button></div>
      </footer>
    </section>
    {selected && <FoodDetails row={selected} preview={preview} close={() => setSelected(null)} />}
  </div>
}
