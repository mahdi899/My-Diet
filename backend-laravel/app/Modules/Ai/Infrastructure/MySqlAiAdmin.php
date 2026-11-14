<?php

namespace App\Modules\Ai\Infrastructure;

use App\Modules\Ai\Application\AiCatalog;
use App\Modules\Identity\Application\IdentitySettings;
use App\Modules\Plans\Domain\CivilDates;
use App\Shared\Domain\LegacyCrypto as Crypto;
use App\Shared\Domain\Problem;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Database\QueryException;

final class MySqlAiAdmin
{
    private const KINDS = ['openrouter', 'openai_compatible'];

    private const STRATEGIES = ['priority', 'cost_first', 'weighted'];

    private const PROMPTS = [
        'plan_draft' => ['{{profile}}', '{{catalog}}', '{{days}}', '{{schema}}'],
        'plan_critic' => ['{{profile}}', '{{plan}}', '{{schema}}'],
        'coach_system' => [],
        'coach_vision' => [],
        'coach_memory' => [],
    ];

    public function __construct(private ConnectionInterface $db, private IdentitySettings $settings, private AiCatalog $catalog) {}

    public function providers(): array
    {
        return ['items' => array_map($this->providerView(...), $this->db->table('ai_providers')->orderBy('created_at')->get()->all())];
    }

    public function createProvider(string $actor, array $body): array
    {
        if (! in_array($body['kind'] ?? null, self::KINDS, true)) {
            throw new Problem(400, 'validation', 'نوع سرویس معتبر نیست');
        }
        $name = $this->text($body['name'] ?? null, 'نام', 60);
        $base = $this->endpoint($body['kind'] === 'openrouter' ? ($body['baseUrl'] ?? 'https://openrouter.ai/api/v1') : ($body['baseUrl'] ?? null));
        $id = Crypto::uuid();
        try {
            $this->db->transaction(function () use ($actor, $body, $id, $name, $base): void {
                $this->db->table('ai_providers')->insert([
                    'id' => $id, 'name' => $name, 'kind' => $body['kind'], 'base_url' => $base,
                    'api_key_encrypted' => $this->key($body['apiKey'] ?? null),
                    'http_referer' => $this->optional($body, 'httpReferer', 200),
                    'app_title' => $this->optional($body, 'appTitle', 80),
                ]);
                $this->audit($actor, 'ai_provider_created', 'ai_provider', $id, ['name' => $name, 'kind' => $body['kind']]);
            });
        } catch (QueryException $error) {
            if ((int) ($error->errorInfo[1] ?? 0) === 1062) {
                throw new Problem(409, 'conflict', 'سرویسی با این نام وجود دارد');
            }
            throw $error;
        }

        return $this->provider($id);
    }

    public function updateProvider(string $actor, string $id, array $body): array
    {
        $row = $this->db->table('ai_providers')->where('id', $id)->first();
        if ($row === null) {
            throw new Problem(404, 'not_found', 'سرویس پیدا نشد');
        }
        if (array_key_exists('active', $body) && ! is_bool($body['active'])) {
            throw new Problem(400, 'validation', 'وضعیت معتبر نیست');
        }
        $key = $row->api_key_encrypted;
        if (array_key_exists('apiKey', $body)) {
            $key = $body['apiKey'] === null ? null : $this->seal((string) $body['apiKey']);
        }
        try {
            $this->db->transaction(function () use ($actor, $id, $body, $row, $key): void {
                $this->db->table('ai_providers')->where('id', $id)->update([
                    'name' => array_key_exists('name', $body) ? $this->text($body['name'], 'نام', 60) : $row->name,
                    'base_url' => array_key_exists('baseUrl', $body) ? $this->endpoint($body['baseUrl']) : $row->base_url,
                    'api_key_encrypted' => $key,
                    'http_referer' => array_key_exists('httpReferer', $body) ? $this->optional($body, 'httpReferer', 200) : $row->http_referer,
                    'app_title' => array_key_exists('appTitle', $body) ? $this->optional($body, 'appTitle', 80) : $row->app_title,
                    'active' => $body['active'] ?? (bool) (int) $row->active,
                    'updated_at' => $this->db->raw('current_timestamp(6)'),
                ]);
                $this->audit($actor, 'ai_provider_updated', 'ai_provider', $id, ['keyChanged' => array_key_exists('apiKey', $body)]);
            });
        } catch (QueryException $error) {
            if ((int) ($error->errorInfo[1] ?? 0) === 1062) {
                throw new Problem(409, 'conflict', 'سرویسی با این نام وجود دارد');
            }
            throw $error;
        }

        return $this->provider($id);
    }

