<?php
namespace Tests\Unit;

use App\Modules\Coach\Application\CoachIntentParser;
use PHPUnit\Framework\TestCase;

final class CoachIntentTest extends TestCase {
    private CoachIntentParser $parser;

    protected function setUp(): void { parent::setUp(); $this->parser = new CoachIntentParser(); }

    public function test_swap_intent(): void { $r = $this->parser->parse('دوست ندارم'); self::assertSame('swap_meal', $r['intent']); }

    public function test_log_weight(): void { $r = $this->parser->parse('وزنم 72 کیلو شد'); self::assertSame('log_weight', $r['intent']); self::assertEquals(72.0, $r['params']['weight']); }

    public function test_plan_today(): void { $r = $this->parser->parse('برنامه امروز چیه'); self::assertSame('show_plan', $r['intent']); }

    public function test_fallback(): void { $r = $this->parser->parse('سلام'); self::assertSame('general_question', $r['intent']); }
}