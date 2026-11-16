# رژیم من

| پوشه | محتوا |
|---|---|
| app | اپ Flutter |
| frontend | سایت و پنل‌های React |
| site | نسخهٔ استاتیک سایت |
| admin / doctor | فایل‌های پنل قدیمی |
| backend-laravel | API و worker با PHP/Laravel و MySQL |
| references | اسناد و منابع |
| tool | ابزار ساخت و تست |

API را از backend-laravel اجرا کنید. راهنمای اجرا، تنظیمات، انتقال داده و تست مستقل در backend-laravel/README.md است.

محیط محلی: همه‌چیز زیر **XAMPP** — PHP 8.4 در `C:\xampp\php`، MySQL 8.4 در `C:\xampp\mysql84`، پورت `3306`، اتصال در `backend-laravel/.env`. وضعیت: `powershell -File tool/local-dev-stack.ps1 -Status`. جزئیات: `.cursor/rules/local-dev-stack.mdc`.

تست محلی از ریشه: node tool/test-laravel.cjs --browser

پوشهٔ backend مرجع قدیمی Node است و هنوز روی دیسک وجود دارد؛ دستور حذف آن توسط بررسی خودکار مجوز رد شد. اجرای جدید از backend-laravel انجام می‌شود و CI مستقل پوشهٔ قدیمی را checkout نمی‌کند. نسخهٔ بازیابی کد در .tools/legacy-backend-2f6dd66.zip و تاریخچهٔ Git موجود است. PostgreSQL فقط مبدأ اختیاری انتقال دادهٔ نسخهٔ جدید است؛ حذف دادهٔ سرور و cutover production انجام نشده است.