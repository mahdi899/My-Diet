import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { apiError, loadQueue } from '../../data/api'
import { canLeaveDoctor } from '../../data/labels'
import { ChangesPage } from './ChangesPage'
import { ClinicalWorkspace } from './ClinicalWorkspace'
import { DashboardPage } from './DashboardPage'
import { MealQuality } from './MealQuality'
import { PlanReview } from './PlanReview'
import { ProfilePage } from './ProfilePage'
import { QueueTable } from './QueueTable'
import { ReportsPage } from './ReportsPage'

type View = { kind: 'page' } | { kind: 'plan'; id: string } | { kind: 'meals'; id: string } | { kind: 'clinical' }

export function DoctorDesk({ section, refreshKey, onNavigate }: { section: string; refreshKey: number; onNavigate: (id: string) => void }) {
  const [view, setView] = useState<View>({ kind: 'page' })
  const [viewSection, setViewSection] = useState(section)
  if (viewSection !== section) {
    setViewSection(section)
    setView({ kind: 'page' })
  }
  function back() {
    if (!canLeaveDoctor()) return
    setView({ kind: 'page' })
  }
  if (view.kind === 'plan') return <PlanReview requestId={view.id} onBack={back} />
  if (view.kind === 'meals') return <MealQuality requestId={view.id} onBack={back} />
  if (view.kind === 'clinical') return <ClinicalWorkspace demo onBack={back} />
  if (section === 'dashboard') return <DashboardPage key={refreshKey} onNavigate={onNavigate} onPlan={(id) => setView({ kind: 'plan', id })} onMeals={(id) => setView({ kind: 'meals', id })} />
  if (section === 'changes') return <ChangesPage key={refreshKey} onEditDemo={() => setView({ kind: 'clinical' })} />
  if (section === 'reports') return <ReportsPage key={refreshKey} />
  if (section === 'profile') return <ProfilePage key={refreshKey} />
  return <QueueSection key={refreshKey + section} section={section} onPlan={(id) => setView({ kind: 'plan', id })} onMeals={(id) => setView({ kind: 'meals', id })} onClinical={() => setView({ kind: 'clinical' })} />
}

function QueueSection({ section, onPlan, onMeals, onClinical }: { section: string; onPlan: (id: string) => void; onMeals: (id: string) => void; onClinical: () => void }) {
  const path = section === 'review' ? 'specialist/queue?bucket=awaiting_review' : 'specialist/queue'
  const query = useQuery({ queryKey: ['doctor', 'queue', path], queryFn: () => loadQueue(path) })
  return (
    <div className="stack">
      <p className="workspace-note">{section === 'review' ? 'پرونده و پیش‌نویس را از درخواست‌های اختصاص‌یافته باز کنید. نمونهٔ جداگانه برای بررسی رابط کامل موجود است.' : 'پرونده‌های مرتبط با درخواست‌های اختصاص‌یافته. دادهٔ پزشکی ارائه‌نشده از روی نام حدس زده نمی‌شود.'}</p>
      <button className="secondary" type="button" onClick={onClinical}>باز کردن پرونده و ویرایشگر نمونه</button>
      {query.isLoading && <section className="card card-pad">در حال دریافت اطلاعات…</section>}
      {query.isError && <section className="card card-pad">{apiError(query.error)}</section>}
      {query.data && <QueueTable rows={query.data} onPlan={(row) => onPlan(row.id)} onMeals={(row) => onMeals(row.id)} />}
    </div>
  )
}
