<?php

namespace App\Modules\Onboarding\Presentation;

use App\Modules\Onboarding\Application\WebIntakeService;
use App\Modules\Onboarding\Domain\WebIntakeRules;
use App\Shared\Domain\Problem;
use App\Shared\Presentation\StrictInput as Input;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class OnboardingWebController
{
    public function __construct(private WebIntakeService $service) {}

    private function body(Request $request): array
    {
        try {
            $body = json_decode($request->getContent(), false, 512, JSON_THROW_ON_ERROR);
            if ($body instanceof \stdClass) {
                return (array) $body;
            }
        } catch (\JsonException) {
        }
        throw new Problem(400, 'validation', 'اطلاعات واردشده ناقص یا نادرست است');
    }

    public function questionnaires(): JsonResponse
    {
        return response()->json((object) $this->service->questionnaires())->header('Cache-Control', 'no-store');
    }

    public function configure(Request $request, string $goal): array
    {
        return $this->service->saveQuestionnaire($goal, WebIntakeRules::questionnaire($goal, $this->body($request)));
    }

    public function join(Request $request): JsonResponse
    {
        $body = Input::body($request, ['completionId']);
        $completionId = Input::uuid(Input::string($body, 'completionId', 36));

        return response()->json($this->service->joinCommunity($completionId), 201)->header('Cache-Control', 'no-store');
    }

    public function save(Request $request): JsonResponse
    {
        $input = WebIntakeRules::submission($this->body($request));
        $input['phone'] = Input::phone($input['phone']);

        return response()->json($this->service->save($input), 201);
    }

    public function verify(Request $request, string $id): JsonResponse
    {
        $body = trim($request->getContent()) === 'null' ? [] : Input::body($request, ['journeyId'], true);
        $journey = ($body['journeyId'] ?? null) === null || $body['journeyId'] === '' ? null : Input::uuid(is_string($body['journeyId']) ? $body['journeyId'] : '');

        return response()->json($this->service->verify($request->attributes->get('actor')['id'], Input::uuid($id), $journey), 201);
    }
}
