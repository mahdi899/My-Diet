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

    /**
     * @param  list<array{role: string, content: string}>  $messages
     * @return list<array{role: string, content: string}>
     */
    private function address(array $messages, string $userMessage): array
    {
        $model = (new ReflectionClass(ConfiguredCoachModel::class))->newInstanceWithoutConstructor();
        $method = new ReflectionMethod(ConfiguredCoachModel::class, 'addressUser');

        return $method->invoke($model, $messages, $userMessage, []);
    }
}
