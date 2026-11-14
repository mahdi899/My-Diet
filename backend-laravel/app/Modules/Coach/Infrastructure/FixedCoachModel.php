<?php

namespace App\Modules\Coach\Infrastructure;

use App\Modules\Coach\Application\CoachModel;

/** Deterministic coach. It never opens a network connection. */
final class FixedCoachModel implements CoachModel
{
    public int $calls = 0;

    public function callsExternalNetwork(): bool
    {
        return false;
    }

    public function reply(string $text): array
    {
        $this->calls++;

        return ['text' => 'پاسخ آزمایشی', 'tokensIn' => 10, 'tokensOut' => 5, 'costMicros' => 100];
    }
}
