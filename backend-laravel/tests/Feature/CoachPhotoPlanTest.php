<?php

namespace Tests\Feature;

use App\Modules\Coach\Application\CoachGateway;
use App\Modules\Coach\Application\CoachModel;
use App\Modules\Coach\Infrastructure\CoachThreads;
use App\Modules\Plans\Domain\CivilDates;
use App\Shared\Domain\LegacyCrypto as Crypto;
use Tests\MySqlTestCase;

class CoachPhotoPlanTest extends MySqlTestCase
{
    public function test_photo_explains_food_then_adds_to_plan_only_after_explicit_consent_once(): void
    {
        [$user, $plan] = $this->ready();
        $photo = $this->photo();
        self::assertStringContainsString('خوراک آزمایشی عکس', $photo['messages'][0]['fallback_text']);
        self::assertStringContainsString('می‌خوای', $photo['messages'][0]['fallback_text']);
        self::assertSame('quick_replies', $photo['messages'][0]['type']);
        self::assertSame(0, $this->db->table('meal_swap_logs')->where('user_id', $user)->count());
        self::assertSame(0, $this->db->table('meal_logs')->where('user_id', $user)->count());
        $thread = $photo['threadId'];
        $command = ['threadId' => $thread, 'clientMessageId' => Crypto::uuid(), 'action' => 'confirm_photo_plan', 'args' => ['entryId' => $photo['entryId']]];
        $this->postJson('/v1/me/coach/actions', $command)->assertOk()->assertJsonPath('messages.0.payload.planChanged', true);
        $this->postJson('/v1/me/coach/actions', $command)->assertOk();
        $this->postJson('/v1/me/coach/actions', [...$command, 'clientMessageId' => Crypto::uuid()])->assertOk();
        self::assertSame(1, $this->db->table('meal_swap_logs')->where('meal_id', $plan['meal'])->count());
        self::assertSame('suggested', $this->db->table('coach_food_entries')->where('id', $photo['entryId'])->value('status'));
        self::assertSame(0, $this->db->table('meal_logs')->where('user_id', $user)->count());
        $this->getJson('/v1/me/plan/day/'.CivilDates::today())->assertOk()
            ->assertJsonPath('meals.0.title', 'خوراک آزمایشی عکس')->assertJsonPath('meals.0.calories', 300)
            ->assertJsonPath('meals.0.selectedOption.ingredients.0.quantity', 100);
    }

    public function test_typed_yes_and_no_apply_only_to_the_pending_photo_in_that_thread(): void
    {
        [$user] = $this->ready();
        $photo = $this->photo();
        $thread = $photo['threadId'];
        $other = app(CoachThreads::class)->create($user)['id'];
        app(CoachGateway::class)->accept($user, Crypto::uuid(), 'بله', null, $other);
        self::assertSame(0, $this->db->table('meal_swap_logs')->where('user_id', $user)->count());
        $result = app(CoachGateway::class)->accept($user, Crypto::uuid(), 'نه', null, $thread);
        self::assertStringContainsString('اضافه نکردم', $result['replies'][0]['fallback_text']);
        app(CoachGateway::class)->accept($user, Crypto::uuid(), 'بله', null, $thread);
        self::assertSame(0, $this->db->table('meal_swap_logs')->where('user_id', $user)->count());
        $photo = $this->photo($thread);
        $result = app(CoachGateway::class)->accept($user, Crypto::uuid(), 'بله', null, $thread);
        self::assertTrue($result['replies'][0]['payload']['planChanged']);
        self::assertSame(1, $this->db->table('meal_swap_logs')->where('user_id', $user)->count());
    }

    public function test_confirmation_rechecks_allergies_and_cannot_cross_accounts(): void
    {
        [$user] = $this->ready();
        $photo = $this->photo();
        $thread = $photo['threadId'];
        $this->db->table('nutrition_profiles')->where('user_id', $user)->update(['allergens' => '["milk"]']);
        $this->db->table('food_catalog')->where('slug', 'photo-plan-test')->update(['allergens' => '["milk"]']);
        $reply = app(CoachGateway::class)->accept($user, Crypto::uuid(), 'بله', null, $thread);
        self::assertStringContainsString('سازگار نیست', $reply['replies'][0]['fallback_text']);
        self::assertSame(0, $this->db->table('meal_swap_logs')->where('user_id', $user)->count());
        $this->actor();
        $this->postJson('/v1/me/coach/actions', ['clientMessageId' => Crypto::uuid(), 'action' => 'confirm_photo_plan', 'args' => ['entryId' => $photo['entryId']]])->assertNotFound();
    }

    public function test_changed_plan_requires_another_yes_and_unknown_or_high_risk_food_is_not_offered(): void
    {
        [$user, $plan] = $this->ready();
        $photo = $this->photo();
        $thread = $photo['threadId'];
        $this->db->table('meal_swap_logs')->insert(['id' => Crypto::uuid(), 'user_id' => $user, 'meal_id' => $plan['meal'], 'old_title' => 'عدسی', 'new_food_slug' => 'photo-plan-test', 'new_title' => 'برنامه اصلاح‌شده', 'new_kcal' => 360, 'reason' => 'variety']);
        $reply = app(CoachGateway::class)->accept($user, Crypto::uuid(), 'بله', null, $thread);
        self::assertSame('quick_replies', $reply['replies'][0]['type']);
        self::assertStringContainsString('تغییر کرده', $reply['replies'][0]['fallback_text']);
        self::assertSame(1, $this->db->table('meal_swap_logs')->where('user_id', $user)->count());
        app(CoachGateway::class)->accept($user, Crypto::uuid(), 'بله', null, $thread);
        self::assertSame(2, $this->db->table('meal_swap_logs')->where('user_id', $user)->count());
        $this->db->table('nutrition_profiles')->where('user_id', $user)->update(['safety_tier' => 'doctor_only']);
        self::assertSame('unavailable', $this->photo($thread)['messages'][0]['payload']['planDecision']);
        $this->db->table('nutrition_profiles')->where('user_id', $user)->update(['safety_tier' => 'ai_ok']);
        $this->db->table('food_catalog')->where('slug', 'photo-plan-test')->update(['active' => 0]);
        self::assertSame('unavailable', $this->photo($thread)['messages'][0]['payload']['planDecision']);
    }

