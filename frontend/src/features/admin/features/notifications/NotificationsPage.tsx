import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { asRecord, asRows, formatFaNumber } from '@shared/utils'
import { AdminIcon as Icon } from '../../components/AdminIcon'
import { StatusFilter } from '../../components/StatusFilter'
import { staff } from '../../session'
import { audienceLabel, CampaignForm, campaignStates, FirebaseForm, NotificationDialog, PushNote, pushDate, pushError, pushNumber, pushPath, type Campaign, type NotificationModal } from './NotificationDialog'
import '../users/users.css'
import './notifications.css'

const pageSize = 12
const columns = ['عنوان اعلان', 'وضعیت', 'مخاطبان', 'پذیرفته‌شده', 'کل گوشی‌ها', 'خطا / نامشخص', 'زمان ارسال · تهران', 'تاریخ ایجاد', 'عملیات']
const sample = { id: 'preview-notification', title: 'یادآوری آزمایشی', body: 'زمان ثبت گزارش هفتگی است.', audience: 'all', status: 'draft', accepted: 0, total: 0, failed: 0, createdAt: '2026-11-14T10:00:00Z' }

function PushBadge({ label, tone }: { label: string; tone: 'good' | 'pending' | 'neutral' | 'error' }) {
  return <span className="push-badge" data-tone={tone}><i aria-hidden="true" />{label}</span>
}

function CampaignBadge({ status }: { status: unknown }) {
  const value = String(status ?? '')
  return <PushBadge label={campaignStates[value] ?? (value || '—')} tone={value === 'failed' ? 'error' : value === 'completed' ? 'good' : value === 'draft' ? 'neutral' : 'pending'} />
}

