import { FormEvent, useEffect, useRef, useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { StaffError } from '@shared/api/staff-session'
import { asRows, formatFaNumber } from '@shared/utils'
import { AdminIcon as Icon } from '../../components/AdminIcon'
import { staff } from '../../session'
import './campaign-links.css'

type CampaignLink = { id: string; name: string; slug: string; source: string; active: boolean; opens: number }
type Modal = { kind: 'create' } | { kind: 'toggle'; link: CampaignLink } | { kind: 'delete'; link: CampaignLink } | null

const sources = [['telegram', 'تلگرام'], ['instagram', 'اینستاگرام'], ['whatsapp', 'واتساپ'], ['sms', 'پیامک'], ['other', 'سایر']] as const
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const pageSize = 10
const queryKey = ['admin-campaign-links']
const samples: CampaignLink[] = [
  { id: 'preview-hale', name: 'hale', slug: 'hale', source: 'instagram', active: true, opens: 2088 },
  { id: 'preview-telegram', name: 'تلگرام', slug: 'telegram', source: 'telegram', active: false, opens: 3 },
  { id: 'preview-instagram', name: 'اینستا', slug: 'instagram', source: 'instagram', active: false, opens: 3 },
]

function readLinks(payload: unknown): CampaignLink[] {
  return asRows(payload).flatMap((row) => {
    if (typeof row.id !== 'string' || typeof row.name !== 'string' || typeof row.slug !== 'string' || typeof row.source !== 'string') return []
    return [{ id: row.id, name: row.name, slug: row.slug, source: row.source, active: Boolean(row.active), opens: typeof row.opens === 'number' ? row.opens : 0 }]
  })
}

function linkUrl(origin: string, slug: string) {
  return `${origin}/go/${slug}`
}

function Dialog({ title, icon, close, children }: { title: string; icon: string; close: () => void; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => element?.close()
  }, [])
  return (
    <dialog ref={dialog} className="campaign-dialog" aria-labelledby="campaign-dialog-title" onCancel={(event) => { event.preventDefault(); close() }}>
      <header>
        <h2 id="campaign-dialog-title"><span className="icon-tile tone-green"><Icon name={icon} /></span>{title}</h2>
        <button type="button" className="icon-button" aria-label="بستن" onClick={close}><Icon name="close" /></button>
      </header>
      {children}
    </dialog>
  )
}

