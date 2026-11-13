import type { StaffNavItem } from '@shared/ui/StaffShell'

export const doctorNav: StaffNavItem[] = [
  { id: 'dashboard', title: 'داشبورد', icon: 'grid', group: 'نمای کلی' },
  { id: 'patients', title: 'پرونده کاربران', icon: 'users', group: 'پرونده‌ها' },
  { id: 'review', title: 'برنامه‌های منتظر بررسی', icon: 'clipboard', group: 'پرونده‌ها' },
  { id: 'changes', title: 'درخواست‌های تغییر برنامه', icon: 'sliders', group: 'پرونده‌ها' },
  { id: 'reports', title: 'کاربران', icon: 'users', group: 'پیگیری' },
  { id: 'profile', title: 'پروفایل حرفه‌ای', icon: 'medical', group: 'پیگیری' },
]

export function doctorPath(section: string) {
  if (section === 'dashboard' || section === 'review') return 'specialist/queue?bucket=awaiting_review'
  if (section === 'changes') return 'specialist/queue?bucket=revisions'
  if (section === 'patients' || section === 'reports') return 'specialist/queue'
  if (section === 'profile') return 'specialist/profile'
  return null
}
