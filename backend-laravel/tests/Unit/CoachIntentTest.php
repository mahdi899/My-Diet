<?php

namespace Tests\Unit;

use App\Modules\Coach\Application\CoachIntentParser;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class CoachIntentTest extends TestCase
{
    private CoachIntentParser $parser;

    protected function setUp(): void
    {
        parent::setUp();
        $this->parser = new CoachIntentParser;
    }

    #[DataProvider('phrases')]
    public function test_phrase(string $text, string $intent, array $params = []): void
    {
        $parsed = $this->parser->parse($text);
        self::assertSame($intent, $parsed['intent'], $text);
        if ($intent === 'check_progress') {
            self::assertLessThan(0.8, $parsed['confidence']);
        }
        foreach ($params as $key => $value) {
            self::assertEquals($value, $parsed['params'][$key] ?? null, $text.' '.$key);
        }
    }

    public static function phrases(): array
    {
        return [
            'lunch today' => ['ناهار امروزم چیه', 'show_plan', ['day' => 'today', 'meal' => 'lunch']],
            'dinner tomorrow' => ['شام فردا چیه', 'show_plan', ['day' => 'tomorrow', 'meal' => 'dinner']],
            'week plan' => ['برنامه این هفته رو نشون بده', 'show_plan', ['day' => 'week']],
            'next week is not this week' => ['برنامه هفته بعد', 'refer_plan'],
            'food calories' => ['آلبالوپلو چند کالری داره', 'show_food'],
            'unnamed food' => ['این غذا چند کالری داره', 'show_food', ['food' => null]],
            'log weight digits' => ['وزنم ۷۵ کیلو', 'log_weight', ['weight' => 75.0]],
            'log weight words' => ['وزنم 72 کیلو شد', 'log_weight', ['weight' => 72.0]],
            'weight loss is not a new weight' => ['چند کیلو کم کردم', 'check_progress'],
            'previous weight' => ['وزن قبلیم چند بود', 'show_weight'],
            'ate lunch' => ['ناهارم را خوردم', 'log_consumption', ['meal' => 'lunch']],
            'ate without a meal' => ['خوردم', 'log_consumption', ['meal' => null]],
            'calories today' => ['امروز چقدر کالری خوردم', 'show_intake'],
            'protein today' => ['چقدر پروتئین مصرف کردم', 'show_intake', ['nutrient' => 'protein']],
            'two glasses' => ['دو لیوان آب خوردم', 'log_water', ['ml' => 500]],
            'water question' => ['آب امروز چقدر است', 'show_water'],
            'boiled is not water' => ['مرغ آب‌پز چند کالری داره', 'show_food'],
            'quota' => ['چقدر اعتبار چت دارم', 'show_quota'],
            'subscription' => ['چند روز از اشتراکم مونده', 'show_subscription'],
            'recipe' => ['دستور پخت قیمه چیه', 'show_recipe'],
            'shopping' => ['لیست خرید این هفته رو بده', 'show_shopping'],
            'dislike is memory' => ['دوست ندارم قارچ', 'remember'],
            'swap is explicit' => ['ناهار را عوض کن', 'swap_meal', ['meal' => 'lunch']],
            'hello' => ['سلام', 'general_question'],
            'plateau' => ['حس میکنم هر کاری میکنم لاغر نمیشم', 'check_progress'],
        ];
    }
}
