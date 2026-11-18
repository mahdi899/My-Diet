<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Modules\Coach\Infrastructure\ConfiguredCoachModel;
use PHPUnit\Framework\TestCase;
use ReflectionClass;
use ReflectionMethod;

final class CoachScopePromptTest extends TestCase
{
    public function test_live_system_prompt_refuses_unrelated_questions(): void
    {
        $messages = $this->address([
            ['role' => 'system', 'content' => 'مربی تغذیه رژیم من هستی.'],
            ['role' => 'user', 'content' => 'این قالب کنار گذاشته می‌شود'],
        ], 'پایتخت فرانسه کجاست؟');

        $system = (string) $messages[0]['content'];
        self::assertStringContainsString('محدوده گفتگو:', $system);
        self::assertStringContainsString('به محتوای آن جواب نده', $system);
        self::assertSame('پایتخت فرانسه کجاست؟', $messages[1]['content']);
    }

    public function test_scope_rule_is_not_repeated_when_the_stored_prompt_already_has_it(): void
    {
        $stored = "مربی تغذیه.\n\nمحدوده گفتگو: فقط تغذیه.";
        $messages = $this->address([
            ['role' => 'system', 'content' => $stored],
        ], 'سلام');

        self::assertSame(1, substr_count((string) $messages[0]['content'], 'محدوده گفتگو:'));
    }

    public function test_voice_and_catalog_context_reach_the_model(): void
    {
        $messages = $this->address([
            ['role' => 'system', 'content' => 'مربی تغذیه.'],
        ], 'ناهار را عوض کن', 'غذاهای مجاز کاتالوگ برای جایگزین:'."\n".'عدس‌پلو، ۴۲۰ کالری');

        $system = (string) $messages[0]['content'];
        self::assertStringContainsString('لحن گفتگو:', $system);
        self::assertStringContainsString('کلمه «خانواده» را کنار هیچ اسم غذایی ننویس', $system);
        self::assertStringContainsString('عدس‌پلو، ۴۲۰ کالری', $system);
        self::assertSame('ناهار را عوض کن', $messages[1]['content']);
    }

    public function test_reply_text_drops_asterisks_and_the_family_prefix(): void
    {
        $clean = $this->humanize("* خانواده خورش قیمه\n**خانواده برنج** را برای خانواده نگه دار");

        self::assertStringNotContainsString('*', $clean);
        self::assertStringNotContainsString('خانواده خورش', $clean);
        self::assertStringContainsString('خورش قیمه', $clean);
        self::assertStringContainsString('برای خانواده', $clean);
    }

    public function test_stored_prompt_still_gets_colloquial_speech(): void
    {
        $messages = $this->address([
            ['role' => 'system', 'content' => "لحن گفتگو: گرم باش.\nمحدوده گفتگو: فقط تغذیه."],
        ], 'سلام');
        $system = (string) $messages[0]['content'];

        self::assertSame(1, substr_count($system, 'لحن گفتگو:'));
        self::assertStringContainsString('لحن محاوره:', $system);
        self::assertStringContainsString('اگر تونستی، یه کم از همون غذای آشنات استفاده کن', $system);
    }

    public function test_formal_wording_is_rewritten_into_spoken_persian(): void
    {
        $clean = $this->humanize('اگر توانستی، غذای آشنایت را امتحان کن.');

        self::assertStringContainsString('اگر تونستی', $clean);
        self::assertStringContainsString('از غذای آشنات استفاده کن', $clean);
        self::assertStringNotContainsString('توانستی', $clean);
        self::assertStringNotContainsString('امتحان کن', $clean);
    }

    /**
     * @param  list<array{role: string, content: string}>  $messages
     * @return list<array{role: string, content: string}>
     */
    private function address(array $messages, string $userMessage, string $context = ''): array
    {
        $model = (new ReflectionClass(ConfiguredCoachModel::class))->newInstanceWithoutConstructor();
        $method = new ReflectionMethod(ConfiguredCoachModel::class, 'addressUser');

        return $method->invoke($model, $messages, $userMessage, [], $context);
    }

    private function humanize(string $text): string
    {
        $model = (new ReflectionClass(ConfiguredCoachModel::class))->newInstanceWithoutConstructor();
        $method = new ReflectionMethod(ConfiguredCoachModel::class, 'humanize');

        return $method->invoke($model, $text);
    }
}
