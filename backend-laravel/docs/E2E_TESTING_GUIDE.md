# 🧪 راهنمای تست کامل End-to-End - رژیم من

## هدف
تست کامل تمام قابلیت‌ها از ابتدا تا انتها با CloseRouter واقعی

---

## پیش‌نیاز

### ۱. محیط و API Keys
```bash
# .env
OPENROUTER_API_KEY=your_key_here
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1

# Budget control
AI_DAILY_CAP_MICROS=5000000  # $5 per day
AI_PER_REQUEST_CAP_MICROS=500000  # $0.50 per request
AI_KILL_SWITCH=0
```

### ۲. Database Seeding
```bash
# غذاها
php artisan db:seed --class=FoodSeeder

# متخصص‌ها
php artisan db:seed --class=SpecialistSeeder

# پلن‌های اشتراک
php artisan db:seed --class=SubscriptionPlansSeeder
```

---

## تست ۱: Onboarding کامل (کاهش وزن)

### مرحله ۱: ثبت‌نام
```bash
curl -X POST http://localhost:8000/v1/auth/otp/request \
  -H "Content-Type: application/json" \
  -d '{"mobile": "+989123456789"}'

# کد OTP از logs یا database
curl -X POST http://localhost:8000/v1/auth/otp/verify \
  -H "Content-Type: application/json" \
  -d '{"mobile": "+989123456789", "code": "123456"}'
  
# ذخیره access_token برای درخواست‌های بعدی
```

### مرحله ۲: شروع Onboarding
```bash
TOKEN="your_access_token_here"

curl -X GET "http://localhost:8000/v1/public/onboarding-spec" \
  -H "Authorization: Bearer $TOKEN"

# دریافت پرسشنامه
curl -X GET "http://localhost:8000/v1/me/questionnaire" \
  -H "Authorization: Bearer $TOKEN"
```

### مرحله ۳: پر کردن پرسشنامه (کاهش وزن)
```bash
curl -X PUT "http://localhost:8000/v1/me/questionnaire" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "track": "weight_loss",
    "sex": "female",
    "age": 30,
    "weightKg": 75,
    "heightCm": 165,
    "targetWeightKg": 65,
    "activity": "light",
    "exercise": "3_4",
    "mealsPerDay": 3,
    "dietStyle": "regular",
    "allergens": [],
    "health": [],
    "budget": "medium",
    "regions": ["tehran"],
    "lossPace": "balanced"
  }'

# Submit
curl -X POST "http://localhost:8000/v1/me/questionnaire/submissions" \
  -H "Authorization: Bearer $TOKEN"
```

### مرحله ۴: خرید اشتراک
```bash
# دریافت catalog
curl -X GET "http://localhost:8000/v1/catalog" \
  -H "Authorization: Bearer $TOKEN"

# شروع checkout
curl -X POST "http://localhost:8000/v1/me/checkouts" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"planCode": "weight_loss_30"}'

# در محیط تست: sandbox payment
CHECKOUT_ID="from_previous_response"
curl -X POST "http://localhost:8000/v1/me/checkouts/$CHECKOUT_ID/sandbox" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"success": true}'
```

### مرحله ۵: تولید رژیم اولیه
```bash
# بعد از پرداخت، سیستم باید خودکار request بسازه
# بررسی status
curl -X GET "http://localhost:8000/v1/me/request" \
  -H "Authorization: Bearer $TOKEN"

# تریگر تولید (معمولاً توسط queue worker)
php artisan tinker --execute="
\$request = DB::table('plan_requests')
  ->where('status', 'queued')
  ->orderByDesc('created_at')
  ->first();
  
if (\$request) {
  app(\App\Modules\Plans\Application\PlanGeneration::class)
    ->generate(\$request->id);
  echo 'Generation triggered for: ' . \$request->id;
}
"
```

