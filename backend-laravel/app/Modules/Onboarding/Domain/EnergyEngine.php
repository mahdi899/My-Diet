<?php

namespace App\Modules\Onboarding\Domain;

final class EnergyEngine
{
    private static function rounded(float $number): int
    {
        return (int) floor($number + .5);
    }

    public static function bmi(float $weight, float $height): float
    {
        return self::rounded($weight / ($height / 100) ** 2 * 10) / 10;
    }

    public static function energy(array $input): array
    {
        $bmi = self::bmi($input['weightKg'], $input['heightCm']);
        $base = self::rounded(10 * $input['weightKg'] + 6.25 * $input['heightCm'] - 5 * $input['age'] + ($input['sex'] === 'male' ? 5 : -161));
        $pal = (['sedentary' => 1.2, 'light' => 1.375, 'moderate' => 1.55, 'high' => 1.725][$input['activity']] ?? 1.375) + (['none' => 0, '1_2' => 0, '3_4' => .04, '5_plus' => .08][$input['exercise']] ?? 0);
        $tdee = self::rounded($base * min(1.9, self::rounded($pal * 1000) / 1000));
        $target = $tdee;
        $weekly = 0;
        $notes = [];
        switch ($input['track']) {
            case 'weight_loss':
                $pace = ['slow' => .25, 'balanced' => .5, 'fast' => .75, 'auto' => .5][$input['lossPace'] ?? 'auto'] ?? .5;
                $deficit = min(self::rounded(min($pace, $input['weightKg'] * .01) * 1100), self::rounded($tdee * .25));
                $target = $tdee - $deficit;
                $weekly = -self::rounded($deficit * 7 / 7700 * 100) / 100;
                if ($bmi < 18.5) {
                    $target = $tdee;
                    $weekly = 0;
                    $notes[] = 'bmi_underweight_no_deficit';
                }
                break;
            case 'weight_gain':
                $target = $tdee + 400;
                $weekly = self::rounded(400 * 7 / 7700 * 100) / 100;
                break;
            case 'pregnancy':
                if (($input['lifeStage'] ?? null) === 'breastfeeding') {
                    $target = $tdee + (($input['monthsPostpartum'] ?? 3) < 6 ? 500 : 400);
                    if (($input['lactationGoal'] ?? null) === 'gradual_loss') {
                        $target -= 250;
                        $weekly = -.2;
                        $notes[] = 'lactation_slow_loss_only';
                    } elseif (($input['lactationGoal'] ?? null) === 'more_energy') {
                        $target += 100;
                    }
                } else {
                    $week = $input['pregnancyWeek'] ?? 12;
                    $trimester = $week < 14 ? 1 : ($week < 28 ? 2 : 3);
                    $target = $tdee + ($trimester === 1 ? 0 : ($trimester === 2 ? 340 : 450));
                    if (! empty($input['babies']) && $input['babies'] !== 'singleton' && $trimester >= 2) {
                        $target += 200;
                    }
                    $weekly = $trimester === 1 ? .05 : .4;
                }
                break;
        }
        $floor = $input['track'] === 'pregnancy' ? 1800 : ($input['sex'] === 'male' ? 1500 : 1200);
        if ($target < $floor) {
            $target = $floor;
            $notes[] = 'calorie_floor_applied';
        }
        $target = self::rounded($target / 5) * 5;
        $protein = min(self::rounded($input['weightKg'] * ['weight_loss' => 1.5, 'weight_gain' => 1.7, 'pregnancy' => 1.2, 'detox' => 1.1][$input['track']]), self::rounded($target * .3 / 4));
        $fat = self::rounded($target * ($input['track'] === 'weight_loss' ? .27 : .3) / 9);
        $carbs = max($input['track'] === 'pregnancy' ? 175 : 100, self::rounded(($target - $protein * 4 - $fat * 9) / 4));
        $eta = null;
        if (! empty($input['targetWeightKg']) && $weekly != 0) {
            $diff = $input['targetWeightKg'] - $input['weightKg'];
            if (($diff <=> 0) === ($weekly <=> 0)) {
                $eta = max(1, (int) ceil(abs($diff / $weekly)));
            }
        }

        return ['bmi' => $bmi, 'bmiBand' => $bmi < 18.5 ? 'underweight' : ($bmi < 25 ? 'normal' : ($bmi < 30 ? 'overweight' : 'obese')),
            'bmrKcal' => $base, 'tdeeKcal' => $tdee, 'targetKcal' => $target, 'floorKcal' => $floor, 'weeklyChangeKg' => $weekly, 'etaWeeks' => $eta, 'proteinG' => $protein, 'carbsG' => $carbs, 'fatG' => $fat, 'notes' => $notes];
    }

    public static function safety(array $input): array
    {
        $flags = array_values(array_unique($input['riskFlags']));
        if (in_array('unintentional_weight_loss', $input['health'], true)) {
            $flags[] = 'unintentional_weight_loss';
        }
        if ($input['track'] === 'weight_loss' && $input['bmi'] < 18.5) {
            $flags[] = 'underweight_loss';
        }
        if (in_array('diabetes', $input['health'], true) && in_array('medication', $input['health'], true)) {
            $flags[] = 'diabetes_on_medication';
        }
        if ($input['track'] === 'weight_loss' && ! empty($input['targetWeightKg']) && self::bmi($input['targetWeightKg'], $input['heightCm']) < 18.5) {
            $flags[] = 'target_bmi_low';
        }
        $flags = array_values(array_unique($flags));
        $reasons = array_values(array_intersect($flags, ['eating_disorder_history', 'high_risk_pregnancy', 'kidney', 'underweight_loss', 'diabetes_on_medication', 'target_bmi_low', 'unintentional_weight_loss']));

        return ['tier' => $reasons ? 'doctor_only' : 'ai_ok', 'reasons' => $reasons, 'flags' => $flags];
    }

    public static function slots(int $target, ?int $meals = null, ?int $wake = null): array
    {
        $breakfast = min(10, max(7, ($wake ?? 7) + 1));
        $shape = ($meals ?? 3) <= 2 ? [['breakfast', .35, sprintf('%02d:30', $breakfast)], ['lunch', .65, '14:00']]
            : (($meals ?? 3) >= 4 ? [['breakfast', .25, sprintf('%02d:00', $breakfast)], ['lunch', .3, '13:00'], ['snack', .15, '16:30'], ['dinner', .3, '20:00']]
                : [['breakfast', .28, sprintf('%02d:00', $breakfast)], ['lunch', .37, '13:30'], ['snack', .1, '17:00'], ['dinner', .25, '20:00']]);
        $slots = array_map(fn ($row) => ['mealType' => $row[0], 'suggestedTime' => $row[2], 'kcal' => self::rounded($target * $row[1] / 5) * 5], $shape);
        $slots[count($slots) - 1]['kcal'] += $target - array_sum(array_column($slots, 'kcal'));

        return $slots;
    }
}
