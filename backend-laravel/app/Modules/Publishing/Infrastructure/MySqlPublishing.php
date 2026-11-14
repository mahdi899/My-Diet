<?php

namespace App\Modules\Publishing\Infrastructure;

use App\Modules\Publishing\Application\PublishingStore;
use App\Shared\Domain\LegacyCrypto;
use Illuminate\Database\ConnectionInterface;

final class MySqlPublishing implements PublishingStore
{
    public function __construct(private ConnectionInterface $db) {}

    private function row(?object $row): ?array
    {
        if (! $row) {
            return null;
        }
        $row = (array) $row;
        if (isset($row['sections'])) {
            $row['sections'] = json_decode($row['sections'], true, 512, JSON_THROW_ON_ERROR);
        }

        return $row;
    }

    private function json(mixed $value): string
    {
        return json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    }

    public function articles(?string $status, int $limit, int $offset): array
    {
        $query = $this->db->table('articles');
        if ($status !== null) {
            $query->where('status', $status);
        }

        return ['total' => $query->count(), 'items' => array_map($this->row(...), $query->orderBy('position')->orderBy('slug')->limit($limit)->offset($offset)->get()->all())];
    }

    public function article(string $slug, bool $lock = false): ?array
    {
        $query = $this->db->table('articles')->where('slug', $slug);

        return $this->row(($lock ? $query->lockForUpdate() : $query)->first());
    }

    public function saveArticle(array $row, bool $new): void
    {
        $fields = ['id', 'slug', 'status', 'version', 'title', 'category', 'image_index', 'reading_minutes', 'intro', 'sections', 'published_at'];
        $row = array_intersect_key($row, array_flip($fields));
        $row['sections'] = $this->json($row['sections']);
        if ($new) {
            $row['position'] = (int) $this->db->table('articles')->max('position') + 1;
            $this->db->table('articles')->insert($row);
        } else {
            $row['updated_at'] = $this->db->raw('current_timestamp(6)');
            $this->db->table('articles')->where('id', $row['id'])->update($row);
        }
    }

    public function snapshot(array $row, string $actor): void
    {
        $fields = ['version', 'status', 'title', 'category', 'image_index', 'reading_minutes', 'intro', 'sections'];
        $snapshot = array_intersect_key($row, array_flip($fields));
        $snapshot['article_id'] = $row['id'];
        $snapshot['actor_id'] = $actor;
        $snapshot['sections'] = $this->json($snapshot['sections']);
        $this->db->table('article_versions')->insert($snapshot);
    }

    public function documents(): array
    {
        return array_map(fn ($row) => (array) $row, $this->db->table('consent_documents')->select('purpose', 'version', 'summary')->where('status', 'published')->orderBy('purpose')->orderBy('version')->get()->all());
    }

    public function publishDocument(string $id, string $purpose, string $summary, string $status): int
    {
        $version = (int) $this->db->table('consent_documents')->where('purpose', $purpose)->max('version') + 1;
        $this->db->table('consent_documents')->insert(['id' => $id, 'purpose' => $purpose, 'version' => $version, 'summary' => $summary, 'status' => $status,
            'published_at' => $status === 'published' ? $this->db->raw('current_timestamp(6)') : null]);

        return $version;
    }

    public function document(string $purpose, int $version): ?array
    {
        return $this->row($this->db->table('consent_documents')->where(['purpose' => $purpose, 'version' => $version])->first());
    }

    public function consent(string $userId, string $purpose, int $version): ?string
    {
        return $this->db->table('consent_records')->where(['user_id' => $userId, 'purpose' => $purpose, 'version' => $version])->value('recorded_at');
    }

    public function recordConsent(string $userId, string $purpose, int $version): string
    {
        $this->db->table('consent_records')->insert(['user_id' => $userId, 'purpose' => $purpose, 'version' => $version]);

        return $this->consent($userId, $purpose, $version);
    }

    public function consents(string $userId): array
    {
        return array_map(fn ($row) => ['purpose' => $row->purpose, 'version' => $row->version, 'recordedAt' => LegacyCrypto::iso($row->recorded_at)],
            $this->db->table('consent_records')->where('user_id', $userId)->orderBy('purpose')->orderBy('version')->get()->all());
    }

    public function config(): ?array
    {
        return $this->row($this->db->table('public_config_versions')->orderByDesc('version')->first());
    }

    public function saveConfig(string $actor, array $config): int
    {
        $version = (int) $this->db->table('public_config_versions')->max('version') + 1;
        $this->db->table('public_config_versions')->insert(['version' => $version, 'min_app_version' => $config['minAppVersion'], 'download_status' => $config['download']['status'], 'download_url' => $config['download']['url'], 'actor_id' => $actor]);

        return $version;
    }

    public function audit(string $actor, string $action, string $type, ?string $id, array $detail): void
    {
        $this->db->table('audit_logs')->insert(['id' => LegacyCrypto::uuid(), 'actor_id' => $actor, 'action' => $action, 'target_type' => $type, 'target_id' => $id, 'detail' => $this->json((object) $detail)]);
    }

    public function transaction(\Closure $work): mixed
    {
        return $this->db->transaction(function () use ($work): mixed {
            $this->db->statement('insert into identity_mutexes(lock_key) values(?) as incoming on duplicate key update lock_key=incoming.lock_key', [hash('sha256', 'publishing:writes')]);

            return $work();
        });
    }
}