### بررسی نتیجه تولید
```sql
-- Status درخواست
SELECT id, status, assigned_specialist_id 
FROM plan_requests 
ORDER BY created_at DESC LIMIT 1;

-- Generation details
SELECT * FROM ai_generations 
ORDER BY created_at DESC LIMIT 1;

-- هزینه واقعی
SELECT 
  model,
  outcome,
  tokens_in,
  tokens_out,
  cost_micros,
  ROUND(cost_micros / 1000000.0, 4) as cost_usd
FROM ai_usage_ledger 
ORDER BY created_at DESC 
LIMIT 5;

-- برنامه تولیدشده
SELECT pv.id, pv.status, COUNT(DISTINCT pd.id) as days, COUNT(pm.id) as meals
FROM plan_versions pv
JOIN plan_days pd ON pd.plan_version_id = pv.id
JOIN plan_meals pm ON pm.plan_day_id = pd.id
GROUP BY pv.id, pv.status
ORDER BY pv.created_at DESC
LIMIT 1;
```

### انتظارات:
- [x] Status = `in_review`
- [x] برنامه ۷ روزه کامل
- [x] متخصص اختصاص داده شده
- [x] هزینه < $0.15
- [x] Input tokens < 20,000

---

## تست ۲: متخصص (بررسی و تأیید)

### Login متخصص
```bash
SPECIALIST_TOKEN="..."

# دریافت صف کار
curl -X GET "http://localhost:8000/v1/specialist/queue" \
  -H "Authorization: Bearer $SPECIALIST_TOKEN"

# دریافت جزئیات درخواست
REQUEST_ID="..."
curl -X GET "http://localhost:8000/v1/specialist/requests/$REQUEST_ID" \
  -H "Authorization: Bearer $SPECIALIST_TOKEN"
```

### بررسی و تأیید برنامه
```bash
# اصلاح (اختیاری)
curl -X PUT "http://localhost:8000/v1/specialist/requests/$REQUEST_ID/draft" \
  -H "Authorization: Bearer $SPECIALIST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "days": [...] // برنامه اصلاح‌شده
  }'

# تأیید و انتشار
curl -X POST "http://localhost:8000/v1/specialist/requests/$REQUEST_ID/publish" \
  -H "Authorization: Bearer $SPECIALIST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"weekStart": "2024-12-01"}'
```

### انتظارات:
- [x] برنامه قابل مشاهده برای متخصص
- [x] امکان اصلاح تک‌تک وعده‌ها
- [x] بعد از publish، status = `published`
- [x] کاربر می‌تونه برنامه رو ببینه

---

## تست ۳: مربی هوشمند (Chat)

### ۱. سؤال ساده
```bash
curl -X POST "http://localhost:8000/v1/me/coach/messages" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "clientMessageId": "msg-1",
    "kind": "text",
    "text": "سلام، ناهار امروزم چیه؟"
  }'
```

**انتظار:** مربی **بدون** نیاز به AI، کارت غذای ناهار امروز رو بده

### ۲. ثبت مصرف از طریق چت
```bash
curl -X POST "http://localhost:8000/v1/me/coach/messages" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "clientMessageId": "msg-2",
    "kind": "text",
    "text": "صبحانه رو خوردم"
  }'
```

**انتظار:** مربی صبحانه امروز رو log کنه و تأیید بده

### ۳. تعویض غذا از طریق چت
```bash
curl -X POST "http://localhost:8000/v1/me/coach/messages" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "clientMessageId": "msg-3",
    "kind": "text",
    "text": "ناهار امروز رو دوست ندارم، تعویض کن"
  }'
```

**انتظار:** مربی alternatives بده و بعد از انتخاب، swap کنه

