import { useEffect, useState } from 'react'
import { Navigate, Route, Routes, useParams } from 'react-router-dom'
import { AdminShell } from './components/AdminShell'
import './styles/reference.css'
import './styles/react.css'
import { adminAuth, staff } from './session'
import { adminNav } from './nav'
import { LoginPage } from './features/auth/LoginPage'
import { WorkspacePage } from './features/workspace/WorkspacePage'
import { adminPreviewEnabled, clearPreviewSession, hasPreviewSession } from './data/preview'
import { AdminIcon } from './components/AdminIcon'
import { OnboardingPage } from './features/onboarding/OnboardingPage'
import { FoodsPage } from './features/foods/FoodsPage'
import { IngredientsPage } from './features/ingredients/IngredientsPage'
import { ArticlesPage } from './features/articles/ArticlesPage'
import { AiPage } from './features/ai/AiPage'
import { SettingsPage } from './features/settings/SettingsPage'
import { StreaksPage } from './features/streaks/StreaksPage'
import { QuestionnairePage } from './features/questionnaire/QuestionnairePage'
import { UserReportsPage } from './features/reports/UserReportsPage'
import { SpecialistReportsPage } from './features/reports/SpecialistReportsPage'
import { JourneysPage } from './features/reports/JourneysPage'
import { CampaignLinksPage } from './features/campaigns/CampaignLinksPage'
import { WebAnalyticsPage } from './features/analytics/WebAnalyticsPage'
import { NotificationsPage } from './features/notifications/NotificationsPage'
import type { NotificationModal } from './features/notifications/NotificationDialog'