    public function deleteProvider(string $actor, string $id): array
    {
        return $this->db->transaction(function () use ($actor, $id): array {
            if ($this->db->table('ai_pool_members')->where('provider_id', $id)->exists()) {
                throw new Problem(409, 'conflict', 'این سرویس هنوز در یک استخر استفاده می‌شود');
            }
            if ($this->db->table('ai_providers')->where('id', $id)->delete() === 0) {
                throw new Problem(404, 'not_found', 'سرویس پیدا نشد');
            }
            $this->audit($actor, 'ai_provider_deleted', 'ai_provider', $id, []);

            return ['ok' => true];
        });
    }

    public function testProvider(string $actor, string $id, mixed $model): array
    {
        $row = $this->db->table('ai_providers')->where('id', $id)->first();
        if ($row === null) {
            throw new Problem(404, 'not_found', 'سرویس پیدا نشد');
        }
        $chosen = is_string($model) && $model !== '' ? $model : 'test-adapter';
        $result = $this->catalog->complete($chosen);
        $this->audit($actor, 'ai_provider_tested', 'ai_provider', $id, ['model' => $chosen, 'ok' => $result['ok'], 'outcome' => $result['outcome'], 'external' => $this->catalog->callsExternalNetwork()]);

        return $result;
    }

    public function models(string $id, string $query, int $limit): array
    {
        if ($this->db->table('ai_providers')->where('id', $id)->doesntExist()) {
            throw new Problem(404, 'not_found', 'سرویس پیدا نشد');
        }
        $needle = mb_strtolower(mb_substr($query, 0, 80));
        $models = array_values(array_filter($this->catalog->models(), fn ($model) => $needle === '' || str_contains(mb_strtolower($model['id'].' '.$model['name']), $needle)));

        return ['fetchedAt' => CivilDates::now()->format('Y-m-d\TH:i:s.v\Z'), 'total' => count($models), 'suggested' => FixedAiCatalog::SUGGESTED, 'items' => array_slice($models, 0, $limit)];
    }

    public function pools(): array
    {
        $pools = $this->db->table('ai_pools')->orderBy('code')->get();
        $members = $this->db->select('select m.id, m.pool_id as poolId, m.provider_id as providerId, p.name as providerName, m.model, m.position, m.weight, m.enabled, m.price_in_micros_per_m as priceInMicrosPerM, m.price_out_micros_per_m as priceOutMicrosPerM, h.consecutive_failures as consecutiveFailures, h.cooldown_until as cooldownUntil, h.last_error_code as lastErrorCode, h.last_ok_at as lastOkAt, h.last_fail_at as lastFailAt, coalesce(h.total_ok,0) as totalOk, coalesce(h.total_fail,0) as totalFail from ai_pool_members m join ai_providers p on p.id=m.provider_id left join ai_pool_health h on h.member_id=m.id order by m.position');

        return ['items' => array_map(function ($pool) use ($members): array {
            return ['id' => $pool->id, 'code' => $pool->code, 'title' => $pool->title, 'strategy' => $pool->strategy, 'temperature' => (float) $pool->temperature, 'maxTokens' => (int) $pool->max_tokens, 'timeoutMs' => (int) $pool->timeout_ms, 'maxAttempts' => (int) $pool->max_attempts, 'enabled' => (bool) (int) $pool->enabled, 'members' => array_values(array_map(fn ($member) => ['id' => $member->id, 'providerId' => $member->providerId, 'providerName' => $member->providerName, 'model' => $member->model, 'position' => (int) $member->position, 'weight' => (int) $member->weight, 'enabled' => (bool) (int) $member->enabled, 'priceInMicrosPerM' => (int) $member->priceInMicrosPerM, 'priceOutMicrosPerM' => (int) $member->priceOutMicrosPerM, 'consecutiveFailures' => (int) ($member->consecutiveFailures ?? 0), 'cooldownUntil' => $member->cooldownUntil, 'lastErrorCode' => $member->lastErrorCode, 'lastOkAt' => $member->lastOkAt, 'lastFailAt' => $member->lastFailAt, 'totalOk' => (int) $member->totalOk, 'totalFail' => (int) $member->totalFail], array_filter($members, fn ($member) => $member->poolId === $pool->id)))];
        }, $pools->all())];
    }

