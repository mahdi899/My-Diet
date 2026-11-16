# پیاده‌سازی طرح تأییدشده

کدها در D:/ad/My-Diet قرار دارند. تصاویر cooking-concept.png و status-concept.png همان طرح‌های تأییدشده‌اند. پوشهٔ implemented اسکرین‌شات ویجت‌های واقعی Flutter با دادهٔ نمونه را نگه می‌دارد؛ تصویر آشپزی شامل مقادیر نمونه است.

تغییرها: عکس غذا و مواد، مراحل شماره‌دار، تایمر جمع‌وجور و کنترل خروج همواره در دسترس؛ تصویرسازی مستقل برای وضعیت برنامه و خطای پرداخت؛ مسیر مراحل مطابق وضعیت واقعی؛ حفظ پلن انتخابی و کلید همان پرداخت هنگام بررسی نتیجهٔ نامشخص؛ دکمهٔ پشتیبانی به گفتگوی موجود اپ متصل است.

۷۲ تست مرتبط پاس شد. flutter analyze بدون ایراد بود. تایمر همچنان اعلان بیرون از اپ ندارد و پایان آشپزی ثبت مصرف وعده نیست.

## تصاویر واقعی

- implemented/cooking.png
- implemented/cooking-timer.png
- implemented/specialist-review.png
- implemented/payment-error.png
- implemented/plan-error.png

گرفتن مجدد تصاویر، از پوشهٔ app:

```powershell
flutter test --no-pub ../references/flutter-app-review/2026-11-16/approved-ui/capture_approved_ui.dart
```

## فایل‌های تولیدشده

ابزار ساخت: imagegen داخلی؛ از CLI استفاده نشده است. تصویر status-concept.png مرجع سبک تصویرسازی‌های شفاف بود. خروجی‌های اصلی در Codex حفظ شده‌اند و نسخهٔ مصرفی داخل پروژه کپی شده است.

- app/assets/images/journey/plan_review.png — تصویرسازی برنامه، نشان متخصص و گلدان؛ پس‌زمینه شفاف.
- app/assets/images/journey/payment_issue.png — رسید پرداخت و نشان اخطار؛ پس‌زمینه شفاف.
- app/assets/photo/ingredient/raw_fish_fillet.png — فیلهٔ خام ماهی.
- app/assets/photo/ingredient/fresh_lemon_halves.png — لیمو.
- app/assets/photo/ingredient/saffron_threads_bowl.png — زعفران.

سه عکس مواد به manifest کتابخانهٔ عکس اضافه شده‌اند و بر اساس نام مواد انتخاب می‌شوند؛ تصویر غذا همچنان از کتابخانهٔ خود اپ می‌آید. تصویرسازی‌ها تزئینی‌اند و وضعیت برنامه و پرداخت از دادهٔ واقعی نمایش داده می‌شود.

## پرامپت‌های نهایی

### plan_review.png

Use case: compositing / illustration-story. The attached UI concept is a STYLE REFERENCE and subject reference. Create ONLY the isolated illustration used near the top of the LEFT screen: a warm ivory meal-plan clipboard slightly angled, pale golden rim, deep emerald clip, three tiny beautiful food photos in the rows (salmon and greens, berries, mixed vegetables), short neutral gray line marks to the right of each food photo. A tiny friendly plant companion with two fresh green leaves in a round cream pot with simple happy face stands to the right. On the bottom left a circular deep emerald medallion with a thin white outline icon of a nutritionist wearing a headscarf and a small check badge. Match the approved concept's elegant soft tactile 3D illustrative style, warm natural soft lighting, subtle dimensionality and grounded small soft shadow. Main clipboard and pot occupy the frame, keep the entire object uncut, no huge empty padding. Transparent background. NO UI screen, NO titles, NO writing, NO Persian letters, NO English, NO watermark. Do not recreate a full interface. Return a landscape illustration about 4:3 ratio. This is a production app asset placed on a cream screen.

### payment_issue.png

Use case: compositing / illustration-story. The attached UI concept is a STYLE REFERENCE and subject reference. Create ONLY the isolated illustration near the top of the RIGHT screen: a warm ivory paper payment receipt tilted slightly with a soft zigzag upper edge and curled lower edge, a small thin emerald credit card outline at the top, three soft gray short line marks representing writing (no actual letters). A small coral-orange circular alert medallion with a white exclamation mark leans against the receipt's lower right with two tiny coral ray accents. Match the approved concept's elegant soft tactile 3D illustrative style, warm soft natural lighting, gently beveled material, restrained grounded soft shadow. Keep the entire object uncut, composition compact without huge empty padding. Transparent background. NO UI screen, NO headings, NO text other than the single exclamation mark, NO Persian/English words, NO watermark. Return a landscape illustration about 4:3 ratio. Production app asset placed on a cream screen.

### عکس‌های مواد

قالب پرامپت (Subject با مقدار هر عکس جایگزین شده است):

Use case: photorealistic-natural. Production food ingredient thumbnail photograph for the Persian diet app Rezhim Man. Subject: SUBJECT. Single isolated ingredient composition on a perfectly plain warm white #FFFCF5 studio background, bright soft natural daylight, subtle contact shadow, editorial premium food photography, three-quarter slightly overhead view, subject centered and filling 80% of frame, all edges inside frame, square composition. Do not add any text, numbers, brand, watermark, label, frames, extra dishes, people, utensils or a UI screen. Sharp detail, true ingredient colors. The asset is displayed in small ingredient tiles. This is a photograph of an ingredient, not a cooked meal.

- raw_fish_fillet.png: a single fresh raw salmon fish fillet, skin edge visible, beautifully cut, with a very small sprig of dill beside it
- fresh_lemon_halves.png: one ripe bright yellow whole lemon and one sliced half showing juicy pulp, two tiny fresh green leaves
- saffron_threads_bowl.png: a tiny elegant white ceramic bowl containing loose deep crimson saffron threads, a few saffron threads naturally scattered beside the bowl
