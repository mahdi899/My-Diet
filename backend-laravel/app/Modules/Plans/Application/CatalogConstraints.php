<?php

declare(strict_types=1);

namespace App\Modules\Plans\Application;

/** Hard catalogue rules. Prompt text is not enough to keep a food out of a plan. */
final class CatalogConstraints
{
    public function allows(array $food, array $profile, array $avoid, array $specialistNotes, bool $enforceBudget): bool
    {
        $status = (string) ($food['nutritionStatus'] ?? 'verified');
        $highRisk = ($profile['track'] ?? '') === 'pregnancy' || ($profile['safety_tier'] ?? 'ai_ok') !== 'ai_ok';
        if ($highRisk && $status !== 'verified') {
            return false;
        }
        $name = mb_strtolower((string) ($food['nameFa'] ?? ''), 'UTF-8');
        foreach ($avoid as $dislike) {
            if ($this->overlaps($name, mb_strtolower(trim((string) $dislike), 'UTF-8'))) {
                return false;
            }
        }
        foreach ($specialistNotes as $note) {
            $note = mb_strtolower((string) $note, 'UTF-8');
            if ($name !== '' && mb_strlen($name, 'UTF-8') >= 2 && mb_stripos($note, $name) !== false) {
                return false;
            }
        }
        if ($enforceBudget && (int) ($food['costTier'] ?? 3) > (($profile['budget'] ?? 'medium') === 'low' ? 2 : 3)) {
            return false;
        }

        return true;
    }

    /** A pregnancy day must reach 25g of fiber when the offered foods can supply it. */
    public function fiberShort(string $track, float $grams, float $bestAvailable): bool
    {
        if ($track !== 'pregnancy' || $bestAvailable < 25) {
            return false;
        }

        return $grams < 25;
    }

    private function overlaps(string $name, string $needle): bool
    {
        if ($needle === '' || mb_strlen($needle, 'UTF-8') < 2 || $name === '') {
            return false;
        }

        return $name === $needle || mb_stripos($name, $needle) !== false || mb_stripos($needle, $name) !== false;
    }
}
