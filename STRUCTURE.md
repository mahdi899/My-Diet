# نقشهٔ پروژهٔ سبزینه

پنج سطح محصول داریم و یک بک‌اند. بک‌اند را به چهار سرویس جدا تقسیم نکن: پرداخت، پروفایل، سفارش برنامه و پاداش باید در یک تراکنش PostgreSQL بنشینند. فرایندها دو تا هستند، هر دو از همین کد: `api` و `worker`.

آدرس‌های عمومی و اسکریپت دیپلوی به نام پوشه‌های ریشه وابسته‌اند. این نام‌ها را عوض نکن.

| سطح | رابط | بک‌اند |
|---|---|---|
| اپ | `app/` | مسیرهای `v1/me`، `v1/auth`، مربی، برنامه، کیف پول، پیگیری |
| سایت | `site/` | فایل استاتیک. مجله از `site/magazine.json` خوانده می‌شود |
| آنبوردینگ وب | `onboarding/` | `v1/onboarding/...`، `v1/public/onboarding-...`، `v1/me/onboarding-transfers` |
| ادمین | `admin/` | `v1/admin/...` |
| پزشک | `doctor/` | `v1/specialist/...` و `v1/specialists` |

`doctor/index.html` روی `/doctor/` سرو می‌شود و اسکریپت مشترک را از `/admin/` می‌گیرد. داخل ایمیج، ادمین در `/app/admin-web` و پزشک در `/app/doctor-web` است. سایت و آنبوردینگ را Nginx جدا سرو می‌کند، نه پروسهٔ API.

## پیدا کردن بک‌اند

منطق دامنه داخل ماژول خودش است. کنترلر گاهی کنار همان ماژول است و گاهی، برای کار پنل، داخل `backend/src/admin/`.

| اگر این را می‌خواهی | این‌جا را باز کن |
|---|---|
| ورود، نشست، پروفایل من | `backend/src/identity/` |
| پرسش‌نامهٔ اپ و نسخهٔ سوال‌ها | `backend/src/questionnaire/` |
| آنبوردینگ اپ (پیش‌نویس، رضایت، پروفایل) | `backend/src/onboarding/` |
| ارسال فرم وب، سوالات عمومی هدف، عضویت شمارنده | `backend/src/admin/onboarding-web.controller.ts` |
| پرداخت آنبوردینگ وب | `backend/src/admin/onboarding-transfers.controller.ts` |
| برنامه، پیش‌نویس، انتشار | `backend/src/plans/` |
| کیف پول و درگاه | `backend/src/money/` و `backend/src/adapters/` |
| غذا و کاتالوگ؛ مسیر ادمین غذا هم همین‌جاست | `backend/src/food/` |
| مربی | `backend/src/coach/` |
| ثبت وعده، وزن، نظر عمومی | `backend/src/tracking/` |
| پیام | `backend/src/messaging/` |
| خرید لیست | `backend/src/shopping/` |
| پاداش و استریک | `backend/src/rewards/` |
| گزارش هفتگی کاربر، پزشک، متریک ادمین | `backend/src/feedback/` |
| مجله و رضایت‌نامه‌های عمومی؛ نوشتن مقاله برای ادمین | `backend/src/publishing/` |
| تنظیم AI | `backend/src/ai/ai-admin.controller.ts` |
| داشبورد، کاربران، پزشکان، سفارش‌ها | `backend/src/admin/admin.controller.ts` |
| لینک کمپین | `backend/src/admin/campaign-links.controller.ts` |
| آنالیتیکس وب | `backend/src/admin/web-analytics.controller.ts` |
| صف، outbox، ساعت تهران | `backend/src/jobs/` و `backend/src/common/` |
| مهاجرت دیتابیس | `backend/migrations/` |

قانون ماژول: جدول ماژول دیگر را مستقیم ننویس. استثنا همان تراکنش‌های مشترکی است که در `backend/docs/adr/0001-modular-monolith-nestjs.md` آمده.

## اپ

دستورها را داخل `app/` بزن. پروژهٔ اندروید همین‌جا است: `app/android/`. پوشهٔ `android/` در ریشهٔ مخزن اضافه بود و برداشته شد.

```text
app/lib/
  main.dart
  app.dart                 پوسته و ناوبری
  core/                    ظاهر، حرکت، شبکه، عکس غذا
  features/coach/          برش تمیز: domain، data، application، presentation
  features/home|plan|shell نمایش تب‌ها
  domain/                  قرارداد تجارت، برنامه، آنبوردینگ
  data/                    ذخیرهٔ محلی و کلاینت HTTP
  presentation/            صفحه‌ها و ویجت‌های مشترک
```

کد تازهٔ اپ را مثل `features/coach/` برش بده: دامنه، داده، کاربرد، نمایش. `presentation/screens/` و `data/` کد قبلی‌اند؛ اپ منتشرشده فقط نقش کاربر را نشان می‌دهد. صفحه‌های قدیمی کارکنان داخل اپ برای تست مانده‌اند. پنل زنده `admin/` و `doctor/` است.

## سایت و آنبوردینگ و پنل

فایل‌ها تخت‌اند چون Nginx و تست‌ها همان مسیر URL را می‌خوانند (`/onboarding/quiz.html`، `/admin/ui.js`). زیرپوشه ساختن بدون عوض کردن `src` در HTML، لینک تولید را می‌شکند.

## چه چیز این‌جا محصول نیست

| مسیر | نقش |
|---|---|
| `references/` | طرح، سند فاز، تصویر تست |
| `references/prompts/` | پیش‌نویس پرامپت تصویر؛ از ریشه به این‌جا منتقل شد |
| `tool/` | دیپلوی، پیش‌نمایش، ساخت کاتالوگ و کلید آنبوردینگ |
| `graphify-out/` | خروجی ابزار گراف. منبع کد نیست |
| `backend/docs/` | قرارداد API و ADR |

## اجرا

```powershell
cd app
flutter pub get
flutter run -d chrome --dart-define=API_BASE_URL=http://127.0.0.1:3000
```

```powershell
cd backend
npm run start:dev
```

پنل: http://127.0.0.1:3000/admin/
پزشک: http://127.0.0.1:3000/doctor/
