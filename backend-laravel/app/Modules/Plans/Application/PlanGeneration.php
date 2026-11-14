<?php

namespace App\Modules\Plans\Application;

final class PlanGeneration
{
    public function __construct(private PlanGenerationStore $store, private DraftProvider $provider) {}

    public function generate(string $requestId, bool $regenerate = false): void
    {
        $claim = $this->store->begin($requestId, $regenerate);
        if ($claim === null) {
            return;
        }
        $days = null;
        $reason = $claim['skip'];
        if ($reason === null) {
            try {
                $days = $this->provider->draft($requestId);
                if (! $this->usable($days)) {
                    $days = null;
                    $reason = 'invalid_draft';
                }
            } catch (\Throwable) {
                $reason = 'provider_error';
            }
        }
        $this->store->finish($requestId, $regenerate, $days, $this->provider->name(), $reason);
    }

    public function regenerate(string $specialist, string $requestId, int $lock): array
    {
        return $this->store->regenerate($specialist, $requestId, $lock);
    }

    private function usable(array $days): bool
    {
        if (count($days) !== 7) {
            return false;
        }
        foreach ($days as $day) {
            $meals = $day['meals'] ?? null;
            if (! is_array($meals) || $meals === []) {
                return false;
            }
            foreach ($meals as $meal) {
                $items = $meal['items'] ?? [];
                $named = is_array($items) && array_filter($items, fn ($item) => is_string($item['name'] ?? null) && trim($item['name']) !== '');
                if (! is_string($meal['title'] ?? null) || trim($meal['title']) === '' || (int) ($meal['calories'] ?? 0) <= 0 || $named === []) {
                    return false;
                }
            }
        }

        return true;
    }
}
