<?php

namespace App\Modules\Identity\Application;

final readonly class IdentitySettings
{
    public function __construct(public string $environment, public string $jwtSecret, public string $otpPepper,
        public string $fieldKey, public ?string $fixedOtp = null) {}
}
