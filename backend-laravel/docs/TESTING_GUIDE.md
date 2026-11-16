# راهنمای تست موتور بهینه‌شده تولید رژیم

## مرحله ۱: آماده‌سازی محیط تست

### فعال‌سازی debug mode
```bash
# در .env یا environment
DRAFT_DEBUG=1
```

### بررسی وضعیت AI Controls
```sql
SELECT * FROM ai_controls WHERE id = 1;
```

مطمئن شوید:
- `kill_switch = 0`
- `daily_cost_cap_micros` و `monthly_cost_cap_micros` مقدار مناسب دارند
- `per_request_cap_micros` برای محدود کردن هزینه هر تست تنظیم شده (مثلاً ۵۰۰۰۰۰ = $0.50)

---

## مرحله ۲: ایجاد کاربران تست

### کاربر ۱: کاهش وزن (وضعیت عادی)
```php
php artisan tinker --execute="
\$user = DB::table('users')->insertGetId([
    'id' => 'test-user-weight-loss',
    'email' => 'test-weight-loss@example.com',
    'name' => 'تست کاهش وزن',
    'created_at' => now(),
]);

DB::table('onboarding_profiles')->insert([
    'user_id' => 'test-user-weight-loss',
    'track' => 'weight_loss',
    'target_kcal' => 1800,
    'protein_g' => 135,
    'carbs_g' => 180,
    'fat_g' => 60,
    'meals_per_day' => 3,
    'diet_style' => 'regular',
    'allergens' => json_encode([]),
    'conditions' => json_encode([]),
    'budget' => 'medium',
    'safety_tier' => 'ai_ok',
]);

\$submissionId = DB::table('questionnaire_submissions')->insertGetId([
    'user_id' => 'test-user-weight-loss',
    'schema_version' => 1,
    'answers' => json_encode([
        'age' => 30,
        'sex' => 'female',
        'weight' => 75,
        'height' => 165,
        'track' => 'weight_loss',
    ]),
    'risk_flags' => json_encode([]),
]);

\$requestId = DB::table('plan_requests')->insertGetId([
    'id' => 'test-req-weight-loss',
    'user_id' => 'test-user-weight-loss',
    'submission_id' => \$submissionId,
    'status' => 'queued',
    'week_start' => now()->startOfWeek()->format('Y-m-d'),
]);

echo 'کاربر کاهش وزن ایجاد شد: test-req-weight-loss';
"
```

### کاربر ۲: افزایش وزن
```php
php artisan tinker --execute="
\$user = DB::table('users')->insertGetId([
    'id' => 'test-user-weight-gain',
    'email' => 'test-weight-gain@example.com',
    'name' => 'تست افزایش وزن',
    'created_at' => now(),
]);

DB::table('onboarding_profiles')->insert([
    'user_id' => 'test-user-weight-gain',
    'track' => 'weight_gain',
    'target_kcal' => 2400,
    'protein_g' => 180,
    'carbs_g' => 300,
    'fat_g' => 80,
    'meals_per_day' => 4,
    'diet_style' => 'regular',
    'allergens' => json_encode([]),
    'conditions' => json_encode([]),
    'budget' => 'high',
    'safety_tier' => 'ai_ok',
]);

\$submissionId = DB::table('questionnaire_submissions')->insertGetId([
    'user_id' => 'test-user-weight-gain',
    'schema_version' => 1,
    'answers' => json_encode(['age' => 25, 'sex' => 'male', 'track' => 'weight_gain']),
    'risk_flags' => json_encode([]),
]);

\$requestId = DB::table('plan_requests')->insertGetId([
    'id' => 'test-req-weight-gain',
    'user_id' => 'test-user-weight-gain',
    'submission_id' => \$submissionId,
    'status' => 'queued',
    'week_start' => now()->startOfWeek()->format('Y-m-d'),
]);

echo 'کاربر افزایش وزن ایجاد شد: test-req-weight-gain';
"
```

### کاربر ۳: بارداری (باید مسدود شود)
```php
php artisan tinker --execute="
\$user = DB::table('users')->insertGetId([
    'id' => 'test-user-pregnancy',
    'email' => 'test-pregnancy@example.com',
    'name' => 'تست بارداری',
    'created_at' => now(),
]);

DB::table('onboarding_profiles')->insert([
    'user_id' => 'test-user-pregnancy',
    'track' => 'pregnancy',
    'life_stage' => 'pregnant',
    'target_kcal' => 2100,
    'protein_g' => 90,
    'carbs_g' => 260,
    'fat_g' => 70,
    'meals_per_day' => 3,
    'diet_style' => 'regular',
    'allergens' => json_encode([]),
    'conditions' => json_encode([]),
    'budget' => 'medium',
    'safety_tier' => 'ai_ok',
]);

\$submissionId = DB::table('questionnaire_submissions')->insertGetId([
    'user_id' => 'test-user-pregnancy',
    'schema_version' => 1,
    'answers' => json_encode(['age' => 28, 'track' => 'pregnancy', 'pregnancy_week' => 16]),
    'risk_flags' => json_encode([]),
]);

\$requestId = DB::table('plan_requests')->insertGetId([
    'id' => 'test-req-pregnancy',
    'user_id' => 'test-user-pregnancy',
    'submission_id' => \$submissionId,
    'status' => 'queued',
    'week_start' => now()->startOfWeek()->format('Y-m-d'),
]);

echo 'کاربر بارداری ایجاد شد: test-req-pregnancy';
"
```

