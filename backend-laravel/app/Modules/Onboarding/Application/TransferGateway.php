<?php

namespace App\Modules\Onboarding\Application;

interface TransferGateway
{
    public function start(int $rial, string $order): string;

    public function verify(string $track, int $rial): bool;

    public function redirectUrl(string $track): string;
}
