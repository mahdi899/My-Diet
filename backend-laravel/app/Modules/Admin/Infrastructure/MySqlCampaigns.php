<?php

namespace App\Modules\Admin\Infrastructure;

use App\Modules\Admin\Domain\AdminRules;
use App\Shared\Domain\LegacyCrypto as Crypto;
use App\Shared\Domain\Problem;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Database\QueryException;

final class MySqlCampaigns
{
    public function __construct(private ConnectionInterface $db) {}

    public function list(): array
    {
        return array_map(fn ($row) => $this->view($row), $this->db->table('demo_campaign_links')->orderByDesc('created_at')->get()->all());
    }

    public function create(string $actor, array $input): array
    {
        $parsed = AdminRules::campaign($input['name'], $input['slug'], $input['source']);
        try {
            return $this->db->transaction(function () use ($actor, $parsed): array {
                $id = Crypto::uuid();
                $this->db->table('demo_campaign_links')->insert(['id' => $id, 'name' => $parsed['name'], 'slug' => $parsed['slug'], 'source' => $parsed['source']]);
                $this->audit($actor, 'campaign_link.created', 'demo_campaign_link', $id, $parsed);

                return $this->view($this->db->table('demo_campaign_links')->where('id', $id)->first());
            });
        } catch (QueryException $error) {
            if ((int) ($error->errorInfo[1] ?? 0) === 1062) {
                throw new Problem(409, 'conflict', 'این پسوند قبلاً استفاده شده؛ پسوند دیگری انتخاب کنید');
            }
            throw $error;
        }
    }

    public function toggle(string $actor, string $id, bool $active): array
    {
        return $this->db->transaction(function () use ($actor, $id, $active): array {
            if ($this->db->table('demo_campaign_links')->where('id', $id)->update(['active' => $active, 'updated_at' => $this->db->raw('current_timestamp(6)')]) === 0) {
                throw new Problem(404, 'not_found', 'لینک پیدا نشد');
            }
            $this->audit($actor, 'campaign_link.status_changed', 'demo_campaign_link', $id, ['active' => $active]);

            return $this->view($this->db->table('demo_campaign_links')->where('id', $id)->first());
        });
    }

    public function resolve(string $slug, bool $count): ?array
    {
        return $this->db->transaction(function () use ($slug, $count): ?array {
            $row = $this->db->selectOne('select source, slug from demo_campaign_links where slug=? and active=1 for update', [$slug]);
            if ($row === null) {
                return null;
            }
            if ($count) {
                $this->db->table('demo_campaign_links')->where('slug', $slug)->update(['opens' => $this->db->raw('opens+1')]);
            }

            return ['source' => $row->source, 'slug' => $row->slug];
        });
    }

    private function view(object $row): array
    {
        return ['id' => $row->id, 'name' => $row->name, 'slug' => $row->slug, 'source' => $row->source, 'active' => (bool) (int) $row->active, 'opens' => (int) $row->opens, 'created_at' => Crypto::iso($row->created_at), 'updated_at' => Crypto::iso($row->updated_at)];
    }

    private function audit(string $actor, string $action, string $type, string $id, array $detail): void
    {
        $this->db->table('audit_logs')->insert(['id' => Crypto::uuid(), 'actor_id' => $actor, 'action' => $action, 'target_type' => $type, 'target_id' => $id, 'detail' => json_encode((object) $detail, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR)]);
    }
}
