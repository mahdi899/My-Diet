<?php

namespace App\Modules\Identity\Application;

interface OtpSender
{
    public function send(string $phone, string $code): void;

    public function latest(string $phone): ?string;
}
