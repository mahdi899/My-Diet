<?php

namespace Tests\Feature;

use App\Modules\Plans\Domain\CivilDates;
use App\Modules\Plans\Infrastructure\MySqlPlanGeneration;
use App\Shared\Domain\LegacyCrypto as Crypto;
use Tests\MySqlTestCase;

class LocalPlanPublishingTest extends MySqlTestCase
{
    public function test_local_published_options_can_be_consumed_and_retried(): void
    {
        $date = CivilDates::today();
        $user = $this->actor();
        $plan = $this->planFixture($user['id']);
        $dayIndex = (new \DateTimeImmutable(CivilDates::saturday($date)))->diff(new \DateTimeImmutable($date))->days;
        $this->db->table('plan_days')->where('id', $plan['day'])->update(['day_index' => $dayIndex]);
        $this->app['env'] = 'local';
        try {
            app(MySqlPlanGeneration::class)->publishLocal($plan['request']);
            $option = $this->getJson('/v1/me/plan/day/'.$date)->assertOk()->json('meals.0.options.0');
            self::assertTrue($option['approved']);
            $command = ['commandId' => Crypto::uuid(), 'versionId' => $plan['version'], 'mealUid' => $plan['mealUid'],
                'optionId' => $plan['option'], 'date' => $date, 'expectedRevision' => 0, 'state' => 'as_planned'];
            $this->postJson('/v1/me/meal-consumption', $command)->assertOk()->assertJsonPath('consumedCalories', 300)->assertJsonPath('revision', 1);
            $this->postJson('/v1/me/meal-consumption', $command)->assertOk()->assertJsonPath('revision', 1);
            $this->getJson('/v1/me/plan/day/'.$date)->assertOk()->assertJsonPath('meals.0.eaten', true);
        } finally {
            $this->app['env'] = 'testing';
        }
    }

    public function test_local_publish_waits_for_the_doctor_when_the_profile_is_high_risk(): void
    {
        $user = $this->actor();
        $plan = $this->planFixture($user['id']);
        $this->db->table('nutrition_profiles')->insert([
            'user_id' => $user['id'], 'submission_id' => $plan['submission'], 'spec_version' => 2, 'track' => 'weight_loss',
            'goal' => 'weight_loss', 'source' => 'app', 'sex' => 'female', 'age' => 35, 'height_cm' => 165,
            'weight_kg' => 54, 'activity' => 'moderate', 'bmi' => 19.8, 'bmr_kcal' => 1235, 'tdee_kcal' => 2013,
            'target_kcal' => 1740, 'protein_g' => 81, 'carbs_g' => 237, 'fat_g' => 52, 'diet_style' => 'omnivore',
            'meals_per_day' => 3, 'budget' => 'low', 'allergens' => '[]', 'conditions' => '[]',
            'risk_flags' => '["target_bmi_low"]', 'safety_tier' => 'doctor_only', 'safety_reasons' => '["target_bmi_low"]', 'preferences' => '{}',
        ]);
        $this->app['env'] = 'local';
        try {
            app(MySqlPlanGeneration::class)->publishLocal($plan['request']);
        } finally {
            $this->app['env'] = 'testing';
        }
        self::assertSame('draft', $this->db->table('plan_versions')->where('id', $plan['version'])->value('status'));
        self::assertSame('', $this->getJson('/v1/me/plan')->assertOk()->getContent());
    }

    public function test_auto_publish_leaves_drafts_unapproved_outside_local(): void
    {
        $user = $this->actor();
        $plan = $this->planFixture($user['id']);
        app(MySqlPlanGeneration::class)->publishLocal($plan['request']);
        self::assertSame('draft', $this->db->table('plan_versions')->where('id', $plan['version'])->value('status'));
        self::assertNull($this->db->table('plan_meal_options')->where('option_uid', $plan['option'])->value('approved_by'));
    }
}
