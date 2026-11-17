<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Modules\Ai\Infrastructure\ModelPools;
use App\Modules\Identity\Application\IdentitySettings;
use App\Shared\Domain\LegacyCrypto as Crypto;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Facades\Http;

#[Signature('sabzine:wire-ai {--test : Send one short coach prompt through the pool}')]
#[Description('Connect Closerouter first and OpenRouter as fallback for the AI pools')]
class WireAiProviders extends Command
{
    private const HAIKU_55 = 'anthropic/claude-haiku-5.5';

    private const LUNA_6 = 'openai/gpt-6-luna';

    public function handle(ConnectionInterface $db, IdentitySettings $settings, ModelPools $pools): int
    {
        $closerKey = (string) env('CLOSEROUTER_API_KEY', '');
        $openKey = (string) env('OPENROUTER_API_KEY', '');
        if (strlen($closerKey) < 8 || strlen($openKey) < 8) {
            $this->error('CLOSEROUTER_API_KEY and OPENROUTER_API_KEY must be set in the environment.');

            return 1;
        }

        $closer = $this->provider($db, $settings, 'Closerouter', 'closerouter', (string) env('CLOSEROUTER_BASE_URL', 'https://api.closerouter.dev/v1'), $closerKey);
        $open = $this->provider($db, $settings, 'OpenRouter', 'openrouter', (string) env('OPENROUTER_BASE_URL', 'https://openrouter.ai/api/v1'), $openKey);
        $closerModels = $this->models($closer['base'], $closerKey);
        $openModels = $this->models($open['base'], $openKey);
        $closerIds = array_column($closerModels, 'id');
        $openIds = array_column($openModels, 'id');

        $chat = ['gemini-3-flash', 'deepseek-v4-flash', 'qwen3.8-flash', 'gemini-2.5-flash'];
        $plan = ['gemini-2.5-pro', 'gemini-3.1-pro', 'deepseek-v4-pro', 'gemini-3-flash'];
        $vision = ['gemini-3-flash', 'gemini-2.5-flash-image', 'gemini-2.5-flash'];
        $map = [
            'nutrition_coach' => $chat,
            'coach_memory' => $chat,
            'plan_draft' => $plan,
            'plan_critic' => $plan,
            'nutrition_vision' => $vision,
        ];
        foreach ($map as $code => $preferred) {
            $poolId = $db->table('ai_pools')->where('code', $code)->value('id');
            if (! is_string($poolId)) {
                $this->warn('missing pool '.$code);

                continue;
            }
            $db->table('ai_pool_members')->where('pool_id', $poolId)->delete();
            $vision = $code === 'nutrition_vision';
            $chosen = [
                [$closer['id'], $this->pick($closerIds, $preferred, $vision) ?? 'google/gemini-3-flash', 150_000, 600_000],
                [$open['id'], $this->pick($openIds, $preferred, $vision) ?? 'google/gemini-2.5-flash', 150_000, 600_000],
            ];
            foreach ([
                [$closer['id'], $this->priced($closerModels, self::HAIKU_55, 35_100, 175_500)],
                [$open['id'], $this->priced($openModels, self::HAIKU_55, 100_000, 500_000)],
            ] as [$providerId, $haiku]) {
                if ($haiku === null || array_any($chosen, fn ($row) => $row[0] === $providerId && $row[1] === $haiku['id'])) {
                    continue;
                }
                $chosen[] = [$providerId, $haiku['id'], $haiku['priceIn'], $haiku['priceOut']];
            }
            $priority = [];
            foreach ([
                [$closer['id'], $this->priced($closerModels, self::LUNA_6, 8_640, 32_400)],
                [$open['id'], $this->priced($openModels, self::LUNA_6, 100_000, 500_000)],
            ] as [$providerId, $luna]) {
                if ($luna === null) {
                    continue;
                }
                $priority[] = [$providerId, $luna['id'], $luna['priceIn'], $luna['priceOut']];
            }
            if ($priority !== []) {
                $chosen = array_values(array_filter($chosen, fn ($row) => ! array_any($priority, fn ($first) => $first[0] === $row[0] && $first[1] === $row[1])));
                $chosen = [...$priority, ...$chosen];
            }
            foreach ($chosen as $position => [$providerId, $model]) {
                $this->member($db, $poolId, $providerId, $model, $position);
                $this->line($code.' #'.$position.' '.$model);
            }
        }

        if ($this->option('test')) {
            $result = $pools->run('nutrition_coach', [
                ['role' => 'system', 'content' => 'فقط یک کلمه فارسی جواب بده.'],
                ['role' => 'user', 'content' => 'سلام'],
            ]);
            $this->info('provider='.$result['provider'].' model='.($result['model'] ?? ''));
            $this->line(mb_substr((string) $result['text'], 0, 180));
        }

        return 0;
    }

