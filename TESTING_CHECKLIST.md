# ✅ چک‌لیست تست و راه‌اندازی نهایی

## مرحله ۱: رفع مشکل PHP (۱۵ دقیقه)

### گزینه الف: نصب PHP 8.4
```powershell
# با Chocolatey
choco install php --version=8.4.1 -y

# یا دانلود دستی از:
# https://windows.php.net/download/

# تست
php -v  # باید 8.4.x نشان دهد
```

### گزینه ب: تنظیم Composer برای PHP 8.2
```bash
cd "d:\New folder (21)\diet\My-Diet\backend-laravel"
composer config platform.php 8.2.12
composer update --lock
```

---

## مرحله ۲: بررسی Database (۱۰ دقیقه)

```bash
php artisan migrate:status

# اگر migration نشده:
php artisan migrate --force
```

### Seed داده‌های اولیه:
```sql
-- بررسی غذاها
SELECT COUNT(*) as total_foods FROM food_catalog WHERE active = 1;
-- اگر < 50: نیاز به seed

-- بررسی متخصص‌ها
SELECT COUNT(*) as total_specialists FROM specialists WHERE active = 1;
-- اگر = 0: نیاز به seed

-- بررسی پلن‌ها
SELECT code, title_fa FROM subscription_plans WHERE available = 1;
-- باید حداقل ۳ پلن باشه
```

---

## مرحله ۳: تنظیم AI Providers (۲۰ دقیقه)

```bash
php artisan tinker
```

```php
// ۱. ایجاد Provider
DB::table('ai_providers')->insert([
    'id' => DB::raw("uuid_generate_v4()"),
    'name' => 'OpenRouter',
    'kind' => 'openrouter',
    'base_url' => 'https://openrouter.ai/api/v1',
    'api_key_encrypted' => encrypt(env('OPENROUTER_API_KEY')),
    'active' => true,
    'created_at' => now(),
]);

$providerId = DB::table('ai_providers')->where('name', 'OpenRouter')->value('id');

// ۲. ایجاد Pools
$pools = [
    ['code' => 'plan_draft', 'model' => 'anthropic/claude-3.5-sonnet', 'max_tokens' => 4000, 'temp' => 0.3],
    ['code' => 'nutrition_coach', 'model' => 'anthropic/claude-3-haiku', 'max_tokens' => 1000, 'temp' => 0.7],
    ['code' => 'nutrition_vision', 'model' => 'openai/gpt-4o', 'max_tokens' => 1000, 'temp' => 0.5],
];

foreach ($pools as $p) {
    $poolId = DB::table('ai_pools')->insertGetId([
        'code' => $p['code'],
        'strategy' => 'cost_first',
        'max_attempts' => 2,
        'max_tokens' => $p['max_tokens'],
        'temperature' => $p['temp'],
        'timeout_ms' => 30000,
        'enabled' => true,
    ]);
    
    DB::table('ai_pool_members')->insert([
        'pool_id' => $poolId,
        'provider_id' => $providerId,
        'model' => $p['model'],
        'position' => 1,
        'weight' => 100,
        'price_in_micros_per_m' => 3000, // $3/M
        'price_out_micros_per_m' => 15000, // $15/M
        'enabled' => true,
    ]);
}

echo "✅ AI Pools configured\n";
```

---

## مرحله ۴: تنظیم Budget Control (۵ دقیقه)

```php
// در tinker
DB::table('ai_controls')->updateOrInsert(['id' => 1], [
    'kill_switch' => false,
    'daily_cost_cap_micros' => 5_000_000, // $5/day
    'monthly_cost_cap_micros' => 100_000_000, // $100/month
    'per_request_cap_micros' => 500_000, // $0.50 per request
    'per_user_daily_drafts' => 3,
]);

echo "✅ Budget limits set\n";
```

---

## مرحله ۵: ایجاد کاربر تست (۱۰ دقیقه)

