<?php

namespace App\Modules\Ai\Infrastructure;

use App\Modules\Ai\Application\AiCatalog;
use App\Shared\Domain\Problem;

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
        try {
            $result = $this->client->complete($provider ?? throw new Problem(503, 'provider_required', 'سرویس انتخاب نشده است'), $model,
                [['role' => 'user', 'content' => 'Reply only with OK.']], 32);

            return ['ok' => true, 'answer' => $result['text'], 'outcome' => 'ok', 'usage' => $result,
                'chain' => [['model' => $model, 'outcome' => 'ok']]];
        } catch (\Throwable $error) {
            $code = $error instanceof Problem ? $error->problemCode : 'outcome_unknown';

            return ['ok' => false, 'answer' => null, 'outcome' => $code, 'usage' => null, 'chain' => [], 'errorCode' => $code];
        }
    }
}
