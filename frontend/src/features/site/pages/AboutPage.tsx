export default function AboutPage() {
  const steps = [
    ['چند سؤال دربارهٔ خودت', 'هدف، سلیقه و شرایطت را در پرسش‌نامه می‌گویی.'],
    ['پیشنهاد هوشمند', 'برنامهٔ اولیه با وعده‌ها بر اساس پاسخ‌های تو آماده می‌شود.'],
    ['بررسی متخصص', 'متخصص برنامه را می‌بیند، اصلاح می‌کند و تأیید می‌کند.'],
    ['همراهی در اپ', 'وعده‌ها و پیگیری روزانه؛ گفتگو با متخصص در اپ.'],
  ]
  return (
    <section className="mx-auto max-w-[1180px] px-6 py-12">
      <img src="/assets/vegetables.jpg" alt="سبزیجات تازه" className="mb-8 h-80 w-full rounded-[30px] object-cover" />
      <h1 className="text-4xl font-bold">برنامه‌ای که با زندگی تو جور دربیاید</h1>
      <p className="mt-4 max-w-3xl leading-8 text-[#5a6b52]">رژیم من برای روزهای شلوغ ساخته شده؛ مسیر روشن از شناخت تو تا وعده‌های روزانه‌ات. در اپلیکیشن جزئیات هر وعده را می‌بینی و با متخصص گفتگو می‌کنی.</p>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {steps.map(([title, text]) => (
          <article key={title} className="rounded-[18px] border border-[#e3ead8] bg-white p-5">
            <h2 className="font-bold">{title}</h2>
            <p className="mt-2 text-sm text-muted">{text}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
