<?php

namespace App\Modules\Coach\Application;

interface CoachModel
{
    public function callsExternalNetwork(): bool;

    /** @return array{text: string, tokensIn: int, tokensOut: int, costMicros: int} */
    public function reply(string $text): array;
}
