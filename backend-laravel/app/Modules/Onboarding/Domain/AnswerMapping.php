<?php

namespace App\Modules\Onboarding\Domain;

final class AnswerMapping
{
    public function __construct(private OnboardingRules $rules) {}

    private static function str(mixed $value): string
    {
        return is_string($value) || is_int($value) || is_float($value) ? (string) $value : '';
    }

    private static function number(mixed $value): int|float|null
    {
        return (is_int($value) || is_float($value)) ? $value : (is_string($value) && $value !== '' && is_numeric($value) ? (float) $value : null);
    }

    private static function values(mixed $value): array
    {
        return is_array($value) ? $value : (is_string($value) && $value !== '' ? [$value] : []);
    }

    private function labels(string $key, array $codes): array
    {
        $labels = array_column($this->rules->questions[$key]['options'] ?? [], 'label', 'code');

        return array_map(fn ($code) => $labels[$code] ?? $code, $codes);
    }

    public function submission(string $track, array $a): array
    {
        $str = fn ($key) => self::str($a[$key] ?? null);
        $list = fn ($key) => self::values($a[$key] ?? null);
        $nonempty = fn ($values) => array_values(array_filter($values, fn ($value) => $value !== ''));
        $nonNone = fn ($values) => array_values(array_filter($values, fn ($value) => $value !== 'none'));
        $health = [];
        $notes = [];
        foreach ($nonNone($list('conditions')) as $code) {
            $health[] = $code;
        }
        $labels = $this->labels('conditions', $nonNone($list('conditions')));
        if ($labels) {
            $notes[] = 'شرایط پزشکی: '.implode('، ', $labels).($str('conditions_text') !== '' ? ' ('.$str('conditions_text').')' : '');
        }
        $allergy = $nonNone($list('allergies'));
        $allergies = '';
        if ($allergy) {
            $health[] = 'food_allergy';
            $allergies = implode('، ', $nonempty([...$this->labels('allergies', array_values(array_filter($allergy, fn ($code) => $code !== 'other'))), $str('allergies_text')])) ?: 'ذکر نشده';
        }
        $takesMeds = $str('medications') === 'yes' || $str('lactation_meds') === 'yes';
        $meds = implode('، ', $nonempty([$str('medications_text'), $str('lactation_meds_text')]));
        if ($takesMeds) {
            $health[] = 'medication';
        }
        if ($str('binge_history') === 'yes') {
            $health[] = 'eating_disorder';
        }
        if (in_array($str('unintended_loss'), ['little', 'significant'], true)) {
            $health[] = 'unintentional_weight_loss';
            $notes[] = 'کاهش وزن ناخواسته: '.implode('، ', $this->labels('unintended_loss', [$str('unintended_loss')])).'؛ بررسی پزشک پیش از تنظیم برنامه لازم است';
        }
        foreach ($list('preg_conditions') as $code) {
            foreach (match ($code) {
                'gestational_diabetes' => ['gestational_diabetes'],'preeclampsia' => ['hypertension', 'high_risk_pregnancy'],'thyroid' => ['thyroid'],'anemia','other' => ['other'],default => []
            } as $flag) {
                $health[] = $flag;
            }
        }
        if (in_array('blood_sugar', $list('doctor_diet_advice'), true)) {
            $health[] = 'diabetes';
        }
        if (in_array('blood_pressure', $list('doctor_diet_advice'), true)) {
            $health[] = 'hypertension';
        }
        if (array_any($list('digestion'), fn ($code) => $code !== 'normal')) {
            $health[] = 'digestive';
        }
        if ($str('doctor_advice') !== '' && $str('doctor_advice') !== 'no') {
            $notes[] = 'توصیه پزشک: '.$this->labels('doctor_advice', [$str('doctor_advice')])[0];
        }
        if ($str('doctor_restrictions') === 'yes') {
            $notes[] = 'محدودیت پزشک: '.$str('doctor_restrictions_text');
        }
        foreach (['preg_symptoms' => 'علائم بارداری: ', 'preg_conditions' => 'شرایط بارداری: '] as $key => $label) {
            if ($nonNone($list($key))) {
                $notes[] = $label.implode('، ', $this->labels($key, $nonNone($list($key))));
            }
        }
        if ($str('baby_concern') !== '' && $str('baby_concern') !== 'no') {
            $notes[] = 'نگرانی پزشکی دربارهٔ شیر یا رشد نوزاد مطرح شده است';
        }
        if ($str('doctor_diet_advice_text') !== '') {
            $notes[] = 'توصیه غذایی پزشک: '.$str('doctor_diet_advice_text');
        }
        $advice = array_values(array_filter($list('doctor_diet_advice'), fn ($code) => $code !== 'no'));
        if ($advice) {
            $notes[] = 'توصیه‌های پزشک: '.implode('، ', $this->labels('doctor_diet_advice', $advice));
        }
        $health = array_values(array_unique($health));
        if (! $health) {
            $health = ['none'];
        }
        $needDetails = array_any($health, fn ($code) => $code !== 'none');
        $pattern = in_array($str('meals_per_day'), ['1', '2'], true) ? 'skipped' : 'regular';
        if (in_array('snacking', $list('loss_challenges'), true)) {
            $pattern = 'grazing';
        } elseif ($str('hunger_time') === 'night') {
            $pattern = 'night';
        }
        $sleep = $a['sleep_wake'] ?? null;
        $sleepCode = '7_to_9';
        if ($sleep instanceof \stdClass || (is_array($sleep) && ! array_is_list($sleep))) {
            $sleep = (array) $sleep;
            $hours = ((($sleep['wake'] - $sleep['sleep']) % 24) + 24) % 24;
            $sleepCode = $hours < 5 ? 'under_5' : ($hours < 7 ? '5_to_7' : ($hours <= 9 ? '7_to_9' : 'over_9'));
        }
        $days = is_numeric($str('exercise_days')) ? (float) $str('exercise_days') : 0;
        $stage = $track === 'pregnancy' ? ($str('life_stage') ?: 'pregnant') : 'none';
        $result = ['name' => $str('name'), 'age' => self::number($a['age'] ?? null), 'sex' => $str('sex'), 'heightCm' => self::number($a['height_cm'] ?? null), 'weightKg' => self::number($a['weight_kg'] ?? null),
            'goal' => $track === 'weight_loss' ? 'weight_loss' : ($track === 'weight_gain' ? 'weight_gain' : 'healthy_eating'), 'lifeStage' => $stage, 'health' => $health,
            'healthDetails' => $needDetails ? (implode(' | ', $notes) ?: 'مطابق پاسخ‌های پرسش‌نامه') : '', 'allergies' => $allergies, 'medicines' => $takesMeds ? ($meds ?: 'ذکر نشده') : '',
            'previousDiet' => $track === 'weight_loss' ? (['first' => 'none', 'kept' => 'kept', 'regained' => 'regained', 'hard' => 'hard'][$str('previous_diet')] ?? null) : 'none',
            'activity' => ['very_low' => 'sedentary', 'low' => 'light', 'medium' => 'moderate', 'high' => 'high', 'very_high' => 'high'][$str('activity')] ?? null,
            'exercise' => $days == 0 ? 'none' : ($days <= 2 ? '1_2' : ($days <= 4 ? '3_4' : '5_plus')), 'sleep' => $sleepCode, 'mealPattern' => $pattern,
            'water' => $str('water') !== '' ? (['under_4' => 'under_4', '4_6' => '4_to_6', '7_9' => '7_to_9', '10_plus' => '10_plus'][$str('water')] ?? null) : '',
            'preference' => in_array($str('diet_style'), ['vegan', 'vegetarian'], true) ? $str('diet_style') : 'iranian', 'budget' => $str('budget'), 'cooking' => $str('prep_time') === 'more' ? 'flexible' : 'under_30', 'dislikes' => $str('dislikes')];
        if (in_array($track, ['weight_loss', 'weight_gain'], true)) {
            $result['targetWeightKg'] = self::number($a['target_weight_kg'] ?? null);
        }
        if ($track === 'pregnancy') {
            if ($stage === 'pregnant') {
                $result['pregnancyWeek'] = self::number($a['pregnancy_week'] ?? null);
                $result['babies'] = $str('babies') === 'singleton' ? 'singleton' : ($str('babies') !== '' ? 'multiple' : null);
            }
            if (in_array($stage, ['pregnant', 'breastfeeding'], true)) {
                $result['prePregnancyWeightKg'] = self::number($a['pre_pregnancy_weight_kg'] ?? null);
            }
            if ($stage === 'breastfeeding') {
                $months = self::number($a['months_postpartum'] ?? null);
                $result['nursingAge'] = $months === null ? null : ($months < 6 ? 'under_6m' : ($months <= 12 ? '6_to_12m' : 'over_12m'));
            }
        }

        return array_filter($result, fn ($value) => $value !== null);
    }

