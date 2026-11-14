<?php

namespace App\Modules\Plans\Presentation;

use App\Modules\Plans\Application\PlanEditor;
use App\Modules\Plans\Application\PlanGeneration;
use App\Shared\Domain\Problem;
use App\Shared\Presentation\StrictInput as Input;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class PlanEditorController
{
    public function __construct(private PlanEditor $service, private PlanGeneration $generation) {}

    private function lock(Request $request): int
    {
        $value = $request->header('If-Match', '');
        if (! preg_match('/^[0-9]+$/D', $value)) {
            throw new Problem(400, 'validation', 'نسخهٔ ویرایش لازم است');
        }

        return (int) min(PHP_INT_MAX, (float) $value);
    }

    public function replace(Request $request, string $id): array
    {
        $actor = $request->attributes->get('actor');
        try {
            $body = json_decode($request->getContent(), false, 512, JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            throw new Problem(400, 'validation', 'برنامه باید هفت روز داشته باشد');
        }

        return $this->service->replace($actor['id'], $actor['role'], Input::uuid($id), $this->lock($request), $body);
    }

    public function regenerate(Request $request, string $id): array
    {
        return $this->generation->regenerate($request->attributes->get('actor')['id'], Input::uuid($id), $this->lock($request));
    }

    public function publish(Request $request, string $id): JsonResponse
    {
        $actor = $request->attributes->get('actor');

        return response()->json($this->service->publish($actor['id'], $actor['role'], Input::uuid($id), $this->lock($request)), 201);
    }

    public function correct(Request $request, string $id): JsonResponse
    {
        return response()->json($this->service->correct($request->attributes->get('actor')['id'], Input::uuid($id)), 201);
    }

    public function staff(Request $request, string $id): array
    {
        $actor = $request->attributes->get('actor');

        return $this->service->staff($actor['id'], $actor['role'], Input::uuid($id), $request->query('reason'));
    }

    public function patientVersions(Request $request, string $userId): array
    {
        return $this->service->patientVersions($request->attributes->get('actor')['id'], Input::uuid($userId));
    }

    public function adminVersion(Request $request, string $id): array
    {
        return $this->service->adminVersion($request->attributes->get('actor')['id'], Input::uuid($id), $request->query('reason'));
    }
}
