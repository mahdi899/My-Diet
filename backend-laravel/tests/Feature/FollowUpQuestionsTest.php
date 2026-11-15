<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Modules\Coach\Application\FollowUpQuestions;
use Tests\MySqlTestCase;

final class FollowUpQuestionsTest extends MySqlTestCase
{
    public function test_missing_profile_asks_for_onboarding(): void
    {
        ['id' => $userId] = $this->actor();
        $questions = app(FollowUpQuestions::class)->forUser($userId);

        self::assertSame('profile', $questions[0]['key']);
    }

    public function test_profile_without_region_asks_about_city_food(): void
    {
        ['id' => $userId] = $this->actor();
        $submission = \App\Shared\Domain\LegacyCrypto::uuid();
        $this->db->table('questionnaire_submissions')->insert([
            'id' => $submission, 'user_id' => $userId, 'schema_version' => 1, 'answers' => '{}', 'risk_flags' => '[]',
        ]);
        $this->db->table('nutrition_profiles')->insert([
            'user_id' => $userId, 'submission_id' => $submission, 'spec_version' => 1, 'track' => 'weight_loss',
            'goal' => 'weight_loss', 'source' => 'app', 'sex' => 'female', 'age' => 30, 'height_cm' => 165,
            'weight_kg' => 70, 'activity' => 'light', 'bmi' => 25, 'bmr_kcal' => 1400, 'tdee_kcal' => 1800,
            'target_kcal' => 1500, 'protein_g' => 90, 'carbs_g' => 140, 'fat_g' => 50, 'diet_style' => 'regular',
            'meals_per_day' => 3, 'budget' => 'medium', 'region' => null, 'allergens' => '[]', 'conditions' => '[]',
            'risk_flags' => '[]', 'safety_tier' => 'ai_ok', 'safety_reasons' => '[]', 'preferences' => '{}',
        ]);

        $keys = array_column(app(FollowUpQuestions::class)->forUser($userId), 'key');
        self::assertContains('region', $keys);
        self::assertNotContains('safety', $keys);
    }
}