    public static function preferences(string $track, array $a): array
    {
        $keys = ['job_activity', 'exercise_duration', 'sport_type', 'meals_per_day', 'loss_pace', 'loss_challenges', 'hunger_time', 'fast_food_freq', 'craving_level', 'gain_goal', 'appetite', 'gain_obstacle', 'unintended_loss', 'gain_sport', 'big_meals', 'snack_readiness', 'feeding_mode', 'lactation_goal', 'lactation_energy', 'health_focus', 'fruit_veg', 'digestion', 'sweets_freq', 'sleep_quality', 'diet_change', 'fav_dishes', 'bread_type', 'rice_frequency', 'tea_sugar', 'region', 'ramadan', 'guest_meals', 'preg_supplements', 'age_approx'];
        $result = ['track' => $track, ...array_filter(array_intersect_key($a, array_flip($keys)), fn ($value) => $value !== null)];
        if (($a['sleep_wake'] ?? null) instanceof \stdClass || (is_array($a['sleep_wake'] ?? null) && ! array_is_list($a['sleep_wake']))) {
            $result['sleep_wake'] = $a['sleep_wake'];
        }

        return $result;
    }

    public static function norm(string $text): string
    {
        $text = strtr($text, array_combine(preg_split('//u', '۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩', -1, PREG_SPLIT_NO_EMPTY), str_split('01234567890123456789')));
        $text = strtr($text, ['ي' => 'ی', 'ك' => 'ک', "\u{200c}" => '', "\u{200f}" => '', "\u{200e}" => '']);

        return mb_strtolower(trim(preg_replace('/\s+/u', ' ', preg_replace('/[؟?!.،,:؛]/u', '', $text))), 'UTF-8');
    }

