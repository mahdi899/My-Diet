<?php

namespace App\Modules\Onboarding\Presentation;

use App\Modules\Onboarding\Application\OnboardingService;
use App\Shared\Domain\Problem;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

final class OnboardingController
{
    public function __construct(private OnboardingService $service) {}

    private function actor(Request $request): string
    {
        return $request->attributes->get('actor')['id'];
    }

    private function body(Request $request): array
    {
        try {
            $body = json_decode($request->getContent(),false,512,JSON_THROW_ON_ERROR);
            if ($body instanceof \stdClass) {
                return (array) $body;
            }
        } catch (\JsonException) {
        }
        throw new Problem(400,'validation','اطلاعات واردشده ناقص یا نادرست است');
    }

    public function spec(): JsonResponse
    {
        return response()->json($this->service->spec())->header('Cache-Control','public, max-age=300');
    }

    public function state(Request $request): JsonResponse
    {
        return response()->json($this->service->state($this->actor($request)))->header('Cache-Control','no-store');
    }

    public function draft(Request $request): array
    {
        return $this->service->draft($this->actor($request),$this->body($request));
    }

    public function submit(Request $request): JsonResponse
    {
        return response()->json($this->service->submit($this->actor($request),$this->body($request)),201);
    }

    public function consent(Request $request): JsonResponse
    {
        return response()->json($this->service->consent($this->actor($request)),201);
    }
}
