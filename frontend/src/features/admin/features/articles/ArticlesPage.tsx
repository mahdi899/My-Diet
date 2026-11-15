import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { asRecord, asRows, formatFaNumber } from '@shared/utils'
import { AdminIcon as Icon } from '../../components/AdminIcon'
import { staff } from '../../session'
import '../users/users.css'
import './articles.css'

type Article = Record<string, unknown>
type Section = { key: number; heading: string; body: string }
type Selection = { kind: 'edit'; article?: Article } | { kind: 'status'; article: Article }
const path = 'admin/articles'
const queryKey = ['admin-articles']
const pageSize = 12
const slugPattern = '[a-z0-9]+(?:-[a-z0-9]+)*'
const covers = ['سالاد', 'سبزیجات', 'صبحانه', 'کاسهٔ غذا']
const text = (value: unknown) => String(value ?? '')
const failure = (cause: unknown) => cause instanceof Error ? cause.message : 'عملیات انجام نشد.'
const sampleArticles = [
  ['weekly-planning', 'یک هفته غذای خوب؛ بدون سردرگمی', 'برنامه‌ریزی غذایی'],
  ['balanced-plate', 'بشقاب متعادل از کجا شروع می‌شود؟', 'تغذیه سالم'],
  ['small-habits', 'عادت‌های کوچک برای روزهای پرمشغله', 'سبک زندگی'],
  ['shopping-list', 'یک فهرست خرید، چند وعدهٔ متفاوت', 'برنامه‌ریزی غذایی'],
  ['colorful-plate', 'رنگ‌های بیشتر، انتخاب‌های متنوع‌تر', 'تغذیه سالم'],
  ['mindful-meals', 'برای وعدهٔ غذایی‌ات کمی وقت بگذار', 'سبک زندگی'],
].map(([id, title, category], index) => ({
  id, title, category, status: index === 4 ? 'draft' : 'published', image: index % covers.length,
  readingMinutes: 5, intro: 'خلاصهٔ آزمایشی برای نمایش فرم مقاله.',
  sections: [{ heading: 'شروع آسان', body: 'این متن نمونه برای پیش‌نمایش مقاله است.' }],
}))

function ArticleDialog({ title, busy, close, children }: { title: string; busy: boolean; close: () => void; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    element?.querySelector<HTMLInputElement>('input')?.focus()
    return () => element?.close()
  }, [])
  return <dialog ref={dialog} className="article-editor-dialog" aria-labelledby="article-dialog-title" onCancel={event => {
    event.preventDefault()
    if (!busy) close()
  }}>
    <header><h2 id="article-dialog-title"><span className="icon-tile tone-green"><Icon name="clipboard" /></span>{title}</h2>
      <button type="button" className="icon-button" aria-label="بستن" disabled={busy} onClick={close}><Icon name="close" /></button>
    </header>
    {children}
  </dialog>
}

function ArticleActions({ label, busy, preview, close }: { label: string; busy: boolean; preview: boolean; close: () => void }) {
  return <div className="article-editor-actions">
    <button type="submit" disabled={busy || preview}><Icon name="check" />{busy ? 'در حال انجام…' : label}</button>
    <button type="button" className="secondary" disabled={busy} onClick={close}>انصراف</button>
  </div>
}

type ModalProps = { preview: boolean; close: () => void; saved: (message: string) => void }

