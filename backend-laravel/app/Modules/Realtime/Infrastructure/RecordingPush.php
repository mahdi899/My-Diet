<?php

namespace App\Modules\Realtime\Infrastructure;

use App\Modules\Realtime\Application\PushSender;

/** Test adapter. It records the send and never contacts a push network. */
final class RecordingPush implements PushSender
{
    public array $sent = [];

    public function send(string $token, string $kind): void
    {
        $this->sent[] = ['token' => $token, 'kind' => $kind];
    }
}
