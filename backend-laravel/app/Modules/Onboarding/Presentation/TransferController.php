<?php

namespace App\Modules\Onboarding\Presentation;

use App\Modules\Onboarding\Application\TransferService;
use App\Shared\Domain\Problem;
use App\Shared\Presentation\StrictInput as Input;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

final class TransferController
{
    public function __construct(private TransferService $service) {}

    private function actor(Request $request): string
    {
        return $request->attributes->get('actor')['id'];
    }

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

    public function create(Request $request): JsonResponse
    {
        $body = $this->body($request);
        $plan = is_string($body['plan'] ?? null) ? $body['plan'] : '';
        if (! in_array($plan, ['weekly', 'monthly', 'quarterly'], true)) {
            throw new Problem(400, 'validation', 'پلن معتبر نیست');
        }
        $submission = Input::uuid(is_string($body['submissionId'] ?? null) ? $body['submissionId'] : '');

        return response()->json($this->service->create($this->actor($request), $plan, $submission), 201)->header('Cache-Control', 'private, no-store');
    }

    public function status(Request $request, string $id): JsonResponse
    {
        return response()->json($this->service->status($this->actor($request), Input::uuid($id)))->header('Cache-Control', 'private, no-store');
    }

    public function start(Request $request, string $id): JsonResponse
    {
        return response()->json($this->service->start($this->actor($request), Input::uuid($id)), 201)->header('Cache-Control', 'private, no-store');
    }

    public function callback(Request $request): RedirectResponse
    {
        $track = $request->query('trackId');
        $success = $request->query('success');

        return new RedirectResponse($this->service->callback(is_string($track) ? $track : '', is_string($success) ? $success : ''), 303, ['Cache-Control' => 'no-store']);
    }

    public function all(): array
    {
        return $this->service->all();
    }

    public function confirm(Request $request, string $id): JsonResponse
    {
        return response()->json($this->service->confirm($this->actor($request), Input::uuid($id), $this->body($request)), 201);
    }
}
