# نقشهٔ پروژهٔ سبزینه

| چه چیزی | کجا |
|---|---|
| اپ Flutter | `app/` |
| سایت | `site/` |
| آنبوردینگ وب (فرم ثبت‌نام) | `onboarding/` |
| پنل ادمین | `admin/` |
| بک‌اند | `backend/` |
| مرجع‌ها | `references/` |
| اسکریپت‌ها | `tool/` |

اپ، سایت، آنبوردینگ وب و پنل از یک API استفاده می‌کنند. پنل فایل استاتیک است و Nest آن را روی `/admin/` سرو می‌کند. داخل ایمیج Docker همین فایل‌ها در `/app/admin-web` قرار می‌گیرند. فرم آنبوردینگ وب در `/onboarding/` است و ارسال‌هایش به `/v1/onboarding/...` می‌رود.

## اپ

دستورها را داخل `app/` بزنید.

```text
app/
  lib/main.dart       ورود
  lib/app.dart        پوسته و ناوبری
  lib/theme.dart      ظاهر
  lib/data/           مدل، ذخیرهٔ محلی، اتصال API
  lib/screens/        صفحه‌ها
  lib/widgets/        اجزای مشترک
  android/  windows/  web/
  test/               تست
  tool/               ثبت تصویر تست
  assets/             فونت
```

داده در `lib/data` است و نمایش در `screens` و `widgets`.

## بک‌اند

`backend/src/` ماژول‌های API است. مهاجرت‌ها در `backend/migrations/`. قرارداد API در `backend/docs/`.

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

## مرجع‌ها

- `references/docs/` شرح فازها
- `references/designs/` طرح صفحه‌ها
- `references/screenshots/` تصویر تست‌ها
- `references/*.md` یادداشت بیلد، کیف پول و رابط
- `graphify-out/` خروجی ابزار گراف است، منبع کد نیست
