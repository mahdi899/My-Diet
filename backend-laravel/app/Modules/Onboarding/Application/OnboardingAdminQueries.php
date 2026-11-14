<?php

namespace App\Modules\Onboarding\Application;

interface OnboardingAdminQueries
{
    public function profiles(array $filter): array;

    public function profile(string $admin, string $user): array;

    public function funnel(): array;

    public function refresh(): array;

    public function leads(?string $cursor, mixed $limit): array;
}
