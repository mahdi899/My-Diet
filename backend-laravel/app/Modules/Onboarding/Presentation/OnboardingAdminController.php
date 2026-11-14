<?php

namespace App\Modules\Onboarding\Presentation;

use App\Modules\Onboarding\Application\OnboardingAdminQueries;
use App\Shared\Presentation\StrictInput;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class OnboardingAdminController
{
    public function __construct(private OnboardingAdminQueries $queries) {}

    public function profiles(Request $request): array
    {
        return $this->queries->profiles($request->only(['track', 'tier', 'source', 'flag', 'allergen', 'q', 'cursor', 'limit']));
    }

    public function profile(Request $request, string $userId): array
    {
        return $this->queries->profile($request->attributes->get('actor')['id'], StrictInput::uuid($userId));
    }

    public function funnel(): array
    {
        return $this->queries->funnel();
    }

    public function refresh(): JsonResponse
    {
        return response()->json($this->queries->refresh(), 201);
    }

    public function leads(Request $request): array
    {
        return $this->queries->leads($request->query('cursor'), $request->query('limit'));
    }
}