function Panel() {
  const [createSpecialist, setCreateSpecialist] = useState(false)
  const [notificationModal, setNotificationModal] = useState<NotificationModal>(null)
  const preview = adminPreviewEnabled()
  const params = useParams()
  const section = params.section && adminNav.some((item) => item.id === params.section) ? params.section : 'dashboard'
  useEffect(() => { if (section !== 'notifications') setNotificationModal(null) }, [section])

  async function logout() {
    if (preview) {
      clearPreviewSession()
    } else {
      try { await staff.logout() } catch { staff.clear() }
    }
    window.location.href = '/admin/'
  }

  return (
    <AdminShell
      section={section}
      description={section === 'specialists' ? 'پزشکان فعال و اطلاعات تخصصی آن‌ها.' : section === 'payments' ? 'خرید پکیج‌ها. بعد از خرید، تغییر برنامه جداگانه محاسبه نمی‌شود.' : section === 'onboarding' ? 'پروفایل تغذیه‌ای کاربران، قیف ثبت‌نام و سرنخ‌های دمو.' : section === 'foods' ? 'غذاهای ایرانی که برنامه‌ها از روی آن‌ها ساخته می‌شود.' : section === 'ingredients' ? 'مواد اولیهٔ مشترک رسپی‌ها، با دسته و مرجع تغذیه.' : section === 'reviews' ? 'نظرات در انتظار بررسی را بخوانید و مدیریت کنید.' : section === 'tickets' ? 'درخواست‌های پشتیبانی و ارتباط کاربران با تیم شما.' : section === 'notifications' ? 'پیام درست را در زمان درست به دست کاربران برسانید.' : section === 'articles' ? 'نوشتن، ویرایش و انتشار مقاله‌های مجلهٔ رژیم من.' : section === 'ai' ? 'سرویس‌ها، استخر مدل‌ها، هزینه، پرامپت و کیفیت پیش‌نویس‌ها.' : section === 'settings' ? 'تعرفه خدمات و پاداش هفتگی را تنظیم کنید.' : section === 'streaks' ? 'دوره‌ها، پاداش‌ها و نسخه‌های کمپین را مدیریت کنید.' : section === 'audit-logs' ? 'ردپای تغییرات و فعالیت‌های مدیریتی.' : section === 'questionnaire' ? 'پیکربندی پرسش‌نامهٔ کاربران.' : section === 'user-reports' ? 'ادامه استفاده و انتخاب غذاها.' : section === 'specialist-reports' ? 'عملکرد و زمان پاسخ‌گویی.' : section === 'journeys' ? 'مسیرهای ورود اول و بازگشت کاربران.' : section === 'campaign-links' ? 'ساخت لینک دمو برای هر کانال و کنترل فعال‌بودن آن.' : section === 'web-analytics' ? 'ورودی تبلیغات، انتخاب هدف، زمان مراحل و مسیر واقعی کاربران دمو.' : undefined}
      actions={section === 'notifications' ? <>
        <button type="button" className="secondary" onClick={() => setNotificationModal('firebase')}><AdminIcon name="sliders" />اتصالات</button>
        <button type="button" onClick={() => setNotificationModal('create')}><AdminIcon name="plus" />اعلان جدید</button>
      </> : section === 'specialists' ? <button onClick={() => setCreateSpecialist(true)}><AdminIcon name="plus" />افزودن</button> : ['foods', 'ingredients', 'reviews', 'tickets', 'articles', 'ai', 'settings', 'streaks', 'audit-logs', 'questionnaire', 'campaign-links', 'web-analytics'].includes(section) ? null : undefined}
      onLogout={logout}
    >
      {preview && <div className="info-note preview-notice" role="status"><p>{section === 'user-reports' ? 'حالت پیش‌نمایش: اعداد گزارش نمونهٔ طراحی هستند و با تغییر بازه همین‌جا محاسبه می‌شوند.' : section === 'specialist-reports' ? 'حالت پیش‌نمایش: این گزارش نمونهٔ طراحی است و با تغییر ترتیب همین‌جا مرتب می‌شود.' : section === 'journeys' ? 'حالت پیش‌نمایش: مسیرها نمونهٔ طراحی هستند و با صافی‌ها همین‌جا محاسبه می‌شوند.' : section === 'campaign-links' ? 'حالت پیش‌نمایش: لینک‌های نمونه فقط در همین زبانه تغییر می‌کنند.' : section === 'web-analytics' ? 'حالت پیش‌نمایش: نشست‌ها و گزارش تاریخی نمونه هستند.' : ['streaks', 'questionnaire'].includes(section) ? 'حالت پیش‌نمایش: نسخه‌های نمونه فقط در همین زبانه ذخیره می‌شوند.' : 'حالت پیش‌نمایش: داده‌های این صفحه آزمایشی هستند؛ عملیات ثبت و تغییر غیرفعال است.'}</p><a href={`/admin/${section}?preview=0`}>بازگشت به داده‌های واقعی</a></div>}
      {section === 'onboarding' ? <OnboardingPage preview={preview} /> : section === 'foods' ? <FoodsPage preview={preview} /> : section === 'ingredients' ? <IngredientsPage preview={preview} /> :
        section === 'notifications' ? <NotificationsPage preview={preview} modal={notificationModal} closeModal={() => setNotificationModal(null)} /> :
        section === 'articles' ? <ArticlesPage preview={preview} /> :
        section === 'ai' ? <AiPage preview={preview} /> :
        section === 'settings' ? <SettingsPage preview={preview} /> :
        section === 'streaks' ? <StreaksPage preview={preview} /> :
        section === 'questionnaire' ? <QuestionnairePage preview={preview} /> :
        section === 'user-reports' ? <UserReportsPage preview={preview} /> :
        section === 'specialist-reports' ? <SpecialistReportsPage preview={preview} /> :
        section === 'journeys' ? <JourneysPage preview={preview} /> :
        section === 'campaign-links' ? <CampaignLinksPage preview={preview} /> :
        section === 'web-analytics' ? <WebAnalyticsPage preview={preview} /> :
        <fieldset disabled={preview && !['users', 'specialists', 'requests', 'payments', 'reviews', 'tickets', 'audit-logs'].includes(section)} className="preview-content"><WorkspacePage section={section} createSpecialist={createSpecialist} onCloseCreate={() => setCreateSpecialist(false)} /></fieldset>}
    </AdminShell>
  )
}

export default function App() {
  const [state, setState] = useState<'checking' | 'in' | 'out'>('checking')

  useEffect(() => {
    if (adminPreviewEnabled()) {
      setState(hasPreviewSession() ? 'in' : 'out')
      return
    }
    adminAuth.bindExpiry(() => setState('out'))
    staff.restore().then(() => setState('in')).catch(() => setState('out'))
  }, [])

  if (state === 'checking') {
    return <div className="grid min-h-screen place-items-center text-muted">در حال بررسی نشست…</div>
  }

  return (
    <div className="admin-reference" dir="rtl"><Routes>
      <Route path="login" element={state === 'in' ? <Navigate to="/admin/dashboard" replace /> : <LoginPage onSuccess={() => setState('in')} />} />
      <Route index element={state === 'in' ? <Navigate to="/admin/dashboard" replace /> : <Navigate to="/admin/login" replace />} />
      <Route path=":section" element={state === 'in' ? <Panel /> : <Navigate to="/admin/login" replace />} />
    </Routes></div>
  )
}
