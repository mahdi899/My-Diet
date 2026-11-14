<?php

namespace App\Modules\Messaging\Application;

interface MessagingStore
{
    public function transaction(callable $work): mixed;

    public function conversations(string $user): array;

    public function participant(string $user, string $conversation): bool;

    public function messages(string $conversation, ?int $after, int $limit): array;

    public function priorMessage(string $conversation, string $author, string $client): ?string;

    public function mediaReady(string $id, string $owner, string $conversation): ?string;

    public function insertMessage(string $id, string $conversation, string $author, string $body, string $kind, ?string $client, ?string $media): void;

    public function receiptsForOthers(string $message, string $conversation, string $author): void;

    public function others(string $conversation, string $author): array;

    public function notify(string $user, string $kind, array $payload): void;

    public function markRead(string $user, string $conversation): int;

    public function support(string $user): ?string;

    public function openSupport(string $id, string $user): void;

    public function careRequest(string $user): ?array;

    public function careConversation(string $request): ?string;

    public function openCare(string $id, string $user, string $request, string $specialist): void;

    public function ensureParticipants(string $conversation, array $users): void;

    public function hasSystem(string $conversation): bool;

    public function beginMedia(string $id, string $owner, string $conversation, string $purpose, string $declared, ?int $duration): string;

    public function lockMedia(string $id, string $owner): ?array;

    public function expireMedia(string $id): void;

    public function quarantine(string $id): void;

    public function storeMedia(string $id, string $bytes, string $detected): void;

    public function mediaStatus(string $id): ?array;

    public function grant(string $id, string $media, string $user, string $hash): void;

    public function readGrant(string $media, string $user, string $hash): ?array;

    public function messageAuthor(string $message, string $conversation): ?string;

    public function stampReceipt(string $message, string $user, string $state): int;

    public function sync(string $user, ?string $since): array;

    public function notifications(string $user): array;

    public function readNotification(string $user, string $id): int;
}
