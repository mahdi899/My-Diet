import '../domain/commerce/commerce.dart';

const subscriptionPlanOffers = <SubscriptionPlanOffer>[
  SubscriptionPlanOffer(
    id: 'weekly',
    title: 'شروع',
    description: 'یک شروع مشخص، متناسب با تو',
    days: 15,
    priceToman: 1290000,
    features: [
      'برنامه تغذیه اختصاصی با متخصص',
      'جایگزین‌های غذایی متناسب با سلیقه‌ات',
      'لیست خرید برنامه',
    ],
  ),
  SubscriptionPlanOffer(
    id: 'monthly',
    title: 'همراه',
    description: 'زمان بیشتر، همراهی نزدیک‌تر',
    days: 30,
    priceToman: 1990000,
    features: [
      'همه امکانات پلن شروع',
      '۲ نوبت بازبینی و اصلاح برنامه',
      'پیگیری هفتگی روند و اجرای برنامه',
      'پشتیبانی متنی در طول دوره',
    ],
  ),
  SubscriptionPlanOffer(
    id: 'quarterly',
    title: 'VIP',
    description: 'همراهی خصوصی و پیوسته',
    days: 90,
    priceToman: 8990000,
    features: [
      'برنامه اختصاصی و همراهی متخصص',
      '۶ نوبت بازبینی و اصلاح برنامه',
      '۳ جلسه آنلاین با متخصص منتخب',
      'پیگیری هفتگی و پشتیبانی اولویت‌دار',
      'برنامه حفظ عادت‌ها در پایان دوره',
    ],
  ),
];
