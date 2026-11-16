<?php

namespace Tests\Feature;

use App\Modules\Coach\Infrastructure\PreferenceService;
use Illuminate\Database\ConnectionInterface;
use Tests\MySqlTestCase;

final class PreferenceTest extends MySqlTestCase
{
    private string $userId;

    protected function setUp(): void
    {
        parent::setUp();
        ['id' => $this->userId] = $this->actor();
    }

    public function test_record_dislike_stores_preference(): void
    {
        $service = app(PreferenceService::class);
        $service->recordDislike($this->userId, 'عدسی', 'dislike');

        $summary = $service->summary($this->userId);
        self::assertContains('عدسی', $summary['dislikes']);
    }

    public function test_record_like_stores_preference(): void
    {
        $service = app(PreferenceService::class);
        $service->recordLike($this->userId, 'مرغ گریل');

        $summary = $service->summary($this->userId);
        self::assertContains('مرغ گریل', $summary['likes']);
    }

    public function test_record_pattern(): void
    {
        $service = app(PreferenceService::class);
        $service->recordPattern($this->userId, 'quick_cook');

        $summary = $service->summary($this->userId);
        self::assertContains('quick_cook', $summary['patterns']);
    }

    public function test_specialist_note_has_highest_strength(): void
    {
        $service = app(PreferenceService::class);
        $service->recordSpecialistNote($this->userId, 'بیماری کلیوی دارد');

        $row = app(ConnectionInterface::class)
            ->table('coach_preferences')
            ->where('user_id', $this->userId)
            ->where('pref_key', 'specialist_note')
            ->first();

        self::assertNotNull($row);
        self::assertSame(3, (int) $row->strength);
        self::assertSame('specialist', $row->source);
    }

    public function test_deactivate_preference(): void
    {
        $service = app(PreferenceService::class);
        $service->recordDislike($this->userId, 'قارچ');
        $service->deactivate($this->userId, 'food_dislike', 'قارچ');

        $summary = $service->summary($this->userId);
        self::assertNotContains('قارچ', $summary['dislikes']);
    }

    public function test_on_meal_swapped_records_dislike(): void
    {
        $service = app(PreferenceService::class);
        $service->onMealSwapped($this->userId, 'عدسی', 'برنج', 'dislike');

        $summary = $service->summary($this->userId);
        self::assertContains('عدسی', $summary['dislikes']);
        self::assertContains('برنج', $summary['likes']);
    }

    public function test_on_meal_swapped_records_pattern_for_time(): void
    {
        $service = app(PreferenceService::class);
        $service->onMealSwapped($this->userId, 'خورشت قورمه‌سبزی', 'ساندویچ', 'time');

        $summary = $service->summary($this->userId);
        self::assertContains('prefers_quick_meals', $summary['patterns']);
    }

    public function test_cap_at_max_prefs(): void
    {
        $service = app(PreferenceService::class);

        // Insert 30 dislikes (the cap)
        for ($i = 1; $i <= 31; $i++) {
            $service->recordDislike($this->userId, "food_$i", 'dislike');
        }

        $count = app(ConnectionInterface::class)
            ->table('coach_preferences')
            ->where('user_id', $this->userId)
            ->where('pref_key', 'food_dislike')
            ->where('active', true)
            ->count();

        self::assertSame(30, $count);
    }

    public function test_strengthening_existing_preference(): void
    {
        $service = app(PreferenceService::class);

        // Record weak signal first
        $service->recordDislike($this->userId, 'گوجه', 'unavailable');

        $before = app(ConnectionInterface::class)
            ->table('coach_preferences')
            ->where('user_id', $this->userId)
            ->where('value', 'گوجه')
            ->first();

        // Record stronger signal
        $service->recordUserStatement($this->userId, 'food_dislike', 'گوجه');

        $after = app(ConnectionInterface::class)
            ->table('coach_preferences')
            ->where('user_id', $this->userId)
            ->where('value', 'گوجه')
            ->first();

        self::assertGreaterThanOrEqual((int) $before->strength, (int) $after->strength);
    }
}