```php
// در tinker
$userId = (string) Str::uuid();
$mobile = '+989123456789';

// ۱. User
DB::table('users')->insert([
    'id' => $userId,
    'mobile' => $mobile,
    'display_name' => 'تست کاربر',
    'status' => 'active',
    'created_at' => now(),
]);

// ۲. OTP (برای login)
DB::table('otp_codes')->insert([
    'mobile' => $mobile,
    'code' => '123456',
    'expires_at' => now()->addMinutes(10),
    'created_at' => now(),
]);

// ۳. Profile (کاهش وزن)
$submissionId = (string) Str::uuid();
DB::table('questionnaire_submissions')->insert([
    'id' => $submissionId,
    'user_id' => $userId,
    'schema_version' => 1,
    'answers' => json_encode([
        'track' => 'weight_loss',
        'sex' => 'female',
        'age' => 30,
        'weightKg' => 75,
        'heightCm' => 165,
        'targetWeightKg' => 65,
        'activity' => 'light',
        'mealsPerDay' => 3,
    ]),
    'risk_flags' => json_encode([]),
    'submitted_at' => now(),
    'created_at' => now(),
]);

// ۴. Profile محاسبه‌شده
DB::table('nutrition_profiles')->insert([
    'user_id' => $userId,
    'submission_id' => $submissionId,
    'track' => 'weight_loss',
    'goal' => 'weight_loss',
    'sex' => 'female',
    'age' => 30,
    'height_cm' => 165,
    'weight_kg' => 75,
    'target_weight_kg' => 65,
    'target_kcal' => 1800,
    'protein_g' => 135,
    'carbs_g' => 180,
    'fat_g' => 60,
    'meals_per_day' => 3,
    'diet_style' => 'regular',
    'allergens' => json_encode([]),
    'safety_tier' => 'ai_ok',
    'created_at' => now(),
]);

// ۵. متخصص (اختیاری - اگر وجود داشته باشد)
$specialistId = DB::table('specialists')->where('active', 1)->value('id');

// ۶. Request برای تولید رژیم
$requestId = (string) Str::uuid();
DB::table('plan_requests')->insert([
    'id' => $requestId,
    'user_id' => $userId,
    'submission_id' => $submissionId,
    'assigned_specialist_id' => $specialistId,
    'status' => 'queued',
    'week_start' => now()->startOfWeek()->format('Y-m-d'),
    'created_at' => now(),
]);

echo "✅ Test user created\n";
echo "User ID: {$userId}\n";
echo "Mobile: {$mobile}\n";
echo "OTP: 123456\n";
echo "Request ID: {$requestId}\n";
```

---

## مرحله ۶: تست تولید رژیم (۵ دقیقه) ⭐⭐⭐

```php
// در tinker
$requestId = 'YOUR_REQUEST_ID';

// فعال کردن debug
putenv('DRAFT_DEBUG=1');

// تولید
$gen = app(\App\Modules\Plans\Application\PlanGeneration::class);
$gen->generate($requestId);

// بررسی نتیجه
$request = DB::table('plan_requests')->where('id', $requestId)->first();
echo "Status: {$request->status}\n";

if ($request->status === 'in_review') {
    echo "✅ برنامه تولید شد!\n";
    
    // جزئیات generation
    $gen = DB::table('ai_generations')->where('request_id', $requestId)->first();
    echo "Model: {$gen->model}\n";
    echo "Tokens: {$gen->tokens}\n";
    echo "Cost: $" . round($gen->cost_micros / 1000000, 4) . "\n";
    
    // تعداد وعده‌ها
    $version = DB::table('plan_versions')->where('request_id', $requestId)->first();
    $meals = DB::table('plan_days as d')
        ->join('plan_meals as m', 'm.plan_day_id', '=', 'd.id')
        ->where('d.plan_version_id', $version->id)
        ->count();
    echo "Total meals: {$meals}\n";
    
    if ($meals === 21) { // 7 days × 3 meals
        echo "✅✅✅ SUCCESS: برنامه کامل ۷ روزه ساخته شد!\n";
    }
} else {
    echo "❌ خطا: {$request->status}\n";
    
    // بررسی خطا
    $error = DB::table('ai_generations')
        ->where('request_id', $requestId)
        ->first();
    echo "Error: " . ($error->skipped_reason ?? 'unknown') . "\n";
}
```

**انتظارات:**
- ✅ Status = `in_review`
- ✅ ۲۱ وعده (۷ روز × ۳ وعده)
- ✅ هزینه < $0.15
- ✅ Input tokens < 20,000

---

## مرحله ۷: Login و دریافت Token (۵ دقیقه)

```bash
# ۱. Request OTP
curl -X POST http://localhost:8000/v1/auth/otp/request \
  -H "Content-Type: application/json" \
  -d '{"mobile": "+989123456789"}'

# ۲. Verify OTP
curl -X POST http://localhost:8000/v1/auth/otp/verify \
  -H "Content-Type: application/json" \
  -d '{"mobile": "+989123456789", "code": "123456"}' \
  | jq -r '.accessToken' > token.txt

# ۳. ذخیره token
$TOKEN = Get-Content token.txt
```

---

## مرحله ۸: تست Coach (Chat) (۱۰ دقیقه) ⭐⭐⭐

