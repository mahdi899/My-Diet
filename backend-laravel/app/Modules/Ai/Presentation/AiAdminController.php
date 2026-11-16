<?php

namespace App\Modules\Ai\Presentation;

use App\Modules\Ai\Infrastructure\MySqlAiAdmin;
use App\Shared\Domain\Problem;
use App\Shared\Presentation\StrictInput as Input;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class AiAdminController
{
    public function __construct(private MySqlAiAdmin $ai) {}

    public function providers(): array
    {
        return $this->ai->providers();
    }

    public function createProvider(Request $request): JsonResponse
    {
        return response()->json($this->ai->createProvider($this->actor($request), $this->object($request)), 201);
    }

    public function updateProvider(Request $request, string $id): array
    {
        return $this->ai->updateProvider($this->actor($request), Input::uuid($id), $this->object($request));
    }

    public function deleteProvider(Request $request, string $id): array
    {
        return $this->ai->deleteProvider($this->actor($request), Input::uuid($id));
    }

    public function testProvider(Request $request, string $id): JsonResponse
    {
        $body = $this->object($request);

        return response()->json($this->ai->testProvider($this->actor($request), Input::uuid($id), $body['model'] ?? null), 201);
    }

    public function models(Request $request, string $id): array
    {
        return $this->ai->models(Input::uuid($id), is_string($request->query('q')) ? $request->query('q') : '', $this->limit($request, 60, 500));
    }

    public function pools(): array
    {
        return $this->ai->pools();
    }

    public function updatePool(Request $request, string $code): array
    {
        return $this->ai->updatePool($this->actor($request), $code, $this->object($request));
    }

    public function members(Request $request, string $code): array
    {
        return $this->ai->setMembers($this->actor($request), $code, json_decode($request->getContent(), true, 512, JSON_THROW_ON_ERROR));
    }

    public function testPool(Request $request, string $code): JsonResponse
    {
        return response()->json($this->ai->testPool($this->actor($request), $code), 201);
    }

    public function resetHealth(Request $request, string $id): JsonResponse
    {
        return response()->json($this->ai->resetHealth($this->actor($request), Input::uuid($id)), 201);
    }

    public function usage(): array
    {
        return $this->ai->usage();
    }

    public function ledger(Request $request): array
    {
        $requestId = $request->query('requestId');

        return $this->ai->ledger(is_string($requestId) && $requestId !== '' ? Input::uuid($requestId) : null, $this->limit($request, 100, 500));
    }

    public function budget(): array
    {
        return $this->ai->budget();
    }

    public function setBudget(Request $request): array
    {
        return $this->ai->setBudget($this->actor($request), $this->object($request));
    }

    public function generations(Request $request): array
    {
        return $this->ai->generations($this->limit($request, 50, 200));
    }

    public function prompts(Request $request): array
    {
        $key = $request->query('key');

        return $this->ai->prompts(is_string($key) && $key !== '' ? $key : null);
    }

    public function testPrompt(string $key): array
    {
        return $this->ai->testPrompt($key);
    }

    public function createPrompt(Request $request, string $key): JsonResponse
    {
        return response()->json($this->ai->createPrompt($this->actor($request), $key, $this->object($request)), 201);
    }

    public function activatePrompt(Request $request, string $key, string $version): JsonResponse
    {
        if (! ctype_digit($version)) {
            throw new Problem(400, 'validation', 'نسخه معتبر نیست');
        }

        return response()->json($this->ai->activatePrompt($this->actor($request), $key, (int) $version), 201);
    }

    private function actor(Request $request): string
    {
        return $request->attributes->get('actor')['id'];
    }

    private function object(Request $request): array
    {
        $decoded = json_decode($request->getContent(), true, 512, JSON_THROW_ON_ERROR);
        if (! is_array($decoded) || array_is_list($decoded)) {
            throw new Problem(400, 'validation', 'اطلاعات واردشده ناقص یا نادرست است');
        }

        return $decoded;
    }

    private function limit(Request $request, int $fallback, int $max): int
    {
        $raw = $request->query('limit');
        $value = $raw === null || $raw === '' ? $fallback : (is_string($raw) ? (int) $raw : -1);
        if ($raw !== null && $raw !== '' && (! is_string($raw) || (string) $value !== $raw || $value < 1)) {
            throw new Problem(400, 'validation', 'محدودیت معتبر نیست');
        }

        return min($value, $max);
    }
}
