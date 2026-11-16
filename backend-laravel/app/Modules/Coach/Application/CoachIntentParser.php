<?php

namespace App\Modules\Coach\Application;

/**
 * Parses user intent from Persian text messages.
 * Detects action requests and extracts parameters.
 */
final class CoachIntentParser
{
    /**
     * Parse user message and return detected intent.
     *
     * @return array{intent: string, confidence: float, params: array}
     */
    public function parse(string $messageText): array
    {
        $lower = strtr(mb_strtolower($messageText, 'UTF-8'), [
            '۰' => '0', '۱' => '1', '۲' => '2', '۳' => '3', '۴' => '4',
            '۵' => '5', '۶' => '6', '۷' => '7', '۸' => '8', '۹' => '9',
            '٠' => '0', '١' => '1', '٢' => '2', '٣' => '3', '٤' => '4',
            '٥' => '5', '٦' => '6', '٧' => '7', '٨' => '8', '٩' => '9',
            '٫' => '.',
        ]);

        // High-confidence exact matches
        if ($this->matchesSwapIntent($lower)) {
            return ['intent' => 'swap_meal', 'confidence' => 0.9, 'params' => $this->extractSwapParams($lower)];
        }

        if ($this->matchesWaterIntent($lower)) {
            return ['intent' => 'log_water', 'confidence' => 0.9, 'params' => $this->extractWaterParams($lower)];
        }

        if ($this->matchesLogIntent($lower)) {
            return ['intent' => 'log_consumption', 'confidence' => 0.85, 'params' => $this->extractLogParams($lower)];
        }

        if ($this->matchesWeightIntent($lower)) {
            return ['intent' => 'log_weight', 'confidence' => 0.9, 'params' => $this->extractWeightParams($lower)];
        }

        if ($this->matchesProgressIntent($lower)) {
            return ['intent' => 'check_progress', 'confidence' => 0.8, 'params' => []];
        }

        if ($this->matchesPlanIntent($lower)) {
            return ['intent' => 'show_plan', 'confidence' => 0.85, 'params' => $this->extractPlanParams($lower)];
        }

        if ($this->matchesMotivationIntent($lower)) {
            return ['intent' => 'motivation', 'confidence' => 0.7, 'params' => []];
        }

        // Default: general question
        return ['intent' => 'general_question', 'confidence' => 0.6, 'params' => []];
    }

    // ── Intent matchers ──────────────────────────────────────────────────────

    private function matchesSwapIntent(string $text): bool
    {
        $patterns = [
            'تعویض',
            'عوض کن',
            'جایگزین',
            'به جای',
            'بجای',
            'دوست ندارم',
            'نمی.?خوام',
            'نمیخوام',
        ];

        return $this->containsAny($text, $patterns);
    }

    private function matchesLogIntent(string $text): bool
    {
        $patterns = [
            'خوردم',
            'مصرف کردم',
            'ثبت.?کن',
            'ثبتش کن',
            'یادداشت کن',
        ];

        return $this->containsAny($text, $patterns);
    }

    private function matchesWeightIntent(string $text): bool
    {
        $patterns = [
            'وزنم.*\d+',
            '\d+.*کیلو',
            '\d+.*کیلوگرم',
            'وزن.?گرفتم',
            'وزن.?کم کردم',
        ];

        foreach ($patterns as $pattern) {
            if (preg_match('/'.$pattern.'/u', $text)) {
                return true;
            }
        }

        return false;
    }

    private function matchesWaterIntent(string $text): bool
    {
        $patterns = [
            'آب',
            'لیوان آب',
            'نوشیدم',
        ];

        return $this->containsAny($text, $patterns) && ! str_contains($text, 'آب‌پز');
    }

    private function matchesProgressIntent(string $text): bool
    {
        $patterns = [
            'پیشرفت',
            'چقدر.*کاهش',
            'چقدر.*افزایش',
            'چند کیلو',
            'موفق شدم',
            'نتیجه',
        ];

        return $this->containsAny($text, $patterns);
    }

