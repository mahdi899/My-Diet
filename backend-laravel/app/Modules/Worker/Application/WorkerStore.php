<?php

namespace App\Modules\Worker\Application;

interface WorkerStore
{
    public function relay(int $limit = 20): int;

    /** @return list<object> */
    public function claim(int $limit = 1): array;

    public function succeed(string $id, string $lease, ?string $note = null): void;

    public function fail(string $id, string $error, int $attempts, int $limit = 3, ?string $lease = null): void;

    public function heartbeat(): void;

    public function maintenance(): array;

    /** @return array{inserted: int, skipped: int} */
    public function drainSnapshot(array $jobs): array;
}
