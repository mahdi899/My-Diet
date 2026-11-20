<?php

namespace App\Modules\Coach\Application;

interface CoachModel
{
    public function callsExternalNetwork(): bool;

    /**
     * Generate reply based on user message and context.
     *
     * @param  string  $userId  User ID for context building
     * @param  string  $userMessage  The user's message text
     * @return array{text: string, tokensIn: int, tokensOut: int, costMicros: int, model?: string}
     */
    public function reply(string $userId, string $userMessage, ?callable $onDelta = null, ?string $threadId = null): array;

    /**
     * @return array{foods: list<array>, confidence: float, questions: list<string>, needsConfirmation: bool, tokensIn: int, tokensOut: int, costMicros: int, text: string}
     */
    public function analyzePhoto(string $userId, string $imageBase64, string $caption = '', string $mime = 'image/jpeg'): array;
}
