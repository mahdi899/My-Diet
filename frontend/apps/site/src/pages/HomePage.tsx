export default function HomePage() {
  return (
    <div>
      {/* Hero Section */}
      <section className="max-w-[1180px] mx-auto px-8 py-16">
        <div className="grid grid-cols-2 gap-20 items-center">
          <div>
            <div className="flex items-center gap-2.5 text-[#6e845e] text-xs tracking-wide mb-6">
              <span className="w-6 h-px bg-current"></span>
              یک مسیر تازه برای مراقبت از خودت
            </div>
            <h1 className="text-5xl lg:text-6xl font-bold leading-tight tracking-tight mb-6">
              رژیم هوشمند،<br />
              <em className="not-italic text-[#709444] relative">
                مسیر کوتاه‌تر.
                <span className="absolute bottom-0 right-0 w-full h-2 border-b-2 border-[#98b66b] rounded-full"></span>
              </em>
            </h1>
            <p className="text-base leading-[2.2] max-w-md mb-7">
              برنامهٔ غذایی تو باید شبیه زندگی خودت باشد.<br />
              در رژیم من، هوش مصنوعی پیشنهاد می‌دهد و متخصص بررسی می‌کند؛ تا با خیال راحت‌تر، قدم بعدی را برداری.
            </p>
            <div className="flex items-center gap-3.5">
              <button className="inline-flex items-center justify-center gap-3 px-6 py-3 rounded-xl bg-pine text-white font-bold text-sm hover:bg-pine/90 transition-all">
                دانلود اپلیکیشن رژیم من
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                  <path d="M19 12H5m6-6-6 6 6 6"/>
                </svg>
              </button>
            </div>
          </div>

          <div className="relative h-[550px] p-[25px_10px_15px]">
            <div className="absolute inset-[0_25px_45px_-5px] bg-sage rounded-[48%_48%_24%_24%] -rotate-[7deg]"></div>
            <img 
              src="/assets/salad.jpg" 
              alt="بشقاب سالاد تازه" 
              className="relative rounded-[48%_48%_23px_23px] h-full w-full object-cover object-center"
            />
            
            <div className="absolute bottom-0 -right-8 bg-white p-4 pr-5 border border-gray-100 rounded-2xl shadow-lg flex gap-3.5 items-center text-[13px]">
              <span className="w-11 h-11 bg-sage inline-flex items-center justify-center rounded-[13px] text-pine flex-shrink-0">
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                  <path d="m5 12 4 4L19 6"/>
                </svg>
              </span>
              <div>
                <strong className="block">هوشمند، با همراهی متخصص</strong>
                <small className="block text-muted text-[11px]">از شناخت تو تا برنامهٔ غذایی تو</small>
              </div>
            </div>

            <svg className="absolute w-[74px] h-[74px] top-2.5 -left-5 -rotate-[20deg] bg-cream rounded-full p-3 text-[#638447]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="M8 8c-4 2-5 10-5 13 5-1 11-4 13-8L8 8Z M10 5c0-4 5-4 5-3l-2 5c5-4 8-1 8 0l-7 3M6 12l3 2m-5 2 3 1"/>
            </svg>
          </div>
        </div>
      </section>

      {/* Process Steps */}
      <section className="bg-pine text-white py-8">
        <div className="max-w-[1180px] mx-auto px-8">
          <div className="grid grid-cols-4 gap-6">
            <article className="border-r border-white/20 pr-5 pl-5">
              <span className="text-xs opacity-50 block">۰۱ / شناخت تو</span>
              <h3 className="text-base my-0.5">چند سؤال ساده</h3>
              <p className="text-[#c3d0bb] text-[11px] m-0">هدفت، سلیقه‌ات و شرایطت را بگو.</p>
            </article>
            <article className="border-r border-white/20 pr-5 pl-5">
              <span className="text-xs opacity-50 block">۰۲ / پیشنهاد هوشمند</span>
              <h3 className="text-base my-0.5">برنامهٔ اولیهٔ تو</h3>
              <p className="text-[#c3d0bb] text-[11px] m-0">پیشنهادی بر اساس اطلاعاتی که وارد کردی.</p>
            </article>
            <article className="border-r border-white/20 pr-5 pl-5">
              <span className="text-xs opacity-50 block">۰۳ / نگاه متخصص</span>
              <h3 className="text-base my-0.5">بررسی و تأیید</h3>
              <p className="text-[#c3d0bb] text-[11px] m-0">متخصص برنامه را بررسی و اصلاح می‌کند.</p>
            </article>
            <article className="pl-5">
              <span className="text-xs opacity-50 block">۰۴ / شروع همراهی</span>
              <h3 className="text-base my-0.5">یک هفته در کنار تو</h3>
              <p className="text-[#c3d0bb] text-[11px] m-0">وعده‌هایت را ببین و مسیرت را پیگیری کن.</p>
            </article>
          </div>
        </div>
      </section>
    </div>
  )
}
