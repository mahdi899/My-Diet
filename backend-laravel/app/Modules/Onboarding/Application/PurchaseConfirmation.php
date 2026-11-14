<?php

namespace App\Modules\Onboarding\Application;

interface PurchaseConfirmation
{
    public function send(string $phone): void;
}