    public function updatePool(string $actor, string $code, array $body): array
    {
        if (! preg_match('/^[a-z][a-z0-9_]{1,40}$/D', $code)) {
            throw new Problem(400, 'validation', 'کد استخر معتبر نیست');
        }
        $current = $this->db->table('ai_pools')->where('code', $code)->first();
        if ($current === null) {
            throw new Problem(404, 'not_found', 'استخر پیدا نشد');
        }
        $strategy = $body['strategy'] ?? $current->strategy;
        if (! in_array($strategy, self::STRATEGIES, true)) {
            throw new Problem(400, 'validation', 'راهبرد معتبر نیست');
        }
        $temperature = array_key_exists('temperature', $body) ? $body['temperature'] : (float) $current->temperature;
        if (! is_numeric($temperature) || $temperature < 0 || $temperature > 2) {
            throw new Problem(400, 'validation', 'دمای مدل معتبر نیست');
        }
        if (array_key_exists('enabled', $body) && ! is_bool($body['enabled'])) {
            throw new Problem(400, 'validation', 'وضعیت معتبر نیست');
        }
        $this->db->transaction(function () use ($actor, $code, $body, $current, $strategy, $temperature): void {
            $this->db->table('ai_pools')->where('code', $code)->update([
                'title' => array_key_exists('title', $body) ? $this->text($body['title'], 'عنوان', 100) : $current->title,
                'strategy' => $strategy, 'temperature' => $temperature,
                'max_tokens' => $this->bounded($body['maxTokens'] ?? null, 'سقف توکن', 200, 32000, (int) $current->max_tokens),
                'timeout_ms' => $this->bounded($body['timeoutMs'] ?? null, 'مهلت', 5000, 300000, (int) $current->timeout_ms),
                'max_attempts' => $this->bounded($body['maxAttempts'] ?? null, 'حداکثر تلاش', 1, 10, (int) $current->max_attempts),
                'enabled' => $body['enabled'] ?? (bool) (int) $current->enabled,
                'updated_at' => $this->db->raw('current_timestamp(6)'),
            ]);
            $this->audit($actor, 'ai_pool_updated', 'ai_pool', $current->id, ['code' => $code]);
        });

        return $this->pools();
    }

    public function setMembers(string $actor, string $code, mixed $body): array
    {
        $list = is_array($body) && array_is_list($body) ? $body : (is_array($body) ? ($body['members'] ?? null) : null);
        if (! is_array($list) || count($list) > 12) {
            throw new Problem(400, 'validation', 'فهرست مدل‌ها معتبر نیست');
        }
        $pool = $this->db->table('ai_pools')->where('code', $code)->first();
        if ($pool === null) {
            throw new Problem(404, 'not_found', 'استخر پیدا نشد');
        }
        $seen = [];
        $members = [];
        foreach (array_values($list) as $index => $entry) {
            if (! is_array($entry)) {
                throw new Problem(400, 'validation', 'فهرست مدل‌ها معتبر نیست');
            }
            $provider = is_string($entry['providerId'] ?? null) ? $entry['providerId'] : '';
            if (! preg_match('/^[0-9a-f-]{36}$/i', $provider)) {
                throw new Problem(400, 'validation', 'شناسه معتبر نیست');
            }
            $model = $this->text($entry['model'] ?? null, 'مدل', 200);
            $key = $provider.'|'.$model;
            if (isset($seen[$key])) {
                throw new Problem(400, 'validation', 'مدل تکراری است');
            }
            $seen[$key] = true;
            $weight = $entry['weight'] ?? 1;
            if (! is_int($weight) || $weight < 1 || $weight > 100) {
                throw new Problem(400, 'validation', 'وزن معتبر نیست');
            }
            $members[] = ['providerId' => $provider, 'model' => $model, 'position' => $index, 'weight' => $weight, 'enabled' => ($entry['enabled'] ?? true) !== false, 'priceIn' => $this->micros($entry['priceInMicrosPerM'] ?? 0), 'priceOut' => $this->micros($entry['priceOutMicrosPerM'] ?? 0)];
        }
        $this->db->transaction(function () use ($actor, $code, $pool, $members): void {
            $ids = array_values(array_unique(array_column($members, 'providerId')));
            if ($ids !== [] && $this->db->table('ai_providers')->whereIn('id', $ids)->count() !== count($ids)) {
                throw new Problem(400, 'validation', 'سرویس انتخاب‌شده وجود ندارد');
            }
            $keep = array_map(fn ($member) => $member['providerId'].'|'.$member['model'], $members);
            $existing = $this->db->table('ai_pool_members')->where('pool_id', $pool->id)->get();
            foreach ($existing as $row) {
                if (! in_array($row->provider_id.'|'.$row->model, $keep, true)) {
                    $this->db->table('ai_pool_health')->where('member_id', $row->id)->delete();
                    $this->db->table('ai_pool_members')->where('id', $row->id)->delete();
                }
            }
            foreach ($members as $member) {
                $this->db->statement('insert into ai_pool_members (id, pool_id, provider_id, model, position, weight, enabled, price_in_micros_per_m, price_out_micros_per_m) values (?,?,?,?,?,?,?,?,?) as incoming on duplicate key update position=incoming.position, weight=incoming.weight, enabled=incoming.enabled, price_in_micros_per_m=incoming.price_in_micros_per_m, price_out_micros_per_m=incoming.price_out_micros_per_m', [Crypto::uuid(), $pool->id, $member['providerId'], $member['model'], $member['position'], $member['weight'], $member['enabled'], $member['priceIn'], $member['priceOut']]);
            }
            $this->audit($actor, 'ai_pool_members_set', 'ai_pool', $pool->id, ['code' => $code, 'count' => count($members)]);
        });

        return $this->pools();
    }