    public function test_comparison_uses_the_selected_alternative_and_its_macros(): void
    {
        [$user, $plan] = $this->ready(withAlternative: true);
        $this->db->table('meal_selections')->insert([
            'user_id' => $user, 'civil_date' => CivilDates::today(), 'meal_uid' => $plan['mealUid'], 'version_id' => $plan['version'], 'meal_id' => $plan['meal'], 'option_uid' => $plan['alternative'],
        ]);
        $photo = $this->photo();
        $proposal = $photo['messages'][0]['payload']['planProposal'];
        self::assertSame('جایگزین انتخاب‌شده', $proposal['oldTitle']);
        self::assertSame(450, $proposal['kcal']);
        self::assertSame(1.5, $proposal['items'][0]['servings']);
        $this->db->table('food_catalog')->where('slug', 'photo-plan-test')->update(['protein_g' => 1]);
        $reply = app(CoachGateway::class)->accept($user, Crypto::uuid(), 'بله', null, $photo['threadId']);
        self::assertStringContainsString('پروتئین', $reply['replies'][0]['fallback_text']);
        self::assertSame(0, $this->db->table('meal_swap_logs')->where('user_id', $user)->count());
    }

    private function photo(?string $thread = null): array
    {
        $result = $this->postJson('/v1/me/coach/food-photos', [
            'threadId' => $thread, 'clientMessageId' => Crypto::uuid(), 'mime' => 'image/png', 'mealType' => 'lunch',
            'image' => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        ])->assertOk()->json();

        return [...$result, 'threadId' => $this->db->table('coach_food_entries')->where('id', $result['entryId'])->value('thread_id')];
    }

    private function ready(bool $withAlternative = false): array
    {
        ['id' => $user] = $this->actor();
        $plan = $this->planFixture($user);
        if ($withAlternative) {
            $plan['alternative'] = Crypto::uuid();
            $this->db->table('plan_meal_options')->insert([
                'meal_id' => $plan['meal'], 'option_uid' => $plan['alternative'], 'kind' => 'specialist_alternative',
                'document' => json_encode(['optionId' => $plan['alternative'], 'kind' => 'specialist_alternative', 'title' => 'جایگزین انتخاب‌شده', 'calories' => 450, 'nutrition' => ['proteinG' => 22.5, 'carbsG' => 60, 'fatG' => 13.5]], JSON_UNESCAPED_UNICODE),
            ]);
        }
        $this->db->table('plan_requests')->where('id', $plan['request'])->update(['status' => 'published', 'week_start' => CivilDates::saturday(CivilDates::today()), 'effective_from' => CivilDates::today()]);
        $this->db->table('plan_days')->where('id', $plan['day'])->update(['civil_date' => CivilDates::today()]);
        $this->db->table('plan_versions')->where('id', $plan['version'])->update(['status' => 'published', 'published_at' => '2026-11-14 00:00:00']);
        $this->db->table('active_plan_versions')->insert(['user_id' => $user, 'version_id' => $plan['version']]);
        $this->db->table('nutrition_profiles')->insert([
            'user_id' => $user, 'submission_id' => $plan['submission'], 'spec_version' => 1, 'track' => 'weight_loss',
            'goal' => 'weight_loss', 'source' => 'app', 'sex' => 'female', 'age' => 30, 'height_cm' => 165,
            'weight_kg' => 74, 'activity' => 'light', 'bmi' => 27, 'bmr_kcal' => 1400, 'tdee_kcal' => 1900,
            'target_kcal' => 1500, 'protein_g' => 90, 'carbs_g' => 150, 'fat_g' => 50, 'diet_style' => 'regular',
            'meals_per_day' => 3, 'budget' => 'medium', 'allergens' => '[]', 'conditions' => '[]',
            'risk_flags' => '[]', 'safety_tier' => 'ai_ok', 'safety_reasons' => '[]', 'preferences' => '{}',
        ]);
        $this->db->table('food_catalog')->insert([
            'id' => Crypto::uuid(), 'slug' => 'photo-plan-test', 'name_fa' => 'خوراک آزمایشی عکس', 'category' => 'main',
            'meal_types' => '["lunch"]', 'serving_label' => 'یک کاسه', 'kcal' => 300, 'protein_g' => 15, 'carbs_g' => 40, 'fat_g' => 9,
            'allergens' => '[]', 'tags' => '[]', 'regions' => '[]', 'seasons' => '[]', 'ingredients' => '[{"name":"عدس","quantity":100,"unit":"g"}]', 'active' => 1,
        ]);
        $model = \Mockery::mock(CoachModel::class);
        $model->shouldReceive('analyzePhoto')->andReturn(['foods' => [['name' => 'خوراک آزمایشی عکس', 'kcal' => 350, 'servingLabel' => 'یک کاسهٔ تقریبی']], 'confidence' => .9, 'questions' => [], 'tokensIn' => 1, 'tokensOut' => 1, 'costMicros' => 0]);
        $model->shouldReceive('reply')->andReturn(['text' => 'پاسخ آزمایشی', 'tokensIn' => 1, 'tokensOut' => 1, 'costMicros' => 0]);
        $this->app->instance(CoachModel::class, $model);

        return [$user, $plan];
    }
}
