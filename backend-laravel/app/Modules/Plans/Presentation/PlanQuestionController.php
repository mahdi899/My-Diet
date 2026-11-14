<?php

namespace App\Modules\Plans\Presentation;

use App\Modules\Plans\Application\PlanQuestionService;
use App\Shared\Presentation\StrictInput as Input;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class PlanQuestionController
{
    public function __construct(private PlanQuestionService $service) {}

    public function ask(Request $request, string $id): JsonResponse
    {
        $actor = $request->attributes->get('actor');
        $body = Input::body($request, ['prompt', 'required']);

        return response()->json($this->service->ask($actor['id'], $actor['role'], Input::uuid($id), Input::string($body, 'prompt', 500), ($body['required'] ?? null) === null ? true : $body['required'] === true), 201);
    }

    public function answer(Request $request, string $id): JsonResponse
    {
        $body = Input::body($request, ['body']);

        return response()->json($this->service->answer($request->attributes->get('actor')['id'], Input::uuid($id), Input::string($body, 'body', 2000)), 201);
    }

    public function acknowledge(Request $request, string $id): JsonResponse
    {
        $actor = $request->attributes->get('actor');

        return response()->json($this->service->acknowledge($actor['id'], $actor['role'], Input::uuid($id)), 201);
    }

    public function withdraw(Request $request, string $id): JsonResponse
    {
        $actor = $request->attributes->get('actor');
        $body = Input::body($request, ['reason']);

        return response()->json($this->service->withdraw($actor['id'], $actor['role'], Input::uuid($id), Input::string($body,'reason',500)), 201);
    }
}
