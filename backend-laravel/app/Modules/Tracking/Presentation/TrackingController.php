<?php

namespace App\Modules\Tracking\Presentation;

use App\Modules\Plans\Application\PlanQueries;
use App\Modules\Plans\Domain\CivilDates;
use App\Modules\Tracking\Application\MealActivityService;
use App\Modules\Tracking\Application\TrackingService;
use App\Shared\Domain\Problem;
use App\Shared\Presentation\StrictInput;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final class TrackingController
{
    public function __construct(private TrackingService $tracking, private MealActivityService $activity, private PlanQueries $plans) {}

    public function reasons(): array
    {
        return $this->activity->reasons();
    }

    public function activity(Request $request, string $date): array
    {
        $this->date($date);

        return $this->activity->day($this->actor($request), $date, $this->plans->day($this->actor($request), $date));
    }

    public function history(Request $request, string $date): array
    {
        $this->date($date);

        return $this->activity->history($this->actor($request), $date);
    }

    public function record(Request $request): array
    {
        return $this->activity->record($this->actor($request), $this->object($request));
    }

    public function select(Request $request): array
    {
        return $this->activity->select($this->actor($request), $this->object($request));
    }

    public function dashboard(Request $request): array
    {
        return $this->tracking->dashboard($this->actor($request));
    }

    public function meal(Request $request): array
    {
        $body = $this->tracking->mealBody($this->object($request));

        return $this->tracking->setMeal($this->actor($request), $body['mealUid'], $body['eaten']);
    }

    public function weight(Request $request): array
    {
        return $this->tracking->setWeight($this->actor($request), $this->tracking->weightBody($this->object($request)));
    }

    public function weights(Request $request): array
    {
        return $this->tracking->weights($this->actor($request));
    }

    public function specialist(Request $request): Response
    {
        $specialist = $this->tracking->specialist($this->actor($request));

        return $specialist === null
            ? response('null', 200, ['Content-Type' => 'application/json'])
            : response()->json($specialist);
    }

    public function pending(Request $request): array
    {
        return $this->tracking->pendingRewards($this->actor($request));
    }

    public function acknowledge(Request $request, string $id): array
    {
        if ($request->getContent() !== '') {
            StrictInput::body($request, []);
        }

        return $this->tracking->acknowledge($this->actor($request), StrictInput::uuid($id));
    }

    public function review(Request $request): array
    {
        $body = $this->tracking->reviewBody($this->object($request));

        return $this->tracking->review($this->actor($request), $body['requestId'], $body['weekStart'], $body['rating'], $body['body']);
    }

    public function publicReviews(): array
    {
        return $this->tracking->publicReviews();
    }

    private function actor(Request $request): string
    {
        return $request->attributes->get('actor')['id'];
    }

    private function date(string $date): void
    {
        if (! CivilDates::valid($date)) {
            throw new Problem(400, 'validation', 'تاریخ معتبر نیست');
        }
    }

    private function object(Request $request): array
    {
        $body = json_decode($request->getContent(), true, 512, JSON_THROW_ON_ERROR);
        if (! is_array($body) || array_is_list($body)) {
            throw new Problem(400, 'validation', 'اطلاعات واردشده ناقص یا نادرست است');
        }

        return $body;
    }
}
