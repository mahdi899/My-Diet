<?php

namespace Tests\Feature;

use App\Modules\Plans\Infrastructure\MealSwapService;
use App\Modules\Plans\Infrastructure\MySqlPlanQueries;
use App\Shared\Domain\LegacyCrypto;
use App\Shared\Domain\Problem;
use Tests\MySqlTestCase;

final class MealSwapTest extends MySqlTestCase
{
    private string $userId;

    private array $planIds;

    protected function setUp(): void
    {
        parent::setUp();
        ['id' => $this->userId] = $this->actor();
        $this->planIds = $this->planFixture($this->userId, published: false);
        $this->db->table('active_plan_versions')->insert([
            'user_id' => $this->userId,
            'version_id' => $this->planIds['version'],
        ]);
        $this->db->table('nutrition_profiles')->insert([
            'user_id' => $this->userId,
            'submission_id' => $this->planIds['submission'],
            'spec_version' => 2,
            'track' => 'weight_loss',
            'goal' => 'weight_loss',
            'source' => 'app',
            'sex' => 'female',
            'age' => 30,
            'height_cm' => 165,
            'weight_kg' => 75,
            'target_weight_kg' => 65,
            'activity' => 'light',
            'bmi' => 27.5,
            'bmr_kcal' => 1400,
            'tdee_kcal' => 1900,
            'target_kcal' => 1500,
            'protein_g' => 100,
            'carbs_g' => 150,
            'fat_g' => 50,
            'diet_style' => 'regular',
            'meals_per_day' => 3,
            'budget' => 'medium',
            'allergens' => '[]',
            'conditions' => '[]',
            'risk_flags' => '[]',
            'safety_tier' => 'ai_ok',
            'safety_reasons' => '[]',
            'preferences' => '{}',
        ]);
        $this->food('rice-200', 'برنج پخته', 280, '[]');
        $this->food('lentil-soup', 'سوپ عدس', 290, '[]', '["vegan"]');
        $this->food('cheese-sandwich', 'ساندویچ پنیر', 290, '["dairy"]');
    }

    public function test_alternatives_come_from_the_real_catalog(): void
    {
        $result = app(MealSwapService::class)->alternatives($this->userId, $this->planIds['meal']);

        self::assertSame($this->planIds['meal'], $result['meal']['id']);
        $slugs = array_column($result['alternatives'], 'slug');
        self::assertContains('rice-200', $slugs);
        self::assertContains('lentil-soup', $slugs);
    }

    public function test_allergen_food_is_excluded(): void
    {
        $this->db->table('nutrition_profiles')->where('user_id', $this->userId)->update(['allergens' => '["dairy"]']);
        $result = app(MealSwapService::class)->alternatives($this->userId, $this->planIds['meal']);

        self::assertNotContains('cheese-sandwich', array_column($result['alternatives'], 'slug'));
    }

    public function test_apply_updates_the_planned_meal_and_learns_a_dislike(): void
    {
        $result = app(MealSwapService::class)->apply($this->userId, $this->planIds['meal'], 'rice-200', 'dislike');

        self::assertSame('برنج پخته', $result['newMeal']['title']);
        self::assertSame('برنج پخته', $this->db->table('plan_meals')->where('id', $this->planIds['meal'])->value('title'));
        self::assertSame('rice-200', $this->db->table('meal_swap_logs')->where('user_id', $this->userId)->value('new_food_slug'));
        self::assertNotNull($this->db->table('coach_preferences')->where(['user_id' => $this->userId, 'pref_key' => 'food_dislike'])->first());
    }

    public function test_published_plan_swap_is_visible_without_rewriting_the_row(): void
    {
        $this->db->table('plan_versions')->where('id', $this->planIds['version'])->update([
            'status' => 'published',
            'published_at' => '2026-11-14 00:00:00',
        ]);
        app(MealSwapService::class)->apply($this->userId, $this->planIds['meal'], 'rice-200', 'dislike');

        self::assertSame('عدسی', $this->db->table('plan_meals')->where('id', $this->planIds['meal'])->value('title'));
        $days = app(MySqlPlanQueries::class)->days($this->planIds['version']);
        self::assertSame('برنج پخته', $days[0]['meals'][0]['title']);
        self::assertSame('عدسی', $days[0]['meals'][0]['plannedTitle']);
        self::assertSame('برنج پخته', $days[0]['meals'][0]['options'][0]['title']);
        self::assertSame(280, $days[0]['meals'][0]['options'][0]['calories']);
    }

    public function test_apply_rejects_a_food_outside_the_suggested_meal_energy_range(): void
    {
        $this->food('tea-2', 'چای ساده', 2, '[]');
        $service = app(MealSwapService::class);
        self::assertNotContains('tea-2', array_column($service->alternatives($this->userId, $this->planIds['meal'])['alternatives'], 'slug'));

        try {
            $service->apply($this->userId, $this->planIds['meal'], 'tea-2', 'variety');
            self::fail('A drink cannot replace the entire lunch');
        } catch (Problem $error) {
            self::assertSame('food_blocked', $error->problemCode);
        }
        self::assertFalse($this->db->table('meal_swap_logs')->where('meal_id', $this->planIds['meal'])->exists());
    }

    public function test_unknown_food_and_meal_are_rejected(): void
    {
        $service = app(MealSwapService::class);
        try {
            $service->apply($this->userId, $this->planIds['meal'], 'missing-food', 'variety');
            self::fail('missing food should 404');
        } catch (Problem $error) {
            self::assertSame(404, $error->status);
        }
        try {
            $service->alternatives($this->userId, LegacyCrypto::uuid());
            self::fail('missing meal should 404');
        } catch (Problem $error) {
            self::assertSame(404, $error->status);
        }
    }

    private function food(string $slug, string $name, int $kcal, string $allergens, string $tags = '[]'): void
    {
        $this->db->table('food_catalog')->insert([
            'id' => LegacyCrypto::uuid(),
            'slug' => $slug,
            'name_fa' => $name,
            'category' => 'main',
            'meal_types' => '["lunch"]',
            'serving_label' => 'وعده',
            'serving_g' => 200,
            'kcal' => $kcal,
            'protein_g' => 10,
            'carbs_g' => 30,
            'fat_g' => 8,
            'allergens' => $allergens,
            'tags' => $tags,
            'regions' => '[]',
            'seasons' => '[]',
            'cost_tier' => 1,
            'prep_minutes' => 15,
            'ingredients' => '[]',
            'active' => 1,
        ]);
    }
}
