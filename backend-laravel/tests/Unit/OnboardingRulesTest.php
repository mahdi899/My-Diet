<?php

namespace Tests\Unit;

use App\Modules\Onboarding\Domain\AnswerMapping;
use App\Modules\Onboarding\Domain\OnboardingRules;
use App\Modules\Onboarding\Domain\EnergyEngine;
use App\Modules\Questionnaire\Domain\QuestionnaireRules;
use PHPUnit\Framework\TestCase;

final class OnboardingRulesTest extends TestCase
{
    public function test_all_intake_legacy_and_energy_vectors_match_actual_node_outputs(): void
    {
        $root = __DIR__.'/../../';
        $rules = new OnboardingRules(json_decode(file_get_contents($root.'app/Modules/Onboarding/Infrastructure/resources/spec.json'),true));
        $mapping = new AnswerMapping($rules);
        $questionnaires = new QuestionnaireRules(json_decode(file_get_contents($root.'app/Modules/Questionnaire/Infrastructure/resources/schema.json'),true));
        $vectors = json_decode(file_get_contents(__DIR__.'/../Fixtures/node-onboarding.json'),true);
        foreach ($vectors['canonical'] as $index=>$case) {
            self::assertEquals($case['missing'],$rules->missing($case['track'],$case['answers']),'Missing '.$index);
            $submission = $mapping->submission($case['track'],$case['answers']);
            self::assertEquals($case['submission'],$submission,'Submission '.$index);
            self::assertEquals($case['validated'],$questionnaires->validate($submission),'Validated '.$index);
            $preferences = AnswerMapping::preferences($case['track'],$case['answers']);
            self::assertEquals($case['preferences'],$preferences);
            self::assertEquals($case['facts'],$rules->facts($case['track'],$case['answers']));
            self::assertEquals($case['profile'],OnboardingRules::profile($case['track'],$case['validated']['answers'],$case['validated']['riskFlags'],$preferences,$case['answers']),'Profile '.$index);
        }
        foreach ($vectors['legacy'] as $index=>$case) {
            self::assertEquals($case['result'],json_decode(json_encode($mapping->legacy('weight_loss',$case['items']),JSON_THROW_ON_ERROR),true),'Legacy '.$index);
        }
        foreach ($vectors['energy'] as $index=>$case) {
            self::assertEquals($case['result'],EnergyEngine::energy($case['input']),'Energy '.$index);
            self::assertEquals($case['safety'],EnergyEngine::safety($case['safetyInput']));
            self::assertEquals($case['slots'],EnergyEngine::slots($case['result']['targetKcal'],4,5));
        }
    }
}
