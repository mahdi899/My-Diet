import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import { MotionConfig } from 'motion/react'
import SiteLayout from './features/site/App'
import HomePage from './features/site/pages/HomePage'
import ArticlesPage from './features/site/pages/ArticlesPage'
import ArticlePage from './features/site/pages/ArticlePage'
import PricingPage from './features/site/pages/PricingPage'
import AboutPage from './features/site/pages/AboutPage'
import ContactPage from './features/site/pages/ContactPage'
import TermsPage from './features/site/pages/TermsPage'
import RefundPage from './features/site/pages/RefundPage'

const BmiPage = lazy(() => import('./features/site/pages/BmiPage'))

const AdminApp = lazy(() => import('./features/admin/App'))
const DoctorApp = lazy(() => import('./features/doctor/App'))
const OnboardingApp = lazy(() => import('./features/onboarding/App'))

export default function App() {
  return (
    <Suspense fallback={<div className="grid min-h-screen place-items-center text-muted">در حال بارگذاری…</div>}>
      <Routes>
        <Route path="/admin/*" element={<AdminApp />} />
        <Route path="/doctor/*" element={<DoctorApp />} />
        <Route path="/onboarding/*" element={<OnboardingApp />} />
        <Route element={<MotionConfig reducedMotion="user"><SiteLayout /></MotionConfig>}>
          <Route index element={<HomePage />} />
          <Route path="index.html" element={<HomePage />} />
          <Route path="bmi" element={<BmiPage />} />
          <Route path="bmi.html" element={<BmiPage />} />
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
          <Route path="terms" element={<TermsPage />} />
          <Route path="terms.html" element={<TermsPage />} />
          <Route path="refund" element={<RefundPage />} />
          <Route path="refund.html" element={<RefundPage />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
