<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Modules\Coach\Infrastructure\CoachChatActions;
use App\Modules\Coach\Infrastructure\FollowUpQuestions;
use App\Modules\Coach\Infrastructure\MySqlCoach;
use App\Modules\Money\Application\MoneyStore;
use App\Modules\Plans\Application\CatalogConstraints;
use App\Modules\Plans\Infrastructure\MealSwapService;
use App\Shared\Domain\LegacyCrypto;
use Tests\MySqlTestCase;

final class AuditGapsTest extends MySqlTestCase
{
    public function test_hard_rules_reject_dislike_budget_specialist_lock_and_unverified_pregnancy_food(): void
    {
        $gate = new CatalogConstraints;
        $soup = ['nameFa' => 'سوپ قارچ', 'costTier' => 1, 'nutritionStatus' => 'verified'];
        $expensive = ['nameFa' => 'استیک', 'costTier' => 3, 'nutritionStatus' => 'verified'];
        $estimated = ['nameFa' => 'املت', 'costTier' => 1, 'nutritionStatus' => 'estimated'];

        self::assertFalse($gate->allows($soup, ['budget' => 'medium', 'track' => 'weight_loss', 'safety_tier' => 'ai_ok'], ['سوپ قارچ'], [], true));
        self::assertFalse($gate->allows($expensive, ['budget' => 'low', 'track' => 'weight_loss', 'safety_tier' => 'ai_ok'], [], [], true));
        self::assertFalse($gate->allows($soup, ['budget' => 'medium', 'track' => 'weight_loss', 'safety_tier' => 'ai_ok'], [], ['سوپ قارچ تا پایان دوره ممنوع است'], true));
        self::assertFalse($gate->allows($estimated, ['budget' => 'medium', 'track' => 'pregnancy', 'safety_tier' => 'ai_ok'], [], [], true));
        self::assertTrue($gate->allows($estimated, ['budget' => 'medium', 'track' => 'weight_loss', 'safety_tier' => 'ai_ok'], [], [], true));
        self::assertTrue($gate->fiberShort('pregnancy', 10, 40));
        self::assertFalse($gate->fiberShort('weight_loss', 0, 40));
        self::assertFalse($gate->fiberShort('pregnancy', 10, 8));
    }

    public function test_swap_rejects_a_food_named_in_the_specialist_note(): void
    {
        ['id' => $userId] = $this->actor();
        $plan = $this->planFixture($userId);
        $this->profile($userId, $plan['submission']);
        $this->db->table('food_catalog')->insert([
            'id' => LegacyCrypto::uuid(), 'slug' => 'locked-soup', 'name_fa' => 'سوپ قارچ',
            'category' => 'main', 'meal_types' => '["lunch"]', 'serving_label' => 'کاسه', 'kcal' => 300,
            'allergens' => '[]', 'tags' => '[]', 'regions' => '[]', 'seasons' => '[]', 'ingredients' => '[]',
            'nutrition_status' => 'verified', 'active' => 1,
        ]);
        $this->db->table('coach_preferences')->insert([
            'id' => LegacyCrypto::uuid(), 'user_id' => $userId, 'pref_key' => 'specialist_note',
            'value' => 'سوپ قارچ ممنوع است', 'source' => 'specialist', 'strength' => 3, 'active' => 1,
        ]);

        $names = array_column(app(MealSwapService::class)->alternatives($userId, $plan['meal'])['alternatives'], 'name');
        self::assertNotContains('سوپ قارچ', $names);
    }

    public function test_follow_up_skips_known_answers_and_asks_for_missing_weight(): void
    {
        ['id' => $userId] = $this->actor();
        $plan = $this->planFixture($userId);
        $this->profile($userId, $plan['submission']);
        $this->db->table('nutrition_profiles')->where('user_id', $userId)->update(['region' => 'شیراز']);

        $before = array_column(app(FollowUpQuestions::class)->forUser($userId), 'key');
        self::assertNotContains('region', $before);
        self::assertContains('weight', $before);

        app(CoachChatActions::class)->remember($userId, 'وقت آشپزی ندارم و غذای سریع می‌خواهم');
        $after = array_column(app(FollowUpQuestions::class)->forUser($userId), 'key');
        self::assertNotContains('kitchen', $after);
        self::assertNotContains('region', $after);
    }

