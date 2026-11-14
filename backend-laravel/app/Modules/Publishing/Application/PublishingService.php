<?php

namespace App\Modules\Publishing\Application;

use App\Modules\Publishing\Domain\ContentRules as Rules;
use App\Shared\Domain\LegacyCrypto as Crypto;
use App\Shared\Domain\Problem;

final class PublishingService
{
    public function __construct(private PublishingStore $store) {}

    private function card(array $row, bool $detail = false): array
    {
        $result = ['id' => $row['slug'], 'title' => $row['title'], 'category' => $row['category'], 'image' => $row['image_index'],
            'time' => (string) $row['reading_minutes'], 'intro' => $row['intro'], 'readingMinutes' => $row['reading_minutes']];

        return $detail ? [...$result, 'version' => $row['version'], 'sections' => $row['sections']] : $result;
    }

    public function articles(mixed $status, mixed $page, mixed $size, bool $admin = false): array
    {
        if ($admin && ! in_array($status, [null, '', 'draft', 'published'], true)) {
            Rules::fail('وضعیت مقاله درست نیست');
        }
        $window = Rules::window($page, $size);
        $rows = $this->store->articles($admin ? ($status ?: null) : 'published', $window['pageSize'], $window['offset']);

        return ['page' => $window['page'], 'pageSize' => $window['pageSize'], 'total' => $rows['total'],
            'items' => array_map(fn ($row) => $admin ? [...$this->card($row, true), 'status' => $row['status']] : $this->card($row), $rows['items'])];
    }

    public function article(string $slug): array
    {
        $row = $this->store->article(Rules::slug($slug));
        if (! $row || $row['status'] !== 'published') {
            throw new Problem(404, 'not_found', 'مقاله پیدا نشد');
        }

        return $this->card($row, true);
    }

    public function saveArticle(string $actor, array $body, ?string $slug = null): array
    {
        $creating = $slug === null;
        $input = Rules::article(Rules::slug($slug ?? $body['slug'] ?? null), $body);

        return $this->store->transaction(function () use ($actor, $input, $creating): array {
            $row = $this->store->article($input['slug'], true);
            if ($creating && $row) {
                throw new Problem(409, 'slug_taken', 'این شناسه قبلاً استفاده شده است');
            }
            if (! $creating && ! $row) {
                throw new Problem(404, 'not_found', 'مقاله پیدا نشد');
            }
            $row = [...($row ?? ['id' => Crypto::uuid(), 'status' => 'draft', 'version' => 0, 'published_at' => null]),
                'slug' => $input['slug'], 'title' => $input['title'], 'category' => $input['category'], 'image_index' => $input['image'], 'reading_minutes' => $input['readingMinutes'], 'intro' => $input['intro'], 'sections' => $input['sections']];
            $row['version']++;
            $this->store->saveArticle($row, $creating);
            $this->store->snapshot($row, $actor);
            $this->store->audit($actor, $creating ? 'article_draft' : 'article_update', 'article', $row['id'], ['slug' => $row['slug'], 'version' => $row['version']]);

            return [...$this->card($row, true), 'status' => $row['status'], 'replayed' => false];
        });
    }

    public function articleStatus(string $actor, string $slug, string $status): array
    {
        $slug = Rules::slug($slug);

        return $this->store->transaction(function () use ($actor, $slug, $status): array {
            $row = $this->store->article($slug, true) ?? throw new Problem(404, 'not_found', 'مقاله پیدا نشد');
            if ($row['status'] === $status) {
                return [...$this->card($row, true), 'status' => $status, 'replayed' => true];
            }
            $row['status'] = $status;
            $row['version']++;
            $row['published_at'] = $status === 'published' ? gmdate('Y-m-d H:i:s') : null;
            $this->store->saveArticle($row, false);
            $this->store->snapshot($row, $actor);
            $this->store->audit($actor, $status === 'published' ? 'article_publish' : 'article_unpublish', 'article', $row['id'], ['slug' => $slug, 'version' => $row['version']]);

            return [...$this->card($row, true), 'status' => $status, 'replayed' => false];
        });
    }

    public function documents(): array
    {
        return ['documents' => $this->store->documents()];
    }

    public function publishConsent(string $actor, array $body): array
    {
        $purpose = Rules::purpose($body['purpose'] ?? null);
        $summary = Rules::text($body['summary'] ?? null, 400);
        $status = $body['status'] ?? null;
        if (! in_array($status, ['draft', 'published'], true)) {
            Rules::fail('وضعیت رضایت درست نیست');
        }

        return $this->store->transaction(function () use ($actor, $purpose, $summary, $status): array {
            $id = Crypto::uuid();
            $version = $this->store->publishDocument($id, $purpose, $summary, $status);
            $this->store->audit($actor, 'consent_publish', 'consent_document', $id, ['purpose' => $purpose, 'version' => $version, 'status' => $status]);

            return ['purpose' => $purpose, 'version' => $version, 'status' => $status];
        });
    }

    public function consents(string $user): array
    {
        return ['records' => $this->store->consents($user)];
    }

    public function recordConsent(string $user, array $body): array
    {
        $purpose = Rules::purpose($body['purpose'] ?? null);
        $version = $body['version'] ?? null;
        if ((! is_int($version) && ! is_float($version)) || floor((float) $version) !== (float) $version || $version < 1) {
            Rules::fail('نسخهٔ رضایت درست نیست');
        }

        return $this->store->transaction(function () use ($user, $purpose, $version): array {
            if (($this->store->document($purpose, (int) $version)['status'] ?? null) !== 'published') {
                throw new Problem(404, 'not_found', 'این نسخهٔ رضایت منتشر نشده است');
            }
            $recorded = $this->store->consent($user, $purpose, (int) $version);
            if ($recorded !== null) {
                return ['purpose' => $purpose, 'version' => $version, 'recordedAt' => Crypto::iso($recorded), 'replayed' => true];
            }
            $recorded = $this->store->recordConsent($user, $purpose, (int) $version);
            $this->store->audit($user, 'consent_record', 'user', $user, ['purpose' => $purpose, 'version' => $version]);

            return ['purpose' => $purpose, 'version' => $version, 'recordedAt' => Crypto::iso($recorded), 'replayed' => false];
        });
    }

    public function config(): array
    {
        $row = $this->store->config();

        return ['version' => $row['version'] ?? 1, 'minAppVersion' => $row['min_app_version'] ?? '1.0.0',
            'download' => ['status' => $row['download_status'] ?? 'not_released', 'url' => ($row['download_status'] ?? '') === 'released' ? $row['download_url'] : null]];
    }

    public function saveConfig(string $actor, array $body): array
    {
        $config = Rules::config($body);

        return $this->store->transaction(function () use ($actor, $config): array {
            $version = $this->store->saveConfig($actor, $config);
            $this->store->audit($actor, 'public_config', 'public_config', null, ['version' => $version, 'minAppVersion' => $config['minAppVersion'], 'downloadStatus' => $config['download']['status']]);

            return ['version' => $version, ...$config];
        });
    }
}
