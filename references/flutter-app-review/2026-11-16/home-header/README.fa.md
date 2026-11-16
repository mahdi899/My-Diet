# اجرای طرح تأییدشدهٔ بالای خانه

محل اجرا: `D:/ad/My-Diet/app`.

- خوشامدگویی شخصی با نام کاربر، آیکن متناسب با ساعت، عکس پروفایل و تاریخ شمسی واقعی.
- کارت نعناعی با جوانهٔ طرح تأییدشده و عنوان متناسب با وعدهٔ بعدی؛ وضعیت مرور روز و انتظار برای برنامه نیز متن و اقدام متناسب دارند.
- نوار وعده‌های ثبت‌شده از ثبت واقعی همان روز؛ صفر ثبت یعنی همهٔ خانه‌ها خالی. ثبت وعده و برگرداندن آن شمارنده را به‌روز می‌کند. «ثبت‌شده» به معنی تأیید رعایت رژیم یا پاداش نیست.
- استفاده از پس‌زمینهٔ سفید خانه و فونت و رنگ‌های مشترک موجود.
- چیدمان در عرض ۳۲۰ و متن ۱٫۵ برابر قابل اسکرول است و خطای سرریز ندارد.

## خروجی واقعی

تصاویر از ویجت واقعی `PanelShell` با ساعت و دادهٔ نمایشی ثابت گرفته شده‌اند:

- [خانه](implemented/home.png)
- [پس از یک ثبت](implemented/home-one-record.png)
- [پس از ثبت همهٔ وعده‌ها](implemented/home-complete.png)
- [متن بزرگ در عرض کم](implemented/home-large-text.png)
- [خلاصه و آب در پایین خانه](implemented/daily-summary.png)
- [طرح تصویری تأییدشده](approved-concept.png)
- [قبل از اجرای سربرگ جدید](before.png)

بازتولید از پوشهٔ `app`:

```powershell
flutter test --no-pub ../references/flutter-app-review/2026-11-16/home-header/capture.dart --reporter expanded
```

## بررسی

۴۵ تست مرتبط موفق؛ بررسی Flutter بدون ایراد؛ تست گرفتن اسکرین نیز موفق. تست‌ها شامل ثبت و برگرداندن وعده، تغییر وعدهٔ بعدی، مرور روز، انتظار برای برنامه، حفظ اقدام پروفایل، نام فارسی بلند و عرض کم هستند. تست‌های موجود با متن خوشامدگویی جدید و اسکرول به محل جدید کنترل‌ها هماهنگ شده‌اند.

## دارایی تصویر

ابزار: built-in `image_gen` با مرجع طرح تأییدشده. تصویر خروجی با شفافیت واقعی RGBA، آلفا از ۰ تا ۲۵۵، در مسیر زیر کپی شده است:

`D:/ad/My-Diet/app/assets/images/home/sprout_welcome.png`

تصویر در اندازهٔ نمایشی محدود decode می‌شود و یک تصویر تزئینی است. در صورت نبودن دارایی، جوانهٔ Flutter موجود جای آن را می‌گیرد. متن و آمار داخل تصویر نیستند و با Flutter رندر می‌شوند.

پرامپت نهایی:

```text
Use case: ui-mockup supporting production illustration. Reference image is approved Persian diet-app home mockup. Create ONLY the standalone tiny smiling sprout planter illustration seen on the LEFT inside its mint panel, as a reusable production asset on genuinely transparent background. Match reference character: exactly two fresh green leaves, short green stems, squat off-white ceramic pot, dark emerald thick lip, happy closed curved eyes and small gentle smile, pale mint circular cheek dots. Refined soft 3D wellness illustration, subtle diffuse daylight, original plant character, emerald brand, simple recognizable silhouette. Character centered, full plant and pot visible with 10% transparent padding; pot bottom softly shaded with a very faint compact grounding shadow. Three small dark green greeting strokes above upper right leaf as reference. No mint rectangle, no circular backdrop, no UI, no text, no letters, no numerals, no food, no extra objects, no watermark. Small asset must remain legible at 96 logical pixels. Do not recreate the whole screenshot. Preserve actual alpha transparency.
```
