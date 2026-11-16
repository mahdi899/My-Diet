<?php

namespace App\Modules\Plans\Application;

interface PlanGenerationStore
{
    public function transaction(callable $work): mixed;

    /** @return array{skip: ?string, userId: string, specialistId: ?string}|null */
    public function begin(string $requestId, bool $regenerate): ?array;

    public function finish(string $requestId, bool $regenerate, ?array $days, string $provider, ?string $reason): void;

    /** Local sandbox has no specialist desk, so a valid draft becomes the visible plan. */
    public function publishLocal(string $requestId): void;

    public function abandon(string $requestId): void;

    /** @return array{status: string} */
    public function regenerate(string $specialist, string $requestId, int $lock): array;
}
