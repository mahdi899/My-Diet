<?php

namespace App\Modules\Realtime\Application;

interface PushSender
{
    public function send(string $token, string $kind): void;
}
