<?php

namespace App\Modules\Money\Application;

final readonly class MoneySettings
{
    public function __construct(public string $defaultGateway, public ?string $publicApiUrl) {}
}