function ArticleEditor({ article, preview, close, saved }: ModalProps & { article?: Article }) {
  const [title, setTitle] = useState(text(article?.title))
  const [intro, setIntro] = useState(text(article?.intro))
  const [sections, setSections] = useState<Section[]>(() => {
    const existing = asRows(article?.sections)
    return existing.length ? existing.map((item, key) => ({ key, heading: text(item.heading), body: text(item.body) })) : [{ key: 0, heading: '', body: '' }]
  })
  const nextKey = useRef(sections.length)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  function editSection(key: number, change: Partial<Pick<Section, 'heading' | 'body'>>) {
    setSections(current => current.map(section => section.key === key ? { ...section, ...change } : section))
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (preview || busy) return
    const data = new FormData(event.currentTarget)
    const category = text(data.get('category')).trim()
    if (!title.trim() || !category || !intro.trim() || sections.some(section => !section.heading.trim() || !section.body.trim())) {
      setError('عنوان، دسته‌بندی، خلاصه و متن همهٔ بخش‌ها را کامل کنید.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const payload = {
        title: title.trim(), category, image: Number(data.get('image')), readingMinutes: Number(data.get('readingMinutes')),
        intro: intro.trim(), sections: sections.map(({ heading, body }) => ({ heading: heading.trim(), body: body.trim() })),
      }
      if (article) await staff.api(`${path}/${encodeURIComponent(text(article.id))}`, 'PUT', payload)
      else await staff.api(path, 'POST', { ...payload, slug: text(data.get('slug')).trim() })
      saved(article ? 'تغییرات مقاله ذخیره شد.' : 'پیش‌نویس مقاله ذخیره شد.')
    } catch (cause) { setError(failure(cause)) }
    finally { setBusy(false) }
  }

  return <ArticleDialog title={article ? 'ویرایش مقاله' : 'افزودن مقاله'} busy={busy} close={close}>
    <form className="article-editor" onSubmit={submit}>
      <label>شناسهٔ آدرس<input name="slug" dir="ltr" pattern={slugPattern} maxLength={64} defaultValue={text(article?.id)}
        readOnly={!!article} required aria-describedby="article-slug-hint" />
        <small id="article-slug-hint">حروف کوچک انگلیسی، عدد و خط تیره، مانند <bdi>weekly-planning</bdi></small></label>
      <label>عنوان مقاله<input value={title} onChange={event => setTitle(event.target.value)} maxLength={120} required /></label>
      <label>دسته‌بندی<input name="category" defaultValue={text(article?.category)} maxLength={40} required /></label>
      <label>تصویر روی جلد<select name="image" defaultValue={text(article?.image ?? 0)}>
        {covers.map((cover, index) => <option key={cover} value={index}>{cover}</option>)}
      </select></label>
      <label>زمان مطالعه (دقیقه)<input name="readingMinutes" type="number" min={1} max={60}
        defaultValue={text(article?.readingMinutes ?? 5)} required /></label>
      <label>خلاصه<textarea value={intro} onChange={event => setIntro(event.target.value)} rows={3} maxLength={400} required /></label>
      {sections.map(section => <fieldset className="article-section-fields" key={section.key}>
        <legend>بخش مقاله</legend>
        <label>تیتر بخش<input value={section.heading} onChange={event => editSection(section.key, { heading: event.target.value })} maxLength={120} required /></label>
        <label>متن بخش<textarea rows={5} value={section.body} onChange={event => editSection(section.key, { body: event.target.value })} maxLength={2000} required /></label>
        <button type="button" className="secondary" disabled={busy || sections.length === 1}
          onClick={() => setSections(current => current.filter(item => item.key !== section.key))}>حذف بخش</button>
      </fieldset>)}
      <div><button type="button" className="secondary" disabled={busy || sections.length >= 8} onClick={() => {
        const key = nextKey.current++
        setSections(current => [...current, { key, heading: '', body: '' }])
      }}><Icon name="plus" />افزودن بخش</button></div>
      <details className="article-text-preview"><summary>پیش‌نمایش متن</summary>
        <h3>{title || 'عنوان مقاله'}</h3><p>{intro}</p>
        {sections.map(section => <section key={section.key}><h4>{section.heading}</h4><p>{section.body}</p></section>)}
      </details>
      {error && <p className="form-error" role="alert">{error}</p>}
      <ArticleActions label={article?.status === 'published' ? 'ذخیره تغییرات مقالهٔ منتشرشده' : 'ذخیره پیش‌نویس'} busy={busy} preview={preview} close={close} />
    </form>
  </ArticleDialog>
}

function ArticleStatus({ article, preview, close, saved }: ModalProps & { article: Article }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const publish = article.status !== 'published'
  const label = publish ? 'انتشار مقاله' : 'لغو انتشار'
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (preview || busy) return
    setBusy(true)
    setError('')
    try {
      await staff.api(`${path}/${encodeURIComponent(text(article.id))}/${publish ? 'publish' : 'unpublish'}`, 'POST')
      saved(publish ? 'مقاله منتشر شد.' : 'مقاله به پیش‌نویس برگشت.')
    } catch (cause) { setError(failure(cause)) }
    finally { setBusy(false) }
  }
  return <ArticleDialog title={label} busy={busy} close={close}>
    <form className="article-editor" onSubmit={submit}>
      <p>{text(article.title)}</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <ArticleActions label={label} busy={busy} preview={preview} close={close} />
    </form>
  </ArticleDialog>
}

