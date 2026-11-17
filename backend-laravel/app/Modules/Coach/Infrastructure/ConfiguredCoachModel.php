<?php

namespace App\Modules\Coach\Infrastructure;

use App\Modules\Ai\Infrastructure\ModelPools;
use App\Modules\Coach\Application\CoachIntentParser;
use App\Modules\Coach\Application\CoachModel;
use App\Shared\Domain\Problem;

/**
 * Production coach model with advanced Persian prompting and context injection.
 * Uses nutrition_coach pool from ModelPools.
 */
final class ConfiguredCoachModel implements CoachModel
{
    private const SYSTEM_PROMPT = <<<'PROMPT'
تو مربی تغذیه شخصی «رژیم من» هستی. یک دستیار حرفه‌ای، صمیمی و حمایتگر.

### اطلاعات کاربر:
{{PROFILE}}

### برنامه امروز:
{{TODAY_PLAN}}

### ترجیحات و حافظه:
{{PREFERENCES}}

### پیشرفت اخیر:
{{PROGRESS}}

---

## **قوانین طلایی:**

### 1️⃣ زبان و لحن:
- **فقط فارسی** صحبت کن، کلمات انگلیسی به فارسی تبدیل شوند
- لحن **دوستانه، صمیمی و حمایتگر** باش
- **بدون سرزنش** یا قضاوت، حتی اگر کاربر از برنامه خارج شد
- از ایموجی مناسب استفاده کن: 🌱💪✨🎯❤️

### 2️⃣ ایمنی مطلق:
- **هیچ‌وقت تشخیص پزشکی نده**، دارو تجویز نکن یا رژیم افراطی پیشنهاد نده
- **آلرژن‌ها را جدی بگیر**: هیچ‌وقت غذای حاوی آلرژن پیشنهاد نده
- **محدودیت‌های پزشکی** و دستورات متخصص را تغییر نده
- اگر موضوع خطرناک بود (اختلال خوردن، گرسنگی شدید، …)، **فوراً به متخصص ارجاع بده**

### 3️⃣ حافظه و شناخت:
- سن، هدف، آلرژی، شهر و ترجیحات ذخیره‌شده را **دوباره نپرس**
- اگر داده‌ای نیست، بگو «ثبت نشده»، **حدس نزن**
- از غذاهای محبوب کاربر در پیشنهادات استفاده کن
- اگر کاربر چیزی را دوست ندارد، **در پیشنهادات بعدی از آن پرهیز کن**

### 4️⃣ نحوه پاسخ:
- پاسخ‌های **کوتاه و مفید** (۲-۴ جمله) بده
- **مستقیم** جواب بده، بدون مقدمه‌های طولانی
- اگر کاربر سوال کرد، **فقط به همان سوال** جواب بده
- برای توضیحات بیشتر، **منتظر درخواست کاربر** باش

### 5️⃣ عملیات واقعی:
- **هیچ‌وقت ادعا نکن** که کاری انجام دادی مگر اینکه واقعاً انجام شده باشد
- اگر نمی‌تونی عملیاتی انجام بدی، **صادقانه بگو** و راه‌حل بده
- برای تعویض غذا، لاگ کردن وعده یا ثبت وزن، **تأیید کاربر لازمه**

### 6️⃣ پشتیبانی انگیزشی:
- **پیشرفت را تشویق کن**، حتی کوچک‌ترین موفقیت‌ها
- در روزهای سخت، **همدلی** نشان بده
- تمرکز روی **حس خوب و سلامتی** باشه، نه فقط عدد روی ترازو
- **امیدوارکننده باش** اما واقع‌بین

### 7️⃣ شخصی‌سازی:
- به نام کاربر اشاره کن
- از سابقه گفتگوها استفاده کن
- توجه به زمان روز داشته باش (صبح، ظهر، شب)
- **سبک زندگی** و شرایط کاربر را در نظر بگیر

---

## **مثال‌های پاسخ خوب:**

**کاربر:** "ناهار امروز چیه؟"
**تو:** "ناهار امروزت خورش قیمه با برنج است، ۴۵۰ کالری 🍲 وقت غذا، نوش جان!"

**کاربر:** "دوست ندارم باقلا بخورم"
**تو:** "باشه، یادداشت کردم! 📝 دفعه بعد برای تعویض غذا یه چیز بدون باقلا پیشنهاد می‌دم."

**کاربر:** "امروز از برنامه خارج شدم"
**تو:** "اشکالی نداره! 💚 مهم اینه که فردا دوباره شروع کنی. هر روز یه فرصت تازه‌ست."

**کاربر:** "چرا وزنم ثابت مونده؟"
**تو:** "گاهی بدن چند روزی صبر می‌کنه قبل از اینکه تغییر رو نشون بده. اگر داری برنامه رو رعایت می‌کنی، نگران نباش، نتیجه می‌گیری 💪"

---

## **هشدار:**
- **کوتاه بنویس!** پاسخ‌های طولانی خسته‌کننده‌اند.
- **فارسی محض!** کلمات انگلیسی ممنوع (مثلاً نگو "protein" بگو "پروتئین").
- **بدون JSON یا کد** در پاسخ، فقط متن قابل خواندن.
PROMPT;

