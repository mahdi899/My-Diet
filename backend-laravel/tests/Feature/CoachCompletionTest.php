<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Modules\Coach\Application\CoachChatActions;
use App\Modules\Coach\Application\CoachQuotaService;
use App\Modules\Plans\Application\NextWeekPlanner;
use App\Modules\Plans\Infrastructure\ConfiguredDraftProvider;
use App\Shared\Domain\Problem;
use Tests\MySqlTestCase;

final class CoachCompletionTest extends MySqlTestCase
{
    public function test_chat_remembers_a_disliked_food(): void
    {
        ['id' => $userId] = $this->actor();
        $text = app(CoachChatActions::class)->remember($userId, 'دوست ندارم قارچ');

        self::assertStringContainsString('قارچ', (string) $text);
        self::assertNotNull($this->db->table('coach_preferences')->where([
            'user_id' => $userId, 'pref_key' => 'food_dislike', 'value' => 'قارچ',
        ])->first());
    }

    public function test_disliked_food_is_excluded_from_swap_options(): void
    {
        ['id' => $userId] = $this->actor();
        $plan = $this->planFixture($userId);
        $this->profile($userId, $plan['submission']);
        $this->db->table('food_catalog')->insert([
            'id' => \App\Shared\Domain\LegacyCrypto::uuid(), 'slug' => 'mushroom-soup', 'name_fa' => 'سوپ قارچ',
            'category' => 'main', 'meal_types' => '["lunch"]', 'serving_label' => 'کاسه', 'kcal' => 300,
            'allergens' => '[]', 'tags' => '[]', 'regions' => '[]', 'seasons' => '[]', 'ingredients' => '[]', 'active' => 1,
        ]);
        app(CoachChatActions::class)->remember($userId, 'دوست ندارم سوپ قارچ');
        $stored = $this->db->table('coach_preferences')->where('user_id', $userId)->where('pref_key', 'food_dislike')->pluck('value')->implode('|');
        $names = array_column(app(\App\Modules\Plans\Application\MealSwapService::class)->alternatives($userId, $plan['meal'])['alternatives'], 'name');
        self::assertNotContains('سوپ قارچ', $names, $stored);
    }

    public function test_doctor_only_profile_is_not_drafted_by_ai(): void
    {
        ['id' => $userId] = $this->actor();
        $plan = $this->planFixture($userId);
        $this->profile($userId, $plan['submission'], 'doctor_only');

        try {
            app(ConfiguredDraftProvider::class)->draft($plan['request']);
            self::fail('high-risk profile must not be drafted');
        } catch (Problem $error) {
            self::assertSame(409, $error->status);
            self::assertSame(1, $this->db->table('plan_versions')->where('request_id', $plan['request'])->count());
        }
    }

    public function test_ended_week_queues_a_next_draft_without_calling_ai(): void
    {
        ['id' => $userId] = $this->actor();
        $plan = $this->planFixture($userId, published: true);
        $this->db->table('plan_requests')->where('id', $plan['request'])->update(['week_start' => '2026-11-01', 'status' => 'published']);

        self::assertSame(1, app(NextWeekPlanner::class)->queueDue());
        $child = $this->db->table('plan_requests')->where('parent_request_id', $plan['request'])->first();
        self::assertNotNull($child);
        self::assertSame('queued', $child->status);
        self::assertSame('ai_revision', $child->kind);
        self::assertNotNull($this->db->table('outbox_events')->where('aggregate_id', $child->id)->where('topic', 'plan.generate')->first());
        self::assertSame(0, $this->db->table('plan_versions')->where('request_id', $child->id)->count());
    }

    public function test_addon_purchase_adds_message_credits(): void
    {
        ['id' => $userId] = $this->actor();
        $state = app(CoachQuotaService::class)->purchaseAddon($userId, 'pack_30');

        self::assertSame(30, $state['addonCredits']);
    }

    private function profile(string $userId, string $submission, string $tier = 'ai_ok'): void
    {
        $this->db->table('nutrition_profiles')->insert([
            'user_id' => $userId, 'submission_id' => $submission, 'spec_version' => 1, 'track' => 'weight_loss',
            'goal' => 'weight_loss', 'source' => 'app', 'sex' => 'female', 'age' => 30, 'height_cm' => 165,
            'weight_kg' => 74, 'activity' => 'light', 'bmi' => 27, 'bmr_kcal' => 1400, 'tdee_kcal' => 1900,
            'target_kcal' => 1500, 'protein_g' => 90, 'carbs_g' => 150, 'fat_g' => 50, 'diet_style' => 'regular',
            'meals_per_day' => 3, 'budget' => 'medium', 'allergens' => '[]', 'conditions' => '[]',
            'risk_flags' => '[]', 'safety_tier' => $tier, 'safety_reasons' => '[]', 'preferences' => '{}',
        ]);
    }
}
