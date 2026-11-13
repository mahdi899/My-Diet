import { Link } from 'react-router-dom'
import { ArticleCard, useMagazine } from './ArticlesPage'

const reviews = [
  { name: 'سارا م.', text: 'برنامه روشن بود؛ دیگر وسط هفته حدس نمی‌زنم چه بخورم. وقتی سؤال داشتم، جواب متخصص سریع رسید.' },
  { name: 'امیر ح.', text: 'غذاهای آشنا توی برنامه بود و اجراش راحت‌تر از چیزی بود که فکر می‌کردم. پیگیری روزانه انگیزه می‌دهد.' },
  { name: 'نرگس ک.', text: 'برای روزهای شلوغ، وعده‌های ساده و قابل‌اجرا پیشنهاد شد. حس می‌کنم برنامه واقعاً برای زندگی خودم نوشته شده.' },
  { name: 'رضا ج.', text: 'بعد از بررسی متخصص، چند مورد اصلاح شد و دقیقاً همان چیزی شد که می‌خواستم. گفتگو داخل اپ راحت است.' },
  { name: 'مریم ع.', text: 'پرسش‌نامه کوتاه بود ولی کامل؛ از همان هفتهٔ اول فهمیدم چقدر و چه چیزی بخورم.' },
  { name: 'پریسا ل.', text: 'قدم‌های کوچک هفتگی را دوست دارم. فشار «همه‌چیز یا هیچ» ندارم و مسیر قابل ادامه است.' },
]

const steps = [
  ['۰۱ / شناخت تو', 'چند سؤال ساده', 'هدفت، سلیقه‌ات و شرایطت را بگو.'],
  ['۰۲ / پیشنهاد هوشمند', 'برنامهٔ اولیهٔ تو', 'پیشنهادی بر اساس اطلاعاتی که وارد کردی.'],
  ['۰۳ / نگاه متخصص', 'بررسی و تأیید', 'متخصص برنامه را بررسی و اصلاح می‌کند.'],
  ['۰۴ / شروع همراهی', 'یک هفته در کنار تو', 'وعده‌هایت را ببین و مسیرت را پیگیری کن.'],
]

const benefits = [
  ['۰۱', 'غذای آشنا، برنامهٔ شخصی', 'علایق، هدف و شرایط خودت را در پرسش‌نامه مشخص کن؛ نقطهٔ شروع برنامه، شناخت توست.'],
  ['۰۲', 'یک متخصص در کنار تو', 'برنامه پیش از رسیدن به دست تو بررسی می‌شود. اگر سؤالی داری یا تغییری می‌خواهی، گفتگو کن.'],
  ['۰۳', 'قدم‌های کوچک و دیدنی', 'وعده‌های انجام‌شده، روند وزن و مسیر هفتگی‌ات را در یک فضای ساده و روشن دنبال کن.'],
]

const plans = [
  ['شروع · ۱۵ روزه', '۱٬۲۹۰٬۰۰۰ تومان'],
  ['همراه · ۳۰ روزه', '۱٬۹۹۰٬۰۰۰ تومان'],
  ['VIP · ۹۰ روزه', '۸٬۹۹۰٬۰۰۰ تومان'],
]

