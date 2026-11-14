<?php

namespace App\Modules\Onboarding\Domain;

use App\Shared\Domain\LegacyCrypto as Crypto;
use App\Shared\Domain\Problem;

final class OnboardingRules
{
    public array $questions;

    public array $textKeys;

    public function __construct(public readonly array $spec)
    {
        $this->questions = array_column($spec['questions'], null, 'key');
        $this->textKeys = [];
        foreach ($spec['questions'] as $q) {
            if ($q['kind'] === 'text') {
                $this->textKeys[] = $q['key'];
            }
            if (isset($q['followUp'])) {
                $this->textKeys[] = $q['followUp']['key'];
            }
        }
    }

    public static function fail(string $message): never
    {
        throw new Problem(400, 'validation', $message);
    }

    public function track(mixed $track): ?string
    {
        if ($track === null) {
            return null;
        }
        if (! is_string($track) || ! in_array($track, array_column($this->spec['tracks'], 'id'), true)) {
            self::fail('هدف انتخابی معتبر نیست');
        }

        return $track;
    }

    public function active(string $track, array $answers): array
    {
        return array_values(array_filter($this->spec['questions'], function ($q) use ($track, $answers): bool {
            if (isset($q['tracks']) && ! in_array($track, $q['tracks'], true)) {
                return false;
            }
            if (! isset($q['showIf'])) {
                return true;
            }
            $condition = $q['showIf'];
            $value = $answers[$condition['key']] ?? null;
            $codes = is_array($value) ? $value : ($value === null ? [] : [(string) $value]);
            if (isset($condition['in']) && ! array_intersect($condition['in'], $codes)) {
                return false;
            }

            return ! isset($condition['notIn']) || ! $codes || ! array_intersect($condition['notIn'], $codes);
        }));
    }

    public function missing(string $track, array $answers): array
    {
        $missing = [];
        foreach ($this->active($track, $answers) as $q) {
            if (! $q['required']) {
                continue;
            }
            $value = $answers[$q['key']] ?? null;
            $answered = $value !== null && (! is_string($value) || trim($value) !== '') && (! is_array($value) || count($value) > 0);
            if ($answered && isset($q['followUp']) && $q['followUp']['required']) {
                $chosen = is_array($value) ? $value : [(string) $value];
                if (array_intersect($chosen, $q['followUp']['whenCodes'])) {
                    $text = $answers[$q['followUp']['key']] ?? null;
                    $answered = is_string($text) && trim($text) !== '';
                }
            }
            if (! $answered) {
                $missing[] = $q['key'];
            }
        }

        return $missing;
    }

    public function patch(mixed $patch): array
    {
        if ($patch === null) {
            return [];
        }
        if (! $patch instanceof \stdClass && (! is_array($patch) || array_is_list($patch))) {
            self::fail('پاسخ‌ها معتبر نیستند');
        }
        $result = [];
        foreach ((array) $patch as $key => $value) {
            if (! isset($this->questions[$key]) && ! in_array($key, [...$this->textKeys, 'age_approx'], true)) {
                self::fail('پاسخ ناشناخته');
            }
            $result[$key] = $this->value($key, $value);
        }

        return $result;
    }

    public function value(string $key, mixed $value): mixed
    {
        if ($value === null) {
            return null;
        }
        $q = $this->questions[$key] ?? null;
        if (in_array($key, $this->textKeys, true)) {
            if (! is_string($value) || strlen(mb_convert_encoding($value, 'UTF-16LE', 'UTF-8')) / 2 > 500) {
                self::fail('متن واردشده معتبر نیست');
            }

            return preg_replace('/^[\s\p{Z}\x{FEFF}]+|[\s\p{Z}\x{FEFF}]+$/u', '', $value);
        }
        if (! $q) {
            if ($key === 'age_approx' && $value === 'yes') {
                return 'yes';
            }
            self::fail('پاسخ ناشناخته');
        }
        switch ($q['kind']) {
            case 'number':
            case 'age':
                if ((! is_int($value) && ! is_float($value)) || ! is_finite((float) $value)) {
                    self::fail('عدد واردشده معتبر نیست');
                }
                if ($value < ($q['min'] ?? -INF) || $value > ($q['max'] ?? INF)) {
                    self::fail('مقدار «'.$q['title'].'» خارج از بازهٔ مجاز است');
                }

                return floor($value * 10 + .5) / 10;
            case 'single':
                if (! is_string($value) || ! in_array($value, array_column($q['options'] ?? [], 'code'), true)) {
                    self::fail('گزینهٔ انتخابی معتبر نیست');
                }

                return $value;
            case 'multi':
            case 'dish_picker':
                if (! is_array($value) || ! array_is_list($value) || count($value) > 20 || array_any($value, fn ($item) => ! is_string($item) || ! in_array($item, array_column($q['options'] ?? [], 'code'), true))) {
                    self::fail('گزینه‌های انتخابی معتبر نیستند');
                }

                return array_values(array_unique($value));
            case 'sleep_wake':
                $value = $value instanceof \stdClass ? (array) $value : $value;
                foreach (['sleep', 'wake'] as $key) {
                    $number = is_array($value) ? ($value[$key] ?? null) : null;
                    if ((! is_int($number) && ! is_float($number)) || floor((float) $number) !== (float) $number || $number < 0 || $number > 23) {
                        self::fail('ساعت خواب و بیداری معتبر نیست');
                    }
                }

                return (object) ['sleep' => (int) $value['sleep'], 'wake' => (int) $value['wake']];
        }
        self::fail('پاسخ معتبر نیست');
    }

