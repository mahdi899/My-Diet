<?php

namespace App\Modules\Questionnaire\Presentation;

use App\Modules\Questionnaire\Application\QuestionnaireService;
use App\Shared\Domain\Problem;
use App\Shared\Presentation\StrictInput;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final class QuestionnaireController
{
    public function __construct(private QuestionnaireService $service) {}

    private function actor(Request $request): string
    {
        return $request->attributes->get('actor')['id'];
    }

    private function answers(Request $request): array
    {
        try {
            $value = json_decode($request->getContent(), false, 512, JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            throw new Problem(400, 'validation', 'پرسشنامه کامل نیست');
        }
        if (! $value instanceof \stdClass) {
            throw new Problem(400, 'validation', 'پرسشنامه کامل نیست');
        }

        return (array) $value;
    }

    public function schema(): array
    {
        return $this->service->schema();
    }

    public function draft(Request $request): array
    {
        return $this->service->draft($this->actor($request));
    }

    public function saveDraft(Request $request): array
    {
        return $this->service->saveDraft($this->actor($request), $this->answers($request));
    }

    public function submit(Request $request): JsonResponse
    {
        return response()->json($this->service->submit($this->actor($request), $this->answers($request)), 201);
    }

    public function current(Request $request): array
    {
        return $this->service->current($this->actor($request));
    }

    public function acquisition(Request $request): array
    {
        return $this->service->acquisition($this->actor($request));
    }

    public function schemas(): array
    {
        return $this->service->schemas();
    }

    private function questions(Request $request): array
    {
        $input = StrictInput::body($request, ['questions']);
        if (! isset($input['questions']) || ! is_array($input['questions'])) {
            throw new Problem(400, 'validation', 'ساختار پرسشنامه درست نیست');
        }

        return $input['questions'];
    }

    public function check(Request $request): JsonResponse
    {
        return response()->json($this->service->check($this->questions($request)), 201);
    }

    public function saveSchema(Request $request): JsonResponse
    {
        return response()->json($this->service->saveSchema($this->actor($request), $this->questions($request)), 201);
    }

    public function publishSchema(Request $request, string $version): JsonResponse
    {
        if (! is_numeric($version) || floor((float) $version) !== (float) $version || (float) $version < 1) {
            throw new Problem(400, 'validation', 'نسخهٔ پرسشنامه پیدا نشد');
        }

        return response()->json($this->service->publishSchema($this->actor($request), (int) $version), 201);
    }

    public function editor(): Response
    {
        return response(file_get_contents(__DIR__.'/../Infrastructure/resources/editor.html'), 200, ['Content-Type' => 'text/html; charset=utf-8']);
    }
}
