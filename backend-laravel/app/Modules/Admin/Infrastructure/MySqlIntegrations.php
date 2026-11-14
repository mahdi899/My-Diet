<?php

namespace App\Modules\Admin\Infrastructure;

use App\Modules\Identity\Application\IdentitySettings;
use App\Modules\Realtime\Application\PushSender;
use App\Shared\Domain\LegacyCrypto as Crypto;
use App\Shared\Domain\Problem;
use Illuminate\Database\ConnectionInterface;

final class MySqlIntegrations
{
    public function __construct(private ConnectionInterface $db, private IdentitySettings $settings, private PushSender $push) {}

    public function connections(): array
    {
        return array_map(fn ($row) => ['id' => $row->id, 'name' => $row->name, 'baseUrl' => $row->base_url, 'model' => $row->model, 'active' => (bool) (int) $row->active, 'costPer1kTokens' => (int) $row->cost_per_1k_tokens, 'createdAt' => Crypto::iso($row->created_at)], $this->db->table('ai_connections')->orderByDesc('created_at')->get()->all());
    }

    public function addConnection(string $actor, array $input): array
    {
        $id = Crypto::uuid();
        $this->db->transaction(function () use ($actor, $input, $id): void {
            $this->db->table('ai_connections')->insert(['id' => $id, 'name' => $input['name'], 'base_url' => rtrim($input['baseUrl'], '/'), 'model' => $input['model'], 'api_key_encrypted' => Crypto::encrypt($input['apiKey'], $this->settings->fieldKey), 'cost_per_1k_tokens' => $input['cost']]);
            $this->audit($actor, 'ai_connection_created', 'ai_connection', $id, []);
        });

        return ['id' => $id];
    }

    public function activate(string $actor, string $id, bool $active): array
    {
        return $this->db->transaction(function () use ($actor, $id, $active): array {
            $this->db->statement('insert into identity_mutexes(lock_key) values(?) as incoming on duplicate key update lock_key=incoming.lock_key', [hash('sha256', 'ai-connections')]);
            if ($active) {
                $this->db->table('ai_connections')->where('active', 1)->update(['active' => 0]);
            }
            if ($this->db->table('ai_connections')->where('id', $id)->update(['active' => $active]) === 0) {
                throw new Problem(404, 'not_found', 'سرویس پیدا نشد');
            }
            $this->audit($actor, 'ai_connection_activation', 'ai_connection', $id, ['active' => $active]);

            return ['ok' => true];
        });
    }

    public function remove(string $actor, string $id): array
    {
        return $this->db->transaction(function () use ($actor, $id): array {
            if ($this->db->table('ai_connections')->where('id', $id)->delete() === 0) {
                throw new Problem(404, 'not_found', 'سرویس پیدا نشد');
            }
            $this->audit($actor, 'ai_connection_deleted', 'ai_connection', $id, []);

            return ['ok' => true];
        });
    }

    public function configureFirebase(string $actor, array $body): array
    {
        $project = $body['project_id'] ?? null;
        $email = $body['client_email'] ?? null;
        $key = $body['private_key'] ?? null;
        if (! is_string($project) || ! is_string($email) || ! is_string($key) || ! str_contains($key, 'BEGIN PRIVATE KEY')) {
            throw new Problem(400, 'validation', 'فایل JSON حساب سرویس Firebase معتبر نیست');
        }
        $account = ['projectId' => $project, 'clientEmail' => $email, 'privateKey' => $key];
        $this->db->transaction(function () use ($actor, $account): void {
            $value = json_encode(['encrypted' => Crypto::encrypt(json_encode($account, JSON_THROW_ON_ERROR), $this->settings->fieldKey)], JSON_THROW_ON_ERROR);
            $this->db->statement("insert into app_settings (`key`, value) values ('firebase_admin', cast(? as json)) as incoming on duplicate key update value=incoming.value, version=app_settings.version+1, updated_at=current_timestamp(6)", [$value]);
            $this->audit($actor, 'firebase_configured', 'settings', null, []);
        });

        return ['ok' => true];
    }

