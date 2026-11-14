<?php

namespace App\Modules\Questionnaire\Application;

use App\Modules\Identity\Application\IdentitySettings;
use App\Modules\Questionnaire\Domain\QuestionnaireRules as Rules;
use App\Shared\Domain\LegacyCrypto as Crypto;
use App\Shared\Domain\Problem;

final class QuestionnaireService
{
    public function __construct(private QuestionnaireStore $store, private Rules $rules, private IdentitySettings $settings) {}

    private function published(): array
    {
        return $this->store->published() ?? throw new Problem(500, 'internal', 'نسخهٔ پرسشنامه در دسترس نیست');
    }

    public function schema(): array
    {
        $row = $this->published();
        $questions = $row['document']['questions'] ?? null;

        return ! is_array($questions) || is_string($questions[0] ?? null) ? $this->rules->builtin : ['version' => $row['version'], 'questions' => $questions];
    }

    private function clinical(array $answers, bool $encrypt): array
    {
        foreach (['healthDetails', 'allergies', 'medicines', 'dislikes'] as $key) {
            if (isset($answers[$key]) && is_string($answers[$key])) {
                $answers[$key] = $encrypt ? Crypto::encrypt($answers[$key], $this->settings->fieldKey) : Crypto::decrypt($answers[$key], $this->settings->fieldKey);
            }
        }

        return $answers;
    }

    public function draft(string $userId): array
    {
        $row = $this->store->draft($userId);

        return ['schemaVersion' => 1, 'answers' => (object) ($row ? $this->clinical($row['answers'], false) : []), 'updatedAt' => $row ? Crypto::iso($row['updated_at']) : null];
    }

    public function saveDraft(string $userId, array $answers): array
    {
        $length = (int) (strlen(mb_convert_encoding(json_encode((object) $answers, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR), 'UTF-16LE', 'UTF-8')) / 2);
        if ($length > 50000) {
            throw new Problem(400, 'validation', 'پرسشنامه بیش از حد طولانی است');
        }
        $this->store->saveDraft($userId, $this->clinical($answers, true));

        return ['ok' => true];
    }

    public function submit(string $userId, array $input): array
    {
        $validated = $this->rules->validate($input);
        $schema = $this->published();
        $extras = [];
        foreach (Rules::questions($schema['document']) as $question) {
            if (! str_starts_with($question['id'], 'custom_')) {
                continue;
            }
            $value = $input[$question['id']] ?? null;
            if (is_string($value)) {
                if (strlen(mb_convert_encoding(trim($value), 'UTF-16LE', 'UTF-8')) / 2 > 500) {
                    throw new Problem(400, 'validation', 'یکی از پاسخ‌ها بیش از حد طولانی است');
                }
                if (trim($value) !== '') {
                    $extras[$question['id']] = trim($value);
                }
            } elseif ((is_int($value) || is_float($value)) && is_finite((float) $value)) {
                $extras[$question['id']] = $value;
            } elseif (is_array($value) && count($value) > 0 && count($value) <= 20) {
                $extras[$question['id']] = $value;
            }
            if (($question['required'] ?? false) === true && ! array_key_exists($question['id'], $extras)) {
                throw new Problem(400, 'validation', 'پرسشنامه کامل نیست');
            }
        }
        $id = Crypto::uuid();
        $answers = $validated['answers'];
        $this->store->createSubmission($id, $userId, $schema['version'], [...$this->clinical($answers, true), ...$extras],
            $validated['riskFlags'], $validated['bmi'], $answers['lifeStage'] === 'pregnant' ? $this->today() : null);
        $this->store->setInitialName($userId, $answers['name']);

        return ['id' => $id, 'schemaVersion' => $schema['version']];
    }

