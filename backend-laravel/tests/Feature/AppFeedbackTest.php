<?php

namespace Tests\Feature;

use Tests\MySqlTestCase;

final class AppFeedbackTest extends MySqlTestCase
{
    public function test_app_feedback_round_trips_and_only_the_public_text_enters_moderation(): void
    {
        $user = $this->actor();
        $plan = $this->planFixture($user['id'], true);
        $body = $this->feedback($plan);
        $this->putJson('/v1/me/weekly-feedback', $body)->assertOk()->assertJsonPath('details.difficult.0', $plan['option']);
        $this->getJson('/v1/me/weekly-feedback?weekStart=2026-11-14')->assertOk()
            ->assertJsonPath('comment', 'یادداشت خصوصی')->assertJsonPath('publicText', '')->assertJsonPath('details.service', 'good');
        self::assertSame(0, $this->db->table('program_reviews')->where('user_id', $user['id'])->count());
        $body['publishPermission'] = true;
        $body['publicText'] = 'نظر عمومی';
        $this->putJson('/v1/me/weekly-feedback', $body)->assertOk()->assertJsonPath('revision', 2);
        $this->putJson('/v1/me/weekly-feedback', $body)->assertOk()->assertJsonPath('revision', 2);
        $review = $this->db->table('program_reviews')->where('user_id', $user['id'])->sole();
        self::assertSame('نظر عمومی', $review->body);
        self::assertSame('pending', $review->status);
        $this->getJson('/v1/me/weekly-feedback?weekStart=2026-11-14')->assertOk()->assertJsonPath('comment', 'یادداشت خصوصی');
        $this->actor();
        $this->getJson('/v1/me/weekly-feedback?weekStart=2026-11-14')->assertNotFound();
        $this->putJson('/v1/me/weekly-feedback', $body)->assertNotFound();
    }

    public function test_invalid_public_consent_cannot_save_or_publish_private_responses(): void
    {
        $user = $this->actor();
        $plan = $this->planFixture($user['id'], true);
        $body = $this->feedback($plan);
        $body['publishPermission'] = true;
        $this->putJson('/v1/me/weekly-feedback', $body)->assertStatus(400);
        $body['publicText'] = 'نظر عمومی';
        $body['serviceRating'] = null;
        $this->putJson('/v1/me/weekly-feedback', $body)->assertStatus(400);
        self::assertSame(0, $this->db->table('weekly_feedback')->where('user_id', $user['id'])->count());
    }

    private function feedback(array $plan): array
    {
        return [
            'weekStart' => '2026-11-14', 'favorites' => [$plan['option']], 'dislikes' => [],
            'preparationDifficulty' => 'hard', 'ingredientAvailability' => 'available',
            'affordability' => 'affordable', 'portionSatisfaction' => 'right', 'serviceRating' => 4,
            'comment' => 'یادداشت خصوصی', 'publishPermission' => false, 'publicText' => '',
            'details' => [
                'requestId' => $plan['request'], 'planVersion' => 1, 'week' => '2026-11-14',
                'at' => '2026-11-20T12:00:00', 'meals' => [['id' => $plan['option'], 'title' => 'عدسی']],
                'favorite' => [$plan['option']], 'disliked' => [], 'difficult' => [$plan['option']],
                'availability' => 'easy', 'budget' => 'comfortable', 'portion' => 'suitable', 'service' => 'good',
            ],
        ];
    }
}
