/** Shared questionnaire options and common questions. */
  const O = (label, icon = '•', extra = {}) => ({ label, icon, ...extra });

  const AGE_RANGE_OPTIONS = [
    O('۱۸ تا ۳۰ سال', '•', { image: 'assets/age-18-30.jpg' }),
    O('۳۰ تا ۴۰ سال', '•', { image: 'assets/age-30-40.jpg' }),
    O('۴۰ تا ۵۰ سال', '•', { image: 'assets/age-40-50.jpg' }),
    O('بالای ۵۰ سال', '•', { image: 'assets/age-50-plus.jpg' }),
  ];

  const CAT = {
    general: 'سوالات کلی',
    loss: 'سوالات هدف لاغری',
    gain: 'سوالات هدف افزایش وزن',
    preg: 'سوالات هدف بارداری و شیردهی',
    pregP: 'سؤالات مخصوص بارداری',
    pregL: 'سؤالات مخصوص شیردهی',
    health: 'سوالات هدف سلامت و پاکسازی بدن',
  };

  /** یک بنر ثابت غذای رژیمی برای همهٔ سؤال‌ها */
  const QUESTION_HERO_IMAGE = 'assets/quiz-hero-diet.jpg';

  function applyHeroImages(questions) {
    return questions.map((q) => ({ ...q, heroImage: QUESTION_HERO_IMAGE }));
  }

  function withGeneral(goalQuestions) {
    return applyHeroImages(GENERAL_QUESTIONS.concat(goalQuestions));
  }

  const GENERAL_QUESTIONS = [
    { category: CAT.general, q: 'اسم شما چیست؟', type: 'text', subtitle: 'متن', placeholder: 'نام و نام خانوادگی' },
    {
      category: CAT.general,
      q: 'چند سال داری؟',
      ui: 'age-range',
      options: AGE_RANGE_OPTIONS,
    },
    {
      category: CAT.general,
      q: 'جنسیتت چیه؟',
      subtitle: 'یک گزینه را انتخاب کن',
      options: [O('زن'), O('مرد')],
    },
    { category: CAT.general, q: 'قدت چقدره؟', type: 'number', subtitle: 'سانتی‌متر', placeholder: 'مثلاً ۱۶۵', slider: { min: 120, max: 230, step: 1, default: 165, unit: 'سانتی‌متر' } },
    { category: CAT.general, q: 'وزن فعلیت چقدره؟', type: 'number', subtitle: 'کیلوگرم', placeholder: 'مثلاً ۷۲', slider: { min: 35, max: 240, step: 1, default: 68, unit: 'کیلوگرم' } },
    {
      category: CAT.general,
      q: 'میزان فعالیت روزانه‌ات چقدره؟',
      options: [O('خیلی کم'), O('کم'), O('متوسط'), O('زیاد'), O('خیلی زیاد')],
    },
    {
      category: CAT.general,
      q: 'معمولاً چند وعده در روز غذا می‌خوری؟',
      options: [O('۱ وعده'), O('۲ وعده'), O('۳ وعده'), O('بیشتر')],
    },
    {
      category: CAT.general,
      q: 'به چه غذاهایی حساسیت داری؟',
      options: [O('بدون حساسیت'), O('لبنیات'), O('آجیل'), O('تخم‌مرغ'), O('گلوتن'), O('سایر')],
      followUpText: true,
      followUpWhenLabel: 'سایر',
      followUpPlaceholder: 'نوع حساسیت را بنویسید',
    },
    {
      category: CAT.general,
      q: 'سبک تغذیه‌ات چیه؟',
      ui: 'option-cards',
      options: [
        O('معمولی', '•', { image: 'assets/diet-normal.jpg' }),
        O('گیاه‌خواری', '•', { image: 'assets/diet-vegetarian.jpg' }),
        O('وگان', '•', { image: 'assets/diet-vegan.jpg' }),
      ],
    },
    {
      category: CAT.general,
      q: 'بیماری خاص یا شرایط پزشکی داری؟',
      options: [
        O('خیر'),
        O('دیابت'),
        O('فشار خون'),
        O('بیماری کلیوی'),
        O('تیروئید'),
        O('مشکلات گوارشی'),
        O('سایر'),
      ],
      followUpText: true,
      followUpWhenLabel: 'سایر',
      followUpPlaceholder: 'نوع بیماری را بنویسید',
    },
    {
      category: CAT.general,
      q: 'دارو یا مکمل خاصی مصرف می‌کنی؟',
      options: [O('خیر'), O('بله')],
      subtitle: 'در صورت «بله» نام را در کادر بنویس',
      followUpText: true,
    },
    {
      category: CAT.general,
      q: 'چه غذاهایی را دوست نداری یا نمی‌خوری؟',
      type: 'text',
      subtitle: 'انتخاب یا متن',
      placeholder: 'مثلاً بادمجان، ماهی…',
    },
    {
      category: CAT.general,
      q: 'معمولاً چه ساعت‌هایی می‌خوابی و بیدار می‌شی؟',
      ui: 'sleep-wake',
      defaultSleep: 23,
      defaultWake: 7,
    },
    {
      category: CAT.general,
      q: 'چقدر برای آماده‌کردن غذا وقت داری؟',
      options: [O('کمتر از ۱۵ دقیقه'), O('۱۵ تا ۳۰ دقیقه'), O('بیشتر')],
    },
    {
      category: CAT.general,
      q: 'بودجه غذایی موردنظرت چقدره؟',
      options: [O('اقتصادی'), O('متوسط'), O('بدون محدودیت')],
    },
    {
      category: CAT.general,
      q: 'شغل یا فعالیت روزانه‌ات بیشتر چه شکلیه؟',
      ui: 'option-cards',
      options: [
        O('نشسته', '•', { image: 'assets/activity-sedentary.jpg' }),
        O('ترکیبی', '•', { image: 'assets/activity-mixed.jpg' }),
        O('سرپا', '•', { image: 'assets/activity-standing.jpg' }),
        O('کار فیزیکی سنگین', '•', { image: 'assets/activity-heavy.jpg' }),
      ],
    },
    {
      category: CAT.general,
      q: 'هفته‌ای چند روز ورزش می‌کنی؟',
      options: [O('۰ روز'), O('۱ روز'), O('۲ روز'), O('۳ روز'), O('۴ روز'), O('۵ روز'), O('۶ روز'), O('۷ روز')],
    },
    {
      category: CAT.general,
      q: 'هر جلسه تقریباً چقدر ورزش می‌کنی؟',
      options: [O('کمتر از ۳۰ دقیقه'), O('۳۰ تا ۶۰ دقیقه'), O('بیشتر')],
    },
    {
      category: CAT.general,
      q: 'چه نوع ورزشی انجام می‌دی؟',
      ui: 'option-cards',
      options: [
        O('قدرتی', '•', { image: 'assets/sport-strength.jpg' }),
        O('هوازی', '•', { image: 'assets/sport-cardio.jpg' }),
        O('ترکیبی', '•', { image: 'assets/sport-combined.jpg' }),
        O('سایر', '•', { image: 'assets/sport-other.jpg' }),
      ],
    },
  ];
