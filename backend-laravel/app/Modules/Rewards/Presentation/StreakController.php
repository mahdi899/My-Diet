<?php

namespace App\Modules\Rewards\Presentation;

use App\Modules\Rewards\Application\StreakService;
use App\Shared\Domain\Problem;
use Illuminate\Http\Request;

final class StreakController
{
    public function __construct(private StreakService $streaks) {}

    public function snapshot(Request $request): array
    {
        return $this->streaks->snapshot($request->attributes->get('actor')['id']);
    }

    public function claim(Request $request): array
    {
        return $this->streaks->claim($request->attributes->get('actor')['id'], $this->streaks->claimBody($this->object($request)));
    }

    public function list(): array
    {
        return $this->streaks->list();
    }

    public function publish(Request $request): array
    {
        return $this->streaks->publish($this->object($request));
    }

    private function object(Request $request): array
    {
        try {
            $body = json_decode($request->getContent(), true, 512, JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            throw new Problem(400, 'validation', 'اطلاعات درخواست کامل نیست');
        }
        if (! is_array($body) || array_is_list($body)) {
            throw new Problem(400, 'validation', 'اطلاعات درخواست کامل نیست');
        }

        return $body;
    }
}
