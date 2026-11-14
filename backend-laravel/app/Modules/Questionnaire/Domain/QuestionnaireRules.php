<?php

namespace App\Modules\Questionnaire\Domain;

use App\Shared\Domain\Problem;

final class QuestionnaireRules
{
    public function __construct(public readonly array $builtin) {}

    private function fail(string $message): never
    {
        throw new Problem(400, 'validation', $message);
    }

    private function length(string $text): int
    {
        return (int) (strlen(mb_convert_encoding($text, 'UTF-16LE', 'UTF-8')) / 2);
    }

    private function pick(array $source, string ...$keys): mixed
    {
        foreach ($keys as $key) {
            if (isset($source[$key]) && $source[$key] !== '') {
                return $source[$key];
            }
        }

        return null;
    }

    private function text(mixed $value, int $max): string
    {
        if ($value === null) {
            return '';
        }
        if (! is_string($value)) {
            $this->fail('پرسشنامه کامل نیست');
        }
        $value = trim($value);
        if ($this->length($value) > $max) {
            $this->fail('یکی از پاسخ‌ها بیش از حد طولانی است');
        }

        return $value;
    }

    private function number(mixed $value, string $message, float $min, float $max, bool $integer = false): int|float
    {
        if ((! is_string($value) && ! is_int($value) && ! is_float($value)) || ! is_numeric($value)) {
            $this->fail($message);
        }
        $number = (float) $value;
        if (! is_finite($number) || $number < $min || $number > $max || ($integer && floor($number) !== $number)) {
            $this->fail($message);
        }

        return $integer ? (int) $number : round($number, 1);
    }

    private function choice(string $id, mixed $value, string $message): string
    {
        if (! is_string($value) || trim($value) === '') {
            $this->fail($message);
        }
        $value = trim($value);
        $question = array_values(array_filter($this->builtin['questions'], fn ($q) => $q['id'] === $id))[0];
        foreach ($question['options'] as $option) {
            if ($option['code'] === $value || $option['label'] === $value) {
                return $option['code'];
            }
        }
        if ($id === 'goal' && in_array($value, ['تغذیهٔ متعادل', 'بهبود عادت غذایی'], true)) {
            return 'healthy_eating';
        }
        $this->fail($message);
    }

