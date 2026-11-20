<?php

namespace App\Modules\Plans\Presentation;

use App\Modules\Onboarding\Application\WebPlanDelivery;
use App\Modules\Plans\Application\PlanQueries;
use App\Modules\Plans\Infrastructure\MySqlPlanDelivery;
use App\Modules\Plans\Infrastructure\MySqlPlanGeneration;
use App\Shared\Presentation\StrictInput;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final class PlanQueryController
{
    public function __construct(private PlanQueries $queries, private MySqlPlanDelivery $delivery) {}

    private function actor(Request $request): string
    {
        return $request->attributes->get('actor')['id'];
    }

    public function published(Request $request): Response
    {
        $plan = $this->queries->published($this->actor($request));
        if ($plan !== null && array_any($plan['days'], fn ($day) => $day['meals'] !== [])) {
            $this->delivery->markReceived($plan['requestId']);
        }

        return $plan === null ? response('', 200) : response()->json($plan);
    }

    public function week(Request $request): array
    {
        return $this->queries->week($this->actor($request), (string) $request->query('weekStart', ''));
    }

    public function day(Request $request, string $date): array
    {
        return $this->queries->day($this->actor($request), $date);
    }

    public function latest(Request $request): Response
    {
        $plan = $this->queries->latest($this->actor($request));

        return $plan === null ? response('', 200) : response()->json($plan);
    }

    public function recover(Request $request, MySqlPlanGeneration $generation, WebPlanDelivery $webDelivery): Response
    {
        $user = $this->actor($request);
        $webDelivery->sync($user);
        $generation->retryForUser($user);

        return $this->latest($request);
    }

    public function requests(Request $request): array
    {
        return $this->queries->requests($this->actor($request));
    }

    public function timeline(Request $request, string $id): array
    {
        return $this->queries->timeline($this->actor($request), StrictInput::uuid($id));
    }

    public function questions(Request $request): array
    {
        return $this->queries->questions($this->actor($request), $request->query('status'));
    }

    public function queue(Request $request): array
    {
        return $this->queries->queue($this->actor($request), $request->query('bucket'));
    }
}
