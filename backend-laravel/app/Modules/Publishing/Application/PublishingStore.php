<?php

namespace App\Modules\Publishing\Application;

interface PublishingStore
{
    public function articles(?string $status, int $limit, int $offset): array;

    public function article(string $slug, bool $lock = false): ?array;

    public function saveArticle(array $row, bool $new): void;

    public function snapshot(array $row, string $actor): void;

    public function documents(): array;

    public function publishDocument(string $id, string $purpose, string $summary, string $status): int;

    public function document(string $purpose, int $version): ?array;

    public function consent(string $userId, string $purpose, int $version): ?string;

    public function recordConsent(string $userId, string $purpose, int $version): string;

    public function consents(string $userId): array;

    public function config(): ?array;

    public function saveConfig(string $actor, array $config): int;

    public function audit(string $actor, string $action, string $type, ?string $id, array $detail): void;

    public function transaction(\Closure $work): mixed;
}