    public function pushStatus(): array
    {
        $config = $this->firebase();
        $devices = (int) $this->db->selectOne("select count(*) as n from devices d join users u on u.id=d.user_id where d.provider='fcm' and d.revoked_at is null and u.status='active' and u.role='user'")->n;
        $scheduled = (int) $this->db->table('push_campaigns')->where('status', 'scheduled')->whereNull('deleted_at')->count();

        return ['configured' => $config !== null, 'projectId' => $config['projectId'] ?? null, 'devices' => $devices, 'scheduled' => $scheduled];
    }

    public function devices(): array
    {
        return array_map(fn ($row) => ['id' => $row->id, 'platform' => $row->platform, 'displayName' => $row->display_name, 'lastSeenAt' => Crypto::iso($row->last_seen_at)], $this->db->select("select d.id, d.platform, u.display_name, d.last_seen_at from devices d join users u on u.id=d.user_id where d.provider='fcm' and d.revoked_at is null and u.status='active' and u.role='user' order by d.last_seen_at desc limit 500"));
    }

    public function campaigns(): array
    {
        return array_map(function ($row): array {
            return ['id' => $row->id, 'title' => $row->title, 'body' => $row->body, 'audience' => $row->audience, 'deviceId' => $row->device_id, 'status' => $row->status, 'scheduledAt' => $row->scheduled_at === null ? null : Crypto::iso($row->scheduled_at), 'sentAt' => $row->sent_at === null ? null : Crypto::iso($row->sent_at), 'createdAt' => Crypto::iso($row->created_at), 'total' => (int) $row->total, 'accepted' => (int) $row->accepted, 'failed' => (int) $row->failed];
        }, $this->db->select("select c.id, c.title, c.body, c.audience, c.device_id, c.status, c.scheduled_at, c.sent_at, c.created_at, count(d.device_id) as total, sum(d.status='accepted') as accepted, sum(d.status in ('failed','unknown')) as failed from push_campaigns c left join campaign_deliveries d on d.campaign_id=c.id where c.deleted_at is null group by c.id order by c.created_at desc limit 200"));
    }

    public function createCampaign(string $actor, array $input): array
    {
        if ($input['scheduledAt'] !== null && new \DateTimeImmutable($input['scheduledAt']) <= CivilDates::now()) {
            throw new Problem(400, 'validation', 'زمان ارسال باید در آینده باشد');
        }
        $id = Crypto::uuid();
        $this->db->transaction(function () use ($actor, $input, $id): void {
            if ($input['audience'] === 'device') {
                $eligible = $this->db->selectOne("select d.id from devices d join users u on u.id=d.user_id where d.id=? and d.provider='fcm' and d.revoked_at is null and u.status='active' and u.role='user'", [$input['deviceId']]);
                if ($eligible === null) {
                    throw new Problem(400, 'validation', 'دستگاه واجد شرایط پیدا نشد');
                }
            }
            $this->db->table('push_campaigns')->insert(['id' => $id, 'title' => $input['title'], 'body' => $input['body'], 'audience' => $input['audience'], 'device_id' => $input['deviceId'], 'scheduled_at' => $input['scheduledAt'], 'created_by' => $actor]);
            $this->audit($actor, 'push_draft_created', 'push_campaign', $id, []);
        });

        return ['id' => $id];
    }

