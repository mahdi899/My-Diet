<?php

namespace App\Modules\Questionnaire\Application;

use Closure;

interface QuestionnaireStore
{
    public function published(): ?array;

    public function draft(string $userId): ?array;

    public function saveDraft(string $userId, array $answers): void;

    public function createSubmission(string $id, string $userId, int $schema, array $answers, array $flags, float $bmi, ?string $pregnancyAsOf): void;

    public function setInitialName(string $userId, string $name): void;

    public function latest(string $userId): ?array;

    public function schema(int $version, bool $lock = false): ?array;

    public function openRequest(string $userId): ?array;

    public function wallet(string $userId): ?array;

    public function schemas(): array;

    public function createSchema(array $document): int;

    public function publish(int $version): void;

    public function audit(string $actor, string $action, int $version): void;

    public function transaction(Closure $work): mixed;
}
