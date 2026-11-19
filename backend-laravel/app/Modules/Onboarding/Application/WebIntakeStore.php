<?php

namespace App\Modules\Onboarding\Application;

interface WebIntakeStore
{
    public function questionnaires(): array;

    public function saveQuestionnaire(string $goal, array $document): void;

    public function joinCommunity(string $completionId): int;

    public function saveLead(array $lead): bool;

    public function verifyLead(string $id, string $hash): bool;

    public function phone(string $user): ?string;

    public function linkJourney(string $id, string $user, string $phone): void;
}