    public function resetHealth(string $actor, string $id): array
    {
        return $this->db->transaction(function () use ($actor, $id): array {
            if ($this->db->table('ai_pool_members')->where('id', $id)->doesntExist()) {
                throw new Problem(404, 'not_found', 'مدل پیدا نشد');
            }
            $this->db->table('ai_pool_health')->where('member_id', $id)->update(['consecutive_failures' => 0, 'cooldown_until' => null, 'last_error_code' => null]);
            $this->audit($actor, 'ai_member_health_reset', 'ai_pool_member', $id, []);

            return ['ok' => true];
        });
    }

    public function testPool(string $actor, string $code): array
    {
        $pool = $this->db->table('ai_pools')->where('code', $code)->first();
        if ($pool === null) {
            throw new Problem(404, 'not_found', 'استخر پیدا نشد');
        }
        if ((int) $pool->enabled !== 1) {
            $result = ['ok' => false, 'answer' => null, 'usage' => null, 'chain' => [], 'errorCode' => 'pool_disabled'];
        } else {
            $member = $this->db->table('ai_pool_members')->where('pool_id', $pool->id)->where('enabled', 1)->orderBy('position')->value('model');
            $result = $member === null
                ? ['ok' => false, 'answer' => null, 'usage' => null, 'chain' => [], 'errorCode' => 'pool_empty']
                : $this->catalog->complete($member);
        }
        $this->audit($actor, 'ai_pool_tested', 'ai_pool', $pool->id, ['code' => $code, 'ok' => $result['ok'], 'external' => $this->catalog->callsExternalNetwork()]);

        return $result;
    }

    public function usage(): array
    {
        $day = (new \DateTimeImmutable(CivilDates::today().' 00:00:00', new \DateTimeZone('Asia/Tehran')))->setTimezone(new \DateTimeZone('UTC'))->format('Y-m-d H:i:s.u');
        $spent = (int) $this->db->table('ai_usage_ledger')->where('created_at', '>=', $day)->sum('cost_micros');
        $controls = $this->budget();

        return ['day' => CivilDates::today(), 'spentMicros' => $spent, 'dailyCapMicros' => $controls['dailyCapMicros'], 'monthlyCapMicros' => $controls['monthlyCapMicros'], 'killSwitch' => $controls['killSwitch']];
    }

