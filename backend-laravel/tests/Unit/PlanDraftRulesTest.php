<?php

namespace Tests\Unit;

use App\Modules\Plans\Domain\PlanDraftRules;
use App\Shared\Domain\Problem;
use PHPUnit\Framework\TestCase;

class PlanDraftRulesTest extends TestCase
{
    public function test_validation_and_publication_match_actual_node_outputs(): void
    {
        $rules = new PlanDraftRules(json_decode(file_get_contents(__DIR__.'/../../app/Modules/Plans/Infrastructure/resources/option-schema.json'), true));
        foreach (json_decode(file_get_contents(__DIR__.'/../Fixtures/node-plans.json'), false) as $index => $case) {
            try {
                $parsed = $rules->parse($case->input);
                self::assertFalse(isset($case->error), 'Expected error in case '.$index);
                self::assertEquals(json_decode(json_encode($case->parsed), true), $parsed, 'Parsed case '.$index);
            } catch (Problem $problem) {
                self::assertEquals((array) ($case->error ?? null), ['status' => $problem->status, 'code' => $problem->problemCode, 'messageFa' => $problem->messageFa], 'Error case '.$index);

                continue;
            }
            try {
                PlanDraftRules::publishable(array_map(fn ($meals) => ['meals' => $meals], $parsed));
                self::assertNull($case->publishError, 'Publication case '.$index);
            } catch (Problem $problem) {
                self::assertEquals((array) $case->publishError, ['status' => $problem->status, 'code' => $problem->problemCode, 'messageFa' => $problem->messageFa], 'Publication error '.$index);
            }
        }
    }
}