export function ArticlesPage({ preview }: { preview: boolean }) {
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Selection | null>(null)
  const [notice, setNotice] = useState('')
  const client = useQueryClient()
  const query = useQuery({
    queryKey: [...queryKey, preview, status, page],
    queryFn: async () => {
      if (preview) {
        const items = sampleArticles.filter(article => !status || article.status === status)
        return { rows: items.slice((page - 1) * pageSize, page * pageSize), total: items.length }
      }
      const params = new URLSearchParams({ status, page: String(page), pageSize: String(pageSize) })
      const result = asRecord(await staff.api(path + '?' + params))
      return { rows: asRows(result?.items), total: Number(result?.total ?? 0) }
    },
  })
  const rows: Article[] = query.data?.rows ?? []
  const total = query.data?.total ?? 0
  const last = Math.max(1, Math.ceil(total / pageSize))
  useEffect(() => {
    if (query.isSuccess && page > last) setPage(last)
  }, [query.isSuccess, last, page])

  function saved(message: string) {
    setSelected(null)
    setNotice(message)
    void client.invalidateQueries({ queryKey })
  }
  return <div className="admin-articles-page">
    <div className="users-table-card article-tools">
      <label>وضعیت<select value={status} onChange={event => { setStatus(event.target.value); setPage(1) }}>
        <option value="">همه</option><option value="draft">پیش‌نویس</option><option value="published">منتشرشده</option>
      </select></label>
      <button type="button" onClick={() => setSelected({ kind: 'edit' })}><Icon name="plus" />افزودن مقاله</button>
    </div>
    {notice && <p className="info-note" role="status">{notice}</p>}
    <section className="users-table-card articles-table-card" aria-labelledby="articles-list-title">
      <header><h2 id="articles-list-title">فهرست مقالات</h2></header>
      {query.isPending ? <p className="article-list-feedback" role="status">در حال دریافت…</p> : query.isError ?
        <div className="article-list-feedback"><p role="alert">{failure(query.error)}</p>
          <button type="button" className="secondary" onClick={() => void query.refetch()}>تلاش دوباره</button></div> : <>
          <div className="users-table-scroll" role="region" aria-label="جدول مقالات" tabIndex={0}>
            <table><thead><tr>{['عنوان', 'دسته‌بندی', 'وضعیت', 'عملیات'].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead>
              <tbody>{rows.map(article => {
                const published = article.status === 'published'
                return <tr key={text(article.id)}><td>{text(article.title)}</td><td>{text(article.category)}</td>
                  <td>{published ? 'منتشرشده' : 'پیش‌نویس'}</td>
                  <td><div className="article-row-actions">
                    <button type="button" className="secondary" onClick={() => setSelected({ kind: 'edit', article })}>ویرایش</button>
                    <button type="button" className="secondary" onClick={() => setSelected({ kind: 'status', article })}>{published ? 'لغو انتشار' : 'انتشار'}</button>
                    {published && <a href={'/article.html?id=' + encodeURIComponent(text(article.id))} target="_blank" rel="noopener noreferrer">نمایش در سایت</a>}
                  </div></td></tr>
              })}
                {!rows.length && <tr><td colSpan={4} className="users-empty">مقاله‌ای در این وضعیت نیست.</td></tr>}
              </tbody>
            </table>
          </div>
          {last > 1 && <footer className="users-pagination"><span>صفحهٔ {formatFaNumber(page)} از {formatFaNumber(last)}</span>
            <div><button type="button" className="users-page-button" disabled={page === 1} onClick={() => setPage(page - 1)}><Icon name="chevron-right" />قبلی</button>
              <button type="button" className="users-page-button" disabled={page >= last} onClick={() => setPage(page + 1)}>بعدی<Icon name="chevron-left" /></button></div>
          </footer>}
        </>}
    </section>
    {selected?.kind === 'edit' && <ArticleEditor article={selected.article} preview={preview} close={() => setSelected(null)} saved={saved} />}
    {selected?.kind === 'status' && <ArticleStatus article={selected.article} preview={preview} close={() => setSelected(null)} saved={saved} />}
  </div>
}
