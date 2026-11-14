<?php

namespace App\Modules\Feedback\Domain;

use App\Modules\Plans\Domain\CivilDates;
use App\Shared\Domain\Problem;

final class FeedbackRules
{
    public const PREPARATION = ['easy', 'moderate', 'hard', 'unknown'];

    public const AVAILABILITY = ['available', 'partial', 'unavailable', 'unknown'];

    public const AFFORDABILITY = ['affordable', 'tight', 'unaffordable', 'unknown'];

    public const PORTION = ['too_small', 'right', 'too_large', 'unknown'];

    public static function week(string $value): string
    {
        if (! CivilDates::valid($value) || CivilDates::saturday($value) !== $value) {
            throw new Problem(400, 'validation', 'شروع هفته باید شنبه باشد');
        }

        return $value;
    }
}
