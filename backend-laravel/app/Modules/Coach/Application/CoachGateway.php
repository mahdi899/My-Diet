<?php

namespace App\Modules\Coach\Application;

interface CoachGateway
{
    public function thread(string $user, ?int $before, int $limit): array;

    public function accept(string $user, string $client, string $text): array;

    public function photo(string $user, string $client, string $bytes, string $mime): array;

    public function confirmPhoto(string $user, string $entryId): array;

    public function followUps(string $user): array;

    public function media(string $user, string $id): ?array;

    public function today(string $user): array;

    public function dayBrief(string $user): array;

    public function action(string $user, string $client, string $action, array $args = [], ?string $label = null): array;

    public function patch(string $user, string $entry, string $title): array;

    public function proactive(): int;
}
