import { useDeferredValue, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { formatFaNumber } from '@shared/utils'
import { AdminIcon as Icon } from '../../components/AdminIcon'
import { staff } from '../../session'
import { ProgressCalendar, type ProgressActivity } from '../../../doctor/features/desk/ProgressCalendar'
import { type DoctorMember, type ActivityNutrition } from '../../../doctor/data/api'
import { formatFaDay, trackLabels } from '../../../doctor/data/labels'
import '../users/users.css'
import './user-reports.css'
import './user-progress.css'

const endpoint = 'admin/reports/user-progress'
const source = {
  scope: 'admin-user-progress',
  activity: (userId: string) => staff.api<ProgressActivity>(`${endpoint}/${encodeURIComponent(userId)}/activity`),
  nutrition: (userId: string, date: string) => staff.api<ActivityNutrition>(`${endpoint}/${encodeURIComponent(userId)}/activity?${new URLSearchParams({ date })}`),
}

export function UserReportsPage({ preview }: { preview: boolean }) {
  const [selected, setSelected] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const term = useDeferredValue(search.trim().toLowerCase().replace(/ي/g, 'ی').replace(/ك/g, 'ک'))
  const query = useQuery({
    queryKey: ['admin', 'user-progress', preview],
    queryFn: () => staff.api<DoctorMember[]>(endpoint),
    enabled: !preview,
    refetchInterval: 86_400_000,
  })
  if (selected) return <div className="admin-user-progress"><ProgressCalendar userId={selected} onBack={() => setSelected(null)} source={source} /></div>
  const users = query.data ?? []
  const rows = users.filter(row => `${row.displayName} ${row.phone ?? ''}`.toLowerCase().replace(/ي/g, 'ی').replace(/ك/g, 'ک').includes(term))
  return <div className="admin-user-progress">
    <p className="info-note">روز کامل یعنی همهٔ وعده‌های برنامه در آن روز ثبت شده‌اند. هفتهٔ برنامه و تغییر وزن هر ۲۴ ساعت محاسبه می‌شوند.</p>
    {preview && <p className="info-note">برای مشاهدهٔ گزارش کاربران، از حالت پیش‌نمایش خارج شوید.</p>}
    <section className="users-table-card">
      <div className="users-toolbar"><label className="users-search"><Icon name="search" />
        <input aria-label="جست‌وجوی کاربران" type="search" placeholder="نام یا شماره تلفن…" value={search} onChange={event => setSearch(event.target.value)} /></label>
        <span role="status">{formatFaNumber(users.length)} کاربر</span></div>
      <div className="users-table-scroll" role="region" aria-label="گزارش پیشرفت همهٔ کاربران" tabIndex={0}>
        <table><thead><tr>{['نام کاربر', 'شماره تلفن', 'هدف', 'هفتهٔ برنامه', 'تغییر وزن', 'آخرین محاسبه', 'روزهای کامل', 'عملیات'].map(title => <th key={title} scope="col">{title}</th>)}</tr></thead>
          <tbody>{rows.map(row => <tr key={row.id}>
            <td>{row.displayName || '—'}</td><td><bdi>{row.phone || '—'}</bdi></td>
            <td>{trackLabels[row.goal ?? ''] || trackLabels[row.track ?? ''] || row.goal || '—'}</td>
            <td>{row.week == null ? 'شروع نشده' : formatFaNumber(row.week)}</td>
            <td>{row.weightChangeKg == null ? 'ثبت وزن کافی نیست' : row.weightChangeKg === 0 ? 'بدون تغییر' : `${formatFaNumber(Math.abs(row.weightChangeKg))} کیلوگرم ${row.weightChangeKg < 0 ? 'کاهش' : 'افزایش'}`}</td>
            <td>{row.refreshedAt ? formatFaDay(row.refreshedAt) : '—'}</td>
            <td>{row.completedDays == null ? '—' : formatFaNumber(row.completedDays)}</td>
            <td><button type="button" className="secondary" aria-label={`جزئیات و تقویم فعالیت ${row.displayName}`} onClick={() => setSelected(row.id)}><Icon name="eye" />جزئیات</button></td>
          </tr>)}
          {!rows.length && <tr><td colSpan={8} className="users-empty">{query.isPending && !preview ? 'در حال دریافت اطلاعات…' : query.isError ? 'گزارش دریافت نشد.' : 'کاربری با این مشخصات پیدا نشد.'}</td></tr>}
          </tbody>
        </table>
      </div>
      {query.isError && <div className="info-note" role="alert"><p>{query.error instanceof Error ? query.error.message : 'دریافت اطلاعات انجام نشد.'}</p><button type="button" className="secondary" onClick={() => void query.refetch()}>تلاش دوباره</button></div>}
    </section>
  </div>
}
