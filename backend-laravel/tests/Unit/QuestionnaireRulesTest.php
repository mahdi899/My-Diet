<?php

namespace Tests\Unit;

use App\Modules\Questionnaire\Domain\QuestionnaireRules;
use App\Shared\Domain\Problem;
use PHPUnit\Framework\TestCase;

final class QuestionnaireRulesTest extends TestCase
{
    public function test_validation_matches_node_for_all_exported_cases(): void
    {
        $rules = new QuestionnaireRules(json_decode(file_get_contents(__DIR__.'/../../app/Modules/Questionnaire/Infrastructure/resources/schema.json'), true));
        $vectors = json_decode(file_get_contents(__DIR__.'/../Fixtures/node-questionnaire.json'), true);
        foreach ($vectors as $index => $vector) {
            try {
                $actual = $rules->validate($vector['input']);
                self::assertArrayHasKey('result', $vector, 'Unexpected success in case '.$index);
                self::assertEquals($vector['result'], $actual, 'Case '.$index);
            } catch (Problem $error) {
                self::assertArrayHasKey('error', $vector, 'Unexpected failure in case '.$index.': '.$error->messageFa);
                self::assertSame($vector['error']['messageFa'], $error->messageFa, 'Case '.$index);
                self::assertSame($vector['error']['code'], $error->problemCode);
            }
        }
    }

    public function test_schema_compatibility_and_pregnancy_freshness_rules(): void
    {
        $rules = new QuestionnaireRules(json_decode(file_get_contents(__DIR__.'/../../app/Modules/Questionnaire/Infrastructure/resources/schema.json'), true));
        self::assertSame([], $rules->compatibility($rules->builtin['questions']));
        self::assertNotEmpty($rules->compatibility([]));
        self::assertSame(17, QuestionnaireRules::week(['lifeStage' => 'pregnant', 'pregnancyWeek' => 15], '2026-10-01', '2026-10-15'));
        self::assertNull(QuestionnaireRules::week(['lifeStage' => 'none'], null, '2026-10-15'));
    }
}
