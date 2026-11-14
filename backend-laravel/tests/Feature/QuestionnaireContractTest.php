<?php

namespace Tests\Feature;

use Illuminate\Database\QueryException;
use Tests\MySqlTestCase;

final class QuestionnaireContractTest extends MySqlTestCase
{
    private function answers(): array
    {
        return json_decode(file_get_contents(__DIR__.'/../Fixtures/node-questionnaire.json'), true)[0]['input'];
    }

    public function test_public_schema_draft_submission_current_and_acquisition_flow(): void
    {
        $this->getJson('/v1/questionnaire/schema')->assertOk()->assertJsonPath('version', 1);
        $actor = $this->actor();
        $draft = $this->getJson('/v1/me/questionnaire')->assertOk();
        self::assertEquals((object) ['schemaVersion' => 1, 'answers' => (object) [], 'updatedAt' => null], json_decode($draft->getContent()));
        $this->getJson('/v1/me/acquisition-state')->assertOk()->assertJsonPath('questionnaire', 'missing')->assertJsonPath('nextStep', 'questionnaire');
        $answers = [...$this->answers(), 'healthDetails' => 'اطلاعات محرمانهٔ آزمایشی'];
        $this->putJson('/v1/me/questionnaire', $answers)->assertOk()->assertExactJson(['ok' => true]);
        $stored = json_decode($this->db->table('questionnaire_drafts')->where('user_id', $actor['id'])->value('answers'), true);
        self::assertStringStartsWith('enc1:', $stored['healthDetails']);
        $this->getJson('/v1/me/questionnaire')->assertOk()->assertJsonPath('answers.healthDetails', $answers['healthDetails']);
        $submitted = $this->postJson('/v1/me/questionnaire/submissions', $answers)->assertCreated()->json();
        $this->getJson('/v1/me/questionnaire/current')->assertOk()->assertJsonPath('submission.id', $submitted['id'])
            ->assertJsonPath('submission.answers.healthDetails', $answers['healthDetails'])->assertJsonPath('submission.valid', true);
        $this->getJson('/v1/me/acquisition-state')->assertOk()->assertJsonPath('questionnaire', 'complete')->assertJsonPath('nextStep', 'select_service');
        self::assertSame($answers['name'], $this->db->table('users')->where('id', $actor['id'])->value('display_name'));
        $this->expectException(QueryException::class);
        $this->db->table('questionnaire_submissions')->where('id', $submitted['id'])->update(['answers' => '{}']);
    }

    public function test_admin_publishes_custom_required_questions_and_customer_must_answer_them(): void
    {
        $admin = $this->actor('admin');
        $questions = json_decode(file_get_contents(app_path('Modules/Questionnaire/Infrastructure/resources/schema.json')), true)['questions'];
        $questions[] = ['id' => 'custom_schedule', 'kind' => 'text', 'title' => 'زمان مناسب', 'required' => true];
        $this->postJson('/v1/admin/questionnaire/compatibility', ['questions' => $questions])->assertCreated()->assertExactJson(['errors' => []]);
        $version = $this->postJson('/v1/admin/questionnaire/schemas', ['questions' => $questions])->assertCreated()->json('version');
        $this->postJson('/v1/admin/questionnaire/schemas/'.$version.'/publish')->assertCreated()->assertExactJson(['version' => $version, 'status' => 'published']);
        $this->getJson('/v1/admin/questionnaire/schemas')->assertOk()->assertJsonCount(2);
        self::assertSame(2, $this->db->table('audit_logs')->where('actor_id', $admin['id'])->count());
        $this->actor();
        $this->postJson('/v1/me/questionnaire/submissions', $this->answers())->assertStatus(400)->assertJsonPath('messageFa', 'پرسشنامه کامل نیست');
        $this->postJson('/v1/me/questionnaire/submissions', [...$this->answers(), 'custom_schedule' => 'عصر'])->assertCreated();
        $this->getJson('/v1/me/questionnaire/current')->assertOk()->assertJsonPath('submission.answers.custom_schedule', 'عصر');
        $this->getJson('/v1/admin/questionnaire/schemas')->assertForbidden();
    }

    public function test_malformed_drafts_and_incompatible_editor_changes_are_rejected(): void
    {
        $this->actor();
        $this->putJson('/v1/me/questionnaire', [])->assertStatus(400);
        $this->actor('admin');
        $this->postJson('/v1/admin/questionnaire/schemas', ['questions' => []])->assertStatus(422)->assertJsonPath('code', 'incompatible_schema');
        $this->get('/questionnaire-editor')->assertOk()->assertHeader('content-type', 'text/html; charset=utf-8');
    }
}