    public function validate(array $source): array
    {
        $name = $this->text($this->pick($source, 'name'), 80);
        if ($this->length($name) < 2) {
            $this->fail('نام را کامل بنویس');
        }
        $age = $this->number($this->pick($source, 'age'), 'سن باید بین ۱۸ و ۱۰۰ سال باشد', 18, 100, true);
        $sex = $this->choice('sex', $this->pick($source, 'sex'), 'جنسیت را انتخاب کن');
        $height = $this->number($this->pick($source, 'heightCm', 'height'), 'قد باید بین ۱۰۰ و ۲۵۰ سانتی‌متر باشد', 100, 250, true);
        $weight = $this->number($this->pick($source, 'weightKg', 'weight'), 'وزن باید بین ۲۵ و ۳۰۰ کیلوگرم باشد', 25, 300);
        $goal = $this->choice('goal', $this->pick($source, 'goal'), 'هدف را انتخاب کن');
        $stage = $this->choice('lifeStage', $this->pick($source, 'lifeStage'), 'وضعیت بارداری یا شیردهی را انتخاب کن');
        $pregnant = $stage === 'pregnant';
        $nursing = $stage === 'breastfeeding';
        $week = $pregnant ? $this->number($this->pick($source, 'pregnancyWeek'), 'هفتهٔ بارداری باید عددی بین ۱ و ۴۲ باشد', 1, 42, true) : null;
        $preWeight = $pregnant || $nursing ? $this->number($this->pick($source, 'prePregnancyWeightKg', 'prePregnancyWeight'), 'وزن پیش از بارداری باید بین ۲۵ و ۳۰۰ کیلوگرم باشد', 25, 300) : null;
        $babies = $pregnant ? $this->choice('babies', $this->pick($source, 'babies'), 'تعداد جنین را انتخاب کن') : null;
        $nursingAge = $nursing ? $this->choice('nursingAge', $this->pick($source, 'nursingAge'), 'سن کودک را انتخاب کن') : null;
        $target = null;
        $rawTarget = $this->pick($source, 'targetWeightKg', 'targetWeight');
        if (! $pregnant && in_array($goal, ['weight_loss', 'weight_gain'], true)) {
            $target = $this->number($rawTarget, 'وزن هدف باید بین ۲۵ و ۳۰۰ کیلوگرم باشد', 25, 300);
            if ($goal === 'weight_loss' && $target >= $weight) {
                $this->fail('وزن هدف باید کمتر از وزن فعلی باشد');
            }
            if ($goal === 'weight_gain' && $target <= $weight) {
                $this->fail('وزن هدف باید بیشتر از وزن فعلی باشد');
            }
        } elseif ($rawTarget !== null && $rawTarget !== '') {
            $target = $this->number($rawTarget, 'وزن هدف باید بین ۲۵ و ۳۰۰ کیلوگرم باشد', 25, 300);
        }
        $health = $this->pick($source, 'health');
        $health = is_array($health) ? $health : ($health === null ? [] : [$health]);
        if (! $health) {
            $this->fail('حداقل یک مورد سلامت را انتخاب کن');
        }
        $health = array_values(array_unique(array_map(fn ($item) => $this->choice('health', $item, 'گزینهٔ سلامت شناخته نشد'), $health)));
        $details = $this->text($this->pick($source, 'healthDetails'), 1000);
        $allergies = $this->text($this->pick($source, 'allergies'), 500);
        $medicines = $this->text($this->pick($source, 'medicines'), 500);
        if (array_diff($health, ['none']) && $details === '') {
            $this->fail('شرایط پزشکی را توضیح بده');
        }
        if (in_array('food_allergy', $health, true) && $allergies === '') {
            $this->fail('مادهٔ حساسیت‌زا را بنویس');
        }
        if (in_array('medication', $health, true) && $medicines === '') {
            $this->fail('داروها را بنویس');
        }
        $answers = ['name' => $name, 'age' => $age, 'sex' => $sex, 'heightCm' => $height, 'weightKg' => $weight, 'goal' => $goal,
            'lifeStage' => $stage, 'pregnancyWeek' => $week, 'prePregnancyWeightKg' => $preWeight, 'babies' => $babies, 'nursingAge' => $nursingAge,
            'targetWeightKg' => $target, 'previousDiet' => $this->choice('previousDiet', $this->pick($source, 'previousDiet'), 'تجربهٔ رژیم را انتخاب کن'),
            'health' => $health, 'healthDetails' => $details, 'allergies' => $allergies, 'medicines' => $medicines];
        foreach (['activity' => 'میزان فعالیت را انتخاب کن', 'exercise' => 'تعداد ورزش را انتخاب کن', 'sleep' => 'خواب را انتخاب کن',
            'mealPattern' => 'الگوی غذا را انتخاب کن', 'preference' => 'سلیقهٔ غذا را انتخاب کن', 'budget' => 'بودجه را انتخاب کن', 'cooking' => 'زمان آشپزی را انتخاب کن'] as $key => $message) {
            $answers[$key] = $this->choice($key, $this->pick($source, $key), $message);
        }
        $answers['water'] = $this->pick($source, 'water') === null ? '' : $this->choice('water', $source['water'], 'مقدار آب را انتخاب کن');
        $answers['dislikes'] = $this->text($this->pick($source, 'dislikes'), 500);
        $flags = $pregnant ? ['pregnant'] : [];
        foreach (['eating_disorder' => 'eating_disorder_history', 'high_risk_pregnancy' => 'high_risk_pregnancy', 'kidney' => 'kidney', 'unintentional_weight_loss' => 'unintentional_weight_loss'] as $key => $flag) {
            if (in_array($key, $health, true)) {
                $flags[] = $flag;
            }
        }

        return ['answers' => $answers, 'riskFlags' => $flags, 'bmi' => round($weight / ($height / 100) ** 2, 1)];
    }

