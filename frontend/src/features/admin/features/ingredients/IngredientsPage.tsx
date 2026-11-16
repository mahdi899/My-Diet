import { useDeferredValue, useEffect, useRef, useState } from 'react'
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { asRecord, asRows, formatFaNumber } from '@shared/utils'
import { AdminIcon as Icon } from '../../components/AdminIcon'
import { staff } from '../../session'
import { foodError } from '../foods/catalog'
import '../users/users.css'
import '../foods/foods.css'
import { IngredientDialog, categories, type Ingredient } from './IngredientDialog'
import './ingredients.css'

const path = 'admin/ingredients'
const pageSize = 15
const columns = ['کد', 'مادهٔ اولیه', 'دسته', 'رسپی‌ها', 'عملیات']
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
  const client = useQueryClient()
  const [modal, setModal] = useState<{ item: Ingredient; mode: 'edit' | 'delete' } | null>(null)
  const [notice, setNotice] = useState('')
  const filterRef = useRef<HTMLDetailsElement>(null)
  useEffect(() => {
    const outside = (event: PointerEvent) => { if (!filterRef.current?.contains(event.target as Node)) filterRef.current?.removeAttribute('open') }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [])
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
    {notice && <p role="status" className="info-note">{notice}</p>}
    <section className="users-table-card food-catalog-card" aria-label="مواد اولیه">
    <div className="users-toolbar"><div className="users-controls">
      <label className="users-search"><Icon name="search" /><span className="sr-only">جست‌وجوی نام یا کد مادهٔ اولیه</span>
        <input type="search" placeholder="جست‌وجوی نام یا کد…" value={search} onChange={event => { setSearch(event.target.value); setPage(1) }} /></label>
      <div className="users-filter-actions">{(category || search) && <button className="users-clear-filters" onClick={() => { setCategory(''); setSearch(''); setPage(1) }}>حذف فیلترها<Icon name="close" /></button>}<details className="ingredient-filter" ref={filterRef} onKeyDown={event => { if (event.key === 'Escape') { filterRef.current?.removeAttribute('open'); filterRef.current?.querySelector('summary')?.focus() } }}><summary aria-label="فیلتر دستهٔ مواد اولیه" title="فیلتر دستهٔ مواد اولیه"><svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M3 4h18l-7 8v6l-4 2v-8L3 4Z" /></svg>{category && <span className="users-filter-dot" />}</summary><div className="users-status-menu">{[['', 'همهٔ دسته‌ها'], ...Object.entries(categories)].map(([value, label]) => <button type="button" key={value} aria-pressed={category === value} onClick={() => { setCategory(value!); setPage(1); filterRef.current?.removeAttribute('open'); filterRef.current?.querySelector('summary')?.focus() }}>{label}{category === value && <Icon name="check" />}</button>)}</div></details></div>
    </div></div>
      {query.data ? <>
        <div className="users-table-scroll" role="region" aria-label="جدول مواد اولیه" tabIndex={0}>
          <table><thead><tr>{columns.map(title => <th scope="col" key={title}>{title}</th>)}</tr></thead>
            <tbody>{visible.map(item => <tr key={item.code}>
              <td><bdi>{item.code}</bdi></td>
              <td><strong>{item.nameFa}</strong></td>
              <td>{categories[item.category] ?? item.category}</td>
              <td>{number(item.recipeCount)}</td>
              <td><div className="users-actions"><button type="button" className="users-action" aria-label={`ویرایش ${item.nameFa}`} onClick={() => setModal({ item, mode: 'edit' })}><Icon name="pencil" /></button><button type="button" className="users-action users-delete" aria-label={`حذف ${item.nameFa}`} onClick={() => setModal({ item, mode: 'delete' })}><Icon name="trash" /></button></div></td>
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
    {modal && <IngredientDialog item={modal.item} mode={modal.mode} preview={preview} close={() => setModal(null)} saved={() => { setNotice(modal.mode === 'edit' ? 'مادهٔ اولیه به‌روز شد.' : 'مادهٔ اولیه حذف شد.'); setModal(null); void client.invalidateQueries({ queryKey: ['admin-ingredients'] }); void client.invalidateQueries({ queryKey: ['admin-food-catalog'] }) }} />}
  </div>
}
