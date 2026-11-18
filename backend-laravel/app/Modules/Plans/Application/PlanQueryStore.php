<?php

namespace App\Modules\Plans\Application;

interface PlanQueryStore
{
    public function active(string $user): ?array;

    public function dated(string $user, string $from, string $to): array;

    public function days(string $version): array;

    public function activity(string $user, string $request, string $date): array;

    public function latest(string $user): ?array;

    public function latestGenerationStatus(string $request): ?string;

    public function requests(string $user): array;

    public function request(string $user, string $id): ?array;

    public function events(string $request): array;

    public function questions(string $request): array;

    public function answers(string $request): array;

    public function conversation(string $request): ?string;

    public function userQuestions(string $user, string $status): array;

    public function queue(string $actor, ?string $bucket): array;
}
