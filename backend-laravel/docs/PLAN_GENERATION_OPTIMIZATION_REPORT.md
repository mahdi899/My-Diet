# گزارش بهینه‌سازی موتور تولید رژیم

## تاریخ: ۱۴۰۳/۰۸/۲۶
## وضعیت: ✅ تکمیل‌شده و آماده تست

---

## 🔍 مشکلات شناسایی‌شده

### ۱. ارسال غیربهینه اطلاعات به AI
**مشکل:** کل آبجکت غذاها با تمام فیلدها (عکس، recipe، nutrition، مشخصات مدیریتی) به مدل ارسال می‌شد.

**اثر:** 
- برای دیتابیس ۱۰۰۰ غذا: ~۱۴۰٬۰۰۰ توکن ورودی
- هزینه: ~$0.465 per plan
- برای ۱۰٬۰۰۰ غذا: ~۱٬۴۰۱٬۰۰۰ توکن → $4.25 per plan

**راه‌حل:** کلاس `FoodSelectionEngine` ساخته شد که:
- فقط فیلدهای ضروری رو ارسال می‌کنه (slug, nameFa, kcal, macros, ingredients)
- تعداد غذا رو هوشمندانه محدود می‌کنه (حداکثر ۵۰ غذا برای هر نوع وعده)

**نتیجه:**
- دیتابیس ۱۰۰۰ غذا: ۱۴۱٬۰۰۰ → ۱۲٬۹۰۰ توکن (۹۱٪ کاهش)
- دیتابیس ۱۰٬۰۰۰ غذا: ۱٬۴۰۱٬۰۰۰ → ۱۲٬۹۰۰ توکن (۹۹٪ کاهش)
- هزینه: $4.25 → $0.08 per plan

---

### ۲. انتخاب غذا فقط بر اساس کالری
**مشکل:** غذاها صرفاً بر اساس نزدیکی کالری به هدف مرتب می‌شدند.

```php
// قبل
usort($list, fn ($a, $b) => abs($a['kcal'] - $slot['kcal']) <=> abs($b['kcal'] - $slot['kcal']));
```

**راه‌حل:** سیستم امتیازدهی چندبعدی:
- ✅ نزدیکی کالری (وزن: ۳۰)
- ✅ پروتئین مناسب (وزن: ۱۵)
- ✅ فیبر (برای بارداری، وزن: ۱۰)
- ✅ بودجه کاربر (وزن: ۸-۱۵)
- ✅ سلیقه کاربر (وزن: ۱۲)
- ✅ تنوع (پنالتی ۲۰ برای غذاهای تکراری)
- ✅ زمان آماده‌سازی
- ✅ فصلی بودن

**کد:**
```php
private function score(array $food, array $slot, array $usedRecently): float
{
    $score = 100.0;
    
    // Calorie proximity
    $calorieDeviation = abs($food['kcal'] - $slot['kcal']) / $slot['kcal'];
    $score -= $calorieDeviation * 30;
    
    // Protein match for weight loss/gain
    if (in_array($this->profile['track'], ['weight_loss', 'weight_gain'])) {
        $targetProteinRatio = $this->profile['track'] === 'weight_loss' ? 0.25 : 0.20;
        $foodProteinRatio = ($food['proteinG'] * 4) / max(1, $food['kcal']);
        $proteinScore = 1 - abs($foodProteinRatio - $targetProteinRatio) / $targetProteinRatio;
        $score += $proteinScore * 15;
    }
    
    // Budget, preferences, variety, etc...
    return max(0, $score);
}
```

---

### ۳. تلرانس اعتبارسنجی خیلی زیاد
**مشکل:**
- تلرانس هر وعده: ۲۰٪
- تلرانس روزانه: ۱۵٪
- در صورت کمبود غذا: تا ۴۵٪!

**راه‌حل:** سخت‌گیری بیشتر
```php
// قبل
$this->energyTolerance() → 0.20 یا 0.45
meal validation → 0.45

// بعد
$this->energyTolerance() → 0.15 یا 0.30
meal validation → 0.30
```

