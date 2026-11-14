<?php

namespace App\Modules\Money\Application;

interface PaymentGateways
{
    public function listing(): array;

    public function info(string $name): ?array;

    public function start(string $name, int $amountRial, string $callbackUrl): array;

    public function verify(string $name, int $amountRial, string $authority): array;
}
