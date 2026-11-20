<?php

namespace App\Modules\Coach\Application;

interface CoachGateway
{
    public function thread(string $user, ?int $before, int $limit, ?string $threadId = null): array;

    public function accept(string $user, string $client, string $text, ?callable $emit = null, ?string $threadId = null, ?string $replyToMessageId = null): array;

    public function photo(string $user, string $client, string $bytes, string $mime, ?string $threadId = null, string $caption = '', string $mealType = 'lunch'): array;

    public function confirmPhoto(string $user, string $entryId): array;

    public function followUps(string $user): array;

    public function media(string $user, string $id): ?array;

    public function today(string $user): array;

    public function dayBrief(string $user, ?string $threadId = null): array;

    public function action(string $user, string $client, string $action, array $args = [], ?string $label = null, ?string $threadId = null): array;

    public function patch(string $user, string $entry, string $title, ?string $mealType = null, ?array $items = null): array;

    public function proactive(): int;
}
