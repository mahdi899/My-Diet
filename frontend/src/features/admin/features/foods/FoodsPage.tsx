import { useDeferredValue, useEffect, useState } from 'react'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { asRecord, asRows, formatFaNumber } from '@shared/utils'
import { AdminIcon as Icon } from '../../components/AdminIcon'
import { staff } from '../../session'
import { CatalogImport, FoodEditor } from './FoodDialogs'
import { categories, display, exportFoodFile, foodError, foodPath, meals, sampleFoods, values, type FoodRow } from './catalog'
import '../users/users.css'
import './foods.css'
import { FoodImage } from './FoodImage'

const catalogKey = ['admin-food-catalog']
const pageSize = 15
const columns = ['عکس', 'غذا', 'دسته', 'وعده‌ها', 'وضعیت', 'عملیات']
const normalize = (value: string) => value.trim().toLowerCase().replace(/ي/g, 'ی').replace(/ك/g, 'ک')
const number = (value: unknown) => value == null ? '—' : formatFaNumber(Number(value))

type Modal = { kind: 'editor'; food: FoodRow | null } | { kind: 'import' | 'replace' }

export function FoodsPage({ preview }: { preview: boolean }) {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [modal, setModal] = useState<Modal | null>(null)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const term = useDeferredValue(search.trim())
  const client = useQueryClient()
  const query = useInfiniteQuery({
    queryKey: [...catalogKey, preview, term, category, status],
    initialPageParam: '',
    queryFn: async ({ pageParam }) => {
      if (preview) return { items: sampleFoods.filter(food => (!category || food.category === category)
        && (!status || String(food.active) === status)
        && [food.nameFa, food.slug].some(value => normalize(String(value)).includes(normalize(term)))), cursor: '' }
      const params = new URLSearchParams({ limit: '100' })
      if (term) params.set('q', term)
      if (category) params.set('category', category)
      if (status) params.set('active', status)
      if (pageParam) params.set('cursor', pageParam)
      const payload = asRecord(await staff.api(foodPath + '?' + params))
      return { items: asRows(payload?.items), cursor: typeof payload?.nextCursor === 'string' ? payload.nextCursor : '' }
    },
    getNextPageParam: last => last.cursor || undefined,
  })
  useEffect(() => {
    if (query.hasNextPage && !query.isFetching && !query.isFetchNextPageError) void query.fetchNextPage()
  }, [query.hasNextPage, query.isFetching, query.isFetchNextPageError, query.fetchNextPage])
  function saved(message: string) {
    setModal(null)
    setNotice(message)
    setError('')
    void client.invalidateQueries({ queryKey: catalogKey })
  }
  const toggle = useMutation({
    mutationFn: (food: FoodRow) => staff.api(`${foodPath}/${encodeURIComponent(String(food.slug))}/active`, 'POST', { active: !food.active }),
    onSuccess: () => saved('وضعیت غذا تغییر کرد.'),
    onError: cause => setError(foodError(cause)),
  })
  const download = useMutation({ mutationFn: exportFoodFile, onError: cause => setError(foodError(cause)) })
  const rows = query.data?.pages.flatMap(result => result.items) ?? []
  const last = Math.max(1, Math.ceil(rows.length / pageSize))
  const current = Math.min(last, page)
  const start = (current - 1) * pageSize
  const visible = rows.slice(start, start + pageSize)

  return <div className="food-catalog">
    <div className="food-catalog-tools">
      <button type="button" onClick={() => setModal({ kind: 'editor', food: null })}><Icon name="plus" />غذای جدید</button>
      <button type="button" className="secondary" onClick={() => setModal({ kind: 'import' })}><Icon name="send" />درون‌ریزی CSV</button>
      <button type="button" className="secondary" disabled={preview || download.isPending} onClick={() => { setError(''); download.mutate('csv') }}><Icon name="clipboard" />خروجی CSV</button>
      <button type="button" className="secondary" disabled={preview || download.isPending} onClick={() => { setError(''); download.mutate('json') }}><Icon name="clipboard" />پشتیبان کامل JSON</button>
      <button type="button" className="secondary" onClick={() => setModal({ kind: 'replace' })}><Icon name="send" />جایگزینی کاتالوگ</button>
    </div>
    {notice && <p className="info-note" role="status">{notice}</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <section className="users-table-card food-catalog-card" aria-label="کاتالوگ غذاهای ایرانی">
      <header className="food-table-toolbar">
        <div className="food-table-search">
      <label className="users-search"><Icon name="search" /><span className="sr-only">جست‌وجوی نام یا شناسه غذا</span>
        <input type="search" placeholder="جست‌وجوی نام یا slug…" value={search} onChange={event => { setSearch(event.target.value); setPage(1) }} /></label>
          {query.data && <p role="status">{number(rows.length)} غذا{query.hasNextPage ? ' تا اینجا؛ در حال بارگذاری…' : ''}</p>}
        </div>
        <div className="food-catalog-filters">

      <select aria-label="دسته غذا" value={category} onChange={event => { setCategory(event.target.value); setPage(1) }}>
        <option value="">همهٔ دسته‌ها</option>{Object.entries(categories).map(([key, name]) => <option key={key} value={key}>{name}</option>)}
      </select>
      <select aria-label="وضعیت غذا" value={status} onChange={event => { setStatus(event.target.value); setPage(1) }}>
        <option value="">همهٔ وضعیت‌ها</option><option value="true">فعال</option><option value="false">غیرفعال</option>
      </select>
        </div>
      </header>
      {query.data ? <>
        <div className="users-table-scroll" role="region" aria-label="جدول غذاها" tabIndex={0}>
          <table><thead><tr>{columns.map(title => <th scope="col" key={title}>{title === 'عملیات' ? <span className="sr-only">{title}</span> : title}</th>)}</tr></thead>
            <tbody>{visible.map(food => <tr key={String(food.slug)}>
              <td><FoodImage key={String(food.image ?? '')} food={food} /></td>
              <td><div className="food-name"><strong>{display(food.nameFa)}</strong><small><bdi>{display(food.slug)}</bdi></small></div></td>
              <td>{categories[String(food.category)] ?? display(food.category)}</td>
              <td>{values(food.mealTypes).map(key => meals[key] ?? key).join('، ') || '—'}</td>
              <td><span className="food-status" data-active={!!food.active}><i aria-hidden="true" />{food.active ? 'فعال' : 'غیرفعال'}</span></td>
              <td><div className="food-row-actions">
                <button type="button" aria-label={`ویرایش ${food.nameFa}`} onClick={() => setModal({ kind: 'editor', food })}><Icon name="sliders" />ویرایش</button>
                <button type="button" disabled={preview || toggle.isPending} aria-label={`${food.active ? 'غیرفعال کردن' : 'فعال کردن'} ${food.nameFa}`}
                  onClick={() => { setNotice(''); setError(''); toggle.mutate(food) }}>{food.active ? 'غیرفعال' : 'فعال'}</button>
              </div></td>
            </tr>)}{!visible.length && <tr><td colSpan={columns.length} className="users-empty">غذایی با این مشخصات پیدا نشد.</td></tr>}</tbody>
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
    {query.hasNextPage && <div>{query.isFetchNextPageError && <p role="alert">{foodError(query.error)}</p>}
      <button type="button" className="secondary" disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>
        {query.isFetchingNextPage ? 'در حال دریافت…' : 'بارگذاری بیشتر'}
      </button></div>}
    {modal?.kind === 'editor' && <FoodEditor food={modal.food} preview={preview} close={() => setModal(null)} saved={saved} />}
    {(modal?.kind === 'import' || modal?.kind === 'replace') && <CatalogImport replace={modal.kind === 'replace'} preview={preview} close={() => setModal(null)} saved={saved} />}
  </div>
}