    public function budget(): array
    {
        $row = $this->db->table('ai_controls')->where('id', 1)->first();
        if ($row === null) {
            throw new Problem(500, 'ai_controls_missing', 'تنظیم مدل پیدا نشد');
        }

        return ['killSwitch' => (bool) (int) $row->kill_switch, 'dailyCapMicros' => $this->nullableInt($row->daily_cost_cap_micros), 'monthlyCapMicros' => $this->nullableInt($row->monthly_cost_cap_micros), 'perRequestCapMicros' => $this->nullableInt($row->per_request_cap_micros), 'perUserDailyDrafts' => (int) $row->per_user_daily_drafts];
    }

    public function setBudget(string $actor, array $body): array
    {
        $allowed = ['killSwitch', 'dailyCapMicros', 'monthlyCapMicros', 'perRequestCapMicros', 'perUserDailyDrafts'];
        if (array_diff(array_keys($body), $allowed) !== []) {
            throw new Problem(400, 'validation', 'فیلد ناشناخته');
        }
        $next = $this->budget();
        if (array_key_exists('killSwitch', $body)) {
            if (! is_bool($body['killSwitch'])) {
                throw new Problem(400, 'validation', 'کلید توقف معتبر نیست');
            }
            $next['killSwitch'] = $body['killSwitch'];
        }
        foreach (['dailyCapMicros' => 'سقف روزانه', 'monthlyCapMicros' => 'سقف ماهانه', 'perRequestCapMicros' => 'سقف هر درخواست'] as $key => $label) {
            if (! array_key_exists($key, $body)) {
                continue;
            }
            if ($body[$key] !== null && (! is_int($body[$key]) || $body[$key] < 0)) {
                throw new Problem(400, 'validation', "مقدار «{$label}» معتبر نیست");
            }
            $next[$key] = $body[$key];
        }
        if (array_key_exists('perUserDailyDrafts', $body) && (! is_int($body['perUserDailyDrafts']) || $body['perUserDailyDrafts'] < 0 || $body['perUserDailyDrafts'] > 100)) {
            throw new Problem(400, 'validation', 'سهم روزانه معتبر نیست');
        }
        $next['perUserDailyDrafts'] = $body['perUserDailyDrafts'] ?? $next['perUserDailyDrafts'];
        $this->db->transaction(function () use ($actor, $next): void {
            $this->db->table('ai_controls')->where('id', 1)->update(['kill_switch' => $next['killSwitch'], 'daily_cost_cap_micros' => $next['dailyCapMicros'], 'monthly_cost_cap_micros' => $next['monthlyCapMicros'], 'per_request_cap_micros' => $next['perRequestCapMicros'], 'per_user_daily_drafts' => $next['perUserDailyDrafts'], 'updated_at' => $this->db->raw('current_timestamp(6)')]);
            $this->audit($actor, 'ai_budget_updated', 'ai_controls', null, $next);
        });

        return $next;
    }

    public function ledger(?string $request, int $limit): array
    {
        $query = $this->db->table('ai_usage_ledger')->orderByDesc('created_at')->limit($limit);
        if ($request !== null) {
            $query->where('request_id', $request);
        }

        return ['items' => array_map(fn ($row) => ['id' => $row->id, 'requestId' => $row->request_id, 'task' => $row->task, 'poolCode' => $row->pool_code, 'provider' => $row->provider_name, 'model' => $row->model, 'attemptNo' => (int) $row->attempt_no, 'chunk' => $row->chunk, 'outcome' => $row->outcome, 'tokensIn' => (int) $row->tokens_in, 'tokensOut' => (int) $row->tokens_out, 'costMicros' => (int) $row->cost_micros, 'costSource' => $row->cost_source, 'latencyMs' => (int) $row->latency_ms, 'errorCode' => $row->error_code, 'createdAt' => Crypto::iso($row->created_at)], $query->get()->all())];
    }

