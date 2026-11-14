// Explicit UI fixtures, never used as a fallback for failed API requests.
export function adminPreviewEnabled() {
  const choice = new URLSearchParams(window.location.search).get('preview')
  if (choice === '1') sessionStorage.setItem('admin-ui-preview', '1')
  if (choice === '0') sessionStorage.removeItem('admin-ui-preview')
  return sessionStorage.getItem('admin-ui-preview') === '1'
}

const createdAt = '2026-11-14T10:00:00Z'
const userId = 'preview-user-001'
const payment = { id: 'preview-payment-001', user: 'کاربر آزمایشی', packageCode: 'پکیج یک‌ماهه', amountToman: 490000, status: 'paid', createdAt }
const rows: Record<string, Record<string, unknown>> = {
  users: { id: userId, displayName: 'سارا آزمایشی', phone: '۰۹۱۲۰۰۰۰۰۰۰', status: 'active', createdAt },
  specialists: { id: 'preview-specialist-001', displayName: 'دکتر نمونه', phone: '۰۹۱۲۰۰۰۰۰۰۱', councilNo: 'TEST-100', subordinateCount: 12, status: 'verified' },
  requests: { id: 'preview-request-001', userId, kind: 'برنامه تغذیه', status: 'pending', createdAt },
  onboarding: { id: 'preview-profile-001', displayName: 'سارا آزمایشی', goal: 'کاهش وزن', status: 'completed', createdAt },
  foods: { id: 'preview-food-001', nameFa: 'عدس‌پلو آزمایشی', slug: 'preview-adas-polo', calories: 310, protein: 12, status: 'active' },
  reviews: { id: 'preview-review-001', userId, rating: 5, body: 'این نظر صرفاً برای نمایش ظاهر جدول ثبت شده است.', status: 'pending', createdAt },
  messages: { id: 'preview-message-001', title: 'گفت‌وگوی آزمایشی', lastMessage: 'سلام، برنامهٔ این هفته را دریافت کردم.', unreadCount: 1, createdAt },
  tickets: { id: 'preview-ticket-001', title: 'پشتیبانی آزمایشی', body: 'درخواست راهنمایی درباره برنامه', status: 'pending', createdAt },
  notifications: { id: 'preview-notification-001', title: 'یادآوری آزمایشی', body: 'زمان ثبت گزارش هفتگی است.', audience: 'همه کاربران', status: 'draft', createdAt },
  articles: { id: 'preview-article-001', title: 'راهنمای تغذیه سالم — نمونه', slug: 'preview-healthy-diet', status: 'draft', createdAt },
  ai: { id: 'preview-ai-001', name: 'سرویس آزمایشی', model: 'preview-model', active: false, costPer1kTokens: 1000, createdAt },
  streaks: { id: 'preview-streak-001', title: 'کمپین آزمایشی', days: 7, rewardToman: 50000, status: 'active', createdAt },
  'audit-logs': { id: 'preview-audit-001', actor: 'مدیر آزمایشی', action: 'نمایش پیش‌نمایش', resource: 'پنل مدیریت', createdAt },
  questionnaire: { id: 'preview-schema-001', version: 1, title: 'پرسش‌نامه آزمایشی', status: 'draft', createdAt },
  reasons: { id: 'preview-reason-001', label: 'تنوع بیشتر در وعده‌ها', active: true, sortOrder: 1 },
  'user-reports': { id: 'preview-report-001', period: 'هفته جاری', users: 25, activeUsers: 18, retentionPercent: 72 },
  'specialist-reports': { id: 'preview-specialist-report-001', specialist: 'دکتر نمونه', requests: 12, completed: 10, averageResponseHours: 3 },
  journeys: { id: 'preview-journey-001', source: 'ثبت‌نام سایت', step: 'تکمیل پروفایل', users: 20, conversionPercent: 80 },
  'campaign-links': { id: 'preview-campaign-001', name: 'کمپین آزمایشی', slug: 'preview-campaign', clicks: 125, active: true, createdAt },
  'web-analytics': { id: 'preview-analytics-001', page: '/onboarding/', source: 'کمپین آزمایشی', visits: 125, uniqueVisitors: 93, conversionPercent: 12 },
}

export function previewSection(section: string) {
  if (section === 'settings') return { kind: 'settings' as const }
  if (section === 'dashboard') return { kind: 'dashboard' as const, stats: { users: 25, newUsers: 4, revenueToman: 490000, paidOrders: 1, unreadMessages: 1, aiToday: 3 }, payments: [payment] }
  if (section === 'payments') return { kind: 'payments' as const, payments: [payment], transfers: [{ id: 'preview-transfer-001', userId, amountToman: 490000, reference: 'TEST-1001', status: 'pending', createdAt }] }
  return { kind: 'table' as const, rows: rows[section] ? [rows[section]!] : [] }
}
