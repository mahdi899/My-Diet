import { useState } from 'react'
import { canLeaveDoctor } from '../../data/labels'
import { ChangesPage } from './ChangesPage'
import { ClinicalWorkspace } from './ClinicalWorkspace'
import { DashboardPage } from './DashboardPage'
import { FoodBankPage } from './FoodBankPage'
import { MealQuality } from './MealQuality'
import { PlanReview } from './PlanReview'
import { ProfilePage } from './ProfilePage'
import { PeoplePage } from './PeoplePage'
import { ProgressCalendar } from './ProgressCalendar'

type View = { kind: 'page' } | { kind: 'plan'; id: string; changeId?: string } | { kind: 'meals'; id: string } | { kind: 'activity'; id: string } | { kind: 'clinical' }

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
  if (view.kind === 'plan') return <PlanReview requestId={view.id} changeRequestId={view.changeId} onBack={back} />
  if (view.kind === 'meals') return <MealQuality requestId={view.id} onBack={back} />
  if (view.kind === 'clinical') return <ClinicalWorkspace demo onBack={back} />
  if (view.kind === 'activity' && section === 'reports') return <ProgressCalendar userId={view.id} onBack={back} />
  if (section === 'dashboard') return <DashboardPage key={refreshKey} onNavigate={onNavigate} onPlan={(id) => setView({ kind: 'plan', id })} onMeals={(id) => setView({ kind: 'meals', id })} />
  if (section === 'changes') return <ChangesPage key={refreshKey} onEditDemo={() => setView({ kind: 'clinical' })} onEditPlan={(id, changeId) => setView({ kind: 'plan', id, changeId })} />
  if (section === 'profile') return <ProfilePage key={refreshKey} />
  if (section === 'food-bank') return <FoodBankPage key={refreshKey} />
  const mode = section === 'review' || section === 'reports' ? section : 'patients'
  return <PeoplePage key={refreshKey + section} mode={mode} onPlan={(id) => setView({ kind: 'plan', id })} onMeals={(id) => setView({ kind: 'meals', id })} onActivity={(id) => setView({ kind: 'activity', id })} />
}
