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
    public function __construct(
        private TrackingService $tracking,
        private MealActivityService $activity,
        private PlanQueries $plans,
        private \Illuminate\Database\ConnectionInterface $db
    ) {}

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

    /**
     * Daily summary: actual consumed kcal + water for home tab ring.
     */
    public function summary(Request $request, ?string $date = null): array
    {
        $date = $date ?? $request->query('date') ?? \App\Modules\Plans\Domain\CivilDates::today();
        $this->date($date);
        $userId = $this->actor($request);

        $photoKcal = (int) $this->db->table('coach_food_entries')
            ->where(['user_id' => $userId, 'civil_date' => $date, 'status' => 'logged'])
            ->get()
            ->sum(fn ($row) => (int) (json_decode($row->totals, true)['kcal'] ?? 0));

        $actualKcal = $photoKcal + (int) $this->db->table('meal_logs as l')
            ->join('plan_meals as m', 'm.id', '=', 'l.plan_meal_id')
            ->where('l.user_id', $userId)
            ->where('l.scheduled_date', $date)
            ->where('l.eaten', 1)
            ->sum('m.calories');

        // Water intake
        $waterMl = (int) ($this->db
            ->table('coach_water')
            ->where('user_id', $userId)
            ->where('civil_date', $date)
            ->value('ml') ?? 0);

        return [
            'date'       => $date,
            'actualKcal' => $actualKcal,
            'waterMl'    => $waterMl,
        ];
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
