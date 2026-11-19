<?php

namespace Tests\Feature;

use App\Modules\Plans\Domain\CivilDates;
use App\Shared\Domain\LegacyCrypto;
use Tests\MySqlTestCase;

final class DoctorActivityTest extends MySqlTestCase
{
    public function test_only_the_assigned_doctor_can_view_completed_historical_days(): void
    {
        $user = $this->actor();
        $date = CivilDates::add(CivilDates::today(), -2);
        $this->db->table('users')->where('id', $user['id'])->update(['created_at' => CivilDates::add($date, -1).' 08:00:00']);
        $plan = $this->planFixture($user['id'], true);
        $this->db->table('plan_days')->where('id', $plan['day'])->update(['civil_date' => $date]);
        $this->db->table('plan_versions')->where('id', $plan['version'])->update(['status' => 'superseded', 'published_at' => $date.' 08:00:00']);
        $alternative = LegacyCrypto::uuid();
        $this->db->table('plan_meal_options')->insert([
            'meal_id' => $plan['meal'], 'option_uid' => $alternative, 'kind' => 'alternative',
            'document' => json_encode(['optionId' => $alternative, 'kind' => 'alternative', 'title' => 'املت', 'calories' => 420]),
        ]);
        $this->db->table('meal_logs')->insert([
            'id' => LegacyCrypto::uuid(), 'user_id' => $user['id'], 'request_id' => $plan['request'],
            'scheduled_date' => $date, 'meal_uid' => $plan['mealUid'], 'eaten' => false,
            'plan_version_id' => $plan['version'], 'plan_meal_id' => $plan['meal'], 'option_uid' => $alternative,
            'details' => json_encode(['state' => 'less', 'consumedCalories' => 250]),
        ]);
        $path = '/v1/specialist/members/'.$user['id'].'/activity';
        $this->actor('specialist');
        $this->getJson($path)->assertNotFound();
        $this->getJson($path.'?date='.$date)->assertNotFound();

        $doctor = $this->actor('specialist');
        $this->db->table('specialist_profiles')->insert(['user_id' => $doctor['id'], 'display_name' => 'پزشک آزمایش']);
        $this->db->table('specialist_members')->insert(['user_id' => $user['id'], 'specialist_id' => $doctor['id']]);
        $this->getJson($path)->assertOk()
            ->assertJsonPath('completedDays', 1)
            ->assertJsonPath("days.$date.recorded", 1);
        $this->getJson('/v1/specialist/members?progress=1')->assertOk()->assertJsonPath('0.completedDays', 1);
        $this->getJson($path.'?date='.$date)->assertOk()
            ->assertJsonCount(2, 'meals.0.options')
            ->assertJsonPath('meals.0.consumed.kind', 'alternative')
            ->assertJsonPath('meals.0.consumed.title', 'املت')
            ->assertJsonPath('consumedKcal', 250);
    }
}
