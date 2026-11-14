<?php

namespace App\Modules\Onboarding\Application;

interface OnboardingStore
{
    public function transaction(string $user, \Closure $work): mixed;

    public function draft(string $user): ?array;

    public function saveDraft(string $user, ?string $track, array $answers, ?string $step, ?int $progress, ?string $source = null): array;

    public function latest(string $user): ?array;

    public function profile(string $user): ?array;

    public function storeProfile(string $user, string $submission, string $source, array $profile, bool $consented): void;

    public function deleteDraft(string $user): void;

    public function facts(string $submission, array $facts): void;

    public function consent(string $user): void;

    public function audit(string $user, string $action, string $type, string $id, array $detail): void;

    public function phone(string $user): ?string;

    public function lead(string $hash): ?array;

    public function claimLead(string $user, string $lead): void;

    public function claimName(string $user, ?string $name): void;
}
