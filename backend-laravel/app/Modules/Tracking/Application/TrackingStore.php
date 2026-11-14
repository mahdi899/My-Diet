<?php

namespace App\Modules\Tracking\Application;

use Closure;

interface TrackingStore
{
    public function transaction(Closure $work): mixed;

    public function lock(string $user): void;

    /** @return list<array{id: string, label: string}> */
    public function reasons(): array;

    public function reason(string $id): ?array;

    public function command(string $user, string $command): ?array;

    public function saveCommand(string $user, string $command, array $payload, array $response): void;

    public function approvedOption(string $user, string $version, string $meal, string $option, string $date): ?array;

    public function latestVersion(string $user, string $date): ?string;

    public function log(string $user, string $date, string $meal): ?array;

    public function saveLog(string $user, string $request, string $date, string $meal, bool $eaten, string $version, string $mealId, string $option, array $details): int;

    public function selection(string $user, string $date, string $meal): ?array;

    public function saveSelection(string $user, string $date, string $meal, string $version, string $mealId, string $option, ?string $reason, ?string $label, ?array $previous): int;

    public function invalidateShopping(string $user, string $date, string $meal, int $revision): void;

    /** @return list<array<string, mixed>> */
    public function logs(string $user, string $date): array;

    /** @return list<array<string, mixed>> */
    public function selections(string $user, string $date): array;

    public function logHistory(string $user, string $date): array;

    public function selectionHistory(string $user, string $date): array;

    public function publishedMeal(string $user, string $meal): ?array;

    public function structuredActivity(string $user, string $meal, string $date): bool;

    public function saveSimpleLog(string $user, string $request, string $date, string $meal, bool $eaten, string $version, string $mealId, ?string $option): void;

    public function rewardForMeal(string $user, string $request): ?array;

    public function rewardIfComplete(string $user, string $request, string $weekStart, string $effectiveFrom, string $friday): ?array;

    public function lateBulk(string $user, string $request, string $date): ?string;

    public function saveWeight(string $user, string $date, float $kilograms): void;

    /** @return list<array{date: string, kilograms: float}> */
    public function weights(string $user): array;

    public function hasReward(string $user, string $request, string $week): bool;

    public function saveReview(string $user, string $request, string $week, int $rating, string $body): string;

    /** @return list<array<string, mixed>> */
    public function rewards(string $user, ?string $id): array;

    public function acknowledge(string $user, string $id): ?string;

    public function publicReviews(): array;

    public function specialist(string $user): ?array;

    /** @return list<string> */
    public function rewardWeeks(string $user): array;

    public function unread(string $user): int;

    public function questions(string $request): array;
}
