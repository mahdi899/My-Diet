<?php

namespace App\Modules\Rewards\Application;

use Closure;

interface StreakStore
{
    public function transaction(Closure $work): mixed;

    public function lockWallet(string $user): void;

    public function claim(string $user, string $command): ?array;

    public function saveClaim(string $user, string $command, array $response): void;

    public function promo(string $user): int;

    public function participation(string $user, string $today): ?array;

    public function latest(): ?array;

    public function rules(string $id): array;

    public function ids(): array;

    public function saveCampaign(array $input, array $milestones): array;

    public function ensureParticipation(string $user, string $campaign, string $cycleStart): array;

    /** @return array{qualified: array<string, true>, partial: array<string, true>, anomaly: bool} */
    public function activity(string $user, string $cycleStart, int $length): array;

    /** @return array<int, true> */
    public function granted(string $participation): array;

    public function reverseShortfall(string $user, string $participation, int $consecutive, string $today): void;

    /** @return list<array{id: string, day: int, amountToman: int, issued: bool}> */
    public function issue(string $user, string $participation, string $cycleStart, array $milestones, int $consecutive, bool $anomaly): array;

    public function held(string $participation): bool;
}