    public function compatibility(array $next): array
    {
        $errors = [];
        $ids = [];
        foreach ($next as $q) {
            $q = (array) $q;
            $id = $q['id'] ?? '';
            if ($id === '' || in_array($id, $ids, true)) {
                $errors[] = 'reused question '.($id ?: '(empty)');
            }
            $ids[] = $id;
            if (! in_array($q['kind'] ?? null, ['text', 'number', 'single', 'multiple'], true)) {
                $errors[] = 'unknown kind '.$id;
            }
            if (trim($q['title'] ?? '') === '') {
                $errors[] = 'missing title '.$id;
            }
            $codes = [];
            foreach ($q['options'] ?? [] as $option) {
                $option = (array) $option;
                $code = $option['code'] ?? '';
                if (! $code || in_array($code, $codes, true)) {
                    $errors[] = 'reused option '.$id.'.'.($code ?: '(empty)');
                }
                $codes[] = $code;
                if (trim($option['label'] ?? '') === '') {
                    $errors[] = 'missing label '.$id.'.'.$code;
                }
            }
        }
        foreach ($this->builtin['questions'] as $built) {
            $matches = array_values(array_filter($next, fn ($q) => (((array) $q)['id'] ?? null) === $built['id']));
            if (! $matches) {
                $errors[] = 'deleted built-in question '.$built['id'];

                continue;
            }
            $found = (array) $matches[0];
            if (($found['kind'] ?? null) !== $built['kind']) {
                $errors[] = 'changed kind '.$built['id'];
            }
            $codes = array_column(array_map(fn ($o) => (array) $o, $found['options'] ?? []), 'code');
            foreach ($built['options'] as $option) {
                if (! in_array($option['code'], $codes, true)) {
                    $errors[] = 'deleted built-in option '.$built['id'].'.'.$option['code'];
                }
            }
        }
        $builtIds = array_column($this->builtin['questions'], 'id');
        foreach ($next as $q) {
            $id = ((array) $q)['id'] ?? '';
            if (! in_array($id, $builtIds, true) && ! preg_match('/^custom_[a-z0-9_]+$/D', $id)) {
                $errors[] = 'invalid custom question '.$id;
            }
        }

        return $errors;
    }

    public static function questions(array $document): array
    {
        return array_values(array_filter(array_map(fn ($q) => is_string($q) ? ['id' => $q] : (array) $q, $document['questions'] ?? []), fn ($q) => isset($q['id']) && is_string($q['id'])));
    }

    public static function answered(mixed $value): bool
    {
        if (is_string($value)) {
            return trim($value) !== '';
        }
        if (is_int($value) || is_float($value)) {
            return is_finite((float) $value);
        }

        return is_array($value) && count(array_filter($value, self::answered(...))) > 0;
    }

    public static function valid(array $questions, array $answers): bool
    {
        foreach ($questions as $q) {
            if (($q['required'] ?? false) === true && ! self::answered($answers[$q['id']] ?? null)) {
                return false;
            }
        }

        return true;
    }

    public static function week(array $answers, ?string $asOf, string $today): ?int
    {
        $week = $answers['pregnancyWeek'] ?? null;
        if (($answers['lifeStage'] ?? null) !== 'pregnant' || (! is_int($week) && ! (is_float($week) && floor($week) === $week)) || $asOf === null) {
            return null;
        }

        return (int) $week + (int) floor(max(0, self::days($asOf, $today)) / 7);
    }

    public static function days(string $from, string $to): int
    {
        return (int) round((strtotime($to.'T00:00:00Z') - strtotime($from.'T00:00:00Z')) / 86400);
    }
}
