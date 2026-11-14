<?php

namespace App\Modules\Feedback\Presentation;

use App\Modules\Feedback\Domain\FeedbackRules;
use App\Modules\Feedback\Infrastructure\MySqlFeedback;
use App\Shared\Domain\Problem;
use App\Shared\Presentation\StrictInput;
use Illuminate\Http\Request;

final class FeedbackController
{
    public function __construct(private MySqlFeedback $feedback) {}

    public function save(Request $request): array
    {
        $body = $this->object($request, 'بازخورد معتبر نیست');
        foreach (['preparationDifficulty' => FeedbackRules::PREPARATION, 'ingredientAvailability' => FeedbackRules::AVAILABILITY, 'affordability' => FeedbackRules::AFFORDABILITY, 'portionSatisfaction' => FeedbackRules::PORTION] as $key => $allowed) {
            if (! in_array($body[$key] ?? null, $allowed, true)) {
                throw new Problem(400, 'validation', 'بازخورد معتبر نیست');
            }
        }
        if (! is_array($body['favorites'] ?? null) || ! is_array($body['dislikes'] ?? null) || count($body['favorites']) > 20 || count($body['dislikes']) > 20 || ! is_bool($body['publishPermission'] ?? null) || ! is_string($body['comment'] ?? null) || mb_strlen($body['comment']) > 1000) {
            throw new Problem(400, 'validation', 'بازخورد معتبر نیست');
        }
        $rating = $body['serviceRating'] ?? null;
        if ($rating !== null && (! is_int($rating) || $rating < 1 || $rating > 5)) {
            throw new Problem(400, 'validation', 'بازخورد معتبر نیست');
        }
        $body['favorites'] = array_map(fn ($id) => StrictInput::uuid($id), $body['favorites']);
        $body['dislikes'] = array_map(fn ($id) => StrictInput::uuid($id), $body['dislikes']);

        return $this->feedback->save($this->actor($request), $body);
    }

    public function read(Request $request): array
    {
        return $this->feedback->get($this->actor($request), (string) $request->query('weekStart', ''));
    }

    public function publish(Request $request): array
    {
        $body = $this->object($request, 'هفتهٔ انتشار معتبر نیست');
        if (array_keys($body) !== ['weekStart']) {
            throw new Problem(400, 'validation', 'هفتهٔ انتشار معتبر نیست');
        }

        return $this->feedback->publish($this->actor($request), (string) $body['weekStart']);
    }

    public function preferences(Request $request): array
    {
        return $this->feedback->preferences($this->actor($request));
    }

    public function confirm(Request $request): array
    {
        $body = $this->object($request, 'اصلاح ترجیح معتبر نیست');
        if (! is_int($body['expectedRevision'] ?? null) || $body['expectedRevision'] < 0 || ! is_array($body['favoriteOptions'] ?? null) || ! is_array($body['dislikedOptions'] ?? null) || ! is_string($body['note'] ?? null)) {
            throw new Problem(400, 'validation', 'اصلاح ترجیح معتبر نیست');
        }

        return $this->feedback->confirm($this->actor($request), $body['expectedRevision'], $body['favoriteOptions'], $body['dislikedOptions'], $body['note']);
    }

    public function report(Request $request): array
    {
        $body = $this->object($request, 'درخواست گزارش معتبر نیست');
        if (array_diff(array_keys($body), ['weekStart', 'commandId'])) {
            throw new Problem(400, 'validation', 'درخواست گزارش معتبر نیست');
        }

        return $this->feedback->generate($this->actor($request), (string) ($body['weekStart'] ?? ''), StrictInput::uuid($body['commandId'] ?? ''));
    }

    public function latest(Request $request): array
    {
        return $this->feedback->latest($this->actor($request), (string) $request->query('weekStart', ''));
    }

    public function specialist(Request $request, string $userId): array
    {
        return $this->feedback->forSpecialist($this->actor($request), StrictInput::uuid($userId), (string) $request->query('weekStart', ''));
    }

    public function metrics(): array
    {
        return $this->feedback->metrics();
    }

    private function actor(Request $request): string
    {
        return $request->attributes->get('actor')['id'];
    }

    private function object(Request $request, string $message): array
    {
        try {
            $body = json_decode($request->getContent(), true, 512, JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            throw new Problem(400, 'validation', $message);
        }
        if (! is_array($body) || array_is_list($body)) {
            throw new Problem(400, 'validation', $message);
        }

        return $body;
    }
}
