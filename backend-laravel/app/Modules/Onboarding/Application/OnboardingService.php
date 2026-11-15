<?php

namespace App\Modules\Onboarding\Application;

use App\Modules\Identity\Application\IdentitySettings;
use App\Modules\Onboarding\Domain\AnswerMapping;
use App\Modules\Onboarding\Domain\OnboardingRules as Rules;
use App\Modules\Questionnaire\Application\QuestionnaireService;
use App\Modules\Questionnaire\Domain\QuestionnaireRules;
use App\Shared\Domain\LegacyCrypto as Crypto;
use App\Shared\Domain\Problem;

final class OnboardingService
{
    public function __construct(private OnboardingStore $store, private Rules $rules, private AnswerMapping $mapping,
        private QuestionnaireService $questionnaires, private QuestionnaireRules $questionnaireRules, private IdentitySettings $settings) {}

    public function spec(): array
    {
        return $this->rules->spec;
    }

    private function clinical(array $answers, bool $encrypt): array
    {
        return $this->rules->clinical($answers, $this->settings->fieldKey, $encrypt);
    }

    public function state(string $user): array
    {
        $claimed = false;
        $latest = $this->store->latest($user);
        if (! $latest) {
            $claimed = $this->store->draft($user) ? false : $this->importDemo($user);
            $latest = $claimed ? $this->store->latest($user) : null;
        }
        if ($latest) {
            $profile = $this->ensureProfile($user);

            return ['specVersion' => 2, 'status' => 'complete', 'nextStep' => $profile && $profile['consented_at'] ? 'enter_app' : 'consent', 'claimedFromDemo' => $claimed,
                'track' => $profile['track'] ?? null, 'missing' => [], 'draft' => null, 'profile' => $profile ? $this->summary($profile) : null];
        }
        $draft = $this->store->draft($user);
        if (! $draft) {
            return ['specVersion' => 2, 'status' => 'none', 'nextStep' => 'start', 'claimedFromDemo' => false, 'track' => null, 'missing' => [], 'draft' => null, 'profile' => null];
        }
        $answers = $this->clinical($draft['answers'], false);

        return ['specVersion' => 2, 'status' => $draft['source'] === 'demo' ? 'needs_gaps' : 'in_progress', 'nextStep' => $draft['source'] === 'demo' ? 'gaps' : 'resume',
            'claimedFromDemo' => $draft['source'] === 'demo', 'track' => $draft['track'], 'missing' => $draft['track'] ? $this->rules->missing($draft['track'], $answers) : [],
            'draft' => ['answers' => (object) $answers, 'stepKey' => $draft['step_key'], 'progress' => $draft['progress'], 'version' => $draft['version'], 'updatedAt' => Crypto::iso($draft['updated_at']), 'source' => $draft['source']], 'profile' => null];
    }

    public function draft(string $user, array $input): array
    {
        $track = $this->rules->track($input['track'] ?? null);
        $patch = $this->rules->patch($input['patch'] ?? null);
        $step = is_string($input['stepKey'] ?? null) ? mb_convert_encoding(substr(mb_convert_encoding($input['stepKey'], 'UTF-16LE', 'UTF-8'), 0, 128), 'UTF-8', 'UTF-16LE') : null;
        $progress = $input['progress'] ?? null;
        $progress = (is_int($progress) || is_float($progress)) && is_finite((float) $progress) ? (int) max(0, min(100, floor($progress + .5))) : null;
        $base = $input['baseVersion'] ?? null;
        $base = (is_int($base) || is_float($base)) && is_finite((float) $base) && floor((float) $base) === (float) $base ? $base : null;

        return $this->store->transaction($user, function () use ($user, $track, $patch, $step, $progress, $base): array {
            $current = $this->store->draft($user);
            if ($current && $base !== null && $base != $current['version']) {
                throw new Problem(409, 'draft_conflict', 'پیش‌نویس روی دستگاه دیگری تغییر کرده است');
            }
            $merged = $current['answers'] ?? [];
            foreach ($this->clinical($patch, true) as $key => $value) {
                if ($value === null) {
                    unset($merged[$key]);
                } else {
                    $merged[$key] = $value;
                }
            }
            $saved = $this->store->saveDraft($user, $track ?? $current['track'] ?? null, $merged, $step, $progress);

            return ['version' => $saved['version'], 'updatedAt' => Crypto::iso($saved['updated_at'])];
        });
    }

    public function submit(string $user, array $input): array
    {
        if (($input['patch'] ?? null) !== null) {
            $this->draft($user, ['patch' => $input['patch']]);
        }
        $draft = $this->store->draft($user);
        if (! $draft || ! $draft['track']) {
            Rules::fail('ابتدا پرسش‌نامه را شروع کن');
        }
        $answers = $this->clinical($draft['answers'], false);
        $missing = $this->rules->missing($draft['track'], $answers);
        if ($missing) {
            $titles = array_map(fn ($key) => $this->rules->questions[$key]['title'] ?? $key, array_slice($missing, 0, 3));
            throw new Problem(422, 'onboarding_incomplete', 'این پاسخ‌ها هنوز کامل نیست: '.implode('، ', $titles));
        }
        if (($input['consent'] ?? null) !== true) {
            throw new Problem(422, 'consent_required', 'برای ادامه باید با پردازش اطلاعات سلامت موافقت کنی');
        }

        return $this->finish($user, $draft['track'], $answers, $draft['source'], true);
    }

