<?php

namespace App\Modules\Worker\Application;

interface WorkerStore
{
    public function relay(int $limit = 20): int;

    /** @return list<object> */
    public function claim(int $limit = 5): array;

    public function succeed(string $id): void;

    public function fail(string $id, string $error, int $attempts, int $limit = 3): void;

    public function heartbeat(): void;

    public function maintenance(): array;

    /** @return array{inserted: int, skipped: int} */
    public function drainSnapshot(array $jobs): array;
}