export function NotificationsPage({ preview, modal, closeModal }: { preview: boolean; modal: NotificationModal; closeModal: () => void }) {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<{ campaign: Campaign; mode: 'details' | 'delete' } | null>(null)
  const [notice, setNotice] = useState('')
  const query = useQuery({
    queryKey: ['admin-push', 'overview', preview],
    queryFn: async () => {
      if (preview) return { overview: { configured: false, devices: 0, scheduled: 0 }, campaigns: [sample] }
      const [overview, campaigns] = await Promise.all([staff.api(pushPath + '/status'), staff.api(pushPath + '/campaigns')])
      return { overview: asRecord(overview), campaigns: asRows(campaigns) }
    },
  })
  function saved(message: string) {
    closeModal()
    setSelected(null)
    setNotice(message)
    void query.refetch()
  }
  const action = useMutation({
    mutationFn: async ({ campaign, mode }: NonNullable<typeof selected>) => {
      if (preview) return
      const path = `${pushPath}/campaigns/${encodeURIComponent(String(campaign.id))}`
      if (mode === 'delete') await staff.api(path, 'DELETE')
      else await staff.api(path + '/send', 'POST', {})
    },
    onSuccess: (_, { mode }) => saved(mode === 'delete' ? 'اعلان از فهرست حذف شد.' : 'اعلان در صف ارسال قرار گرفت.'),
  })
  function show(campaign: Campaign, mode: 'details' | 'delete') {
    action.reset()
    setSelected({ campaign, mode })
  }
  const overview = asRecord(query.data?.overview)
  const configured = overview?.configured === true
  const campaigns: Campaign[] = query.data?.campaigns ?? []
  const term = search.trim().toLowerCase()
  const filtered = campaigns.filter(campaign => (!status || campaign.status === status)
    && [campaign.title, campaign.body].some(value => String(value ?? '').toLowerCase().includes(term)))
  const last = Math.max(1, Math.ceil(filtered.length / pageSize))
  const current = Math.min(last, page)
  const start = (current - 1) * pageSize
  const visible = filtered.slice(start, start + pageSize)
  const entry = selected?.campaign

  return <div className="push-page-react">
    {notice && <p className="info-note" role="status">{notice}</p>}
    {query.isPending ? <p className="users-table-card push-feedback" role="status">در حال دریافت اعلان‌ها…</p> :
      query.isError && !query.data ? <div className="users-table-card push-feedback"><p role="alert">{pushError(query.error)}</p>
        <button type="button" className="secondary" onClick={() => void query.refetch()}>تلاش دوباره</button></div> : <>
        {query.isError && <div className="users-table-card push-feedback"><p role="alert">به‌روزرسانی اعلان‌ها انجام نشد.</p>
          <button type="button" className="secondary" onClick={() => void query.refetch()}>تلاش دوباره</button></div>}
        <section className="push-overview" aria-label="خلاصهٔ نوتیفیکیشن">
          <div className="push-overview-title"><span className="icon-tile tone-green"><Icon name="send" /></span>
            <div><h2>ارتباط مستقیم با کاربران</h2><p>اعلان بسازید، آزمایش کنید و نتیجه را ببینید.</p></div></div>
          <dl><div><dt>وضعیت سرویس</dt><dd><PushBadge label={configured ? 'Firebase تنظیم‌شده' : 'در انتظار اتصال'} tone={configured ? 'good' : 'pending'} />
            {typeof overview?.projectId === 'string' && overview.projectId && <bdi>{overview.projectId}</bdi>}</dd></div>
            <div><dt>گوشی‌های واجد شرایط</dt><dd>{pushNumber(overview?.devices)}</dd></div>
            <div><dt>اعلان‌های زمان‌بندی‌شده</dt><dd>{pushNumber(overview?.scheduled)}</dd></div></dl>
          <PushNote>{configured ? 'پذیرفته‌شده یعنی Firebase پیام را پذیرفته است. نمایش روی گوشی به تنظیمات دستگاه بستگی دارد.' :
            'پیش‌نویس‌ها را آماده کنید؛ پس از اتصال Firebase و ثبت دستگاه، ارسال واقعی فعال می‌شود.'}</PushNote>
        </section>
        <section className="users-table-card push-table-card" aria-labelledby="push-table-title">
          <header><h2 id="push-table-title">اعلان‌ها</h2><p>{formatFaNumber(campaigns.length)} اعلان در فهرست</p></header>
          <div className="users-toolbar"><div className="users-controls">
            <label className="users-search"><Icon name="search" /><span className="sr-only">جست‌وجو در اعلان‌ها</span>
              <input type="search" placeholder="جست‌وجو در اعلان‌ها…" value={search} onChange={event => { setSearch(event.target.value); setPage(1) }} /></label>
            <StatusFilter label="فیلتر وضعیت اعلان" value={status} options={Object.entries(campaignStates)} showSelection onChange={value => { setStatus(value); setPage(1) }} />
          </div></div>
          <div className="users-table-scroll" role="region" aria-label="جدول اعلان‌ها" tabIndex={0}>
            <table><thead><tr>{columns.map(column => <th key={column} scope="col">{column}</th>)}</tr></thead>
              <tbody>{visible.map(campaign => <tr key={String(campaign.id)}>
                <td><strong>{String(campaign.title ?? '—')}</strong><small>{String(campaign.body ?? '')}</small></td>
                <td><CampaignBadge status={campaign.status} /></td><td>{audienceLabel(campaign.audience)}</td>
                <td>{pushNumber(campaign.accepted)}</td><td>{pushNumber(campaign.total)}</td><td>{pushNumber(campaign.failed)}</td>
                <td>{pushDate(campaign.sentAt || campaign.scheduledAt)}</td><td>{pushDate(campaign.createdAt)}</td>
                <td><div className="push-row-actions"><button type="button" className="secondary" onClick={() => show(campaign, 'details')}><Icon name="eye" />جزئیات</button>
                  {campaign.status !== 'sending' && <button type="button" className="secondary push-delete" disabled={preview} onClick={() => show(campaign, 'delete')}><Icon name="trash" />حذف</button>}</div></td>
              </tr>)}
                {!visible.length && <tr><td colSpan={columns.length} className="push-empty-cell"><div className="push-empty">
                  <span className="icon-tile tone-green"><Icon name={campaigns.length ? 'search' : 'bell'} /></span>
                  <h3>{campaigns.length ? 'اعلانی پیدا نشد' : 'اولین پیام شما، شروع یک ارتباط'}</h3>
                  <p>{campaigns.length ? 'عبارت جست‌وجو یا وضعیت را تغییر دهید.' : 'با دکمهٔ «اعلان جدید» یک پیام بسازید و ابتدا آن را به‌صورت پیش‌نویس ذخیره کنید.'}</p>
                </div></td></tr>}
              </tbody>
            </table>
          </div>
          <footer className="users-pagination"><span role="status">{filtered.length ? `${formatFaNumber(start + 1)} تا ${formatFaNumber(start + visible.length)} از ${formatFaNumber(filtered.length)} مورد` : '۰ مورد'}</span>
            <div><button type="button" className="users-page-button" disabled={current === 1} onClick={() => setPage(current - 1)}><Icon name="chevron-right" />قبلی</button>
              <span className="users-current" aria-current="page">{formatFaNumber(current)}</span>
              <button type="button" className="users-page-button" disabled={current === last} onClick={() => setPage(current + 1)}>بعدی<Icon name="chevron-left" /></button></div>
          </footer>
        </section>
      </>}
    {modal === 'firebase' && <FirebaseForm preview={preview} close={closeModal} saved={saved} />}
    {modal === 'create' && <CampaignForm preview={preview} close={closeModal} saved={saved} />}
    {selected && entry && <NotificationDialog title={selected.mode === 'delete' ? 'حذف اعلان' : 'جزئیات اعلان'} icon="bell" close={() => setSelected(null)} busy={action.isPending}>
      <div className="push-dialog-form">
        <div className="push-detail"><h3>{String(entry.title ?? '—')}</h3><p>{String(entry.body ?? '')}</p></div>
        {selected.mode === 'delete' ? <PushNote>اعلان از فهرست حذف و ارسال زمان‌بندی‌شده لغو می‌شود. گزارش آن حفظ می‌شود.</PushNote> : <>
          <dl className="push-detail-grid"><div><dt>وضعیت</dt><dd><CampaignBadge status={entry.status} /></dd></div>
            <div><dt>مخاطبان</dt><dd>{audienceLabel(entry.audience)}</dd></div>
            <div><dt>پذیرفته‌شده</dt><dd>{pushNumber(entry.accepted)}</dd></div><div><dt>خطا / نامشخص</dt><dd>{pushNumber(entry.failed)}</dd></div>
            <div><dt>زمان ایجاد</dt><dd>{pushDate(entry.createdAt)}</dd></div><div><dt>زمان ارسال · تهران</dt><dd>{pushDate(entry.sentAt || entry.scheduledAt)}</dd></div>
          </dl>
          {entry.status === 'draft' && <PushNote>{configured ? 'با تأیید، اعلان برای مخاطبان انتخاب‌شده در صف ارسال قرار می‌گیرد.' : 'برای ارسال، ابتدا اتصال Firebase را در بخش اتصالات تنظیم کنید.'}</PushNote>}
        </>}
        {action.isError && <p className="form-error" role="alert">{pushError(action.error)}</p>}
        <div className="push-dialog-actions">
          {(selected.mode === 'delete' || entry.status === 'draft') && <button type="button" className={selected.mode === 'delete' ? 'danger' : ''}
            disabled={preview || action.isPending || (selected.mode === 'details' && !configured)} onClick={() => action.mutate(selected)}>
            {action.isPending ? 'در حال انجام…' : selected.mode === 'delete' ? 'حذف اعلان' : entry.scheduledAt ? 'تأیید زمان‌بندی' : entry.audience === 'all' ? 'تأیید و ارسال به همه کاربران' : 'ارسال آزمایشی'}
          </button>}
          <button type="button" className="secondary" disabled={action.isPending} onClick={() => setSelected(null)}>بستن</button>
        </div>
      </div>
    </NotificationDialog>}
  </div>
}
