import type { StaffNavItem } from '@shared/ui/StaffShell'

export type DoctorNavItem = StaffNavItem & { description: string }

export const doctorNav: DoctorNavItem[] = [
  { id: 'dashboard', title: 'داشبورد', icon: 'grid', group: 'نمای کلی', description: 'شما در این صفحه می‌توانید پرونده‌ها و برنامه‌های در انتظار بررسی را مشاهده کنید.' },
  { id: 'profile', title: 'پروفایل حرفه‌ای', icon: 'medical', group: 'نمای کلی', description: 'مشخصات و تصویر حرفه‌ای خود را مدیریت کنید.' },
  { id: 'patients', title: 'کاربران', icon: 'users', group: 'پرونده‌ها', description: 'کاربران زیرمجموعه و اطلاعات تکمیلی آن‌ها را مشاهده کنید.' },
  { id: 'review', title: 'برنامه‌های منتظر بررسی', icon: 'clipboard', group: 'پرونده‌ها', description: 'شما در این صفحه می‌توانید برنامه‌های منتظر بررسی را مشاهده کنید.' },
  { id: 'changes', title: 'درخواست‌های تغییر برنامه', icon: 'sliders', group: 'پرونده‌ها', description: 'شما در این صفحه می‌توانید درخواست‌های تغییر برنامه را مشاهده کنید.' },
  { id: 'reports', title: 'گزارش پیشرفت', icon: 'clipboard', group: 'پیگیری', description: 'هفتهٔ برنامه و تغییر وزن کاربران زیرمجموعه را ببینید.' },
]

export function doctorPath(section: string) {
  if (section === 'dashboard' || section === 'review') return 'specialist/queue?bucket=awaiting_review'
  if (section === 'changes') return 'specialist/queue?bucket=revisions'
  if (section === 'patients') return 'specialist/members'
  if (section === 'reports') return 'specialist/members?progress=1'
  if (section === 'profile') return 'specialist/profile'
  return null
}