    public function generations(int $limit): array
    {
        $items = array_map(function ($row): array {
            $warnings = json_decode($row->warnings ?: '[]', true) ?: [];
            $notes = json_decode($row->ai_notes ?: 'null', true);
            $chain = json_decode($row->attempt_chain ?: '[]', true) ?: [];

            return ['id' => $row->id, 'requestId' => $row->request_id, 'provider' => $row->provider, 'model' => $row->model, 'status' => $row->status, 'reason' => $row->skipped_reason, 'costMicros' => (int) $row->cost_micros, 'tokens' => (int) $row->tokens, 'latencyMs' => (int) $row->latency_ms, 'poolCode' => $row->pool_code, 'promptVersion' => $row->prompt_version, 'createdAt' => Crypto::iso($row->created_at), 'warningCount' => count($warnings), 'validatorWarnings' => is_array($notes['warnings'] ?? null) ? count($notes['warnings']) : 0, 'critic' => $notes['critic']['verdict'] ?? null, 'attempts' => count($chain), 'failedAttempts' => count(array_filter($chain, fn ($item) => ($item['outcome'] ?? 'ok') !== 'ok'))];
        }, $this->db->table('ai_generations')->orderByDesc('created_at')->limit($limit)->get()->all());
        $totals = $this->db->selectOne("select count(*) as total, sum(status='drafted') as drafted, sum(status='failed') as failed, sum(status='skipped') as skipped, coalesce(avg(case when status='drafted' then cost_micros end),0) as avgCostMicros, coalesce(avg(case when status='drafted' then latency_ms end),0) as avgLatencyMs from ai_generations where created_at>=date_sub(current_timestamp(6), interval 30 day)");

        return ['totals' => ['total' => (int) $totals->total, 'drafted' => (int) $totals->drafted, 'failed' => (int) $totals->failed, 'skipped' => (int) $totals->skipped, 'avgCostMicros' => (float) $totals->avgCostMicros, 'avgLatencyMs' => (float) $totals->avgLatencyMs], 'items' => $items];
    }

    public function prompts(?string $key): array
    {
        if ($key !== null && ! array_key_exists($key, self::PROMPTS)) {
            throw new Problem(400, 'validation', 'کلید پرامپت معتبر نیست');
        }
        $query = $this->db->table('ai_prompt_templates')->orderBy('key')->orderByDesc('version');
        if ($key !== null) {
            $query->where('key', $key);
        }

        return ['items' => array_map(fn ($row) => $this->prompt($row), $query->get()->all())];
    }

    public function createPrompt(string $actor, string $key, array $body): array
    {
        if (! array_key_exists($key, self::PROMPTS)) {
            throw new Problem(400, 'validation', 'کلید پرامپت معتبر نیست');
        }
        $system = is_string($body['systemPrompt'] ?? null) ? trim($body['systemPrompt']) : '';
        $user = is_string($body['userTemplate'] ?? null) ? trim($body['userTemplate']) : '';
        $notes = is_string($body['notes'] ?? null) ? mb_substr(trim($body['notes']), 0, 500) : '';
        if (mb_strlen($system) < 200 || mb_strlen($system) > 20000 || mb_strlen($user) > 20000) {
            throw new Problem(400, 'validation', 'طول پرامپت سیستم معتبر نیست');
        }
        $missing = array_values(array_filter(self::PROMPTS[$key], fn ($placeholder) => ! str_contains($user, $placeholder)));
        if ($missing !== []) {
            throw new Problem(400, 'validation', 'قالب باید شامل '.implode('، ', $missing).' باشد');
        }

        return $this->db->transaction(function () use ($actor, $key, $system, $user, $notes): array {
            $version = (int) $this->db->table('ai_prompt_templates')->where('key', $key)->max('version') + 1;
            $id = Crypto::uuid();
            $this->db->table('ai_prompt_templates')->insert(['id' => $id, 'key' => $key, 'version' => $version, 'status' => 'draft', 'system_prompt' => $system, 'user_template' => $user, 'notes' => $notes, 'created_by' => $actor]);
            $this->audit($actor, 'ai_prompt_created', 'ai_prompt', $id, ['key' => $key, 'version' => $version]);

            return $this->prompt($this->db->table('ai_prompt_templates')->where('id', $id)->first());
        });
    }

    public function activatePrompt(string $actor, string $key, int $version): array
    {
        if (! array_key_exists($key, self::PROMPTS) || $version < 1) {
            throw new Problem(400, 'validation', 'نسخه معتبر نیست');
        }

        return $this->db->transaction(function () use ($actor, $key, $version): array {
            $row = $this->db->table('ai_prompt_templates')->where(['key' => $key, 'version' => $version])->first();
            if ($row === null) {
                throw new Problem(404, 'not_found', 'نسخه پیدا نشد');
            }
            $this->db->table('ai_prompt_templates')->where('key', $key)->where('status', 'active')->update(['status' => 'retired']);
            $this->db->table('ai_prompt_templates')->where('id', $row->id)->update(['status' => 'active']);
            $this->audit($actor, 'ai_prompt_activated', 'ai_prompt', $row->id, ['key' => $key, 'version' => $version]);

            return ['ok' => true];
        });
    }