---

## مرحله ۳: تولید برنامه

### تست ۱: کاهش وزن
```php
php artisan tinker --execute="
\$gen = app(\App\Modules\Plans\Application\PlanGeneration::class);
\$gen->generate('test-req-weight-loss');
echo 'درخواست کاهش وزن پردازش شد';
"
```

### بررسی نتیجه
```sql
-- وضعیت درخواست
SELECT status FROM plan_requests WHERE id = 'test-req-weight-loss';

-- جزئیات generation
SELECT * FROM ai_generations WHERE request_id = 'test-req-weight-loss';

-- هزینه و توکن
SELECT 
    model, 
    outcome, 
    tokens_in, 
    tokens_out, 
    cost_micros,
    cost_micros / 1000000 as cost_usd
FROM ai_usage_ledger 
WHERE request_id = 'test-req-weight-loss';

-- برنامه تولیدشده
SELECT pv.id, pv.status, pd.day_index, pm.meal_type, pm.title, pm.calories
FROM plan_versions pv
JOIN plan_days pd ON pd.plan_version_id = pv.id
JOIN plan_meals pm ON pm.plan_day_id = pd.id
WHERE pv.request_id = 'test-req-weight-loss'
ORDER BY pd.day_index, pm.position;
```

### تست ۲: افزایش وزن
```php
php artisan tinker --execute="
\$gen = app(\App\Modules\Plans\Application\PlanGeneration::class);
\$gen->generate('test-req-weight-gain');
"
```

### تست ۳: بارداری (باید مسدود شود)
```php
php artisan tinker --execute="
try {
    \$gen = app(\App\Modules\Plans\Application\PlanGeneration::class);
    \$gen->generate('test-req-pregnancy');
    echo '❌ خطا: برنامه بارداری نباید تولید شود!';
} catch (\App\Shared\Domain\Problem \$e) {
    if (\$e->problemCode === 'specialist_approval_required') {
        echo '✅ درست: بارداری مسدود شد';
    } else {
        echo '⚠️ خطای متفاوت: ' . \$e->problemCode;
    }
}
"
```

---

## مرحله ۴: بررسی کیفیت

### ۱. بررسی کالری
```sql
-- مجموع کالری روزانه
SELECT 
    pd.day_index as روز,
    SUM(pm.calories) as کالری_روز,
    (SELECT target_kcal FROM onboarding_profiles WHERE user_id = pr.user_id) as هدف,
    ABS(SUM(pm.calories) - (SELECT target_kcal FROM onboarding_profiles WHERE user_id = pr.user_id)) as انحراف,
    ROUND(ABS(SUM(pm.calories) - (SELECT target_kcal FROM onboarding_profiles WHERE user_id = pr.user_id)) * 100.0 / (SELECT target_kcal FROM onboarding_profiles WHERE user_id = pr.user_id), 2) as درصد_انحراف
FROM plan_requests pr
JOIN plan_versions pv ON pv.request_id = pr.id
JOIN plan_days pd ON pd.plan_version_id = pv.id
JOIN plan_meals pm ON pm.plan_day_id = pd.id
WHERE pr.id = 'test-req-weight-loss'
GROUP BY pd.day_index, pr.user_id
ORDER BY pd.day_index;
```

انتظار: انحراف کمتر از ۱۵٪ برای هر روز

### ۲. بررسی تنوع
```sql
-- تعداد غذاهای منحصربه‌فرد
SELECT COUNT(DISTINCT pm.title) as تعداد_غذا_منحصربه‌فرد
FROM plan_requests pr
JOIN plan_versions pv ON pv.request_id = pr.id
JOIN plan_days pd ON pd.plan_version_id = pv.id
JOIN plan_meals pm ON pm.plan_day_id = pd.id
WHERE pr.id = 'test-req-weight-loss';
```

انتظار: حداقل ۱۵ غذای منحصربه‌فرد در ۷ روز

