<?php

namespace App\Modules\Plans\Application;

use App\Modules\Identity\Application\IdentitySettings;
use App\Modules\Plans\Domain\CivilDates as Dates;
use App\Shared\Domain\Amount;
use App\Shared\Domain\LegacyCrypto as Crypto;
use App\Shared\Domain\Problem;

final class PlanQueries
{
    public function __construct(private PlanQueryStore $store, private IdentitySettings $settings) {}

    public function published(string $user): ?array
    {
        $request = $this->store->active($user);
        if (! $request) {
            return null;
        }
        $today = Dates::today();
        $friday = Dates::add($request['week_start'], 6);
        $week = $this->week($user, $request['week_start']);

        return ['requestId' => $request['id'], 'versionId' => $request['version_id'], 'weekStart' => $request['week_start'], 'effectiveFrom' => $request['effective_from'], 'expired' => $today > $friday,
            'days' => array_map(function ($day, $index) use ($today, $friday, $request): array {
                return [...$day, 'dayIndex' => $index, 'meals' => array_map(fn ($meal) => [...$meal, 'loggable' => $day['date'] === $today && $day['date'] >= $request['effective_from'] && $today <= $friday], $day['meals'])];
            }, $week['days'], array_keys($week['days']))];
    }

    public function week(string $user, string $date): array
    {
        if (! Dates::valid($date) || Dates::saturday($date) !== $date) {
            throw new Problem(400, 'validation', 'هفته باید از شنبه شروع شود');
        }
        $rows = $this->store->dated($user, $date, Dates::add($date, 6));
        $cache = [];
        $days = [];
        for ($i = 0; $i < 7; $i++) {
            $days[] = $this->presentDay($user, Dates::add($date, $i), $rows, $cache);
        }

        return ['weekStart' => $date, 'days' => $days];
    }

    public function day(string $user, string $date): array
    {
        if (! Dates::valid($date)) {
            throw new Problem(400, 'validation', 'تاریخ درست نیست');
        }
        $cache = [];

        return $this->presentDay($user, $date, $this->store->dated($user, $date, $date), $cache);
    }

    private function presentDay(string $user, string $date, array $rows, array &$cache): array
    {
        $covering = array_filter($rows, fn ($row) => $row['civil_date'] === $date && Dates::today($row['published_at']) <= $date);
        usort($covering, fn ($a, $b) => strcmp($b['published_at'], $a['published_at']) ?: strcmp($b['version_id'], $a['version_id']));
        if (! $covering) {
            return ['date' => $date, 'requestId' => null, 'versionId' => null, 'versionStatus' => null, 'meals' => []];
        }
        $chosen = $covering[0];
        $cache[$chosen['version_id']] ??= $this->store->days($chosen['version_id']);
        $day = array_values(array_filter($cache[$chosen['version_id']], fn ($day) => $day['dayIndex'] === $chosen['day_index']))[0] ?? null;
        $activity = $this->store->activity($user, $chosen['request_id'], $date);
        $meals = array_map(function ($meal) use ($activity, $chosen): array {
            $selection = array_values(array_filter($activity['selections'], fn ($row) => $row['meal_uid'] === $meal['mealUid']))[0] ?? null;
            $log = array_values(array_filter($activity['logs'], fn ($row) => $row['meal_uid'] === $meal['mealUid']))[0] ?? null;
            $selected = array_values(array_filter($meal['options'], fn ($option) => $selection && $selection['version_id'] === $chosen['version_id'] ? $option['optionId'] === $selection['option_uid'] : $option['kind'] === 'primary'))[0] ?? null;
            $details = $log['details'] ?? [];
            $consumption = $log === null ? null : ['versionId' => $log['plan_version_id'], 'optionId' => $log['option_uid'], 'eaten' => (bool) $log['eaten'], ...$details,
                'consumedCalories' => is_int($details['consumedCalories'] ?? null) || is_float($details['consumedCalories'] ?? null) ? $details['consumedCalories'] : null];

            return [...$meal, 'selectedOptionId' => $selected['optionId'] ?? null, 'selectedOption' => $selected, 'selectionRevision' => $selection['revision'] ?? 0,
                'plannedCalories' => $selected !== null ? ($selected['calories'] ?? null) : $meal['calories'], 'consumptionRevision' => $log['revision'] ?? 0,
                'consumptionState' => $details['state'] ?? (($log['eaten'] ?? false) ? 'as_planned' : 'unrecorded'), 'eaten' => (bool) ($log['eaten'] ?? false), 'consumption' => $consumption];
        }, $day['meals'] ?? []);

        return ['date' => $date, 'requestId' => $chosen['request_id'], 'versionId' => $chosen['version_id'], 'versionStatus' => $chosen['status'], 'meals' => $meals];
    }

