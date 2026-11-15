import { useDeferredValue, useEffect, useState } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { asRecord, asRows, formatFaNumber } from '@shared/utils'
import { AdminIcon as Icon } from '../../components/AdminIcon'
import { staff } from '../../session'
import { foodError } from '../foods/catalog'
import '../users/users.css'
import '../foods/foods.css'

const path = 'admin/ingredients'
const pageSize = 15
const columns = ['کد', 'مادهٔ اولیه', 'دسته', 'مرجع تغذیه', 'رسپی‌ها']
const categories: Record<string, string> = {
  dairy: 'لبنیات', grains: 'غلات', other: 'سایر', pantry: 'خواربار', produce: 'سبزی و میوه', protein: 'پروتئین',
}
const normalize = (value: string) => value.trim().toLowerCase().replace(/ي/g, 'ی').replace(/ك/g, 'ک')
const number = (value: number) => formatFaNumber(value)

const sampleIngredients = [
  { code: 'ING-0001', nameFa: 'برنج خشک', category: 'grains', nutritionReference: 'مرجع نمونهٔ غلات', recipeCount: 120 },
  { code: 'ING-0002', nameFa: 'سینه مرغ خام بدون پوست', category: 'protein', nutritionReference: 'مرجع نمونهٔ پروتئین', recipeCount: 80 },
  { code: 'ING-0003', nameFa: 'ماست کم‌چرب', category: 'dairy', nutritionReference: null, recipeCount: 24 },
  { code: 'ING-0004', nameFa: 'روغن', category: 'pantry', nutritionReference: 'مرجع نمونهٔ خواربار', recipeCount: 200 },
  { code: 'ING-0005', nameFa: 'پیاز پوست‌گرفته', category: 'produce', nutritionReference: null, recipeCount: 150 },
  { code: 'ING-0006', nameFa: 'آب', category: 'other', nutritionReference: null, recipeCount: 40 },
]

type Ingredient = { code: string; nameFa: string; category: string; nutritionReference: string | null; recipeCount: number }

function asIngredient(row: Record<string, unknown>): Ingredient | null {
  if (typeof row.code !== 'string' || typeof row.nameFa !== 'string' || typeof row.category !== 'string') return null
  return {
    code: row.code,
    nameFa: row.nameFa,
    category: row.category,
    nutritionReference: typeof row.nutritionReference === 'string' ? row.nutritionReference : null,
    recipeCount: Number(row.recipeCount ?? 0),
  }
}

export function IngredientsPage({ preview }: { preview: boolean }) {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [page, setPage] = useState(1)
  const term = useDeferredValue(search.trim())
  const query = useInfiniteQuery({
    queryKey: ['admin-ingredients', preview, term, category],
    initialPageParam: '',
    queryFn: async ({ pageParam }) => {
      if (preview) {
        const items = sampleIngredients.filter(item => (!category || item.category === category)
          && [item.nameFa, item.code].some(value => normalize(value).includes(normalize(term))))
        return { items, cursor: '' }
      }
      const params = new URLSearchParams({ limit: '200' })
      if (term) params.set('q', term)
      if (category) params.set('category', category)
      if (pageParam) params.set('cursor', pageParam)
      const payload = asRecord(await staff.api(path + '?' + params))
      return {
        items: asRows(payload?.items).flatMap(row => { const item = asIngredient(row); return item ? [item] : [] }),
        cursor: typeof payload?.nextCursor === 'string' ? payload.nextCursor : '',
      }
    },
    getNextPageParam: last => last.cursor || undefined,
  })
  useEffect(() => {
    if (query.hasNextPage && !query.isFetching && !query.isFetchNextPageError) void query.fetchNextPage()
  }, [query.hasNextPage, query.isFetching, query.isFetchNextPageError, query.fetchNextPage])
  const rows = query.data?.pages.flatMap(result => result.items) ?? []
  const last = Math.max(1, Math.ceil(rows.length / pageSize))
  const current = Math.min(last, page)
  const start = (current - 1) * pageSize
  const visible = rows.slice(start, start + pageSize)

  return <div className="food-catalog ingredient-catalog">
    <div className="food-catalog-filters">
      <label className="users-search"><Icon name="search" /><span className="sr-only">جست‌وجوی نام یا کد مادهٔ اولیه</span>
        <input type="search" placeholder="جست‌وجوی نام یا کد…" value={search} onChange={event => { setSearch(event.target.value); setPage(1) }} /></label>
      <select aria-label="دسته ماده اولیه" value={category} onChange={event => { setCategory(event.target.value); setPage(1) }}>
        <option value="">همهٔ دسته‌ها</option>{Object.entries(categories).map(([key, name]) => <option key={key} value={key}>{name}</option>)}
      </select>
    </div>
    <section className="users-table-card food-catalog-card" aria-label="مواد اولیه">
      <header><h2>مواد اولیه</h2>{query.data && <p>{number(rows.length)} ماده{query.hasNextPage ? ' تا اینجا؛ بقیه در حال بارگذاری است' : ''}</p>}</header>
      {query.data ? <>
        <div className="users-table-scroll" role="region" aria-label="جدول مواد اولیه" tabIndex={0}>
          <table><thead><tr>{columns.map(title => <th scope="col" key={title}>{title}</th>)}</tr></thead>
            <tbody>{visible.map(item => <tr key={item.code}>
              <td><bdi>{item.code}</bdi></td>
              <td><strong>{item.nameFa}</strong></td>
              <td>{categories[item.category] ?? item.category}</td>
              <td className="ingredient-reference">{item.nutritionReference || '—'}</td>
              <td>{number(item.recipeCount)}</td>
            </tr>)}{!visible.length && <tr><td colSpan={columns.length} className="users-empty">مادهٔ اولیه‌ای با این مشخصات پیدا نشد.</td></tr>}</tbody>
          </table>
        </div>
        <footer className="users-pagination"><span role="status">{rows.length ? `${number(start + 1)} تا ${number(start + visible.length)} از ${number(rows.length)} مورد` : '۰ مورد'}</span>
          <div><button type="button" className="users-page-button" disabled={current === 1} onClick={() => setPage(current - 1)}><Icon name="chevron-right" />قبلی</button>
            <span className="users-current" aria-current="page">{number(current)}</span>
            <button type="button" className="users-page-button" disabled={current === last} onClick={() => setPage(current + 1)}>بعدی<Icon name="chevron-left" /></button></div>
        </footer>
      </> : <div className="food-catalog-message">{query.isError ? <>
        <p role="alert">{foodError(query.error)}</p><button type="button" className="secondary" onClick={() => void query.refetch()}>تلاش دوباره</button>
      </> : <p role="status">در حال دریافت…</p>}</div>}
    </section>
  </div>
}