    private function matchesPlanIntent(string $text): bool
    {
        $patterns = [
            'برنامه.*امروز',
            'برنامه.*فردا',
            'ناهار.*چی',
            'صبحانه.*چی',
            'شام.*چی',
            'غذای.*امروز',
        ];

        return $this->containsAny($text, $patterns);
    }

    private function matchesMotivationIntent(string $text): bool
    {
        $patterns = [
            'خسته شدم',
            'دلسرد شدم',
            'نتیجه نمی.?گیرم',
            'انگیزه',
            'نا امید',
        ];

        return $this->containsAny($text, $patterns);
    }

    // ── Parameter extractors ─────────────────────────────────────────────────

    private function extractSwapParams(string $text): array
    {
        $params = ['reason' => null, 'budget_concern' => false];

        if (str_contains($text, 'گرون') || str_contains($text, 'ارزون')) {
            $params['reason'] = 'budget';
            $params['budget_concern'] = true;
        } elseif (str_contains($text, 'دوست ندارم') || str_contains($text, 'نمی‌خوام')) {
            $params['reason'] = 'dislike';
        } elseif (str_contains($text, 'وقت ندارم') || str_contains($text, 'سریع')) {
            $params['reason'] = 'time';
        } elseif (str_contains($text, 'ندارم') || str_contains($text, 'نیست')) {
            $params['reason'] = 'unavailable';
        }

        return $params;
    }

    private function extractLogParams(string $text): array
    {
        $params = ['meal_time' => null, 'amount' => 'full'];

        if (str_contains($text, 'ناهار')) {
            $params['meal_time'] = 'lunch';
        } elseif (str_contains($text, 'صبحانه')) {
            $params['meal_time'] = 'breakfast';
        } elseif (str_contains($text, 'شام')) {
            $params['meal_time'] = 'dinner';
        }

        if (str_contains($text, 'نصف') || str_contains($text, 'نیمی')) {
            $params['amount'] = 'half';
        } elseif (str_contains($text, 'کم') || str_contains($text, 'کمی')) {
            $params['amount'] = 'less';
        } elseif (str_contains($text, 'زیاد') || str_contains($text, 'بیشتر')) {
            $params['amount'] = 'more';
        }

        return $params;
    }

    private function extractWaterParams(string $text): array
    {
        $glasses = 1;
        if (preg_match('/(\d+(?:[\.٫]\d+)?)\s*لیوان/u', $text, $matches) === 1) {
            $glasses = (float) str_replace('٫', '.', $matches[1]);
        } elseif (preg_match('/(یک|یه|دو|سه|چهار|پنج|شش|هفت|هشت)\s*لیوان/u', $text, $matches) === 1) {
            $glasses = match ($matches[1]) {
                'دو' => 2,
                'سه' => 3,
                'چهار' => 4,
                'پنج' => 5,
                'شش' => 6,
                'هفت' => 7,
                'هشت' => 8,
                default => 1,
            };
        }

        return ['ml' => (int) round(max(1, $glasses) * 250)];
    }

    private function extractWeightParams(string $text): array
    {
        $params = ['weight' => null];

        // Extract number followed by کیلو or between context
        if (preg_match('/(\d+(?:\.\d+)?)\s*کیلو/u', $text, $matches)) {
            $params['weight'] = (float) $matches[1];
        } elseif (preg_match('/وزنم\s*(\d+(?:\.\d+)?)/u', $text, $matches)) {
            $params['weight'] = (float) $matches[1];
        }

        return $params;
    }

    private function extractPlanParams(string $text): array
    {
        $params = ['day' => 'today'];

        if (str_contains($text, 'فردا')) {
            $params['day'] = 'tomorrow';
        } elseif (str_contains($text, 'دیروز')) {
            $params['day'] = 'yesterday';
        }

        return $params;
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private function containsAny(string $text, array $patterns): bool
    {
        foreach ($patterns as $pattern) {
            if (preg_match('/'.$pattern.'/u', $text)) {
                return true;
            }
        }

        return false;
    }
}
