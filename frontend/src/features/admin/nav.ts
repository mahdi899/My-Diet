import type { StaffNavItem } from '@shared/ui/StaffShell'

export const adminNav: StaffNavItem[] = [
  { id: 'dashboard', title: 'داشبورد', icon: 'grid', group: 'نمای کلی' },
  { id: 'users', title: 'کاربران', icon: 'users', group: 'مدیریت خدمات' },
  { id: 'specialists', title: 'پزشکان', icon: 'medical', group: 'مدیریت خدمات' },
  { id: 'requests', title: 'درخواست‌ها', icon: 'clipboard', group: 'مدیریت خدمات' },
  { id: 'payments', title: 'پرداخت‌ها', icon: 'wallet', group: 'مدیریت خدمات' },
  { id: 'onboarding', title: 'ثبت‌نام و پروفایل‌ها', icon: 'users', group: 'مدیریت خدمات' },
  { id: 'foods', title: 'کاتالوگ غذا', icon: 'clipboard', group: 'مدیریت خدمات' },
  { id: 'ingredients', title: 'مواد اولیه', icon: 'leaf', group: 'مدیریت خدمات' },
  { id: 'reviews', title: 'نظرات', icon: 'star', group: 'ارتباط با کاربران' },
  { id: 'messages', title: 'پیام‌ها', icon: 'message', group: 'ارتباط با کاربران' },
  { id: 'tickets', title: 'تیکت‌ها', icon: 'headphones', group: 'ارتباط با کاربران' },
  { id: 'notifications', title: 'نوتفیکیشن', icon: 'bell', group: 'ارتباط با کاربران' },
  { id: 'articles', title: 'مقالات', icon: 'clipboard', group: 'محتوا' },
  { id: 'ai', title: 'هوش مصنوعی', icon: 'sparkles', group: 'تنظیمات و ابزارها' },
  { id: 'coach-quotas', title: 'سهمیه مربی', icon: 'message', group: 'تنظیمات و ابزارها' },
  { id: 'subscription-prices', title: 'تعرفه اشتراک', icon: 'wallet', group: 'تنظیمات و ابزارها' },
  { id: 'streaks', title: 'کمپین روزهای پیاپی', icon: 'calendar', group: 'تنظیمات و ابزارها' },
  { id: 'audit-logs', title: 'تاریخچه فعالیت', icon: 'history', group: 'تنظیمات و ابزارها' },
  { id: 'questionnaire', title: 'پیکربندی پرسش‌نامه', icon: 'clipboard', group: 'توسعه سامانه' },
  { id: 'reasons', title: 'دلایل تغییر برنامه', icon: 'sliders', group: 'توسعه سامانه' },
  { id: 'user-reports', title: 'گزارش کاربران', icon: 'users', group: 'گزارش‌ها' },
  { id: 'specialist-reports', title: 'گزارش متخصصان', icon: 'medical', group: 'گزارش‌ها' },
  { id: 'journeys', title: 'مسیر کاربران', icon: 'history', group: 'گزارش‌ها' },
  { id: 'campaign-links', title: 'لینک‌های تبلیغاتی', icon: 'history', group: 'گزارش‌ها' },
  { id: 'web-analytics', title: 'رهگیری آنبوردینگ', icon: 'history', group: 'گزارش‌ها' },
]

const paths: Record<string, string> = {
  users: 'admin/users',
  specialists: 'admin/specialists',
  requests: 'admin/requests',
  reviews: 'admin/reviews?status=pending',
  messages: 'conversations',
  tickets: 'admin/support-conversations',
  'audit-logs': 'admin/audit-logs',
  reasons: 'admin/plan-change-reasons',
  'user-reports': 'admin/reports/retention',
  'specialist-reports': 'admin/reports/specialists',
  journeys: 'admin/reports/journeys',
  'campaign-links': 'admin/campaign-links',
  'web-analytics': 'admin/web-analytics',
}

export function adminSectionPath(section: string) {
  return paths[section] ?? null
}
