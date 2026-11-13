import { Link } from 'react-router-dom'

export default function ContactPage() {
  return (
    <section className="mx-auto max-w-[1180px] px-6 py-12">
      <h1 className="text-4xl font-bold">تماس و پشتیبانی</h1>
      <p className="mt-3 text-muted">برای پرسش دربارهٔ پلن‌ها و پیگیری درخواست با پشتیبانی رژیم من تماس بگیر.</p>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <article className="rounded-mydiet border border-line bg-white p-6">
          <h2 className="font-bold">شمارهٔ پشتیبانی</h2>
          <a className="mt-3 block text-2xl font-bold text-pine" dir="ltr" href="tel:+989056013977">۰۹۰۵۶۰۱۳۹۷۷</a>
          <p className="mt-3 text-sm">شنبه تا پنجشنبه، ساعت ۸ صبح تا ۸ شب به وقت ایران.</p>
        </article>
        <article className="rounded-mydiet border border-line bg-white p-6">
          <h2 className="font-bold">اطلاعات پیش از انتخاب</h2>
          <div className="mt-3 flex flex-col gap-2 text-sm text-pine">
            <Link to="/pricing.html">خدمات و تعرفه‌ها</Link>
            <Link to="/terms.html">شرایط خرید</Link>
            <Link to="/refund.html">لغو و بازگشت وجه</Link>
          </div>
        </article>
      </div>
    </section>
  )
}
