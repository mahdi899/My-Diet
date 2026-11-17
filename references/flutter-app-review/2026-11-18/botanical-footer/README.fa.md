# پیگیری مسیرت — پیاده‌سازی طرح تأییدشده

بخش انتهایی خانه شامل مسیر پیوستگی با جوانه، کارت وزن با تصویرسازی ترازو و کارت سبز تیرهٔ مربی است. فایل `approved-concept.png` طرح تأییدشده و `single-weight.png` تصویر اجرای واقعی کامپوننت است. `weight-history.png` نمودار واقعی چند ثبت و یک روز کامل را نشان می‌دهد؛ `narrow-large-text.png` چیدمان عرض ۳۲۰ با متن ۱۵۰٪ را نشان می‌دهد.

پیوستگی از snapshot برنامه خوانده می‌شود؛ نقطه‌های مسیر با تعداد روزهای کامل تغییر می‌کنند. ثبت وزن و بازشدن گفتگو همان مسیرهای واقعی برنامه را دارند. وزن تک‌ثبت‌شده نمودار فرضی ندارد؛ با ثبت در روز دیگر، نمودار تاریخچه نمایش داده می‌شود. تصویرسازی‌ها تزئینی هستند و متن و کنترل‌ها اجزای مستقل Flutter و قابل دسترسی‌اند.

اعتبارسنجی: تحلیل ۷ فایل بدون خطا؛ ۱۶ تست رابط، وزن و پیوستگی به‌علاوهٔ یک تست تولید تصاویر موفق شدند. اسکریپت تولید تصاویر و دستور اجرای آن در `capture.dart` قرار دارند.

تصویر ترازو با ابزار داخلی imagegen تولید و در `app/assets/images/brand_scenes/weight_journey_v1.png` ذخیره شد؛ PNG دارای شفافیت واقعی است. جوانهٔ مربی از دارایی موجود `app/assets/images/home/sprout_welcome.png` استفاده می‌کند. مسیر روزها با CustomPainter رسم می‌شود.

## پرامپت نهایی تصویر ترازو

Use case: precise-object-edit. Asset type: standalone transparent decorative illustration for a Flutter nutrition app. Input image is the APPROVED UI design reference. Recreate ONLY the mint green bathroom scale and tiny growing plant illustration from the middle-left weight card in the reference as a high-quality isolated asset. No UI, no cards, no text, no numbers, no buttons, no border. Keep the same beautiful boutique editorial botanical style: softly rounded pale mint analog bathroom scale, emerald gauge and needle, simple dial tick marks but no numerals, small two-leaf lime sprout to the lower-right of the scale, delicate muted cream organic ground shape underneath, 3 tiny green excitement dashes above. Slight three-quarter tilt matching reference. Clean restrained illustration with subtle tactile paper grain, gentle dimensional shading, clearly defined silhouette, forest green and fresh sage, warm ivory base. Entire object comfortably inside frame with about 8 percent padding. True transparent background around the whole illustration; retain only the small cream grounding shape and subtle contact shadow, not a rectangular background. Square composition 1024x1024. Do not include any part of the app screenshot. This is a reusable PNG image illustration, not a mockup.