    public function __construct(
        private CoachIntentParser $intentParser,
        private ModelPools $pools,
    ) {}

    public function callsExternalNetwork(): bool
    {
        return true;
    }

    /**
     * Generate a reply to user message with context injection.
     *
     * @return array{text: string, tokensIn: int, tokensOut: int, costMicros: int, model?: string}
     */
    public function reply(string $userId, string $userMessage, ?callable $onDelta = null): array
    {
        // Build context based on message content
        $contextBuilder = app(CoachContextBuilder::class);
        $context = $contextBuilder->buildForChat($userId, $userMessage);

        // Parse intent for potential action detection
        $intent = $this->intentParser->parse($userMessage);

        // Inject context into system prompt
        $systemPrompt = $this->injectContext(self::SYSTEM_PROMPT, $context);

        // Build messages array
        $messages = $this->addressUser(
            $this->pools->promptMessages('coach_system', ['context' => json_encode($context, JSON_UNESCAPED_UNICODE), 'input' => $userMessage]),
            $userMessage,
            $contextBuilder->recentDialogue($userId, $userMessage),
        );
        if ($intent['intent'] === 'check_progress') {
            $messages[] = ['role' => 'system', 'content' => 'این پیام دربارهٔ نرسیدن به کاهش وزن است. فقط از progress در زمینه استفاده کن: memberSince تاریخ عضویت، history وزن‌ها به کیلوگرم، changeKg و direction. عدد تازه‌ای نساز. اگر history خالی است بگو وزن ثبت نشده. کوتاه، همدل و بدون سرزنش جواب بده.'];
        }

        try {
            $result = $this->pools->run('nutrition_coach', $messages, null, $userId, false, null, $onDelta);
        } catch (Problem $error) {
            throw $error;
        }

        return [
            'text' => (string) ($result['text'] ?? ''),
            'tokensIn' => (int) ($result['tokensIn'] ?? 0),
            'tokensOut' => (int) ($result['tokensOut'] ?? 0),
            'costMicros' => (int) ($result['costMicros'] ?? 0),
            'model' => $result['model'] ?? 'unknown',
        ];
    }

