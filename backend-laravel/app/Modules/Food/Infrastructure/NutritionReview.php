<?php

declare(strict_types=1);

namespace App\Modules\Food\Infrastructure;

use App\Modules\Ai\Infrastructure\ModelPools;
use App\Shared\Domain\Problem;
use Illuminate\Database\ConnectionInterface;

final class NutritionReview
{
    public function __construct(private ConnectionInterface $db, private ModelPools $pools) {}

    public function setStatus(string $slug, string $status): array
    {
        if (! in_array($status, ['estimated', 'calculated', 'verified'], true)) {
            throw new Problem(400, 'validation', 'وضعیت تغذیه معتبر نیست');
        }
        $updated = $this->db->table('food_catalog')->where('slug', $slug)->update(['nutrition_status' => $status]);
        if ($updated === 0 && ! $this->db->table('food_catalog')->where('slug', $slug)->exists()) {
            throw new Problem(404, 'not_found', 'غذا پیدا نشد');
        }

        return ['slug' => $slug, 'nutritionStatus' => $status];
    }

    public function estimate(string $slug): array
    {
        $food = $this->db->table('food_catalog')->where('slug', $slug)->first();
        if ($food === null) {
            throw new Problem(404, 'not_found', 'غذا پیدا نشد');
        }
        if ($food->nutrition_status === 'verified') {
            throw new Problem(409, 'already_verified', 'مقدار تأییدشده را با تخمین عوض نمی‌کنم. اول وضعیت را بردار.');
        }
        $result = $this->pools->run('nutrition_coach', [
            ['role' => 'system', 'content' => 'فقط JSON بده: {"kcal":0,"protein":0,"carbs":0,"fat":0}. این تخمین است نه مقدار آزمایشگاهی.'],
            ['role' => 'user', 'content' => 'یک وعده '.$food->name_fa],
        ], null, null, true);
        $parsed = json_decode((string) $result['text'], true);
        if (! is_array($parsed)) {
            throw new Problem(502, 'invalid_json', 'تخمین قابل خواندن نبود');
        }
        $nutrition = ['source' => 'ai_estimate', 'kcal' => (int) ($parsed['kcal'] ?? 0), 'protein' => (float) ($parsed['protein'] ?? 0), 'carbs' => (float) ($parsed['carbs'] ?? 0), 'fat' => (float) ($parsed['fat'] ?? 0)];
        $this->db->table('food_catalog')->where('slug', $slug)->update([
            'kcal' => max(1, $nutrition['kcal']),
            'protein_g' => $nutrition['protein'],
            'carbs_g' => $nutrition['carbs'],
            'fat_g' => $nutrition['fat'],
            'nutrition' => json_encode($nutrition, JSON_UNESCAPED_UNICODE),
            'nutrition_status' => 'estimated',
        ]);

        return ['slug' => $slug, 'nutritionStatus' => 'estimated', 'nutrition' => $nutrition];
    }
}
