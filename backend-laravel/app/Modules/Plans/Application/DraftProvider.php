<?php

namespace App\Modules\Plans\Application;

interface DraftProvider
{
    public function name(): string;

    public function callsExternalNetwork(): bool;

    /** @return list<array{meals: list<array{mealType: string, title: string, calories: int, notes: string, suggestedTime: string|null, items: list<array{name: string, quantity: float|int|null, unit: string|null}>}>}> */
    public function draft(string $requestId): array;
}
