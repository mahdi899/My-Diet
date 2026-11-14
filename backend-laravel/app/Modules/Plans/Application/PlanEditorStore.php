<?php

namespace App\Modules\Plans\Application;

interface PlanEditorStore
{
    public function transaction(\Closure $work): mixed;

    public function request(string $id, bool $lock = false): ?array;

    public function lockOwner(string $user): void;

    public function versions(string $request): array;

    public function version(string $id): ?array;

    public function specialist(string $id): ?array;

    public function createVersion(string $request, int $number, ?string $author, array $days): string;

    public function replaceContents(string $version, int $lock, array $days, ?string $approver): int;

    public function inReview(string $request): void;

    public function blocked(string $request): bool;

    public function baseUnchanged(string $version, string $user): bool;

    public function publish(string $request, string $version, string $user, string $actor, string $week, string $effective): void;

    public function event(string $request, string $actor, string $kind): void;

    public function notify(string $user, string $kind, array $payload): void;

    public function healthAccess(string $actor, string $request, ?string $reason): void;

    public function patientAssigned(string $actor, string $patient): bool;

    public function patientVersions(string $patient): array;

    public function generation(string $request): ?array;

    public function flags(string $request): array;
}