    public function consent(string $user): array
    {
        if (! $this->ensureProfile($user)) {
            throw new Problem(409, 'onboarding_incomplete', 'ابتدا پرسش‌نامه را کامل کن');
        }
        $this->store->transaction($user, function () use ($user): void {
            $this->store->consent($user);
            $this->store->audit($user, 'onboarding_consent', 'nutrition_profile', $user, ['specVersion' => 2]);
        });

        return ['ok' => true];
    }

    private function finish(string $user, string $track, array $answers, string $source, bool $consented): array
    {
        $submission = $this->mapping->submission($track, $answers);
        $validated = $this->questionnaireRules->validate($submission);
        $profile = Rules::profile($track, $validated['answers'], $validated['riskFlags'], AnswerMapping::preferences($track, $answers), $answers);

        return $this->store->transaction($user, function () use ($user, $submission, $profile, $source, $consented, $track, $answers): array {
            $created = $this->questionnaires->submit($user, $submission);
            $this->store->storeProfile($user, $created['id'], $source, $profile, $consented);
            $this->store->facts($created['id'], $this->rules->facts($track, $answers));
            $this->store->deleteDraft($user);
            if ($consented) {
                $this->store->audit($user, 'onboarding_consent', 'nutrition_profile', $user, ['specVersion' => 2]);
            }

            return ['submissionId' => $created['id'], 'profile' => $this->summary($this->store->profile($user))];
        });
    }

    public function ensureProfile(string $user): ?array
    {
        return $this->store->transaction($user, function () use ($user): ?array {
            $latest = $this->store->latest($user);
            if (! $latest) {
                return null;
            }
            $existing = $this->store->profile($user);
            if ($existing && $existing['submission_id'] === $latest['id']) {
                return $existing;
            }
            $stored = $latest['answers'];
            foreach (['healthDetails', 'allergies', 'medicines', 'dislikes'] as $key) {
                if (is_string($stored[$key] ?? null)) {
                    $stored[$key] = Crypto::decrypt($stored[$key], $this->settings->fieldKey);
                }
            }
            $profile = Rules::profile(Rules::trackStored($stored), $stored, $latest['risk_flags']);
            $this->store->storeProfile($user, $latest['id'], 'app', $profile, false);

            return $this->store->profile($user);
        });
    }

    public function importDemo(string $user): bool
    {
        $phone = $this->store->phone($user);
        if (! $phone) {
            return false;
        }
        $hash = hash_hmac('sha256', $phone, $this->settings->fieldKey);
        $imported = $this->store->transaction($user, function () use ($user, $hash): ?array {
            $lead = $this->store->lead($hash);
            if (! $lead) {
                return null;
            }
            try {
                $items = json_decode(Crypto::decrypt($lead['answers_encrypted'], $this->settings->fieldKey), true, 512, JSON_THROW_ON_ERROR);
                if (! is_array($items) || ! array_is_list($items)) {
                    $items = [];
                }
            } catch (\Throwable) {
                $items = [];
            }
            $mapped = $this->mapping->legacy($lead['goal'], $items);
            $name = is_string($mapped['answers']['name'] ?? null) ? trim($mapped['answers']['name']) : '';
            $campaign = is_string($lead['campaign_slug'] ?? null) && $lead['campaign_slug'] !== '' ? $lead['campaign_slug'] : null;
            $this->store->claimName($user, $name ?: AnswerMapping::displayName($items), $campaign);
            $this->store->saveDraft($user, $mapped['track'], $this->clinical($mapped['answers'], true), null, 0, 'demo');
            $this->store->claimLead($user, $lead['id']);
            $this->store->audit($user, 'demo_lead_claimed', 'demo_lead', $lead['id'], ['track' => $mapped['track']]);

            return $mapped;
        });
        if (! $imported) {
            return false;
        }
        if (! $this->rules->missing($imported['track'], $imported['answers'])) {
            try {
                $this->finish($user, $imported['track'], $imported['answers'], 'demo', false);
            } catch (\Throwable) {
                /** Keep the imported draft available when legacy clinical answers need review. */
            }
        }

        return true;
    }

    private function summary(array $row): array
    {
        return ['track' => $row['track'], 'source' => $row['source'], 'bmi' => (float) $row['bmi'], 'weightKg' => (float) $row['weight_kg'], 'targetWeightKg' => $row['target_weight_kg'] === null ? null : (float) $row['target_weight_kg'],
            'heightCm' => (float) $row['height_cm'], 'age' => $row['age'], 'bmrKcal' => $row['bmr_kcal'], 'tdeeKcal' => $row['tdee_kcal'], 'targetKcal' => $row['target_kcal'],
            'proteinG' => $row['protein_g'], 'carbsG' => $row['carbs_g'], 'fatG' => $row['fat_g'], 'safetyTier' => $row['safety_tier'], 'safetyReasons' => $row['safety_reasons'], 'dietStyle' => $row['diet_style'], 'consented' => $row['consented_at'] !== null];
    }
}
