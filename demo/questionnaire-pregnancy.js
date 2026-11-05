/** Goal questionnaire: بارداری و شیردهی. */
const PREGNANCY_QUESTIONS = [
    {
      category: CAT.preg,
      q: 'در چه مرحله‌ای هستی؟',
      options: [O('باردار هستم'), O('در دوران شیردهی هستم'), O('هم باردار هستم و هم شیردهی می‌کنم')],
    },
    { category: CAT.pregP, q: 'در هفته چندم بارداری هستی؟', type: 'number', subtitle: 'هفته بارداری', placeholder: 'مثلاً ۱۲' },
    { category: CAT.pregP, q: 'قبل از بارداری چند کیلوگرم وزن داشتی؟', type: 'number', subtitle: 'کیلوگرم', placeholder: 'وزن قبل از بارداری' },
    {
      category: CAT.pregP,
      q: 'بارداری تو از چه نوعیه؟',
      options: [O('تک‌قلو'), O('دوقلو'), O('سه‌قلو یا بیشتر')],
    },
    {
      category: CAT.pregP,
      q: 'آیا پزشک برای وزن‌گیری یا تغذیه‌ات توصیه خاصی داشته؟',
      options: [
        O('خیر'),
        O('بله، کنترل افزایش وزن'),
        O('بله، نیاز به افزایش وزن بیشتر'),
        O('بله، محدودیت غذایی یا توصیه پزشکی دیگر'),
      ],
    },
    {
      category: CAT.pregP,
      q: 'در دوران بارداری کدام مشکلات را تجربه می‌کنی؟',
      options: [O('تهوع'), O('استفراغ'), O('یبوست'), O('سوزش معده'), O('بی‌اشتهایی'), O('هیچ‌کدام')],
    },
    {
      category: CAT.pregP,
      q: 'آیا به یکی از شرایط زیر مبتلا هستی؟',
      options: [
        O('دیابت بارداری'),
        O('فشار خون بالا یا پره‌اکلامپسیا'),
        O('کم‌خونی'),
        O('بیماری تیروئید'),
        O('سایر مشکلات پزشکی'),
        O('هیچ‌کدام'),
      ],
    },
    {
      category: CAT.pregP,
      q: 'چه مکمل‌هایی مصرف می‌کنی؟',
      options: [O('اسید فولیک'), O('آهن'), O('ویتامین D'), O('مولتی‌ویتامین بارداری'), O('سایر'), O('هیچ‌کدام')],
    },
    {
      category: CAT.pregP,
      q: 'آیا پزشک مصرف غذا یا مکمل خاصی را برای تو محدود یا توصیه کرده؟',
      options: [O('خیر'), O('بله')],
      followUpText: true,
    },
    { category: CAT.pregL, q: 'چند ماه از زایمانت گذشته؟', type: 'number', subtitle: 'عدد', placeholder: 'مثلاً ۴' },
    {
      category: CAT.pregL,
      q: 'به چه شکلی به نوزادت شیر می‌دی؟',
      options: [O('فقط شیر مادر'), O('ترکیبی از شیر مادر و شیر خشک'), O('شیردهی کم یا گهگاهی')],
    },
    { category: CAT.pregL, q: 'چند ماهه که شیردهی را شروع کردی؟', type: 'number', subtitle: 'عدد', placeholder: 'مثلاً ۲' },
    { category: CAT.pregL, q: 'وزنت قبل از بارداری چقدر بوده؟', type: 'number', subtitle: 'کیلوگرم', placeholder: 'وزن قبل از بارداری' },
    {
      category: CAT.pregL,
      q: 'هدفت در دوران شیردهی چیه؟',
      options: [O('تغذیه سالم و متعادل'), O('حفظ وزن فعلی'), O('بازگشت تدریجی به وزن قبل از بارداری'), O('تأمین انرژی بیشتر')],
    },
    {
      category: CAT.pregL,
      q: 'وضعیت انرژی و اشتهای خودت را چطور ارزیابی می‌کنی؟',
      options: [O('انرژی و اشتهای مناسبی دارم'), O('بیشتر اوقات خسته‌ام'), O('اشتهای زیادی دارم'), O('اشتهای کمی دارم')],
    },
    {
      category: CAT.pregL,
      q: 'آیا درباره میزان شیر یا رشد نوزاد نگرانی پزشکی مطرح شده؟',
      options: [O('خیر'), O('بله'), O('در حال بررسی توسط پزشک هستم')],
    },
    {
      category: CAT.pregL,
      q: 'آیا مکمل یا داروی خاصی در دوران شیردهی مصرف می‌کنی؟',
      options: [O('خیر'), O('بله')],
      followUpText: true,
    },
  ];
window.SABZINE_GOALS = window.SABZINE_GOALS || {};
window.SABZINE_GOALS.pregnancy = { id: 'pregnancy', title: 'بارداری و شیردهی', badge: 'ایمن و تخصصی', icon: '🤰', image: 'assets/bowl.jpg', desc: 'تغذیه دوران بارداری و شیردهی با توجه به وضعیت پزشکی', calories: '۲,۲۵۰ کیلوکالری در روز', questions: withGeneral(PREGNANCY_QUESTIONS) };