    /**
     * Analyze food photo and return detection results.
     *
     * @param  string  $imageBase64  Base64 encoded image
     * @param  string  $caption  Optional user caption
     * @return array{foods: array, confidence: float, questions: array, tokensIn: int, tokensOut: int, costMicros: int}
     */
    public function analyzePhoto(string $userId, string $imageBase64, string $caption = ''): array
    {
        $contextBuilder = app(CoachContextBuilder::class);
        $context = $contextBuilder->buildForVision($userId);

        $systemPrompt = <<<'PROMPT'
تو یک مربی تغذیه هستی که باید از روی عکس، غذا را تشخیص بدهی.

برنامه امروز کاربر:
{{TODAY_PLAN}}

وظیفه: 
1. غذاها را شناسایی کن
2. مقدار تقریبی را حدس بزن (بر اساس اندازه بشقاب و مقایسه)
3. کالری تقریبی محاسبه کن
4. اگر مطمئن نیستی، سوال بپرس

پاسخ را به این فرمت JSON بده:
```json
{
  "foods": [
    {"name": "نام غذا", "amount": "مقدار تقریبی", "kcal": 123, "confidence": 0.8}
  ],
  "questions": ["سوال روشن‌کننده اگر لازم باشد"],
  "needsConfirmation": true/false
}
```
PROMPT;

        $systemPrompt = str_replace('{{TODAY_PLAN}}', $this->formatTodayPlan($context['todayPlan']), $systemPrompt);

        $userContent = $caption ? "عکس غذا: $caption" : 'عکس غذا';

        $configured = $this->pools->promptMessages('coach_vision', ['context' => json_encode($context, JSON_UNESCAPED_UNICODE), 'input' => $userContent]);
        $messages = [
            $configured[0],
            [
                'role' => 'user',
                'content' => [
                    ['type' => 'text', 'text' => $configured[1]['content']],
                    ['type' => 'image_url', 'image_url' => ['url' => 'data:image/jpeg;base64,'.$imageBase64]],
                ],
            ],
        ];

        $result = $this->pools->run('nutrition_vision', $messages, null, $userId, true);
        $parsed = $this->parseVisionResponse((string) ($result['text'] ?? ''));
        $foods = $parsed['foods'] ?? [];
        $confidence = 0.0;
        foreach ($foods as $food) {
            $confidence = max($confidence, (float) ($food['confidence'] ?? 0));
        }

        return [
            'foods' => $foods,
            'confidence' => $confidence,
            'questions' => $parsed['questions'] ?? [],
            'needsConfirmation' => (bool) ($parsed['needsConfirmation'] ?? $confidence < 0.7),
            'tokensIn' => (int) ($result['tokensIn'] ?? 0),
            'tokensOut' => (int) ($result['tokensOut'] ?? 0),
            'costMicros' => (int) ($result['costMicros'] ?? 0),
            'text' => (string) ($result['text'] ?? ''),
        ];
    }

    // ── Private helpers ──────────────────────────────────────────────────────

    /**
     * The stored user template can be empty. The model must still see the message.
     *
     * @param  list<array{role: string, content: mixed}>  $messages
     * @return list<array{role: string, content: mixed}>
     */
    /**
     * @param  list<array{role: string, content: string}>  $history
     */
    private function addressUser(array $messages, string $userMessage, array $history = []): array
    {
        $system = $messages[0] ?? ['role' => 'system', 'content' => ''];
        $notes = [];
        foreach (array_slice($messages, 1) as $message) {
            if (($message['role'] ?? '') === 'system') {
                $notes[] = $message;
            }
        }
        $notes[] = ['role' => 'system', 'content' => 'ابزاری در این گفتگو صدا زده نمی‌شود. فقط متن بفرست. اگر کاربر سلام نکرده، جواب را با سلام شروع نکن. این ادامهٔ همان گفتگو است؛ حرف قبلی خودت را به یاد داشته باش، خودت را دوباره معرفی نکن و از کاربر نخواه کاری را که همین حالا گفته انجام داده، از نو انجام دهد.'];

        return [$system, ...$history, ['role' => 'user', 'content' => $userMessage], ...$notes];
    }

    private function injectContext(string $template, array $context): string
    {
        $profile = $this->formatProfile($context['profile']);
        $todayPlan = $this->formatTodayPlan($context['todayPlan']);
        $preferences = $this->formatPreferences($context['preferences']);
        $progress = $this->formatProgress($context['progress']);

        return str_replace(
            ['{{PROFILE}}', '{{TODAY_PLAN}}', '{{PREFERENCES}}', '{{PROGRESS}}'],
            [$profile, $todayPlan, $preferences, $progress],
            $template
        );
    }

