<?php

namespace App\Modules\Onboarding\Application;

interface TransferStore
{
    public function transaction(\Closure $work): mixed;

    public function lockUser(string $user): ?string;

    public function verified(string $submission, string $hash): bool;

    public function reusable(string $user, string $submission, string $plan): ?array;

    public function insert(string $id, string $user, string $submission, string $plan, int $amount): ?array;

    public function status(string $id, string $user): ?array;

    public function payment(string $id, string $user): ?array;

    public function attach(string $id, string $track): void;

    public function byTrack(string $track): ?array;

    public function lockReference(string $reference): void;

    public function referenceUsed(string $reference, string $except): bool;

    public function confirm(string $id, string $reference, ?int $bankAmount = null): ?array;

    public function audit(?string $actor, string $action, string $id, array $detail): void;

    public function all(): array;

    public function smsStatus(string $id, string $status): void;
}
