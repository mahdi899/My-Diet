<?php

namespace App\Modules\Shopping\Application;

use Closure;

interface ShoppingStore
{
    public function transaction(Closure $work): mixed;

    public function lock(string $user): void;

    /**
     * @param  list<string>  $days
     * @return array{weekStart: string, days: list<string>, items: list<array<string, mixed>>, missingDays: list<string>, incomplete: bool, projectionKey: string, revision: int}
     */
    public function project(string $user, string $weekStart, array $days): array;

    public function saveFlag(string $user, string $weekStart, string $key, bool $alreadyHave, bool $purchased, ?float $quantity): void;
}