    public function sendCampaign(string $actor, string $id): array
    {
        if ($this->firebase() === null) {
            throw new Problem(409, 'firebase_required', 'ابتدا Firebase را از تنظیمات متصل کنید');
        }

        return $this->db->transaction(function () use ($actor, $id): array {
            $campaign = $this->db->selectOne('select * from push_campaigns where id=? and deleted_at is null for update', [$id]);
            if ($campaign === null) {
                throw new Problem(404, 'not_found', 'اعلان پیدا نشد');
            }
            if ($campaign->status !== 'draft') {
                throw new Problem(409, 'conflict', 'این اعلان قبلاً در صف ارسال قرار گرفته است');
            }
            $this->db->statement("insert into campaign_deliveries (campaign_id, device_id) select ?, d.id from devices d join users u on u.id=d.user_id where d.provider='fcm' and d.revoked_at is null and u.status='active' and u.role='user' and (? is null or d.id=?)", [$id, $campaign->audience === 'device' ? $campaign->device_id : null, $campaign->audience === 'device' ? $campaign->device_id : null]);
            $this->db->statement("update push_campaigns set status='scheduled', scheduled_at=coalesce(scheduled_at, current_timestamp(6)) where id=?", [$id]);
            $this->audit($actor, 'push_queued', 'push_campaign', $id, []);

            return ['ok' => true];
        });
    }

    public function deleteCampaign(string $actor, string $id): array
    {
        return $this->db->transaction(function () use ($actor, $id): array {
            if ($this->db->table('push_campaigns')->where('id', $id)->where('status', '<>', 'sending')->whereNull('deleted_at')->update(['deleted_at' => $this->db->raw('current_timestamp(6)')]) === 0) {
                throw new Problem(409, 'conflict', 'اعلان موجود نیست یا در حال ارسال است');
            }
            $this->audit($actor, 'push_deleted', 'push_campaign', $id, []);

            return ['ok' => true];
        });
    }

    public function dispatchDue(): int
    {
        if ($this->firebase() === null) {
            return 0;
        }
        $campaign = $this->db->selectOne("select * from push_campaigns where deleted_at is null and ((status='scheduled' and scheduled_at<=current_timestamp(6)) or status='sending') order by scheduled_at limit 1");
        if ($campaign === null) {
            return 0;
        }
        $this->db->table('push_campaigns')->where('id', $campaign->id)->update(['status' => 'sending']);
        $sent = 0;
        foreach ($this->db->select('select t.device_id, d.push_token, d.revoked_at, u.status as user_status from campaign_deliveries t join devices d on d.id=t.device_id join users u on u.id=d.user_id where t.campaign_id=? and t.status=\'pending\' limit 100', [$campaign->id]) as $delivery) {
            if ($delivery->revoked_at !== null || $delivery->user_status !== 'active') {
                $this->db->table('campaign_deliveries')->where(['campaign_id' => $campaign->id, 'device_id' => $delivery->device_id])->update(['status' => 'failed', 'error_code' => 'ineligible']);

                continue;
            }
            $this->push->send($delivery->push_token, 'campaign:'.$campaign->id);
            $this->db->table('campaign_deliveries')->where(['campaign_id' => $campaign->id, 'device_id' => $delivery->device_id])->update(['status' => 'accepted']);
            $sent++;
        }
        $pending = $this->db->table('campaign_deliveries')->where(['campaign_id' => $campaign->id, 'status' => 'pending'])->exists();
        if (! $pending) {
            $accepted = $this->db->table('campaign_deliveries')->where(['campaign_id' => $campaign->id, 'status' => 'accepted'])->exists();
            $this->db->table('push_campaigns')->where('id', $campaign->id)->update(['status' => $accepted ? 'completed' : 'failed', 'sent_at' => $this->db->raw('current_timestamp(6)')]);
        }

        return $sent;
    }

    private function firebase(): ?array
    {
        $value = $this->db->table('app_settings')->where('key', 'firebase_admin')->value('value');
        if (! is_string($value) || $value === '') {
            return null;
        }
        $decoded = json_decode($value, true);
        if (! is_array($decoded) || ! is_string($decoded['encrypted'] ?? null)) {
            return null;
        }

        return json_decode(Crypto::decrypt($decoded['encrypted'], $this->settings->fieldKey), true, 512, JSON_THROW_ON_ERROR);
    }

    private function audit(string $actor, string $action, string $type, ?string $id, array $detail): void
    {
        $this->db->table('audit_logs')->insert(['id' => Crypto::uuid(), 'actor_id' => $actor, 'action' => $action, 'target_type' => $type, 'target_id' => $id, 'detail' => json_encode((object) $detail, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR)]);
    }
}
