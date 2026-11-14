<?php

namespace App\Modules\Plans\Application;

use Closure;
use Throwable;

interface PlanChangeStore
{
    public function transaction(Closure $work): mixed;

    public function duplicateKey(Throwable $error): bool;

    public function reasons(bool $activeOnly): array;

    public function updateReason(string $id, string $label, bool $active): array;

    public function lockUser(string $user): void;

    public function lockRequest(string $request): void;

    public function byCommand(string $user, string $command): ?array;

    public function activePlan(string $user): ?array;

    public function activeReasons(array $ids): array;

    public function targetExists(string $version, int $day, ?string $meal): bool;

    public function insert(string $id, string $user, string $request, string $version, string $command, string $explanation): void;

    public function snapshotReason(string $request, string $reason, string $label): void;

    public function target(string $request, int $day, ?string $meal): void;

    public function systemMessage(string $user, string $specialist, string $request, string $change, string $body): void;

    public function notify(string $user, string $change): void;

    public function present(string $id, bool $staff): array;

    public function idsForUser(string $user): array;

    public function queueIds(string $specialist): array;

    public function row(string $id): ?array;

    public function lock(string $id): array;

    public function save(string $id, array $values, bool $respond = false): void;

    public function answer(string $request, string $body): bool;

    public function ask(string $request, string $prompt): void;

    public function specialist(string $request): string;

    public function assertAssigned(string $specialist, string $request): void;

    public function activeVersion(string $user): ?string;

    public function hasOpenQuestion(string $request): bool;
}
