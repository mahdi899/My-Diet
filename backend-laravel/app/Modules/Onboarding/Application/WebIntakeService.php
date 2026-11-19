<?php

namespace App\Modules\Onboarding\Application;

use App\Modules\Identity\Application\IdentitySettings;
use App\Shared\Domain\LegacyCrypto as Crypto;
use App\Shared\Domain\Problem;

final class WebIntakeService
{
    public function __construct(private WebIntakeStore $store, private OnboardingService $onboarding, private IdentitySettings $settings) {}

    public function questionnaires(): array
    {
        return $this->store->questionnaires();
    }

    public function saveQuestionnaire(string $goal, array $document): array
    {
        $this->store->saveQuestionnaire($goal, $document);

        return $document;
    }

    public function joinCommunity(string $completionId): array
    {
        return ['count' => $this->store->joinCommunity($completionId)];
    }

    public function save(array $input): array
    {
        $key = $this->settings->fieldKey;
        $saved = $this->store->saveLead(['id' => $input['id'], 'phone_hash' => hash_hmac('sha256', $input['phone'], $key), 'goal' => $input['goal'],
            'phone_encrypted' => Crypto::encrypt($input['phone'], $key), 'answers_encrypted' => Crypto::encrypt(json_encode($input['answers'], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR), $key),
            'campaign_slug' => $input['campaign']]);
        if (! $saved) {
            throw new Problem(409, 'conflict', 'شناسهٔ ثبت تکراری است');
        }

        return ['saved' => true, 'id' => $input['id'], 'phoneVerified' => false];
    }

    public function verify(string $user, string $id, ?string $journey): array
    {
        $phone = $this->store->phone($user);
        if (! $phone) {
            throw new Problem(401, 'unauthorized', 'نشست معتبر نیست');
        }
        if (! $this->store->verifyLead($id, hash_hmac('sha256', $phone, $this->settings->fieldKey))) {
            throw new Problem(404, 'not_found', 'اطلاعات ثبت‌شده پیدا نشد');
        }
        $this->onboarding->importDemo($user);
        if ($journey !== null) {
            $this->store->linkJourney($journey, $user, $phone);
        }

        return ['verified' => true];
    }
}
