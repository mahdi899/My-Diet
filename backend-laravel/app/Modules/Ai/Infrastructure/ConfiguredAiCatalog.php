<?php

namespace App\Modules\Ai\Infrastructure;

use App\Modules\Ai\Application\AiCatalog;
use App\Shared\Domain\LegacyCrypto;
use App\Shared\Domain\Problem;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\DB;

final class ConfiguredAiCatalog implements AiCatalog
{
    public function __construct(private ProviderClient $client) {}

    public function callsExternalNetwork(): bool
    {
        return true;
    }

    public function models(?array $provider = null): array
    {
        return $this->client->models($provider ?? throw new Problem(503, 'provider_required', 'سرویس انتخاب نشده است'));
    }

    public function complete(string $model, ?array $provider = null): array
    {
        $started = microtime(true);
        try {
            $result = $this->client->complete($provider ?? throw new Problem(503, 'provider_required', 'سرویس انتخاب نشده است'), $model,
                [['role' => 'user', 'content' => 'Reply only with OK.']], 128, 60000);

            if (trim($result['text']) === '') {
                throw new Problem(502, 'empty_completion', 'مدل پاسخ متنی برنگرداند');
            }

            DB::table('ai_usage_ledger')->insert(['id' => LegacyCrypto::uuid(), 'task' => 'provider_test', 'pool_code' => 'provider_test', 'provider_name' => $provider['name'] ?? 'provider', 'model' => $model, 'outcome' => 'ok', 'tokens_in' => $result['tokensIn'] ?? 0, 'tokens_out' => $result['tokensOut'] ?? 0, 'cost_micros' => $result['costMicros'] ?? 0, 'cost_source' => $result['costMicros'] === null ? 'unknown' : $result['costSource'], 'latency_ms' => (int) ((microtime(true) - $started) * 1000)]);

            return ['ok' => true, 'answer' => $result['text'], 'outcome' => 'ok', 'usage' => $result,
                'chain' => [['model' => $model, 'outcome' => 'ok']]];
        } catch (\Throwable $error) {
            $code = $error instanceof Problem ? $error->problemCode : ($error instanceof ConnectionException ? 'connection_failed' : 'outcome_unknown');

            return ['ok' => false, 'answer' => null, 'outcome' => $code, 'usage' => null, 'chain' => [], 'errorCode' => $code];
        }
    }
}
