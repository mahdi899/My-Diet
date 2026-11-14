# بک‌اند Laravel سبزینه

کد API و worker در همین پوشه است: PHP 8.4، Laravel 13 و MySQL. مبنای فعلی تست MySQL 8.4 LTS است؛ نسخهٔ سرور مقصد هنوز تعیین نشده است.

اجرای برنامه به بک‌اند Node یا PostgreSQL نیاز ندارد. Node برای ساخت React و ابزار مرورگر استفاده می‌شود. PostgreSQL فقط به عنوان مبدأ خواندنیِ ابزار انتقال قابل تنظیم است؛ کد آن ابزار را تا پایان انتقال داده نگه دارید.

پوشهٔ backend هنوز روی دیسک موجود است؛ حذف بازگشتی آن توسط بررسی خودکار مجوز رد شد. تنظیمات اجرای جدید به آن وابسته نیست. مرجع تاریخی در Git و نسخهٔ بازیابی کد در .tools/legacy-backend-2f6dd66.zip موجود است. این نسخه پشتیبان دیتابیس production نیست.

## معماری

- app/Modules/*/Domain: قواعد دامنه.
- Application: use case و پورت مستقل از Laravel و SQL.
- Infrastructure: MySQL و آداپتر سرویس بیرونی.
- Presentation: HTTP و اعتبارسنجی.
- contracts/nest-routes.json: قرارداد منجمد ۲۷۱ مسیر قبلی.
- contracts/postgres-source: ۴۴ migration مبدأ برای بررسی انتقال، نه اجرا روی MySQL.

۲۷۱ مسیر ثبت شده است. این تعداد اثبات پوشش کامل تمام سناریوهای عملیاتی نیست. دستور migration:status --require-ready تا تأیید واقعی تمام gateهای عملیاتی ناموفق می‌ماند؛ فایل gateها برای عبور ظاهری تست تغییر نکرده است. مستقل شدن اجرا، به معنی تکمیل انتقال production یا حذف دادهٔ قدیمی نیست.

## اجرا

از ریشهٔ پروژه در PowerShell:

    & .\.tools\php84\php.exe backend-laravel\artisan serve --host=127.0.0.1 --port=8000

پیش از اولین اجرا، composer install، ساخت .env از .env.example، تنظیم APP_KEY و DATABASE_URL مخصوص MySQL و اجرای artisan migrate لازم است.

برای worker، APP_ROLE=worker را در فرایند مستقل تنظیم کنید و اجرا کنید:

    php artisan sabzine:work

API باید APP_ROLE=api باشد. worker شامل relay، lease دارای شناسهٔ مالکیت، پردازش job، maintenance و refresh زمان‌بندی‌شدهٔ funnel است.

JWT_SECRET، OTP_PEPPER و FIELD_KEY هنگام انتقال داده باید با مقادیر قبلی سازگار بمانند. APP_KEY جای این کلیدها نیست. مسیرها همان /v1 هستند و cookie وب sabzine_refresh حفظ شده است.

## AI و اعلان

تنظیمات اصلی به ProviderClient/ModelPools، ConfiguredDraftProvider، ConfiguredCoachModel و FcmPush متصل‌اند. آداپترهای ثابت فقط در تست‌های قدیمی به‌صراحت تزریق می‌شوند.

برای AI واقعی، provider و کلید رمز‌شده، مدل‌ها و poolهای plan_draft و nutrition_coach را در پنل تنظیم و AI_HTTP=true کنید. قیمت ورودی/خروجی مدل باید برای اعمال سقف هزینه تعیین شود. مصرف و رزروهای باز در کنترل بودجه لحاظ می‌شوند؛ رزرو باقی‌مانده پس از قطع فرایند نیازمند بررسی است و خودکار آزاد نمی‌شود.

در نبود تنظیمات، خطای قابل تشخیص برمی‌گردد؛ پاسخ ساختگی موفقیت تولید نمی‌شود. پیش‌نویس AI از غذاهای کاتالوگ ساخته می‌شود، کنترل حساسیت و مقدار دارد و تا تأیید متخصص منتشر نمی‌شود.

Firebase از تنظیمات حساب سرویس رمز‌شده استفاده می‌کند. ارسال فقط پس از پاسخ موفق FCM تأیید می‌شود. هیچ credential واقعی در تست‌ها استفاده نمی‌شود.

SSE رویدادهای جدید را در اتصال باز دنبال می‌کند، heartbeat می‌دهد و since یا Last-Event-ID را با دقت میکروثانیه می‌پذیرد. زمان اتصال محدود است تا کلاینت reconnect کند.

## Docker

از ریشهٔ پروژه:

    docker compose -f backend-laravel/docker-compose.yml up --build -d

وب روی پورت ۸۰۰۰ است. سرویس‌ها MySQL، migration، PHP-FPM، Nginx و worker هستند. React در مرحلهٔ build ساخته می‌شود؛ سرویس Node در runtime وجود ندارد. پنل‌های قدیمی نیز در image PHP قرار می‌گیرند.

مقادیر پیش‌فرض Compose مخصوص توسعه‌اند. برای production، NODE_ENV، APP_ENV، کلیدها، پیامک، درگاه، URL عمومی و CORS را صریح تنظیم کنید. build و rollout واقعی Docker روی این دستگاه بدون Docker قابل تأیید نیست.

## تست مستقل

از ریشهٔ پروژه:

    node tool/laravel-contracts.cjs --check
    node tool/test-laravel.cjs --browser

runner یک MySQL موقت می‌سازد و به DATABASE_URL فایل .env وصل نمی‌شود. تست‌های PHP با --fail-on-skipped اجرا می‌شوند. تست مرورگر سایت، ورود و refresh مدیر، ورود پزشک، آنبوردینگ مشتری و اجرای worker را به PHP/MySQL واقعی وصل می‌کند. نبود Playwright خطاست و به عنوان تست موفق شمرده نمی‌شود.

PHP_BINARY و MYSQL_HOME برای محیط دیگر قابل تنظیم‌اند. برای اجرای مستقیم PHPUnit، MYSQL_TEST_URL و MYSQL_BACKUP_TEST_URL باید به دیتابیس disposable تست اشاره کنند؛ URL دوم برای ساخت دیتابیس restore مجوز کافی لازم دارد.

تست آداپترهای واقعی از HTTP fake کنترل‌شده استفاده می‌کند؛ provider، امضا، خطا، هزینه و اعتبارسنجی بررسی می‌شوند. این تست، اتصال زنده به حساب AI/Firebase یا پرداخت واقعی را تأیید نمی‌کند.

تست‌های مقایسه و انتقال با مرجع Node در محیط موقت اجرا شدند. fixtureهای رمزنگاری، پرسش‌نامه، محاسبات تغذیه و برنامه در همین پوشه مستقل‌اند. CI اصلی بدون checkout پوشهٔ backend اجرا می‌شود؛ workflow قدیمی فقط به صورت دستی برای مرجع قابل اجراست.

## انتقال داده و بکاپ

schema معادل ۱۱۷ جدول محصول، FK، CHECK، index و trigger در MySQL موجود است. برای تمرین انتقال، مبدأ را فقط‌خواندنی و مقصد را خالی و مستقل تنظیم کنید. پیش از اولین migrate مقصد تمرین، MIGRATION_SKIP_PRODUCT_SEEDS=true لازم است.

    php artisan migration:preflight
    php artisan migration:import-product
    php artisan migration:import-product --execute

واردکننده ظرفیت نوع‌ها، FK، تعداد و checksum را پیش از commit بررسی می‌کند. اجرای production هنوز تا تکمیل gateها مسدود است. انتقال pg-boss، analytics و رسانه‌ها نیز باید در cutover واقعی تطبیق داده شود.

دستور زیر واقعاً dump می‌گیرد، در دیتابیس تازه restore می‌کند، checksum/تعداد تمام جدول‌ها و triggerها را بررسی می‌کند و مقصد موقت را پاک می‌کند:

    php artisan sabzine:rehearse-backup --url=<URL دیتابیس تست>

فقط نام دارای _test یا _rehearsal پذیرفته می‌شود. ابزارهای mysql و mysqldump باید در MYSQL_HOME/bin باشند. نبود ابزار یا شکست restore خطاست. این دستور دادهٔ مبدأ را حذف نمی‌کند.

بازگشت صرف ترافیک به PostgreSQL بعد از شروع نوشتن در MySQL، rollback معتبر نیست. اطلاعات جدید، فایل‌ها و صف‌ها نیز باید تعیین تکلیف شوند. هیچ دیتابیس production با حذف پوشهٔ بک‌اند پاک نمی‌شود.
