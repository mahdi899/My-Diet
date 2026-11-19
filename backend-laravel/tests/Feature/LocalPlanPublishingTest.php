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

    public function test_auto_publish_leaves_drafts_unapproved_outside_local(): void
    {
        $user = $this->actor();
        $plan = $this->planFixture($user['id']);
        app(MySqlPlanGeneration::class)->publishLocal($plan['request']);
        self::assertSame('draft', $this->db->table('plan_versions')->where('id', $plan['version'])->value('status'));
        self::assertNull($this->db->table('plan_meal_options')->where('option_uid', $plan['option'])->value('approved_by'));
    }
}