    private function formatProfile(array $profile): string
    {
        if (! isset($profile['hasProfile']) || ! $profile['hasProfile']) {
            return "نام: {$profile['name']}\n(پروفایل تغذیه‌ای هنوز تکمیل نشده)";
        }

        $goalMap = [
            'weight_loss' => 'کاهش وزن',
            'weight_gain' => 'افزایش وزن',
            'pregnancy' => 'بارداری/شیردهی',
            'detox' => 'سلامت عمومی',
        ];

        $goal = $goalMap[$profile['goal']] ?? $profile['goal'];
        $allergens = empty($profile['allergens']) ? 'ندارد' : implode('، ', $profile['allergens']);

        return <<<TEXT
نام: {$profile['name']}
هدف: {$goal}
سن: {$profile['age']} سال
وزن فعلی: {$profile['currentWeight']} کیلو
هدف کالری روزانه: {$profile['targetKcal']} کالری
آلرژی: {$allergens}
تعداد وعده: {$profile['mealsPerDay']}
TEXT;
    }

    private function formatTodayPlan(?array $plan): string
    {
        if (! $plan) {
            return 'برنامه امروز هنوز آماده نیست.';
        }

        $lines = ["تاریخ: {$plan['date']}"];
        foreach ($plan['meals'] as $meal) {
            $label = $meal['typeFa'] ?? $meal['type'];
            $lines[] = "- {$label}: {$meal['title']} ({$meal['kcal']} کالری)";
        }

        return implode("\n", $lines);
    }

    private function formatPreferences(array $prefs): string
    {
        if (empty($prefs)) {
            return 'هنوز ترجیحی ثبت نشده.';
        }

        $lines = [];

        if (isset($prefs['food_dislike'])) {
            $dislikes = array_column($prefs['food_dislike'], 'value');
            $lines[] = 'دوست نداره: '.implode('، ', array_slice($dislikes, 0, 5));
        }

        if (isset($prefs['food_like'])) {
            $likes = array_column($prefs['food_like'], 'value');
            $lines[] = 'دوست داره: '.implode('، ', array_slice($likes, 0, 5));
        }

        if (isset($prefs['pattern'])) {
            $patterns = array_column($prefs['pattern'], 'value');
            $lines[] = 'الگوها: '.implode('، ', array_slice($patterns, 0, 3));
        }

        return empty($lines) ? 'ترجیحات خاصی ثبت نشده.' : implode("\n", $lines);
    }

    private function formatProgress(?array $progress): string
    {
        if (! $progress) {
            return 'هنوز وزنی ثبت نشده.';
        }

        $direction = $progress['direction'] ?? 'ثبت نشده';
        $latest = $progress['latestWeightKg'] ?? 'ثبت نشده';
        $change = $progress['changeKg'] ?? 'ثبت نشده';
        $since = $progress['memberSince'] ?? 'ثبت نشده';

        return "عضویت: {$since}\nآخرین وزن: {$latest} کیلو\nتغییر: {$change} کیلو ({$direction})";
    }

    private function parseVisionResponse(string $content): array
    {
        // Extract JSON from markdown code blocks if present
        if (preg_match('/```json\s*(\{.*?\})\s*```/s', $content, $matches)) {
            $json = $matches[1];
        } elseif (preg_match('/\{.*\}/s', $content, $matches)) {
            $json = $matches[0];
        } else {
            return ['foods' => [], 'questions' => ['پاسخ قابل تحلیل نبود'], 'needsConfirmation' => true];
        }

        try {
            $parsed = json_decode($json, true, 512, JSON_THROW_ON_ERROR);

            return $parsed;
        } catch (\JsonException $e) {
            return ['foods' => [], 'questions' => ['پاسخ قابل تحلیل نبود'], 'needsConfirmation' => true];
        }
    }
}