    public function test_overdue_review_moves_to_a_specialist_with_free_capacity(): void
    {
        ['id' => $userId] = $this->actor();
        $plan = $this->planFixture($userId);
        $current = $this->specialist('عمومی');
        $backup = $this->specialist('متخصص عمومی');
        $this->db->table('plan_requests')->where('id', $plan['request'])->update([
            'assigned_specialist_id' => $current,
            'created_at' => '2026-11-01 00:00:00',
        ]);

        $this->artisan('sabzine:sla-alerts')->assertOk();

        $assigned = $this->db->table('plan_requests')->where('id', $plan['request'])->value('assigned_specialist_id');
        self::assertNotSame($current, $assigned);
        self::assertNotNull($this->db->table('notifications')->where(['user_id' => $assigned, 'kind' => 'sla_reassigned'])->first());
        self::assertNotSame('', $backup);
    }

    public function test_pregnancy_case_prefers_a_specialist_whose_credential_matches(): void
    {
        ['id' => $userId] = $this->actor();
        $plan = $this->planFixture($userId);
        $this->profile($userId, $plan['submission']);
        $this->db->table('nutrition_profiles')->where('user_id', $userId)->update(['track' => 'pregnancy']);
        $general = $this->specialist('تغذیه عمومی');
        $pregnancy = $this->specialist('متخصص بارداری');

        $chosen = app(MoneyStore::class)->assignSpecialist($plan['submission']);
        self::assertStringContainsString('بارداری', (string) $this->db->table('specialist_profiles')->where('user_id', $chosen)->value('credential'));
        self::assertNotSame($general, $chosen);
    }

    public function test_photo_stays_unlogged_until_the_user_confirms(): void
    {
        ['id' => $userId] = $this->actor();
        $coach = app(MySqlCoach::class);
        $photo = $coach->photo($userId, 'photo-1', "\xFF\xD8\xFF\x00", 'image/jpeg');

        self::assertSame('suggested', $photo['status']);
        self::assertSame(0, $coach->today($userId)['meals']);
        self::assertSame('logged', $coach->confirmPhoto($userId, $photo['entryId'])['status']);
        self::assertSame(1, $coach->today($userId)['meals']);
    }

    public function test_eating_risk_message_notifies_the_assigned_specialist(): void
    {
        ['id' => $userId] = $this->actor();
        $plan = $this->planFixture($userId);
        $specialist = $this->specialist('بالینی');
        $this->db->table('plan_requests')->where('id', $plan['request'])->update(['assigned_specialist_id' => $specialist]);

        $reply = app(MySqlCoach::class)->accept($userId, 'risk-1', 'فکر می‌کنم اختلال خوردن دارم');

        self::assertStringContainsString('متخصص', $reply['replies'][0]['fallback_text']);
        self::assertNotNull($this->db->table('notifications')->where(['user_id' => $specialist, 'kind' => 'eating_risk'])->first());
    }

    private function specialist(string $credential): string
    {
        $id = $this->actor('specialist')['id'];
        $this->db->table('specialist_profiles')->insert([
            'user_id' => $id,
            'display_name' => 'متخصص تست',
            'credential' => $credential,
            'capacity' => 5,
            'active' => 1,
            'verification_status' => 'verified',
        ]);

        return $id;
    }

    private function profile(string $userId, string $submission): void
    {
        $this->db->table('nutrition_profiles')->insert([
            'user_id' => $userId, 'submission_id' => $submission, 'spec_version' => 1, 'track' => 'weight_loss',
            'goal' => 'weight_loss', 'source' => 'app', 'sex' => 'female', 'age' => 30, 'height_cm' => 165,
            'weight_kg' => 74, 'activity' => 'light', 'bmi' => 27, 'bmr_kcal' => 1400, 'tdee_kcal' => 1900,
            'target_kcal' => 1500, 'protein_g' => 90, 'carbs_g' => 150, 'fat_g' => 50, 'diet_style' => 'regular',
            'meals_per_day' => 3, 'budget' => 'medium', 'allergens' => '[]', 'conditions' => '[]',
            'risk_flags' => '[]', 'safety_tier' => 'ai_ok', 'safety_reasons' => '[]', 'preferences' => '{}',
        ]);
    }
}
