<?php

namespace App\Modules\Plans\Application;

interface PlanQuestionStore
{
    public function transaction(\Closure $work): mixed;

    public function request(string $id): ?array;

    public function question(string $id): ?array;

    public function create(string $id, string $request, string $actor, string $prompt, bool $required): void;

    public function answer(string $question, string $author, string $body): void;

    public function questionStatus(string $id, string $status): void;

    public function requestStatus(string $id, string $status, ?array $only = null): void;

    public function hasRequired(string $request, array $statuses): bool;

    public function event(string $request, string $actor, string $kind, array $detail = []): void;

    public function notify(string $user, string $kind, array $payload): void;
}
