import { Link } from 'react-router-dom'

const plans = [
  { days: '۱۵ روزه', name: 'شروع', price: '۱٬۲۹۰٬۰۰۰', points: ['برنامهٔ تغذیه اختصاصی با همراهی متخصص منتخب', 'جایگزین‌های غذایی متناسب با سلیقه‌ات', 'لیست خرید برنامه'] },
  { days: '۳۰ روزه', name: 'همراه', price: '۱٬۹۹۰٬۰۰۰', featured: true, points: ['همهٔ امکانات پلن شروع در یک دورهٔ ۳۰ روزه', '۲ نوبت بازبینی و اصلاح برنامه', 'پیگیری هفتگی روند و اجرای برنامه', 'پشتیبانی متنی در طول دوره'] },
  { days: '۹۰ روزه', name: 'VIP', price: '۸٬۹۹۰٬۰۰۰', points: ['برنامهٔ اختصاصی و همراهی متخصص منتخب', '۶ نوبت بازبینی و اصلاح برنامه', '۳ جلسهٔ آنلاین با متخصص منتخب', 'پیگیری هفتگی و پشتیبانی اولویت‌دار'] },
]

export default function PricingPage() {
  return (
    <section className="mx-auto max-w-[1180px] px-6 py-12">
      <div className="mb-10 text-center">
        <p className="text-sm text-[#6e845e]">همراهی متناسب با مسیر تو</p>
        <h1 className="mt-2 text-4xl font-bold">خدمات و تعرفه‌ها</h1>
        <p className="mt-3 text-sm text-muted">تمام مبالغ به تومان و برای یک دوره از پلن انتخابی هستند.</p>
      </div>
      <div className="grid gap-5 md:grid-cols-3">
        {plans.map((plan) => (
          <article key={plan.name} className={`rounded-mydiet border p-6 ${plan.featured ? 'border-pine bg-sage' : 'border-line bg-white'}`}>
            <p className="text-xs text-muted">{plan.days}</p>
            <h2 className="text-2xl font-bold">{plan.name}</h2>
            <p className="my-4 text-xl font-bold">{plan.price} <span className="text-sm font-normal">تومان / هر دوره</span></p>
            <ul className="mb-6 space-y-2 text-sm text-[#4a5d50]">
              {plan.points.map((point) => <li key={point}>{point}</li>)}
            </ul>
            <a className="inline-flex rounded-xl bg-pine px-5 py-3 text-sm font-bold text-white" href="/onboarding/">شروع پرسش‌نامه</a>
          </article>
        ))}
      </div>
      <p className="mt-8 text-sm leading-8 text-muted">
        پشتیبانی: <a dir="ltr" href="tel:+989056013977">۰۹۰۵۶۰۱۳۹۷۷</a>؛ شنبه تا پنجشنبه، ۸ صبح تا ۸ شب.
        {' '}<Link to="/terms.html" className="underline">شرایط خرید</Link>
        {' '}و <Link to="/refund.html" className="underline">بازگشت وجه</Link>.
      </p>
    </section>
  )
}