export function CampaignLinksPage({ preview }: { preview: boolean }) {
  const queryClient = useQueryClient()
  const origin = preview ? 'https://my-diet.ir' : window.location.origin
  const live = useQuery({ queryKey, queryFn: async () => readLinks(await staff.api('admin/campaign-links')), enabled: !preview })
  const [localLinks, setLocalLinks] = useState(samples)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const [modal, setModal] = useState<Modal>(null)
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [slug, setSlug] = useState('')
  const links = preview ? localLinks : live.data ?? []
  const needle = query.trim().toLocaleLowerCase('fa')
  const filtered = links.filter((link) => !needle || [link.name, link.source, link.slug, linkUrl(origin, link.slug)].some((value) => value.toLocaleLowerCase('fa').includes(needle)))
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, pageCount - 1)
  const visible = filtered.slice(safePage * pageSize, (safePage + 1) * pageSize)

  function tell(message: string) {
    setNotice(message)
  }

  async function copy(link: CampaignLink) {
    const url = linkUrl(origin, link.slug)
    try {
      await navigator.clipboard.writeText(url)
      tell('لینک کپی شد')
    } catch {
      tell('کپی خودکار ممکن نیست؛ آدرس جدول را کپی کنید')
    }
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const name = String(data.get('name') ?? '').trim()
    const source = String(data.get('source') ?? '')
    const nextSlug = slug.trim().toLowerCase()
    if (!name) { tell('نام لینک را وارد کنید.'); return }
    if (!slugPattern.test(nextSlug)) { tell('پسوند لینک و منبع را با حروف انگلیسی، عدد و خط تیره وارد کنید'); return }
    if (links.some((link) => link.slug === nextSlug)) { tell('این پسوند قبلاً استفاده شده؛ پسوند دیگری انتخاب کنید'); return }
    setBusy(true)
    try {
      if (preview) {
        setLocalLinks((current) => [{ id: `preview-${nextSlug}`, name, slug: nextSlug, source, active: true, opens: 0 }, ...current])
      } else {
        await staff.api('admin/campaign-links', 'POST', { name, slug: nextSlug, source })
        await queryClient.invalidateQueries({ queryKey })
      }
      setModal(null)
      setSlug('')
      tell('لینک ساخته شد؛ می‌توانید آن را کپی کنید')
    } catch (cause) {
      tell(cause instanceof StaffError ? cause.message : 'ساخت لینک انجام نشد.')
    } finally {
      setBusy(false)
    }
  }

  async function toggle(link: CampaignLink) {
    setBusy(true)
    try {
      if (preview) {
        setLocalLinks((current) => current.map((item) => item.id === link.id ? { ...item, active: !item.active } : item))
      } else {
        await staff.api(`admin/campaign-links/${link.id}`, 'PATCH', { active: !link.active })
        await queryClient.invalidateQueries({ queryKey })
      }
      setModal(null)
      tell('وضعیت لینک تغییر کرد')
    } catch (cause) {
      tell(cause instanceof StaffError ? cause.message : 'تغییر وضعیت انجام نشد.')
    } finally {
      setBusy(false)
    }
  }

  async function remove(link: CampaignLink) {
    setBusy(true)
    try {
      if (preview) {
        setLocalLinks((current) => current.filter((item) => item.id !== link.id))
      } else {
        await staff.api(`admin/campaign-links/${link.id}`, 'DELETE')
        await queryClient.invalidateQueries({ queryKey })
      }
      setModal(null)
      tell('لینک حذف شد')
    } catch (cause) {
      tell(cause instanceof StaffError ? cause.message : 'حذف لینک انجام نشد.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="campaign-links">
      <section className="campaign-create-bar">
        <button type="button" onClick={() => { setSlug(''); setModal({ kind: 'create' }) }}>ساخت لینک جدید<Icon name="plus" /></button>
      </section>
      <div className="info-note" role="note"><Icon name="info" /><p>لینک غیرفعال، بازدیدکننده را به دمو نمی‌فرستد. صفحه‌های بازشده قبلی و آدرس عمومی دمو همچنان در دسترس هستند. آمار نشست‌ها را در «رهگیری سایت دمو ← کانال‌های ورودی» بر اساس منبع و کمپین ببینید.</p></div>
      {notice && <p className="campaign-notice" role="status">{notice}</p>}
      {!preview && live.isLoading && <p>در حال دریافت لینک‌ها</p>}
      {!preview && live.isError && <p>{live.error instanceof StaffError ? live.error.message : 'فهرست لینک‌ها دریافت نشد.'}</p>}
      <section className="card data-panel">
        <div className="section-head"><div><h2>لینک‌های تبلیغاتی</h2><p>تعداد بازشدن شامل درخواست ربات‌ها و پیش‌نمایش پیام‌رسان‌ها هم می‌شود؛ برابر با تعداد کاربران نیست.</p></div></div>
        <div className="table-toolbar">
          <div className="search-field">
            <Icon name="search" />
            <input type="search" aria-label="جستجو در لینک‌های تبلیغاتی" placeholder="جستجو در لینک‌های تبلیغاتی…" value={query} onChange={(event) => { setQuery(event.target.value); setPage(0) }} />
          </div>
        </div>
        <div className="table-wrap" tabIndex={0} role="region" aria-label="لینک‌های تبلیغاتی">
          <table>
            <thead><tr>{['نام', 'منبع', 'لینک / کمپین', 'وضعیت', 'بازشدن لینک', 'عملیات'].map((label) => <th key={label} scope="col">{label}</th>)}</tr></thead>
            <tbody>
              {visible.length ? visible.map((link) => (
                <tr key={link.id}>
                  <td>{link.name}</td>
                  <td>{link.source}</td>
                  <td><span className="campaign-link">{linkUrl(origin, link.slug)}</span></td>
                  <td>{link.active ? 'فعال' : 'غیرفعال'}</td>
                  <td>{formatFaNumber(link.opens)}</td>
                  <td><div className="campaign-row-actions">
                    <button type="button" className="secondary" onClick={() => copy(link)}>کپی لینک</button>
                    <button type="button" className="secondary" onClick={() => setModal({ kind: 'toggle', link })}>{link.active ? 'غیرفعال کردن' : 'فعال کردن'}</button>
                    <button type="button" className="secondary campaign-delete" onClick={() => setModal({ kind: 'delete', link })}><Icon name="trash" />حذف</button>
                  </div></td>
                </tr>
              )) : <tr><td className="empty-cell" colSpan={6}><div className="empty-state"><h3>{needle ? 'نتیجه‌ای پیدا نشد' : 'هنوز لینکی نساخته‌اید'}</h3><p>{needle ? 'عبارت جستجو را تغییر دهید.' : 'برای تبلیغات هر کانال یک پسوند جدا بسازید.'}</p></div></td></tr>}
            </tbody>
          </table>
        </div>
        <div className="campaign-footer">
          <span>{filtered.length ? `${formatFaNumber(safePage * pageSize + 1)} تا ${formatFaNumber(Math.min((safePage + 1) * pageSize, filtered.length))} از ${formatFaNumber(filtered.length)} مورد` : '۰ مورد'}</span>
          <div className="campaign-pager">
            <button type="button" className="secondary" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}><Icon name="chevron-right" />قبلی</button>
            <span className="page-number">{formatFaNumber(safePage + 1)}</span>
            <button type="button" className="secondary" disabled={(safePage + 1) * pageSize >= filtered.length} onClick={() => setPage(safePage + 1)}>بعدی<Icon name="chevron-left" /></button>
          </div>
        </div>
      </section>
      {modal?.kind === 'create' && <Dialog title="ساخت لینک تبلیغاتی" icon="history" close={() => !busy && setModal(null)}>
        <form onSubmit={create}>
          <label>نام لینک<input name="name" maxLength={120} required autoFocus /></label>
          <label>کانال ورودی<select name="source" defaultValue="telegram">{sources.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>پسوند دلخواه لینک<input name="slug" dir="ltr" maxLength={64} required placeholder="telegram-summer" value={slug} onChange={(event) => setSlug(event.target.value.toLowerCase())} /></label>
          <p className="form-help">حروف کوچک انگلیسی، عدد و خط تیره؛ پس از ساخت قابل تغییر نیست.</p>
          <p className="campaign-preview">{slug ? linkUrl(origin, slug) : `${origin}/go/…`}</p>
          <div className="campaign-dialog-actions">
            <button type="button" className="secondary" disabled={busy} onClick={() => setModal(null)}>انصراف</button>
            <button type="submit" disabled={busy}>{busy ? 'در حال انجام…' : 'ساخت لینک'}<Icon name="plus" /></button>
          </div>
        </form>
      </Dialog>}
      {modal?.kind === 'toggle' && <Dialog title={modal.link.active ? 'غیرفعال کردن لینک' : 'فعال کردن لینک'} icon="sliders" close={() => !busy && setModal(null)}>
        <form onSubmit={(event) => { event.preventDefault(); void toggle(modal.link) }}>
          <p>{modal.link.active ? 'پس از تأیید، ورودهای جدید از این لینک متوقف می‌شوند.' : 'این لینک دوباره به صفحه دمو هدایت خواهد شد.'}</p>
          <div className="campaign-dialog-actions">
            <button type="button" className="secondary" disabled={busy} onClick={() => setModal(null)}>انصراف</button>
            <button type="submit" disabled={busy}><Icon name="check" />{busy ? 'در حال انجام…' : 'تأیید'}</button>
          </div>
        </form>
      </Dialog>}
      {modal?.kind === 'delete' && <Dialog title="حذف لینک تبلیغاتی" icon="trash" close={() => !busy && setModal(null)}>
        <form onSubmit={(event) => { event.preventDefault(); void remove(modal.link) }}>
          <p>لینک «{modal.link.name}» حذف می‌شود و آدرس {linkUrl(origin, modal.link.slug)} دیگر به دمو هدایت نمی‌کند.</p>
          <div className="campaign-dialog-actions">
            <button type="button" className="secondary" disabled={busy} onClick={() => setModal(null)}>انصراف</button>
            <button type="submit" className="danger" disabled={busy}>{busy ? 'در حال انجام…' : 'حذف لینک'}</button>
          </div>
        </form>
      </Dialog>}
    </div>
  )
}
