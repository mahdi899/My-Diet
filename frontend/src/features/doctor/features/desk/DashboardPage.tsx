import { useQuery } from '@tanstack/react-query'
import { formatFaNumber } from '@shared/utils'
import { apiError, loadQueue } from '../../data/api'
import { QueueTable } from './QueueTable'
import type { QueueRow } from '../../data/samples'

export function DashboardPage({ onNavigate, onPlan, onMeals }: { onNavigate: (section: string) => void; onPlan: (id: string) => void; onMeals: (id: string) => void }) {
  const query = useQuery({
    queryKey: ['doctor', 'dashboard'],
    queryFn: async () => {
      const [review, changes] = await Promise.all([
        loadQueue('specialist/queue?bucket=awaiting_review'),
        loadQueue('specialist/queue?bucket=revisions'),
      ])
      return { review, changes }
    },
  })
  if (query.isLoading) return <section className="card card-pad">در حال دریافت اطلاعات…</section>
  if (query.isError) return <section className="card card-pad">{apiError(query.error)}</section>
  const review = query.data?.review ?? []
  const changes = query.data?.changes ?? []
  return (
    <div className="stack">
      <section className="intro-card">
        <h2>فضایی برای تمرکز روی هر پرونده</h2>
        <p>برنامه‌های آماده بررسی و درخواست‌های اصلاح را از میز کار دنبال کنید.</p>
      </section>
      <div className="cards">
        <Count title="منتظر بررسی" count={review.length} onOpen={() => onNavigate('review')} />
        <Count title="درخواست اصلاح" count={changes.length} onOpen={() => onNavigate('changes')} />
      </div>
      <p className="workspace-note">تعداد درخواست‌ها مربوط به حداکثر ۱۰۰ مورد برگشتی هر صف است.</p>
      <h2>برنامه‌های آماده بررسی</h2>
      <QueueTable rows={review} onPlan={(row) => onPlan(row.id)} onMeals={(row) => onMeals(row.id)} />
    </div>
  )
}

function Count({ title, count, onOpen }: { title: string; count: number; onOpen: () => void }) {
  return (
    <section className="card card-pad">
      <p>{title}</p>
      <div className="count">{formatFaNumber(count)}</div>
      <button className="secondary" type="button" onClick={onOpen}>مشاهده</button>
    </section>
  )
}

export type { QueueRow }