export default function HomePage() {
  const magazine = useMagazine()
  return (
    <div>
      <section className="mx-auto grid max-w-[1180px] items-center gap-12 px-6 py-16 lg:grid-cols-2 lg:gap-20 lg:px-8">
        <div>
          <div className="mb-6 flex items-center gap-2.5 text-xs tracking-wide text-[#6e845e]">
            <span className="h-px w-6 bg-current" />
            یک مسیر تازه برای مراقبت از خودت
          </div>
          <h1 className="mb-6 text-4xl font-bold leading-tight tracking-tight lg:text-6xl">
            رژیم هوشمند،
            <br />
            <em className="relative not-italic text-[#709444]">
              مسیر کوتاه‌تر.
              <span className="absolute bottom-1 right-0 h-2 w-full rounded-full border-b-2 border-[#98b66b]" />
            </em>
          </h1>
          <p className="mb-7 max-w-md text-base leading-[2.2]">
            برنامهٔ غذایی تو باید شبیه زندگی خودت باشد.
            <br />
            در رژیم من، هوش مصنوعی پیشنهاد می‌دهد و متخصص بررسی می‌کند؛ تا با خیال راحت‌تر، قدم بعدی را برداری.
          </p>
          <Link to="/onboarding" className="inline-flex items-center gap-3 rounded-xl bg-pine px-6 py-3 text-sm font-bold text-white transition hover:bg-[#18462d]">
            شروع پرسش‌نامه
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
              <path d="M19 12H5m6-6-6 6 6 6" />
            </svg>
          </Link>
        </div>
        <div className="relative mx-auto h-[520px] w-full max-w-md">
          <div className="absolute inset-x-6 bottom-10 top-0 -rotate-[7deg] rounded-[48%_48%_24%_24%] bg-sage" />
          <img src="/assets/salad.jpg" alt="بشقاب سالاد تازه" className="relative h-full w-full rounded-[48%_48%_23px_23px] object-cover" />
          <div className="absolute -bottom-2 right-0 flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-lg">
            <span className="grid h-11 w-11 place-items-center rounded-[13px] bg-sage text-pine">
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="m5 12 4 4L19 6" /></svg>
            </span>
            <div className="text-[13px]">
              <strong className="block">هوشمند، با همراهی متخصص</strong>
              <small className="text-[11px] text-muted">از شناخت تو تا برنامهٔ غذایی تو</small>
            </div>
          </div>
        </div>
      </section>

      <section id="how" className="bg-pine py-8 text-white">
        <div className="mx-auto grid max-w-[1180px] gap-6 px-6 md:grid-cols-4 lg:px-8">
          {steps.map(([num, title, text]) => (
            <article key={num} className="border-white/20 md:border-r md:pr-5 md:last:border-0">
              <span className="block text-xs opacity-50">{num}</span>
              <h2 className="my-1 text-base font-bold">{title}</h2>
              <p className="m-0 text-[11px] text-[#c3d0bb]">{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-[1180px] gap-4 px-6 py-16 md:grid-cols-3 lg:px-8">
        {benefits.map(([index, title, text]) => (
          <article key={title} className="rounded-[22px] border border-[#e3ead8] bg-white p-6">
            <span className="text-xs text-[#6e845e]">{index}</span>
            <h2 className="mt-2 text-lg font-bold">{title}</h2>
            <p className="mt-2 text-sm leading-7 text-[#5a6b52]">{text}</p>
          </article>
        ))}
      </section>

      <section className="mx-auto grid max-w-[1180px] items-center gap-10 px-6 pb-8 lg:grid-cols-2 lg:px-8">
        <div>
          <div className="mb-3 text-xs text-[#6e845e]">رژیم من، در دسترس تو</div>
          <h2 className="text-3xl font-bold leading-snug">برنامه‌ات را ببین.<br />مسیرت را زندگی کن.</h2>
          <p className="mt-4 max-w-md leading-8 text-[#5a6b52]">هر روز بدان چه غذایی، با چه مقداری در برنامه‌ات داری. تغییر لازم بود؟ از همان‌جا با متخصصت در میان بگذار.</p>
          <ul className="mt-5 space-y-2 text-sm">
            {['جزئیات و مقدار هر وعده', 'پیگیری وضعیت بررسی و اصلاح برنامه', 'گفتگو با متخصص و ثبت بازخورد'].map((item) => (
              <li key={item} className="flex items-center gap-2">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-sage text-pine">✓</span>
                {item}
              </li>
            ))}
          </ul>
          <Link to="/onboarding" className="mt-6 inline-flex rounded-xl bg-pine px-5 py-3 text-sm font-bold text-white">شروع از پرسش‌نامه</Link>
        </div>
        <div className="mx-auto w-full max-w-sm rounded-[32px] border border-[#d7e3cc] bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between text-sm">
            <b>سلام، روزت سبز</b>
            <span className="text-muted">۹:۴۱</span>
          </div>
          <div className="rounded-2xl bg-sage p-4">
            <p className="text-xs text-[#5d7348]">کالری امروز تو</p>
            <strong className="text-3xl">۱٬۲۴۰</strong>
            <p className="text-xs text-muted">نمونهٔ نمایشی داشبورد</p>
          </div>
          <h3 className="mb-2 mt-5 text-sm font-bold">برنامهٔ امروز</h3>
          <div className="mb-2 flex items-center gap-3 rounded-2xl bg-cream p-2">
            <img src="/assets/breakfast.jpg" alt="" className="h-14 w-14 rounded-xl object-cover" />
            <div className="text-sm"><b>یک صبحانهٔ تازه</b><br /><small className="text-muted">جزئیات و مقدار وعده</small></div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl bg-cream p-2">
            <img src="/assets/salad.jpg" alt="" className="h-14 w-14 rounded-xl object-cover" />
            <div className="text-sm"><b>ناهار رنگارنگ</b><br /><small className="text-muted">جزئیات و مقدار وعده</small></div>
          </div>
        </div>
      </section>

      <section id="pricing" className="mx-auto max-w-[1180px] px-6 py-16 lg:px-8">
        <div className="mb-6 flex items-end justify-between gap-4">
          <h2 className="text-3xl font-bold">خدمات و تعرفه‌ها</h2>
          <Link to="/pricing.html" className="text-sm font-bold text-pine">جزئیات پلن‌ها</Link>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {plans.map(([name, price]) => (
            <article key={name} className="rounded-[22px] border border-[#e3ead8] bg-white p-6">
              <h3 className="font-bold">{name}</h3>
              <p className="mt-3 text-lg font-bold">{price}</p>
              <p className="text-xs text-muted">برای هر دوره</p>
            </article>
          ))}
        </div>
        <p className="mt-6 text-sm text-pine">
          <Link to="/terms.html">شرایط و ضوابط خرید</Link>
          <span className="px-2 text-muted">·</span>
          <Link to="/refund.html">لغو و بازگشت وجه</Link>
          <span className="px-2 text-muted">·</span>
          <Link to="/contact.html">تماس با ما</Link>
        </p>
      </section>

      <section className="mx-auto max-w-[1180px] px-6 pb-8 lg:px-8">
        <div className="mb-6 text-center">
          <div className="text-xs text-[#6e845e]">صدای کاربران</div>
          <h2 className="text-3xl font-bold">نظرات کاربران</h2>
        </div>
        <div className="flex gap-4 overflow-x-auto pb-2">
          {reviews.map((review) => (
            <article key={review.name} className="min-w-[280px] flex-1 rounded-[22px] border border-[#e3ead8] bg-white p-5">
              <p className="text-sm leading-7 text-[#3d5244]">{review.text}</p>
              <strong className="mt-4 block text-sm">{review.name}</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[1180px] px-6 py-12 lg:px-8">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <div className="text-xs text-[#6e845e]">مجلهٔ رژیم من</div>
            <h2 className="text-3xl font-bold">کمی بخوان، آگاهانه‌تر انتخاب کن.</h2>
          </div>
          <Link to="/articles.html" className="text-sm font-bold text-pine">همهٔ مقاله‌ها</Link>
        </div>
        {magazine.isError && <p className="text-sm text-danger">دریافت مقالات ممکن نشد.</p>}
        <div className="grid gap-6 md:grid-cols-3">
          {magazine.data?.map((item) => <ArticleCard key={item.id} item={item} />)}
        </div>
      </section>

      <section className="mx-auto mb-8 flex max-w-[1180px] flex-wrap items-center justify-between gap-4 rounded-[28px] bg-pine px-8 py-10 text-white lg:mx-auto">
        <div>
          <h2 className="text-2xl font-bold">از یک انتخاب خوب شروع کن.</h2>
          <p className="mt-2 text-sm text-[#d5e4c8]">یک برنامهٔ غذایی، متناسب با سلیقه و زندگی تو.</p>
        </div>
        <Link to="/onboarding" className="rounded-xl bg-white px-5 py-3 text-sm font-bold text-pine">شروع پرسش‌نامه</Link>
      </section>
    </div>
  )
}
