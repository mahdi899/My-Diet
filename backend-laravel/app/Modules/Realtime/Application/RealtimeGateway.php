<?php

namespace App\Modules\Realtime\Application;

interface RealtimeGateway
{
    public function register(string $user, string $session, string $platform, string $token, string $provider): array;

    public function remove(string $user, string $device): array;

    public function deliver(string $user, string $kind): int;

    public function since(string $user, string $since): array;
}