### ۴. ارسال عکس غذا
```bash
# عکس رو base64 کن
IMAGE_BASE64=$(base64 -w 0 food.jpg)

curl -X POST "http://localhost:8000/v1/me/coach/food-photos" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"clientMessageId\": \"photo-1\",
    \"image\": \"$IMAGE_BASE64\",
    \"mime\": \"image/jpeg\",
    \"caption\": \"این رو خوردم\"
  }"

# تأیید تشخیص
FOOD_ENTRY_ID="from_response"
curl -X POST "http://localhost:8000/v1/me/coach/food-entries/$FOOD_ENTRY_ID/confirm" \
  -H "Authorization: Bearer $TOKEN"
```

**انتظار:** 
- Vision model تشخیص بده
- در صورت ابهام سؤال بپرسه
- بعد از تأیید log کنه

### ۵. ثبت وزن از طریق چت
```bash
curl -X POST "http://localhost:8000/v1/me/coach/messages" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "clientMessageId": "msg-4",
    "kind": "text",
    "text": "وزنم امروز ۷۳ کیلو شد"
  }'
```

**انتظار:** وزن ثبت بشه و تشویق یا feedback بده

### ۶. سؤال تخصصی تغذیه
```bash
curl -X POST "http://localhost:8000/v1/me/coach/messages" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "clientMessageId": "msg-5",
    "kind": "text",
    "text": "آیا خوردن میوه شب باعث چاقی میشه؟"
  }'
```

**انتظار:** پاسخ علمی و مرتبط با profile کاربر

---

## تست ۴: صفحه خانه (Home)

```bash
# دریافت dashboard
curl -X GET "http://localhost:8000/v1/me/dashboard" \
  -H "Authorization: Bearer $TOKEN"

# خلاصه امروز
curl -X GET "http://localhost:8000/v1/me/coach/today" \
  -H "Authorization: Bearer $TOKEN"
```

**انتظارات:**
- [x] کالری مصرف‌شده واقعی (نه برنامه‌ای)
- [x] پروگرس ماکروها
- [x] وعده‌های لاگ‌شده
- [x] وزن آخرین
- [x] پیام‌های انگیزشی

---

## تست ۵: تب برنامه (Plan)

```bash
# برنامه ۷ روزه
curl -X GET "http://localhost:8000/v1/me/plan/week" \
  -H "Authorization: Bearer $TOKEN"

# یک روز خاص
curl -X GET "http://localhost:8000/v1/me/plan/day/2024-12-01" \
  -H "Authorization: Bearer $TOKEN"

# تعویض غذا (از تب برنامه)
MEAL_ID="..."
curl -X POST "http://localhost:8000/v1/me/coach/swap-meal" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"mealId\": \"$MEAL_ID\",
    \"reason\": \"dislike\",
    \"budgetOk\": true
  }"

# انتخاب alternative
curl -X POST "http://localhost:8000/v1/me/coach/swap-meal" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"mealId\": \"$MEAL_ID\",
    \"reason\": \"dislike\",
    \"budgetOk\": true,
    \"foodSlug\": \"grilled-chicken-salad\"
  }"
```

**انتظارات:**
- [x] برنامه ۷ روزه کامل با عکس و دستور
- [x] alternatives مناسب
- [x] swap بدون خطا
- [x] تغییرات در home و chat هماهنگ

---

## تست ۶: Quota و محدودیت‌ها

```bash
# بررسی سهمیه
curl -X GET "http://localhost:8000/v1/me/coach/quota" \
  -H "Authorization: Bearer $TOKEN"

# ارسال پیام‌های متوالی تا تمام شدن سهمیه
for i in {1..50}; do
  curl -X POST "http://localhost:8000/v1/me/coach/messages" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"clientMessageId\": \"test-$i\",
      \"kind\": \"text\",
      \"text\": \"سلام شماره $i\"
    }"
done
```

**انتظارات:**
- [x] بعد از تمام شدن سهمیه: error `quota_exceeded`
- [x] پیشنهاد خرید addon
- [x] سهمیه روزانه reset شه

---

## تست ۷: بارداری (باید مسدود شود)