```bash
# ۱. سؤال ساده (باید بدون AI پاسخ بده)
curl -X POST http://localhost:8000/v1/me/coach/messages \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "clientMessageId": "msg-1",
    "kind": "text",
    "text": "سلام"
  }'

# انتظار: پاسخ خوش‌آمدگویی

# ۲. پرسیدن برنامه امروز (باید بدون AI برنامه رو بده)
curl -X POST http://localhost:8000/v1/me/coach/messages \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "clientMessageId": "msg-2",
    "kind": "text",
    "text": "ناهار امروزم چیه؟"
  }'

# انتظار: کارت غذای ناهار امروز

# ۳. سؤال تخصصی (نیاز به AI)
curl -X POST http://localhost:8000/v1/me/coach/messages \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "clientMessageId": "msg-3",
    "kind": "text",
    "text": "چرا باید صبحانه بخورم؟"
  }'

# انتظار: پاسخ تخصصی از AI

# ۴. بررسی quota
curl -X GET http://localhost:8000/v1/me/coach/quota \
  -H "Authorization: Bearer $TOKEN"
```

**انتظارات:**
- ✅ پاسخ‌های سریع برای سؤالات ساده
- ✅ پاسخ فارسی طبیعی
- ✅ کاهش quota بعد از سؤالات AI
- ✅ عدم کاهش quota برای سؤالات ساده

---

## مرحله ۹: تست تعویض غذا (۵ دقیقه)

```bash
# ۱. دریافت برنامه امروز
curl -X GET http://localhost:8000/v1/me/plan/day/$(date +%Y-%m-%d) \
  -H "Authorization: Bearer $TOKEN" \
  | jq '.meals[0].id' > meal_id.txt

$MEAL_ID = Get-Content meal_id.txt

# ۲. دریافت alternatives
curl -X POST http://localhost:8000/v1/me/coach/swap-meal \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"mealId\": \"$MEAL_ID\",
    \"reason\": \"variety\",
    \"budgetOk\": true
  }"

# ۳. اعمال swap
curl -X POST http://localhost:8000/v1/me/coach/swap-meal \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"mealId\": \"$MEAL_ID\",
    \"reason\": \"variety\",
    \"budgetOk\": true,
    \"foodSlug\": \"ALTERNATIVE_SLUG\"
  }"
```

**انتظارات:**
- ✅ لیست alternatives مناسب
- ✅ swap موفق
- ✅ برنامه به‌روز شده

---

## مرحله ۱۰: تست Dashboard (۵ دقیقه)

```bash
# ۱. Dashboard
curl -X GET http://localhost:8000/v1/me/dashboard \
  -H "Authorization: Bearer $TOKEN"

# ۲. Today summary
curl -X GET http://localhost:8000/v1/me/coach/today \
  -H "Authorization: Bearer $TOKEN"

# ۳. برنامه هفتگی
curl -X GET http://localhost:8000/v1/me/plan/week \
  -H "Authorization: Bearer $TOKEN"
```

**انتظارات:**
- ✅ کالری هدف و مصرف‌شده
- ✅ وعده‌های امروز
- ✅ برنامه ۷ روزه کامل

---

## ✅ چک‌لیست نهایی

### Core Features
- [ ] PHP 8.4 نصب یا Composer تنظیم شده
- [ ] Database migrate شده
- [ ] AI Providers تنظیم شده
- [ ] Budget limits ست شده
- [ ] کاربر تست ساخته شده

### تولید رژیم
- [ ] برنامه ۷ روزه تولید شد
- [ ] همه ۲۱ وعده کامل
- [ ] هزینه < $0.15
- [ ] خطای validation نداشت

### مربی هوشمند
- [ ] پاسخ به سؤالات ساده
- [ ] پاسخ به سؤالات تخصصی
- [ ] نمایش برنامه امروز
- [ ] Quota کنترل می‌شه

### عملیات
- [ ] تعویض غذا کار می‌کنه
- [ ] Dashboard اطلاعات صحیح نشون می‌ده
- [ ] Login و token کار می‌کنه

---

## 🎯 موفقیت = همه تست‌ها ✅

**اگر همه تست‌ها موفق بود:**
پروژه **۱۰۰٪ آماده production** است! 🎉

**اگر تستی fail شد:**
1. لاگ `storage/logs/laravel.log` رو بررسی کن
2. لاگ `storage/logs/draft-last.txt` برای خروجی AI
3. جدول `ai_usage_ledger` برای جزئیات هزینه
4. مشکل رو برطرف کن و دوباره تست کن

---

**نکته:** این چک‌لیست رو قدم‌به‌قدم دنبال کن. هر مرحله رو کامل کن قبل از رفتن به مرحله بعد.