    public function current(string $userId): array
    {
        $row = $this->store->latest($userId);
        if (! $row) {
            return ['submission' => null];
        }
        $answers = $this->clinical($row['answers'], false);
        $schema = $this->store->schema($row['schema_version']);

        return ['submission' => ['id' => $row['id'], 'schemaVersion' => $row['schema_version'], 'submittedAt' => Crypto::iso($row['submitted_at']),
            'answers' => (object) $answers, 'riskFlags' => $row['risk_flags'], 'bmi' => $row['bmi'] === null ? null : (float) $row['bmi'],
            'pregnancyWeek' => Rules::week($answers, $row['pregnancy_as_of'], $this->today()), 'valid' => Rules::valid(Rules::questions($schema['document'] ?? []), $answers)]];
    }

    private function today(): string
    {
        return (new \DateTimeImmutable('now', new \DateTimeZone('Asia/Tehran')))->format('Y-m-d');
    }

    public function acquisition(string $userId): array
    {
        $schema = $this->published();
        $submission = $this->store->latest($userId);
        $wallet = $this->store->wallet($userId) ?? throw new Problem(404, 'not_found', 'کیف پول پیدا نشد');
        $open = $this->store->openRequest($userId);
        $reasons = [];
        $week = null;
        $questionnaire = 'missing';
        $next = 'questionnaire';
        if ($submission) {
            $answers = $this->clinical($submission['answers'], false);
            if (! Rules::valid(Rules::questions($schema['document']), $answers)) {
                $reasons[] = 'schema_required_question_added';
            }
            $week = Rules::week($answers, $submission['pregnancy_as_of'], $this->today());
            if (($answers['lifeStage'] ?? null) === 'pregnant' && ($week === null || Rules::days($submission['pregnancy_as_of'], $this->today()) > 28)) {
                $reasons[] = 'pregnancy_stale';
            }
            $questionnaire = $reasons ? 'needs_review' : 'complete';
            $next = $reasons ? 'questionnaire' : ($open ? 'open_request' : (($schema['version'] !== $submission['schema_version'] || ($week !== null && $week !== ($answers['pregnancyWeek'] ?? null))) ? 'confirm_summary' : 'select_service'));
        }
        foreach (['cash_toman', 'promo_toman'] as $key) {
            if (abs((float) $wallet[$key]) > 9007199254740991) {
                throw new \RuntimeException('toman amount is outside the safe integer range');
            }
        }

        return ['questionnaire' => $questionnaire, 'reasons' => $reasons, 'nextStep' => $next, 'openRequest' => $open,
            'pregnancyWeek' => $week, 'wallet' => ['cashToman' => (int) $wallet['cash_toman'], 'promoToman' => (int) $wallet['promo_toman']]];
    }

    public function schemas(): array
    {
        return $this->store->schemas();
    }

    public function check(array $questions): array
    {
        return ['errors' => $this->rules->compatibility($questions)];
    }

    public function saveSchema(string $actor, array $questions): array
    {
        $errors = $this->rules->compatibility($questions);
        if ($errors) {
            throw new Problem(422, 'incompatible_schema', 'نسخهٔ پرسشنامه با سؤال‌های ثابت سازگار نیست');
        }
        $version = $this->store->createSchema(['questions' => $questions]);
        $this->store->audit($actor, 'questionnaire_draft', $version);

        return ['version' => $version, 'status' => 'draft', 'errors' => $errors];
    }

    public function publishSchema(string $actor, int $version): array
    {
        return $this->store->transaction(function () use ($actor, $version): array {
            $schema = $this->store->schema($version, true) ?? throw new Problem(404, 'not_found', 'نسخهٔ پرسشنامه پیدا نشد');
            if ($schema['status'] !== 'published') {
                if ($this->rules->compatibility($schema['document']['questions'] ?? [])) {
                    throw new Problem(422, 'incompatible_schema', 'نسخهٔ پرسشنامه با سؤال‌های ثابت سازگار نیست');
                }
                $this->store->publish($version);
                $this->store->audit($actor, 'questionnaire_publish', $version);
            }

            return ['version' => $version, 'status' => 'published'];
        });
    }
}