```bash
# ثبت‌نام کاربر جدید
# پر کردن پرسشنامه با track=pregnancy
curl -X PUT "http://localhost:8000/v1/me/questionnaire" \
  -H "Authorization: Bearer $TOKEN2" \
  -H "Content-Type: application/json" \
  -d '{
    "track": "pregnancy",
    "pregnancyWeek": 16,
    "lifeStage": "pregnant",
    ...
  }'

# تلاش برای خرید
curl -X POST "http://localhost:8000/v1/me/checkouts" \
  -H "Authorization: Bearer $TOKEN2" \
  -H "Content-Type: application/json" \
  -d '{"planCode": "pregnancy_30"}'
```

**انتظار:** خطا یا تأکید که نیاز به متخصص داره

---

## تست ۸: هفته دوم (تولید بر اساس پیشرفت)

```bash
# بعد از ۷ روز، trigger تولید هفته دوم
php artisan tinker --execute="
\$userId = 'user_id_here';

// ثبت چند لاگ و وزن
DB::table('meal_logs')->insert([
  'user_id' => \$userId,
  'scheduled_date' => '2024-12-01',
  ...
]);

DB::table('weight_entries')->insert([
  'user_id' => \$userId,
  'civil_date' => '2024-12-05',
  'weight_kg' => 73.5,
]);

// تریگر تولید هفته دوم
\$nextWeek = app(\App\Modules\Plans\Application\NextWeekPlanner::class);
\$nextWeek->plan(\$userId);
"
```

**انتظارات:**
- [x] لاگ‌ها و وزن در نظر گرفته بشن
- [x] برنامه جدید با تنوع بیشتر
- [x] کالری adjust بشه (اگه کاهش وزن کم بوده)

---

## چک‌لیست نهایی

### Core Features
- [ ] ثبت‌نام و OTP
- [ ] Onboarding ۴ مسیر
- [ ] محاسبات کالری صحیح
- [ ] تولید رژیم موفق
- [ ] اختصاص متخصص
- [ ] تأیید متخصص
- [ ] انتشار برنامه

### Coach (مهم‌ترین)
- [ ] پاسخ به سؤالات ساده بدون AI
- [ ] ثبت مصرف از چت
- [ ] تعویض غذا از چت
- [ ] تشخیص عکس غذا
- [ ] ثبت وزن از چت
- [ ] عملیات واقعی در backend
- [ ] شخصیت ثابت فارسی
- [ ] حافظه کاربر

### Home & Plan
- [ ] کالری واقعی (نه برنامه‌ای)
- [ ] برنامه ۷ روزه کامل
- [ ] تعویض از تب برنامه
- [ ] هماهنگی home/plan/chat

### Safety & Quota
- [ ] بارداری مسدود می‌شه
- [ ] بیماری‌های حاد مسدود می‌شن
- [ ] سهمیه کنترل می‌شه
- [ ] هزینه کنترل می‌شه
- [ ] Retry هوشمند

### Quality
- [ ] کالری ±15%
- [ ] تنوع کافی
- [ ] رعایت آلرژی
- [ ] رعایت بودجه
- [ ] هفته دوم بر اساس پیشرفت

---

## گزارش نهایی

بعد از تست، یک فایل گزارش بساز:

```markdown
# گزارش تست End-to-End

## تست موفق
- [ ] Onboarding: ✅/❌
- [ ] تولید رژیم: ✅/❌
  - هزینه: $X.XX
  - توکن: X,XXX
  - زمان: X ثانیه
- [ ] Coach: ✅/❌
  - پاسخ ساده: ✅/❌
  - ثبت مصرف: ✅/❌
  - تعویض غذا: ✅/❌
  - عکس غذا: ✅/❌
- [ ] Safety: ✅/❌
- [ ] Quota: ✅/❌

## مشکلات
1. ...
2. ...

## نواقص
1. ...
2. ...
```

---

**نکته مهم:** این تست‌ها باید با داده واقعی و API واقعی انجام بشن. اگه مشکلی پیدا شد، بگو تا رفعش کنیم.
