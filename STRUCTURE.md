# ساختار پروژه

بک‌اند یک مونولیت ماژولار Laravel با MySQL است. API و worker فرایندهای مستقل یک محصول و یک دیتابیس‌اند.

| بخش | مسیر |
|---|---|
| API و منطق کسب‌وکار | backend-laravel/app/Modules |
| دامنه، سناریو و پورت | Modules/*/Domain و Modules/*/Application |
| MySQL و سرویس بیرونی | Modules/*/Infrastructure |
| HTTP | Modules/*/Presentation |
| DI | backend-laravel/app/Providers/AppServiceProvider.php |
| مسیرها | backend-laravel/routes/api.php |
| schema و انتقال داده | backend-laravel/database و app/Shared/Infrastructure |
| قراردادهای تاریخی API و SQL | backend-laravel/contracts |
| تست PHP و fixture مستقل | backend-laravel/tests |
| تست مرورگر مستقل | tool/laravel-browser.spec.cjs |
| فرانت React | frontend |
| اپ Flutter | app |
| پنل‌های قدیمی | admin و doctor |
| سایت استاتیک | site |

ماژول‌ها شامل Identity، Questionnaire، Onboarding، Food، Publishing، Money، Plans، Tracking، Shopping، Rewards، Feedback، Messaging، Realtime، Coach، Ai، Reports، Admin، Health، Metrics و Worker هستند.

Domain و Application به HTTP و SQL وابسته نمی‌شوند. تراکنش‌های مشترک پول، سفارش، برنامه، ledger و outbox باید اتمی بمانند. محتوای منتشرشدهٔ برنامه تغییرپذیر نیست؛ اصلاح با نسخهٔ جدید انجام می‌شود.

Dockerfile چندمرحله‌ای React را می‌سازد و PHP-FPM و Nginx را جدا اجرا می‌کند. پنل‌ها همراه image کپی می‌شوند. در runtime سرویس Node یا PostgreSQL وجود ندارد. Node ابزار ساخت فرانت و اجرای تست مرورگر است.

منبع دادهٔ قبلی برای تمرین import فقط‌خواندنی است. guard آمادگی production و gateهای عملیاتی مستقل از حذف کد محلی نگهداری می‌شوند. راهنمای کامل اجرا و محدودیت‌های تأیید محیطی در backend-laravel/README.md است.
