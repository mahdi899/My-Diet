<?php

namespace App\Modules\Onboarding\Domain;

use App\Modules\Publishing\Domain\ContentRules;
use App\Shared\Domain\Problem;

final class WebIntakeRules
{
    public const GOALS = ['weight_loss', 'weight_gain', 'pregnancy', 'detox'];

    private static function length(string $value): int
    {
        return (int) (strlen(mb_convert_encoding($value, 'UTF-16LE', 'UTF-8')) / 2);
    }

    private static function invalid(string $message): never
    {
        throw new Problem(400, 'validation', $message);
    }

    public static function submission(array $body): array
    {
        if (! is_string($body['id'] ?? null) || ! preg_match('/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/iD', $body['id']) || ! is_string($body['phone'] ?? null)
            || ! in_array($body['goal'] ?? null, self::GOALS, true) || ! is_array($body['answers'] ?? null) || count($body['answers']) < 1 || count($body['answers']) > 100) {
            self::invalid('اطلاعات پرسش‌نامه کامل نیست');
        }
        foreach ($body['answers'] as $answer) {
            if (! $answer instanceof \stdClass || ! is_string($answer->question ?? null) || ! is_string($answer->answer ?? null) || self::length($answer->question) > 500 || self::length($answer->answer) > 2000) {
                self::invalid('پاسخ معتبر نیست');
            }
            if (property_exists($answer, 'key') && (! is_string($answer->key) || ! preg_match('/^[a-z0-9_]{1,60}$/D', $answer->key))) {
                self::invalid('پاسخ معتبر نیست');
            }
            if (property_exists($answer, 'codes')) {
                if (! is_array($answer->codes) || count($answer->codes) > 20) {
                    self::invalid('پاسخ معتبر نیست');
                }
                foreach ($answer->codes as $code) {
                    if (! is_string($code) || ! preg_match('/^[a-z0-9_]{1,60}$/D', $code)) {
                        self::invalid('پاسخ معتبر نیست');
                    }
                }
            }
        }

        return ['id' => strtolower($body['id']), 'phone' => $body['phone'], 'goal' => $body['goal'], 'answers' => $body['answers']];
    }

    public static function questionnaire(string $goal, array $body): array
    {
        $invalid = fn () => self::invalid('تنظیمات هدف یا سؤال‌ها معتبر نیست');
        if (! in_array($goal, self::GOALS, true) || ! is_array($body['questions'] ?? null) || count($body['questions']) < 1 || count($body['questions']) > 100) {
            $invalid();
        }
        $ids = [];
        $questions = [];
        foreach ($body['questions'] as $raw) {
            $raw = $raw instanceof \stdClass ? (array) $raw : [];
            $id = $raw['id'] ?? null;
            if ((! is_int($id) && ! is_float($id)) || floor((float) $id) !== (float) $id || $id < 1 || $id > 10000 || isset($ids[(int) $id])) {
                $invalid();
            }
            $ids[(int) $id] = true;
            $question = ['id' => (int) $id, 'q' => ContentRules::text($raw['q'] ?? null, 500)];
            if ($id > 100) {
                if (($raw['type'] ?? null) === 'text') {
                    $question['type'] = 'text';
                } else {
                    if (($raw['type'] ?? null) !== 'choice' || ! is_array($raw['options'] ?? null) || count($raw['options']) < 2 || count($raw['options']) > 12) {
                        $invalid();
                    }
                    $question['type'] = 'choice';
                    $question['options'] = array_map(fn ($label) => ContentRules::text($label, 120), $raw['options']);
                }
            }
            $questions[] = $question;
        }

        return ['title' => ContentRules::text($body['title'] ?? null, 120), 'questions' => $questions];
    }
}