### ۳. بررسی گزینه‌های جایگزین
```sql
-- وعده‌هایی که alternative ندارند
SELECT pd.day_index, pm.meal_type, pm.title
FROM plan_requests pr
JOIN plan_versions pv ON pv.request_id = pr.id
JOIN plan_days pd ON pd.plan_version_id = pv.id
JOIN plan_meals pm ON pm.plan_day_id = pd.id
WHERE pr.id = 'test-req-weight-loss'
AND NOT EXISTS (
    SELECT 1 FROM plan_meal_options pmo 
    WHERE pmo.meal_id = pm.id AND pmo.kind = 'ai_alternative'
);
```

انتظار: خروجی خالی (همه وعده‌ها باید alternative داشته باشند)

---

## مرحله ۵: گزارش هزینه

### هزینه کل تست‌ها
```sql
SELECT 
    task,
    COUNT(*) as تعداد_فراخوانی,
    SUM(tokens_in) as کل_توکن_ورودی,
    SUM(tokens_out) as کل_توکن_خروجی,
    SUM(cost_micros) as هزینه_میکرودلار,
    ROUND(SUM(cost_micros) / 1000000.0, 4) as هزینه_دلار,
    outcome
FROM ai_usage_ledger
WHERE request_id IN ('test-req-weight-loss', 'test-req-weight-gain')
GROUP BY task, outcome
ORDER BY task, outcome;
```

### میانگین هزینه موفق
```sql
SELECT 
    AVG(cost_micros) / 1000000.0 as میانگین_هزینه_دلار,
    AVG(tokens_in + tokens_out) as میانگین_توکن
FROM ai_usage_ledger
WHERE request_id IN ('test-req-weight-loss', 'test-req-weight-gain')
AND outcome = 'ok';
```

### مقایسه با تخمین
```php
php artisan tinker --execute="
\$metrics = app(\App\Modules\Plans\Application\PlanGenerationMetrics::class);

// تعداد غذاهای فعال
\$foodCount = DB::table('food_catalog')->where('active', 1)->count();

echo \"تعداد غذاهای فعال: {\$foodCount}\n\n\";

// تخمین برای این دیتابیس
\$estimate = \$metrics->estimateCostForCatalog(\$foodCount, 3);
print_r(\$estimate);

echo \"\n\n--- نتایج واقعی ---\n\";
\$actual = \$metrics->requestMetrics('test-req-weight-loss');
print_r(\$actual);
"
```

---

## مرحله ۶: بررسی لاگ‌ها

### خروجی آخرین draft
```bash
cat storage/logs/draft-last.txt
```

### خطاهای validation (اگر بوده)
```bash
cat storage/logs/draft-validation-fail.txt
```

---

## چک‌لیست موفقیت

- [ ] ✅ برنامه کاهش وزن با موفقیت تولید شد
- [ ] ✅ برنامه افزایش وزن با موفقیت تولید شد
- [ ] ✅ بارداری مسدود شد با پیام صحیح
- [ ] ✅ انحراف کالری < ۱۵٪ برای هر روز
- [ ] ✅ حداقل ۱۵ غذای منحصربه‌فرد
- [ ] ✅ همه وعده‌ها دارای alternative
- [ ] ✅ هزینه در محدوده تخمین
- [ ] ✅ توکن ورودی < ۲۰٬۰۰۰ (برای دیتابیس متوسط)

---

## پاکسازی داده‌های تست

```sql
DELETE FROM plan_requests WHERE id IN ('test-req-weight-loss', 'test-req-weight-gain', 'test-req-pregnancy');
DELETE FROM users WHERE id IN ('test-user-weight-loss', 'test-user-weight-gain', 'test-user-pregnancy');
DELETE FROM ai_usage_ledger WHERE request_id IN ('test-req-weight-loss', 'test-req-weight-gain', 'test-req-pregnancy');
```

---

## در صورت مشکل

### خطای invalid_plan
بررسی کنید:
```sql
SELECT error_code, skipped_reason 
FROM ai_generations 
WHERE request_id = 'test-req-weight-loss';
```

اگر `meal_energy_invalid` یا `daily_energy_invalid` دیدید:
- غذاهای کافی در دیتابیس وجود دارد؟
- energy tolerance ممکن است خیلی سخت باشد؟

### خطای catalog_too_small
```sql
-- بررسی تعداد غذاهای فعال برای هر نوع وعده
SELECT 
    JSON_UNQUOTE(JSON_EXTRACT(meal_types, '$[0]')) as meal_type,
    COUNT(*) as count
FROM food_catalog
WHERE active = 1
AND kcal > 0
GROUP BY meal_type;
```

حداقل نیاز: ۵ غذا برای هر نوع وعده

---

**موفق باشید!** 🚀
