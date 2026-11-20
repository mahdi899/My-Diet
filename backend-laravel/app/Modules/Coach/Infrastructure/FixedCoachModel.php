<?php

namespace App\Modules\Coach\Infrastructure;

use App\Modules\Coach\Application\CoachModel;

/** Deterministic coach. It never opens a network connection. */
final class FixedCoachModel implements CoachModel
{
    public int $calls = 0;

    public function callsExternalNetwork(): bool
    {
        return false;
    }

    public function reply(string $userId, string $userMessage, ?callable $onDelta = null, ?string $threadId = null): array
    {
        $this->calls++;

        return ['text' => 'پاسخ آزمایشی', 'tokensIn' => 10, 'tokensOut' => 5, 'costMicros' => 100];
    }

    public function analyzePhoto(string $userId, string $imageBase64, string $caption = '', string $mime = 'image/jpeg'): array
    {
        $this->calls++;

        return ['foods' => [
            ['name' => 'عدسی', 'kcal' => 250, 'servingLabel' => 'یک کاسهٔ تقریبی', 'confidence' => .8],
            ['name' => 'نان سنگک', 'kcal' => 80, 'servingLabel' => 'حدود یک کف دست', 'confidence' => .8],
        ], 'confidence' => .8, 'questions' => [], 'needsConfirmation' => true, 'tokensIn' => 0, 'tokensOut' => 0, 'costMicros' => 0, 'text' => 'تحلیل آزمایشی'];
    }
}