    /** @return array{id: string, base: string} */
    private function provider(ConnectionInterface $db, IdentitySettings $settings, string $name, string $kind, string $base, string $key): array
    {
        $base = rtrim($base, '/');
        $encrypted = Crypto::encrypt($key, $settings->fieldKey);
        $existing = $db->table('ai_providers')->where('name', $name)->first();
        if ($existing === null) {
            $id = Crypto::uuid();
            $db->table('ai_providers')->insert([
                'id' => $id,
                'name' => $name,
                'kind' => $kind,
                'base_url' => $base,
                'api_key_encrypted' => $encrypted,
                'app_title' => 'رژیم من',
                'active' => 1,
            ]);
        } else {
            $id = $existing->id;
            $db->table('ai_providers')->where('id', $id)->update([
                'kind' => $kind,
                'base_url' => $base,
                'api_key_encrypted' => $encrypted,
                'active' => 1,
                'updated_at' => $db->raw('current_timestamp(6)'),
            ]);
        }

        return ['id' => $id, 'base' => $base];
    }

    private function member(ConnectionInterface $db, string $poolId, string $providerId, string $model, int $position): void
    {
        $db->table('ai_pool_members')->insert([
            'id' => Crypto::uuid(),
            'pool_id' => $poolId,
            'provider_id' => $providerId,
            'model' => $model,
            'position' => $position,
            'weight' => 1,
            'enabled' => 1,
        ]);
    }

    /** @return list<array{id: string, priceIn: int, priceOut: int}> */
    private function models(string $base, string $key): array
    {
        try {
            $response = Http::withToken($key)->acceptJson()->timeout(25)->get($base.'/models');
            $data = $response->json('data');
            if (! is_array($data)) {
                $this->warn('model list unavailable for '.$base.' status '.$response->status());

                return [];
            }
            $models = [];
            foreach ($data as $row) {
                if (! is_array($row) || ! is_string($row['id'] ?? null)) {
                    continue;
                }
                $pricing = is_array($row['pricing'] ?? null) ? $row['pricing'] : [];
                $models[] = ['id' => $row['id'], 'priceIn' => $this->micros($pricing, 'prompt'), 'priceOut' => $this->micros($pricing, 'completion')];
            }

            return $models;
        } catch (\Throwable $error) {
            $this->warn('model list failed for '.$base);

            return [];
        }
    }

    /** @param array<string, mixed> $pricing */
    private function micros(array $pricing, string $field): int
    {
        $factor = ($pricing['unit'] ?? '') === 'usd_per_million_tokens' ? 1_000_000 : 1_000_000_000_000;
        $value = $pricing[$field] ?? 0;

        return is_numeric($value) ? (int) ceil((float) $value * $factor) : 0;
    }

    /**
     * @param  list<array{id: string, priceIn: int, priceOut: int}>  $catalog
     * @return array{id: string, priceIn: int, priceOut: int}|null
     */
    private function priced(array $catalog, string $id, int $fallbackIn, int $fallbackOut): ?array
    {
        foreach ($catalog as $model) {
            if ($model['id'] === $id) {
                return $model;
            }
        }

        return $catalog === [] ? ['id' => $id, 'priceIn' => $fallbackIn, 'priceOut' => $fallbackOut] : null;
    }

    /** @param list<string> $available @param list<string> $preferred */
    private function pick(array $available, array $preferred, bool $allowImage = false): ?string
    {
        foreach ($preferred as $want) {
            $hits = [];
            foreach ($available as $id) {
                $lower = mb_strtolower($id);
                if (! str_contains($lower, mb_strtolower($want))) {
                    continue;
                }
                if (! $allowImage && (str_contains($lower, 'image') || str_contains($lower, 'embed') || str_contains($lower, 'audio'))) {
                    continue;
                }
                $hits[] = $id;
            }
            if ($hits !== []) {
                usort($hits, fn (string $a, string $b) => strlen($a) <=> strlen($b));

                return $hits[0];
            }
        }

        return null;
    }
}
