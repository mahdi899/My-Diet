<?php

namespace App\Modules\Plans\Infrastructure;

use App\Modules\Plans\Application\DraftProvider;

/** Deterministic stand-in used when no model pool is configured. It never opens a network connection. */
final class LocalDraftProvider implements DraftProvider
{
    public function name(): string
    {
        return 'local';
    }

    public function callsExternalNetwork(): bool
    {
        return false;
    }

    public function draft(string $requestId): array
    {
        return array_map(fn () => ['meals' => [[
            'mealType' => 'lunch',
            'title' => 'پیش‌نویس محلی',
            'calories' => 300,
            'notes' => '',
            'suggestedTime' => '13:00',
            'items' => [['name' => 'عدس', 'quantity' => 80, 'unit' => 'g']],
        ]]], range(0, 6));
    }
}