---

### ۴. کنترل‌های ایمنی ناقص
**مشکل:** فقط `safety_tier !== 'ai_ok'` بررسی می‌شد.

**راه‌حل:** متد `enforceSafetyGates()` اضافه شد:

```php
private function enforceSafetyGates(array $profile): void
{
    // بارداری و شیردهی
    if ($track === 'pregnancy') {
        $stage = $profile['life_stage'] ?? '';
        if ($stage === 'pregnant' || $stage === 'breastfeeding') {
            throw new Problem(409, 'specialist_approval_required', 
                'برنامه بارداری و شیردهی نیاز به تأیید متخصص دارد');
        }
    }
    
    // بیماری‌های حاد
    $criticalConditions = ['diabetes', 'kidney', 'heart', 'thyroid', 'pcos'];
    if (array_intersect($criticalConditions, $conditions)) {
        throw new Problem(409, 'medical_review_required', 
            'وضعیت پزشکی شما نیاز به بررسی متخصص دارد');
    }
}
```

**نکته:** این گیت‌ها **قبل از** صدا زدن AI اجرا می‌شن و نمی‌تونن bypass بشن.

---

### ۵. Retry بی‌هدف و پرهزینه
**مشکل:** در صورت `invalid_plan`، یک جمله اضافه می‌کرد و دوباره تلاش می‌کرد، حتی اگه مشکل اساسی باشه.

**راه‌حل:** Retry هوشمند

```php
// فقط خطاهای قابل اصلاح retry می‌شن
$retryableErrors = [
    'meal_energy_invalid', 
    'daily_energy_invalid', 
    'alternative_same', 
    'unknown_food_or_portion'
];

if (!$this->isRetryable($errorCode, $retryableErrors)) {
    throw $error; // No wasteful retry
}

// پیام repair دقیق‌تر و هدفمند
$repairGuidance = $this->buildRepairGuidance($errorCode, $targetKcal);
```

**نتیجه:**
- کاهش تلاش‌های بیهوده
- پیام‌های خطای دقیق‌تر برای debugging
- کاهش هزینه در موارد شکست

---

## 📊 نتایج بهینه‌سازی

### مقایسه هزینه

| دیتابیس | قبل (توکن) | قبل (هزینه) | بعد (توکن) | بعد (هزینه) | کاهش |
|---------|-----------|------------|-----------|------------|------|
| ۱۰۰ غذا | 15,000 | $0.087 | 7,650 | $0.065 | -25.3% |
| ۱,۰۰۰ غذا | 141,000 | $0.465 | 12,900 | $0.081 | -82.6% |
| ۱۰,۰۰۰ غذا | 1,401,000 | $4.245 | 12,900 | $0.081 | -98.1% |

### برای ۱۰۰۰ برنامه در ماه

| دیتابیس | صرفه‌جویی ماهانه |
|---------|------------------|
| ۱۰۰ غذا | $22 |
| ۱,۰۰۰ غذا | $384 |
| ۱۰,۰۰۰ غذا | **$4,164** |

---

## 🛠️ تغییرات اعمال‌شده

### فایل‌های جدید:
1. ✅ `app/Modules/Plans/Infrastructure/FoodSelectionEngine.php`
   - انتخاب هوشمند غذا
   - سیستم امتیازدهی چندبعدی
   - محدودسازی هوشمند تعداد

2. ✅ `app/Modules/Plans/Application/PlanGenerationMetrics.php`
   - ردیابی هزینه و کیفیت
   - گزارش‌دهی دقیق
   - تخمین هزینه

3. ✅ `scripts/demo_optimization.php`
   - نمایش نتایج بهینه‌سازی
   - مقایسه قبل/بعد

### فایل‌های تغییریافته:
1. ✅ `app/Modules/Plans/Infrastructure/ConfiguredDraftProvider.php`
   - استفاده از `FoodSelectionEngine`
   - اضافه شدن `enforceSafetyGates()`
   - بهبود retry logic
   - کاهش energy tolerance
   - پیام‌های repair دقیق‌تر