    private function matches(array $options, string $text): array
    {
        $rest = self::norm($text);
        $found = [];
        usort($options, fn ($a, $b) => mb_strlen($b['label']) <=> mb_strlen($a['label']));
        foreach ($options as $option) {
            $label = self::norm($option['label']);
            $at = mb_strpos($rest, $label);
            if ($at !== false) {
                $found[] = ['at' => $at, 'option' => $option];
                $rest = mb_substr($rest, 0, $at).str_repeat(' ', mb_strlen($label)).mb_substr($rest, $at + mb_strlen($label));
            }
        }
        usort($found, fn ($a, $b) => $a['at'] <=> $b['at']);

        return array_column($found, 'option');
    }

    public function legacy(string $track, array $items): array
    {
        $titles = [];
        foreach ($this->rules->spec['questions'] as $question) {
            foreach ($question['demoTitles'] ?? [] as $title) {
                $titles[self::norm($title)] = $question;
            }
        }
        $answers = [];
        foreach ($items as $item) {
            $item = (array) $item;
            $question = $this->rules->questions[$item['key'] ?? ''] ?? $titles[self::norm($item['question'] ?? '')] ?? null;
            $text = trim($item['answer'] ?? '');
            if (! $question || $text === '' || in_array($text, ['ثبت نشده', 'ثبت نشده (اختیاری)', '__skipped__'], true)) {
                continue;
            }
            $key = $question['key'];
            $options = $question['options'] ?? [];
            if ($question['kind'] === 'text') {
                $answers[$key] = $text;
            } elseif (in_array($question['kind'], ['number', 'age'], true)) {
                $digits = strtr($text, array_combine(preg_split('//u', '۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩', -1, PREG_SPLIT_NO_EMPTY), str_split('01234567890123456789')));
                $numeric = preg_replace('/[^0-9.\-]/u', '', preg_replace('/[٬،\s]/u', '', str_replace(['٫', ',', '/'], '.', $digits)));
                $number = $numeric === '' ? 0 : (is_numeric($numeric) ? (float) $numeric : null);
                $range = $this->matches($options, $text)[0]['code'] ?? '';
                if ($question['kind'] === 'age' && isset(['18_30' => 24, '30_40' => 35, '40_50' => 45, '50_plus' => 55][$range])) {
                    $answers['age'] = ['18_30' => 24, '30_40' => 35, '40_50' => 45, '50_plus' => 55][$range];
                    $answers['age_approx'] = 'yes';
                } elseif ($number !== null && ($question['kind'] !== 'age' || ($number >= 18 && $number <= 100))) {
                    $answers[$key] = $number;
                }
            } elseif ($question['kind'] === 'sleep_wake') {
                $digits = strtr($text, array_combine(preg_split('//u', '۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩', -1, PREG_SPLIT_NO_EMPTY), str_split('01234567890123456789')));
                preg_match_all('/[0-9]{1,2}/', $digits, $matches);
                if (count($matches[0]) >= 2) {
                    $answers[$key] = (object) ['sleep' => (int) $matches[0][0] % 24, 'wake' => (int) $matches[0][1] % 24];
                }
            } else {
                $parts = explode(' — ', $text, 2);
                $codes = array_values(array_filter(is_array($item['codes'] ?? null) ? $item['codes'] : [], fn ($code) => is_string($code) && in_array($code, array_column($options, 'code'), true)));
                $chosen = $codes ?: array_column($this->matches($options, trim($parts[0])), 'code');
                if (! $chosen) {
                    continue;
                }
                $answers[$key] = $question['kind'] === 'single' ? $chosen[0] : $chosen;
                if (isset($parts[1],$question['followUp']) && trim($parts[1]) !== '') {
                    $answers[$question['followUp']['key']] = trim($parts[1]);
                }
            }
        }

        return ['track' => $track, 'answers' => $answers];
    }

    public static function displayName(array $items): ?string
    {
        foreach ($items as $item) {
            $item = (array) $item;
            $answer = trim($item['answer'] ?? '');
            if ($answer !== '' && ! in_array($answer, ['ثبت نشده', 'ثبت نشده (اختیاری)', '__skipped__'], true) && (($item['key'] ?? '') === 'name' || str_contains(self::norm($item['question'] ?? ''), 'اسم'))) {
                return mb_substr($answer, 0, 80);
            }
        }

        return null;
    }
}
