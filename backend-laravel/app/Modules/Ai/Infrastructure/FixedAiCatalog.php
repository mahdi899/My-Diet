<?php

namespace App\Modules\Ai\Infrastructure;

use App\Modules\Ai\Application\AiCatalog;

/** Deterministic catalogue. It never opens a network connection. */
final class FixedAiCatalog implements AiCatalog
{
    public int $calls = 0;

    public const SUGGESTED = ['deepseek/deepseek-v4.1-flash-1017', 'anthropic/claude-3.5-haiku', 'qwen/qwen-2.5-72b-instruct'];

    public function callsExternalNetwork(): bool
    {
        return false;
    }

    public function models(): array
    {
        return array_map(fn (string $id) => ['id' => $id, 'name' => $id, 'contextLength' => null, 'priceInMicrosPerM' => 0, 'priceOutMicrosPerM' => 0, 'free' => true], self::SUGGESTED);
    }

    public function complete(string $model): array
    {
        $this->calls++;

        return ['ok' => true, 'answer' => 'ok', 'outcome' => 'ok', 'usage' => ['model' => $model, 'tokensIn' => 1, 'tokensOut' => 1, 'costMicros' => 0], 'chain' => [['model' => $model, 'outcome' => 'ok']]];
    }
}
