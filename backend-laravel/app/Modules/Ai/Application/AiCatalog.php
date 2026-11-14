<?php

namespace App\Modules\Ai\Application;

interface AiCatalog
{
    public function callsExternalNetwork(): bool;

    /** @return list<array{id: string, name: string, contextLength: int|null, priceInMicrosPerM: int, priceOutMicrosPerM: int, free: bool}> */
    public function models(?array $provider = null): array;

    /** @return array{ok: bool, answer: ?string, outcome: string, usage: ?array, chain: array, errorCode?: string} */
    public function complete(string $model, ?array $provider = null): array;
}
