import type { StaffNavItem } from '@shared/ui/StaffShell'

export type DoctorNavItem = StaffNavItem & { description: string }

export const doctorNav: DoctorNavItem[] = [
  { id: 'dashboard', title: 'داشبورد', icon: 'grid', group: 'نمای کلی', description: 'شما در این صفحه می‌توانید پرونده‌ها و برنامه‌های در انتظار بررسی را مشاهده کنید.' },
  { id: 'patients', title: 'پرونده کاربران', icon: 'users', group: 'پرونده‌ها', description: 'شما در این صفحه می‌توانید پروندهٔ کاربران را مشاهده کنید.' },
  { id: 'review', title: 'برنامه‌های منتظر بررسی', icon: 'clipboard', group: 'پرونده‌ها', description: 'شما در این صفحه می‌توانید برنامه‌های منتظر بررسی را مشاهده کنید.' },
  { id: 'changes', title: 'درخواست‌های تغییر برنامه', icon: 'sliders', group: 'پرونده‌ها', description: 'شما در این صفحه می‌توانید درخواست‌های تغییر برنامه را مشاهده کنید.' },
  { id: 'reports', title: 'کاربران', icon: 'users', group: 'پیگیری', description: 'شما در این صفحه می‌توانید کاربران و گزارش هفتهٔ هر کدام را ببینید.' },
  { id: 'profile', title: 'پروفایل حرفه‌ای', icon: 'medical', group: 'پیگیری', description: 'شما در این صفحه می‌توانید پروفایل حرفه‌ای خود را مشاهده کنید.' },
]

export function doctorPath(section: string) {
  if (section === 'dashboard' || section === 'review') return 'specialist/queue?bucket=awaiting_review'
  if (section === 'changes') return 'specialist/queue?bucket=revisions'
  if (section === 'patients' || section === 'reports') return 'specialist/queue'
  if (section === 'profile') return 'specialist/profile'
  return null
}
