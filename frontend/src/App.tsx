import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import SiteLayout from '../apps/site/src/App'
import HomePage from '../apps/site/src/pages/HomePage'
import ArticlesPage from '../apps/site/src/pages/ArticlesPage'
import ArticlePage from '../apps/site/src/pages/ArticlePage'
import PricingPage from '../apps/site/src/pages/PricingPage'
import AboutPage from '../apps/site/src/pages/AboutPage'
import ContactPage from '../apps/site/src/pages/ContactPage'
import TermsPage from '../apps/site/src/pages/TermsPage'
import RefundPage from '../apps/site/src/pages/RefundPage'

const AdminApp = lazy(() => import('../apps/admin/src/App'))
const DoctorApp = lazy(() => import('../apps/doctor/src/App'))
const OnboardingApp = lazy(() => import('../apps/onboarding/src/App'))

export default function App() {
  return (
    <Suspense fallback={<div className="grid min-h-screen place-items-center text-muted">در حال بارگذاری…</div>}>
      <Routes>
        <Route path="/admin/*" element={<AdminApp />} />
        <Route path="/doctor/*" element={<DoctorApp />} />
        <Route path="/onboarding/*" element={<OnboardingApp />} />
        <Route element={<SiteLayout />}>
          <Route index element={<HomePage />} />
          <Route path="index.html" element={<HomePage />} />
          <Route path="articles" element={<ArticlesPage />} />
          <Route path="articles.html" element={<ArticlesPage />} />
          <Route path="article" element={<ArticlePage />} />
          <Route path="article.html" element={<ArticlePage />} />
          <Route path="pricing" element={<PricingPage />} />
          <Route path="pricing.html" element={<PricingPage />} />
          <Route path="about" element={<AboutPage />} />
          <Route path="about.html" element={<AboutPage />} />
          <Route path="contact" element={<ContactPage />} />
          <Route path="contact.html" element={<ContactPage />} />
          <Route path="terms.html" element={<TermsPage />} />
          <Route path="refund.html" element={<RefundPage />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
