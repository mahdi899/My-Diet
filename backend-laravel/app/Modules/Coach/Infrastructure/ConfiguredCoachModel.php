<?php

namespace App\Modules\Coach\Infrastructure;

use App\Modules\Coach\Application\CoachModel;
use App\Modules\Coach\Application\CoachContextBuilder;
use App\Modules\Coach\Application\CoachIntentParser;
use App\Modules\Ai\Infrastructure\ModelPools;
use App\Shared\Domain\Problem;

/**
 * Production coach model with advanced Persian prompting and context injection.
 * Uses nutrition_coach pool from ModelPools.
 */
final class ConfiguredCoachModel implements CoachModel
{
    private const SYSTEM_PROMPT = <<<'PROMPT'
تو یک مربی تغذیه شخصی و حرفه‌ای هستی. نامت «مربی رژیم من» است.

### اطلاعات کاربر:
{{PROFILE}}

### برنامه امروز:
{{TODAY_PLAN}}

### ترجیحات کاربر:
{{PREFERENCES}}

### وضعیت پیشرفت:
{{PROGRESS}}

### وظایف تو:
1. **پشتیبانی و انگیزه‌بخشی**: کاربر را در مسیر سلامت همراهی کن، بدون سرزنش یا قضاوت
2. **راهنمایی تغذیه‌ای**: سوالات درباره غذا، کالری، ماکروها را پاسخ بده
3. **مدیریت برنامه**: کمک به انتخاب غذا، تعویض وعده، ثبت مصرف
4. **پیگیری پیشرفت**: تحلیل روند وزن، تشویق موفقیت‌ها

### قوانین مهم:
- **زبان**: فقط فارسی صحبت کن، لحن دوستانه و صمیمی
- **ایمنی**: هیچ‌وقت تشخیص پزشکی نده، دارو تجویز نکن
- **حدود**: دستورات متخصص تغذیه را تغییر نده
- **آلرژن**: هیچ‌وقت غذای حاوی آلرژن کاربر پیشنهاد نده
- **محدودیت پزشکی**: برای کاربران با safety_tier = "doctor_only" خیلی محتاط باش

### نحوه پاسخ:
- پاسخ‌های کوتاه (۲-۴ جمله) بده، مگر کاربر توضیح بیشتر خواست
- از ایموجی مناسب استفاده کن: 🌱💪✨🎯
- اگر متوجه نشدی، سوال روشن‌کننده بپرس
- اگر درخواست خارج از حیطه‌ات بود، صادقانه بگو و به متخصص ارجاع بده

### اگر کاربر درخواست عملیات داشت (تعویض غذا، ثبت مصرف، ...)
در آخر پاسخ، یک JSON بازگردان:
```json
{
  "action": "swap_meal" | "log_consumption" | "log_weight" | "log_water" | "show_alternatives",
  "params": { ... }
}
```

### تن صدا:
- حمایتگر و دوستانه، نه معلم‌وار
- مثبت و امیدوارکننده
- واقع‌بین اما انگیزه‌بخش
- احترام به تلاش و شرایط کاربر
PROMPT;

    public function __construct(
        private CoachContextBuilder $contextBuilder,
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
    public function reply(string $userId, string $userMessage): array
    {
        // Build context based on message content
        $context = $this->contextBuilder->buildForChat($userId, $userMessage);
        
        // Parse intent for potential action detection
        $intent = $this->intentParser->parse($userMessage);
        
        // Inject context into system prompt
        $systemPrompt = $this->injectContext(self::SYSTEM_PROMPT, $context);
        
        // Build messages array
        $messages = [
            ['role' => 'system', 'content' => $systemPrompt],
            ['role' => 'user', 'content' => $userMessage],
        ];
        
        if ($intent['intent'] !== 'general_question') {
            $messages[] = ['role' => 'system', 'content' => 'نیت تشخیص‌داده‌شده: '.$intent['intent'].' '.json_encode($intent['params'], JSON_UNESCAPED_UNICODE)];
        }

        try {
            $result = $this->pools->run('nutrition_coach', $messages, null, $userId);
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
     * @param string $userId
     * @param string $imageBase64 Base64 encoded image
     * @param string $caption Optional user caption
     * @return array{foods: array, confidence: float, questions: array, tokensIn: int, tokensOut: int, costMicros: int}
     */
    public function analyzePhoto(string $userId, string $imageBase64, string $caption = ''): array
    {
        $context = $this->contextBuilder->buildForVision($userId);
        
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
        
        $userContent = $caption ? "عکس غذا: $caption" : "عکس غذا";
        
        $messages = [
            ['role' => 'system', 'content' => $systemPrompt],
            [
                'role' => 'user',
                'content' => [
                    ['type' => 'text', 'text' => $userContent],
                    ['type' => 'image_url', 'image_url' => ['url' => 'data:image/jpeg;base64,' . $imageBase64]],
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
        if (!isset($profile['hasProfile']) || !$profile['hasProfile']) {
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
        if (!$plan) {
            return 'برنامه امروز هنوز آماده نیست.';
        }
        
        $lines = ["تاریخ: {$plan['date']}"];
        foreach ($plan['meals'] as $meal) {
            $lines[] = "- {$meal['type']}: {$meal['title']} ({$meal['kcal']} کالری)";
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
            $lines[] = 'دوست نداره: ' . implode('، ', array_slice($dislikes, 0, 5));
        }
        
        if (isset($prefs['food_like'])) {
            $likes = array_column($prefs['food_like'], 'value');
            $lines[] = 'دوست داره: ' . implode('، ', array_slice($likes, 0, 5));
        }
        
        if (isset($prefs['pattern'])) {
            $patterns = array_column($prefs['pattern'], 'value');
            $lines[] = 'الگوها: ' . implode('، ', array_slice($patterns, 0, 3));
        }
        
        return empty($lines) ? 'ترجیحات خاصی ثبت نشده.' : implode("\n", $lines);
    }

    private function formatProgress(?array $progress): string
    {
        if (!$progress) {
            return 'هنوز وزنی ثبت نشده.';
        }
        
        $trend = [
            'decreasing' => 'در حال کاهش ✓',
            'increasing' => 'در حال افزایش',
            'stable' => 'ثابت',
        ][$progress['trend']] ?? '';
        
        return <<<TEXT
آخرین وزن: {$progress['latestWeight']} کیلو ({$progress['latestDate']})
تغییر هفتگی: {$progress['weeklyChange']} کیلو ({$trend})
TEXT;
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
