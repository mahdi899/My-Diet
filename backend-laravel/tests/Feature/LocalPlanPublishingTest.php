<?php

namespace Tests\Feature;

use App\Modules\Plans\Infrastructure\MySqlPlanGeneration;
use App\Shared\Domain\LegacyCrypto as Crypto;
use Tests\MySqlTestCase;

class LocalPlanPublishingTest extends MySqlTestCase
{
    public function test_local_published_options_can_be_consumed_and_retried(): void
    {
        $user = $this->actor();
        $plan = $this->planFixture($user['id']);
        $this->db->table('plan_days')->where('id', $plan['day'])->update(['day_index' => 5]);
        $this->app['env'] = 'local';
        putenv('SABZINE_NOW=2026-11-19T08:00:00Z');
        try {
            app(MySqlPlanGeneration::class)->publishLocal($plan['request']);
            $option = $this->getJson('/v1/me/plan/day/2026-11-19')->assertOk()->json('meals.0.options.0');
            self::assertTrue($option['approved']);
            $command = ['commandId' => Crypto::uuid(), 'versionId' => $plan['version'], 'mealUid' => $plan['mealUid'],
                'optionId' => $plan['option'], 'date' => '2026-11-19', 'expectedRevision' => 0, 'state' => 'as_planned'];
            $this->postJson('/v1/me/meal-consumption', $command)->assertOk()->assertJsonPath('consumedCalories', 300)->assertJsonPath('revision', 1);
            $this->postJson('/v1/me/meal-consumption', $command)->assertOk()->assertJsonPath('revision', 1);
            $this->getJson('/v1/me/plan/day/2026-11-19')->assertOk()->assertJsonPath('meals.0.eaten', true);
        } finally {
            $this->app['env'] = 'testing';
            putenv('SABZINE_NOW');
        }
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
