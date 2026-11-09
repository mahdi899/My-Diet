# -*- coding: utf-8 -*-
import os

catalog_file = r"d:\New folder (21)\my-diet\My-Diet\IRANIAN_1000_FOOD_PROMPTS_MASTER.md"

header = """# 🍽️ دانشنامه مستر پرامپت ۱۰۰۰ غذای ایرانی — نانو بنانا (Nano Banana Master Food Prompts)
> **اختصاصی اپلیکیشن «رژیم من»** | ویرایش ویژه: **تمرکز صددرصدی بر خود غذا (Hero-Centric)، حذف شلوغی‌های اطراف، زاویه تعارف و پیشنهاد به کاربر (Appetizing & Inviting)، و اصالت کاملاً ایرانیزه**.

---

## 🎯 اصول طلایی پرامپت‌نویسی جدید نانو بنانا

1. **خلوت بودن کادر و پس‌زمینه (Zero Clutter & Minimal Background):**
   - حذف ترشیجات متعدد، کاسه‌های زیاد، لیوان‌های اضافه، پارچ، نان‌های پراکنده و شلوغی‌های حاشیه‌ای.
   - یک بشقاب یا کاسه اصلی سرامیکی مات و شیک در مرکز تصویر، بدون هیچ عامل مزاحم بصری.
   - پس‌زمینه: سطحی مات و مینیمال از چوب بلوط روشن یا سنگ تراورتن با نور طبیعی بسیار نرم.

2. **خود غذا به عنوان قهرمان اصلی تصویر (Food as the Absolute Hero):**
   - تمام جزئیات لنز، عمق میدان و نورپردازی روی بافت خود غذا متمرکز است: دانه‌های برنج قدکشیده و زعفرانی، درخشش ملایم خورش جاافتاده، برشتگی وسوسه‌انگیز کباب، بخار ملایم و مطبوع.

3. **حس پیشنهاد و تعارف به کاربر ("انگار ما بهش پیشنهاد می‌دیم این غذای رژیمی رو بخوره"):**
   - زاویه دوربین ۴۵ درجه به سمت کاربر، گویی یک وعده غذایی لوکس، سالم، تمیز و محاسبه‌شده با مهر و مهربانی روی میز پیش روی او قرار گرفته و او را به میل کردن یک غذای مقوی دعوت می‌کند.

4. **فرمول طلایی پرامپت نانو بنانا برای هر غذا (Universal Hero Formula):**
   ```text
   Commercial editorial food photography of [Dish Name & Ingredients], presented as an enticing, delicious hero meal directly in front of the viewer. Perfectly centered on a clean, modern off-white matte ceramic plate resting on a minimal light neutral surface. Minimal uncluttered composition with zero distractions, soft natural side daylight, delicate steam rising, mouthwatering textures, 85mm macro lens, f/2.8, shallow depth of field, authentic Iranian culinary plating, true-to-life colors, 4K resolution --ar 1:1
   ```

---

## 📑 فهرست دسته‌بندی‌های غذایی
1. [دسته ۱: پلوها، چلوها و ته‌چین‌های اصیل و مجلسی (Persian Rice, Pilafs & Tahchin)](#دسته-۱-پلوها-چلوها-و-تهچینهای-اصیل-و-مجلسی)
2. [دسته ۲: خورش‌های نامدار و سنتی سراسر ایران (Classic & Regional Persian Stews)](#دسته-۲-خورشهای-نامدار-و-سنتی-سراسر-ایران)
3. [دسته ۳: کباب‌ها، جوجه‌ها و گریل‌های سلامت ایرانی (Persian Kababs & Healthy Grills)](#دسته-۳-کبابها-جوجهها-و-گریلهای-سلامت-ایرانی)
4. [دسته ۴: غذاهای نانی، خوراک‌ها و تاس‌کباب‌ها (Traditional Stewed Dishes & Meat Dishes)](#دسته-۴-غذاهای-نانی-خوراکها-و-تاسکبابها)
5. [دسته ۵: کوکوها، کتلت‌ها و شامی‌های سنتی (Kuku, Kotlet & Shami Varieties)](#دسته-۵-کوکوها-کتلتها-و-شامیهای-سنتی)
6. [دسته ۶: دلمه‌ها، کوفته‌ها و بقچه‌های سنتی (Dolmeh, Kufteh & Stuffed Dishes)](#دسته-۶-دلمهها-کوفتهها-و-بقچههای-سنتی)
7. [دسته ۷: آش‌ها، سوپ‌ها و کاسه‌های سنتی شفابخش (Healing Soups & Ash Varieties)](#دسته-۷-آشها-سوپها-و-کاسههای-سنتی-شفابخش)
8. [دسته ۸: غذاهای محلی گیلان، مازندران و شمال ایران (Caspian & Northern Regional Specials)](#دسته-۸-غذاهای-محلی-گیلان-مازندران-و-شمال-ایران)
9. [دسته ۹: غذاهای دریایی و ادویه‌ای جنوب و خلیج فارس (Southern & Persian Gulf Seafood & Dishes)](#دسته-۹-غذاهای-دریایی-و-ادویهای-جنوب-و-خلیج-فارس)
10. [دسته ۱۰: صبحانه‌ها و عصرانه‌های مقوی و پرانرژی (Healthy Persian Breakfasts & Light Meals)](#دسته-۱۰-صبحانهها-و-عصرانههای-مقوی-و-پرانرژی)
11. [دسته ۱۱: میان‌وعده‌ها، دسرها و نوشیدنی‌های اصیل سلامت (Healthy Snacks, Teas & Refreshments)](#دسته-۱۱-میان‌وعده‌ها-دسرها-و-نوشیدنی‌های-اصیل-سلامت)
12. [بانک جامع فهرست ۱۰۰۰ غذای ایرانی به تفکیک استان و طبع غذایی (The 1000 Iranian Dishes Database)](#بانک-جامع-فهرست-۱۰۰۰-غذای-ایرانی-به-تفکیک-استان-و-طبع-غذایی)

---
"""

# Read existing content
with open(catalog_file, "r", encoding="utf-8") as f:
    existing_body = f.read()

# Prepend header if not present
if not existing_body.startswith("# 🍽️"):
    full_content = header + "\n" + existing_body
    with open(catalog_file, "w", encoding="utf-8") as f:
        f.write(full_content)
    print("Prepend header completed successfully!")
else:
    print("Header already present.")