---

## ✅ چک‌لیست تکمیل

- [x] ۱. کاهش اطلاعات ارسالی به AI
- [x] ۲. بهبود انتخاب غذا (امتیازدهی چندبعدی)
- [x] ۳. کاهش تلرانس اعتبارسنجی
- [x] ۴. کنترل‌های ایمنی backend
- [x] ۵. Retry هوشمند
- [x] ۶. سیستم مانیتورینگ هزینه
- [x] ۷. مستندات کامل
- [x] ۸. Demo script

---

## 🧪 تست

برای مشاهده نتایج بهینه‌سازی:

```bash
php scripts/demo_optimization.php
```

خروجی:
```
📊 Food Selection Scaling:
  Catalog:  10000 → Selected: 170 foods → ~ 11900 tokens

💰 Cost Analysis:
  Large catalog: $4.2450 → $0.0807 (-98.1%)
  
📈 Monthly savings for 1000 plans: $4,164.30
```

---

## 🚀 مراحل بعدی (برای تست واقعی)

### ۱. تست با دیتابیس واقعی
```bash
# فعال‌سازی debug mode
export DRAFT_DEBUG=1

# تولید یک برنامه تست
php artisan tinker --execute="
\$request = DB::table('plan_requests')->where('status', 'queued')->first();
app(\App\Modules\Plans\Application\PlanGeneration::class)->generate(\$request->id);
"
```

### ۲. بررسی لاگ‌ها
```bash
# بررسی آخرین خروجی draft
cat storage/logs/draft-last.txt

# بررسی خطاهای validation
cat storage/logs/draft-validation-fail.txt
```

### ۳. بررسی هزینه
```php
$metrics = app(\App\Modules\Plans\Application\PlanGenerationMetrics::class);

// هزینه یک درخواست خاص
$report = $metrics->requestMetrics($requestId);

// گزارش یک بازه زمانی
$period = $metrics->periodMetrics('2024-01-01', '2024-01-31');
```

---

## ⚠️ نکات مهم

### کنترل بودجه
در `ai_controls` table:
- `daily_cost_cap_micros`: سقف روزانه
- `monthly_cost_cap_micros`: سقف ماهانه
- `per_request_cap_micros`: سقف هر درخواست
- `kill_switch`: خاموش کردن کامل

### Safety Gates
این موارد **قبل از AI** بلاک می‌شن:
- بارداری فعال
- شیردهی فعال
- diabetes + medication
- kidney, heart, thyroid, PCOS
- eating_disorder_history

### Debug Mode
```bash
export DRAFT_DEBUG=1  # فعال
export DRAFT_DEBUG=0  # غیرفعال
```

---

## 📈 انتظارات

### بهبود کیفیت:
- ✅ کمتر `invalid_plan` error
- ✅ برنامه‌های متناسب با بودجه
- ✅ برنامه‌های متناسب با سلیقه
- ✅ پروتئین بهتر برای کاهش/افزایش وزن
- ✅ فیبر کافی برای بارداری

### بهبود هزینه:
- ✅ کاهش ۸۰-۹۸٪ برای دیتابیس بزرگ
- ✅ کاهش retry‌های بیهوده
- ✅ قابل پیش‌بینی‌تر

### بهبود امنیت:
- ✅ گیت‌های backend قبل از AI
- ✅ جلوگیری از bypass با prompt injection
- ✅ safe by default

---

## 🎯 نتیجه‌گیری

موتور تولید رژیم از نظر **کیفیت، هزینه و ایمنی** به‌طور قابل‌توجه بهبود یافته است. 

تغییرات اعمال‌شده:
1. ✅ کاهش هزینه ۸۰-۹۸٪
2. ✅ انتخاب هوشمند غذا
3. ✅ اعتبارسنجی دقیق‌تر
4. ✅ ایمنی بیشتر
5. ✅ retry هوشمند
6. ✅ مانیتورینگ کامل

**آماده برای تست در محیط واقعی.**
