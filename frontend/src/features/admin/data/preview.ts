// Explicit UI fixtures, never used as a fallback for failed API requests.
const previewModeKey = 'admin-ui-preview'
const previewSessionKey = 'admin-ui-preview-session'

export function adminPreviewEnabled() {
  if (!import.meta.env.DEV) return false
  const choice = new URLSearchParams(window.location.search).get('preview')
  if (choice === '1') sessionStorage.setItem(previewModeKey, '1')
  if (choice === '0') {
    sessionStorage.removeItem(previewModeKey)
    clearPreviewSession()
  }
  return sessionStorage.getItem(previewModeKey) === '1'
}

export function hasPreviewSession() {
  return adminPreviewEnabled() && sessionStorage.getItem(previewSessionKey) === '1'
}

export function loginToPreview(username: string, password: string) {
  if (!adminPreviewEnabled() || username.trim() !== 'admin-demo' || password !== 'MyDiet-Demo-2026!') return false
  sessionStorage.setItem(previewSessionKey, '1')
  return true
}

export function clearPreviewSession() {
  sessionStorage.removeItem(previewSessionKey)
}

const createdAt = '2026-11-14T10:00:00Z'
const userId = 'preview-user-001'
const payment = { id: 'preview-payment-001', user: 'کاربر آزمایشی', packageCode: 'پکیج یک‌ماهه', amountToman: 490000, status: 'paid', createdAt }
const rows: Record<string, Record<string, unknown>> = {
  users: { id: userId, displayName: 'زهره ارجمندی', phone: '+989194460014', status: 'pending', createdAt },
  specialists: { id: 'preview-specialist-001', displayName: 'دکتر نمونه', phone: '۰۹۱۲۰۰۰۰۰۰۱', councilNo: 'TEST-100', subordinateCount: 12, status: 'verified' },
  requests: { id: 'preview-request-001', userId, kind: 'new_plan', status: 'in_review', createdAt },
  reviews: { id: 'preview-review-001', userId, rating: 5, body: 'این نظر صرفاً برای نمایش ظاهر جدول ثبت شده است.', status: 'pending', createdAt },
  messages: { id: 'preview-message-001', title: 'گفت‌وگوی آزمایشی', lastMessage: 'سلام، برنامهٔ این هفته را دریافت کردم.', unreadCount: 1, createdAt },
  reasons: { id: 'preview-reason-001', label: 'تنوع بیشتر در وعده‌ها', active: true, sortOrder: 1 },
  'user-reports': { id: 'preview-report-001', period: 'هفته جاری', users: 25, activeUsers: 18, retentionPercent: 72 },
  'specialist-reports': { id: 'preview-specialist-report-001', specialist: 'دکتر نمونه', requests: 12, completed: 10, averageResponseHours: 3 },
  journeys: { id: 'preview-journey-001', source: 'ثبت‌نام سایت', step: 'تکمیل پروفایل', users: 20, conversionPercent: 80 },
  'campaign-links': { id: 'preview-campaign-001', name: 'کمپین آزمایشی', slug: 'preview-campaign', clicks: 125, active: true, createdAt },
  'web-analytics': { id: 'preview-analytics-001', page: '/onboarding/', source: 'کمپین آزمایشی', visits: 125, uniqueVisitors: 93, conversionPercent: 12 },
}

export function previewSection(section: string) {
  if (section === 'audit-logs') {
    const events = [
      ['ai_pool_tested', 'ai_pool', null], ['food_enabled', 'food_catalog', null], ['food_disabled', 'food_catalog', null],
      ['onboarding_profile_viewed', 'nutrition_profile', 'demo0001-profile'],
      ['ai_member_health_reset', 'ai_pool_member', 'demo0002-member'],
      ['article_draft', 'article', 'demo0003-article'],
    ] as const
    return { kind: 'table' as const, rows: [...events, ...events].map(([action, targetType, targetId], index) => ({
      id: `preview-audit-${index + 1}`, actorId: 'demo0001-admin', action, targetType, targetId,
      createdAt: new Date(Date.parse(createdAt) - index * 180_000).toISOString(),
    })) }
  }
  if (section === 'tickets') return {
    kind: 'table' as const,
    rows: Array.from({ length: 7 }, (_, index) => ({
      id: `test000${index + 1}-ticket`, userId: `demo000${index + 1}-user`,
      createdAt: new Date(Date.parse(createdAt) - index * 86_400_000).toISOString(),
    })),
  }
  if (section === 'dashboard') return {
    kind: 'dashboard' as const,
    stats: { users: 25, newUsers: 4, revenueToman: 490000, paidOrders: 1, unreadMessages: 1, aiToday: 3 },
    payments: [{ id: 'd155d987-0000-4000-8000-000000000001', user: 'ملیکا حسین پور', packageCode: 'monthly', amountToman: 1992170, status: 'credited', paidAt: '2026-11-12T12:13:00.000Z', createdAt: '2026-11-12T12:13:00.000Z' }],
  }
  if (section === 'payments') return {
    kind: 'payments' as const,
    payments: [{ ...payment, phone: '+989120000000', packageCode: 'monthly', status: 'credited', paidAt: createdAt, reference: 'TEST-1001' }],
    transfers: [
      { id: 'preview-transfer-001', phone_e164: '+989120000001', plan: 'monthly', amount_toman: 490000, expires_at: createdAt, zibal_track_id: 'TEST-1002' },
      { id: 'preview-transfer-002', phone_e164: '+989120000002', plan: 'monthly', amount_toman: 490000, expires_at: createdAt },
    ],
  }
  return { kind: 'table' as const, rows: rows[section] ? [rows[section]!] : [] }
}