    public function latest(string $user): ?array
    {
        $request = $this->store->latest($user);
        if (! $request) {
            return null;
        }

        return $this->summary($request);
    }

    public function summary(array $request): array
    {
        $answers = $this->store->answers($request['id']);
        $questions = array_map(function ($q) use ($answers): array {
            return [...$this->question($q), 'answers' => array_map(fn ($answer) => ['body' => Crypto::decrypt($answer['body'], $this->settings->fieldKey), 'createdAt' => Crypto::iso($answer['created_at'])],
                array_values(array_filter($answers, fn ($answer) => $answer['question_id'] === $q['id'])))];
        }, $this->store->questions($request['id']));

        $hold = ($request['safety_tier'] ?? null) === 'doctor_only' && $request['status'] !== 'published'
            ? 'به‌خاطر گزینه‌ای که در سلامت انتخاب کردی (سابقهٔ اختلال خوردن)، برنامه تا تأیید متخصص در این صفحه فعال نمی‌شود.'
            : null;

        return ['id' => $request['id'], 'status' => $request['status'], 'kind' => $request['kind'], 'priceToman' => Amount::safe($request['price_toman']),
            'weekStart' => $request['week_start'], 'effectiveFrom' => $request['effective_from'], 'displayName' => $request['display_name'],
            'conversationId' => $this->store->conversation($request['id']), 'questions' => $questions, 'version' => null, 'holdReason' => $hold];
    }

    public function requests(string $user): array
    {
        return array_map($this->requestView(...), $this->store->requests($user));
    }

    private function requestView(array $row): array
    {
        return ['id' => $row['id'], 'status' => $row['status'], 'kind' => $row['kind'], 'priceToman' => Amount::safe($row['price_toman']), 'createdAt' => Crypto::iso($row['created_at'])];
    }

    private function question(array $row): array
    {
        return ['id' => $row['id'], 'prompt' => Crypto::decrypt($row['prompt'], $this->settings->fieldKey), 'required' => (bool) $row['required'], 'status' => $row['status']];
    }

    public function timeline(string $user, string $id): array
    {
        $row = $this->store->request($user, $id) ?? throw new Problem(404, 'not_found', 'درخواست پیدا نشد');

        return [...$this->requestView($row), 'events' => array_map(fn ($event) => ['kind' => $event['kind'], 'createdAt' => Crypto::iso($event['created_at'])], $this->store->events($id)),
            'questions' => array_map($this->question(...), array_values(array_filter($this->store->questions($id), fn ($q) => in_array($q['status'], ['open', 'answered'], true))))];
    }

    public function questions(string $user, ?string $status): array
    {
        $status = $status ?: 'open';
        if (! in_array($status, ['open', 'answered', 'acknowledged', 'withdrawn'], true)) {
            throw new Problem(400, 'validation', 'وضعیت سؤال شناخته نشد');
        }

        return array_map(fn ($q) => [...$this->question($q), 'requestId' => $q['request_id'], 'createdAt' => Crypto::iso($q['created_at'])], $this->store->userQuestions($user, $status));
    }

    public function queue(string $actor, ?string $bucket): array
    {
        $bucket = $bucket === '' ? null : $bucket;
        if ($bucket !== null && ! in_array($bucket, ['generating', 'awaiting_review', 'awaiting_user', 'response_received', 'revisions', 'published'], true)) {
            throw new Problem(400, 'validation', 'دستهٔ صف شناخته نشد');
        }

        return array_map(fn ($row) => ['id' => $row['id'], 'status' => $row['status'], 'kind' => $row['kind'], 'createdAt' => Crypto::iso($row['created_at']), 'displayName' => $row['display_name'], 'phone' => $row['phone_e164'] ?? null, 'goal' => $row['goal'] ?? null, 'track' => $row['track'] ?? null], $this->store->queue($actor, $bucket));
    }
}