    public function clinical(array $answers, string $secret, bool $encrypt): array
    {
        foreach ($answers as $key => &$value) {
            if (is_string($value) && in_array($key, $this->textKeys, true)) {
                $value = $encrypt ? Crypto::encrypt($value, $secret) : Crypto::decrypt($value, $secret);
            }
        }

        return $answers;
    }

    public function facts(string $track, array $answers): array
    {
        $facts = [['key' => 'track', 'code' => $track, 'num' => null]];
        foreach ($this->spec['questions'] as $q) {
            $value = $answers[$q['key']] ?? null;
            if ($value === null || $q['kind'] === 'text') {
                continue;
            }
            if (in_array($q['kind'], ['number', 'age'], true)) {
                if (is_int($value) || is_float($value)) {
                    $facts[] = ['key' => $q['key'], 'code' => '', 'num' => $value];
                }
            } elseif ($q['kind'] === 'sleep_wake') {
                $value = (array) $value;
                $facts[] = ['key' => 'sleep_hour', 'code' => '', 'num' => $value['sleep']];
                $facts[] = ['key' => 'wake_hour', 'code' => '', 'num' => $value['wake']];
            } else {
                foreach (is_array($value) ? $value : [$value] as $code) {
                    $facts[] = ['key' => $q['key'], 'code' => (string) $code, 'num' => null];
                }
            }
        }

        return $facts;
    }

    public static function trackStored(array $stored): string
    {
        return in_array($stored['lifeStage'], ['pregnant', 'breastfeeding'], true) ? 'pregnancy' : (in_array($stored['goal'], ['weight_loss', 'weight_gain'], true) ? $stored['goal'] : 'detox');
    }

    public static function profile(string $track, array $stored, array $riskFlags, array $preferences = [], array $canonical = []): array
    {
        $meals = ['1' => 1, '2' => 2, '3' => 3, '4_plus' => 4][$preferences['meals_per_day'] ?? ''] ?? null;
        $energy = EnergyEngine::energy([...$stored, 'track' => $track, 'sex' => $stored['sex'] === 'male' ? 'male' : 'female',
            'lossPace' => $preferences['loss_pace'] ?? null, 'monthsPostpartum' => $canonical['months_postpartum'] ?? null, 'lactationGoal' => $preferences['lactation_goal'] ?? null]);
        $safety = EnergyEngine::safety(['track' => $track, 'bmi' => $energy['bmi'], 'health' => $stored['health'], 'riskFlags' => $riskFlags, 'targetWeightKg' => $stored['targetWeightKg'], 'heightCm' => $stored['heightCm']]);
        $allergens = is_array($canonical['allergies'] ?? null) ? array_values(array_filter($canonical['allergies'], fn ($code) => $code !== 'none')) : (in_array('food_allergy', $stored['health'], true) ? ['other'] : []);

        return ['track' => $track, 'goal' => $stored['goal'], 'sex' => $stored['sex'] === 'male' ? 'male' : 'female', 'age' => $stored['age'], 'heightCm' => $stored['heightCm'], 'weightKg' => $stored['weightKg'],
            'targetWeightKg' => $stored['targetWeightKg'], 'activity' => $stored['activity'], 'bmi' => $energy['bmi'], 'energy' => $energy, 'dietStyle' => in_array($stored['preference'], ['vegan', 'vegetarian'], true) ? $stored['preference'] : 'omnivore',
            'mealsPerDay' => $meals, 'budget' => $stored['budget'], 'region' => is_string($preferences['region'] ?? null) ? $preferences['region'] : null, 'allergens' => $allergens,
            'conditions' => array_values(array_filter($stored['health'], fn ($code) => $code !== 'none')), 'riskFlags' => $safety['flags'], 'safety' => $safety, 'preferences' => $preferences];
    }
}