    private function provider(string $id): array
    {
        $row = $this->db->table('ai_providers')->where('id', $id)->first();
        if ($row === null) {
            throw new Problem(404, 'not_found', 'سرویس پیدا نشد');
        }

        return $this->providerView($row);
    }

    private function providerView(object $row): array
    {
        return ['id' => $row->id, 'name' => $row->name, 'kind' => $row->kind, 'baseUrl' => $row->base_url, 'httpReferer' => $row->http_referer, 'appTitle' => $row->app_title, 'active' => (bool) (int) $row->active, 'hasKey' => $row->api_key_encrypted !== null, 'keyHint' => $this->hint($row->api_key_encrypted), 'createdAt' => Crypto::iso($row->created_at), 'updatedAt' => Crypto::iso($row->updated_at)];
    }

    private function prompt(object $row): array
    {
        return ['key' => $row->key, 'version' => (int) $row->version, 'status' => $row->status, 'systemPrompt' => $row->system_prompt, 'userTemplate' => $row->user_template, 'notes' => $row->notes, 'createdAt' => Crypto::iso($row->created_at)];
    }

    private function endpoint(mixed $value): string
    {
        if (! is_string($value)) {
            throw new Problem(400, 'validation', 'نشانی سرویس معتبر نیست');
        }
        $url = parse_url($value);
        $secure = is_array($url) && (($url['scheme'] ?? '') === 'https' || (config('ai.allow_private') && ($url['scheme'] ?? '') === 'http'));
        $host = $url['host'] ?? '';
        $private = $host === 'localhost' || str_ends_with($host, '.local') || filter_var($host, FILTER_VALIDATE_IP);
        if (! $secure || isset($url['user']) || isset($url['pass']) || ($private && ! config('ai.allow_private'))) {
            throw new Problem(400, 'validation', 'نشانی سرویس باید https باشد');
        }

        return rtrim($value, '/');
    }

    private function key(mixed $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        return $this->seal((string) $value);
    }

    private function seal(string $key): string
    {
        if (strlen(trim($key)) < 8 || strlen($key) > 400 || preg_match('/\s/', trim($key)) === 1) {
            throw new Problem(400, 'validation', 'کلید API معتبر نیست');
        }

        return Crypto::encrypt(trim($key), $this->settings->fieldKey);
    }

    private function hint(?string $secret): ?string
    {
        if ($secret === null) {
            return null;
        }
        try {
            $plain = Crypto::decrypt($secret, $this->settings->fieldKey);

            return strlen($plain) >= 8 ? '…'.substr($plain, -4) : '…';
        } catch (\Throwable) {
            return null;
        }
    }

    private function text(mixed $value, string $label, int $max): string
    {
        if (! is_string($value) || trim($value) === '' || mb_strlen($value) > $max) {
            throw new Problem(400, 'validation', "«{$label}» معتبر نیست");
        }

        return trim($value);
    }

    private function optional(array $body, string $key, int $max): ?string
    {
        if (! array_key_exists($key, $body) || $body[$key] === null || $body[$key] === '') {
            return null;
        }

        return $this->text($body[$key], $key, $max);
    }

    private function bounded(mixed $value, string $label, int $min, int $max, int $fallback): int
    {
        if ($value === null) {
            return $fallback;
        }
        if (! is_int($value) || $value < $min || $value > $max) {
            throw new Problem(400, 'validation', "«{$label}» معتبر نیست");
        }

        return $value;
    }

    private function micros(mixed $value): int
    {
        if (! is_int($value) || $value < 0 || $value > 1_000_000_000_000) {
            throw new Problem(400, 'validation', 'قیمت معتبر نیست');
        }

        return $value;
    }

    private function nullableInt(mixed $value): ?int
    {
        return $value === null ? null : (int) $value;
    }

    private function audit(string $actor, string $action, string $type, ?string $id, array $detail): void
    {
        $this->db->table('audit_logs')->insert(['id' => Crypto::uuid(), 'actor_id' => $actor, 'action' => $action, 'target_type' => $type, 'target_id' => $id, 'detail' => json_encode((object) $detail, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR)]);
    }
}
