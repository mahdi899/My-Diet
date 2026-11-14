<?php

namespace Tests\Feature;

use Tests\MySqlTestCase;

final class PlanQuestionsContractTest extends MySqlTestCase
{
    public function test_question_answer_acknowledgement_and_withdrawal_are_encrypted_and_authorized(): void
    {
        $user = $this->actor();
        $plan = $this->planFixture($user['id']);
        $specialist = $this->actor('specialist');
        $this->db->table('specialist_profiles')->insert(['user_id' => $specialist['id'], 'display_name' => 'متخصص آزمایش']);
        $this->db->table('plan_requests')->where('id', $plan['request'])->update(['assigned_specialist_id' => $specialist['id']]);
        $question = $this->postJson('/v1/specialist/requests/'.$plan['request'].'/questions', ['prompt' => 'پرسش خصوصی آزمایشی', 'required' => true])->assertCreated()->assertJsonPath('status', 'awaiting_user')->json('id');
        self::assertStringStartsWith('enc1:', $this->db->table('info_questions')->where('id', $question)->value('prompt'));
        $this->postJson('/v1/specialist/info-questions/'.$question.'/acknowledge')->assertStatus(409)->assertJsonPath('code', 'not_answered');
        $this->withToken($user['token']);
        $this->getJson('/v1/me/info-questions')->assertOk()->assertJsonPath('0.prompt', 'پرسش خصوصی آزمایشی');
        $this->postJson('/v1/me/info-questions/'.$question.'/answers', ['body' => 'پاسخ محرمانهٔ آزمایشی'])->assertCreated()->assertJsonPath('status', 'answered');
        $this->postJson('/v1/me/info-questions/'.$question.'/answers', ['body' => 'تکمیل پاسخ'])->assertCreated();
        self::assertStringStartsWith('enc1:', $this->db->table('info_answers')->where('question_id', $question)->value('body'));
        self::assertSame('response_received', $this->db->table('plan_requests')->where('id', $plan['request'])->value('status'));
        $this->getJson('/v1/me/request')->assertOk()->assertJsonCount(2, 'questions.0.answers');
        $other = $this->actor('specialist');
        $this->db->table('specialist_profiles')->insert(['user_id'=>$other['id'],'display_name'=>'متخصص دیگر']);
        $this->postJson('/v1/specialist/info-questions/'.$question.'/acknowledge')->assertNotFound();
        $this->withToken($specialist['token']);
        $this->postJson('/v1/specialist/info-questions/'.$question.'/acknowledge')->assertCreated();
        self::assertSame('in_review', $this->db->table('plan_requests')->where('id', $plan['request'])->value('status'));
        $this->withToken($user['token']);
        $this->postJson('/v1/me/info-questions/'.$question.'/answers', ['body' => 'پاسخ دیرهنگام'])->assertStatus(409)->assertJsonPath('code', 'already_answered');
        $this->withToken($specialist['token']);
        $next = $this->postJson('/v1/specialist/requests/'.$plan['request'].'/questions', ['prompt' => 'سؤال قابل پس گرفتن'])->assertCreated()->json('id');
        $this->postJson('/v1/specialist/info-questions/'.$next.'/withdraw', ['reason' => 'نیازی به پاسخ نیست'])->assertCreated()->assertJsonPath('status', 'withdrawn');
        self::assertSame('in_review', $this->db->table('plan_requests')->where('id', $plan['request'])->value('status'));
        $this->postJson('/v1/specialist/info-questions/'.$next.'/withdraw', ['reason' => 'تکرار'])->assertStatus(409);
        self::assertSame(4, $this->db->table('notifications')->whereIn('user_id',[$user['id'], $specialist['id']])->count());
    }
}
