<?php

namespace Tests\Feature;

use App\Shared\Domain\LegacyCrypto as Crypto;
use Tests\MySqlTestCase;

final class AccountContractTest extends MySqlTestCase
{
    public function test_feedback_stays_private_until_permission_and_deletion_keeps_the_ledger(): void
    {
        $user = $this->actor();
        $plan = $this->planFixture($user['id']);
        $this->db->table('orders')->where('id', $plan['order'])->update(['created_at' => '2026-11-14 08:00:00']);
        $this->db->table('plan_requests')->where('id', $plan['request'])->update(['week_start' => '2026-11-14']);
        $this->db->table('wallet_ledger')->insert(['id' => Crypto::uuid(), 'user_id' => $user['id'], 'bucket' => 'cash', 'amount_toman' => 1000, 'kind' => 'topup', 'reference_id' => Crypto::uuid()]);
        $this->db->table('wallets')->where('user_id', $user['id'])->update(['cash_toman' => 1000]);
        $option = Crypto::uuid();
        $body = ['weekStart' => '2026-11-15', 'favorites' => [], 'dislikes' => [], 'preparationDifficulty' => 'easy', 'ingredientAvailability' => 'available', 'affordability' => 'affordable', 'portionSatisfaction' => 'right', 'serviceRating' => 5, 'comment' => 'خوب بود', 'publishPermission' => false];
        $this->putJson('/v1/me/weekly-feedback', $body)->assertStatus(400);
        $body['weekStart'] = '2026-11-14';
        $this->putJson('/v1/me/weekly-feedback', $body)->assertOk()->assertJsonPath('revision', 1)->assertJsonPath('publishPermission', false);
        $this->putJson('/v1/me/weekly-feedback', $body)->assertOk()->assertJsonPath('revision', 1);
        $this->postJson('/v1/me/weekly-feedback/publish', ['weekStart' => '2026-11-14'])->assertStatus(409)->assertJsonPath('code', 'permission_required');
        self::assertSame(0, $this->db->table('program_reviews')->where('user_id', $user['id'])->count());
        $body['publishPermission'] = true;
        $body['favorites'] = [$option];
        $this->putJson('/v1/me/weekly-feedback', $body)->assertOk()->assertJsonPath('revision', 2);
        $published = $this->postJson('/v1/me/weekly-feedback/publish', ['weekStart' => '2026-11-14'])->assertOk()->assertJsonPath('status', 'pending')->assertJsonPath('approvesNewPlan', false)->json();
        self::assertSame('in_review', $this->db->table('plan_requests')->where('id', $plan['request'])->value('status'));
        $command = Crypto::uuid();
        $report = $this->postJson('/v1/me/patient-reports', ['weekStart' => '2026-11-14', 'commandId' => $command])->assertOk()->assertJsonPath('retried', false)->json();
        $this->postJson('/v1/me/patient-reports', ['weekStart' => '2026-11-14', 'commandId' => $command])->assertOk()->assertJsonPath('retried', true)->assertJsonPath('version', $report['version']);
        $this->putJson('/v1/me/preferences', ['expectedRevision' => 0, 'favoriteOptions' => ['عدس'], 'dislikedOptions' => [], 'note' => ''])->assertOk()->assertJsonPath('revision', 1)->assertJsonPath('notADiagnosis', true);
        $this->putJson('/v1/me/preferences', ['expectedRevision' => 0, 'favoriteOptions' => ['عدس'], 'dislikedOptions' => [], 'note' => ''])->assertStatus(409)->assertJsonPath('code', 'lock_conflict');
        $doctor = $this->actor('specialist');
        $this->db->table('specialist_profiles')->insert(['user_id' => $doctor['id'], 'display_name' => 'متخصص گزارش', 'active' => true]);
        $this->getJson('/v1/specialist/patients/'.$user['id'].'/patient-reports?weekStart=2026-11-14')->assertNotFound();
        $this->db->table('plan_requests')->where('id', $plan['request'])->update(['assigned_specialist_id' => $doctor['id']]);
        $this->getJson('/v1/specialist/patients/'.$user['id'].'/patient-reports?weekStart=2026-11-14')->assertOk()->assertJsonPath('version', $report['version']);
        $this->withToken($user['token']);
        $install = Crypto::uuid();
        $session = Crypto::uuid();
        $this->postJson('/v1/journey/events', ['installId' => $install, 'sessionId' => $session, 'platform' => 'android', 'appVersion' => '1.2.3', 'events' => [
            ['type' => 'screen_view', 'occurredAt' => '2026-11-14T08:00:02Z', 'properties' => ['sessionType' => 'returning']],
            ['type' => 'screen_view', 'occurredAt' => '2026-11-14T08:00:01Z', 'properties' => []],
        ]])->assertStatus(400);
        $this->postJson('/v1/journey/events', ['installId' => $install, 'sessionId' => $session, 'platform' => 'android', 'appVersion' => '1.2.3', 'events' => [
            ['type' => 'screen_view', 'occurredAt' => '2026-11-14T08:00:01Z', 'properties' => ['sessionType' => 'returning', 'userId' => $user['id']]],
        ]])->assertOk()->assertJsonPath('sessionType', 'first_visit');
        self::assertSame('first_visit', $this->db->table('journey_sessions')->where('id', $session)->value('session_type'));
        $this->actor('admin');
        $this->getJson('/v1/admin/reports/retention?from=2026-11-14&to=2026-11-14&event=nope')->assertStatus(400);
        $this->getJson('/v1/admin/reports/retention?from=2026-11-14&to=2026-11-14')->assertOk()->assertJsonPath('rows.0.cells.week4.state', 'not_yet_measurable');
        $this->withToken($user['token']);
        $conversation = $this->postJson('/v1/me/support-conversation')->assertOk()->json('id');
        $this->postJson('/v1/conversations/'.$conversation.'/messages', ['body' => 'پیام خصوصی'])->assertOk();
        $this->getJson('/v1/me/export')->assertOk()->assertJsonPath('ledger.0.amount_toman', 1000);
        $this->postJson('/v1/me/account/delete', ['confirmation' => 'حذف حساب'])->assertOk()->assertJsonPath('ledgerRetained', true);
        self::assertSame(1, $this->db->table('wallet_ledger')->where('user_id', $user['id'])->count());
        self::assertSame('', $this->db->table('messages')->where('author_id', $user['id'])->value('body'));
        $this->postJson('/v1/me/account/delete', ['confirmation' => 'حذف حساب'])->assertStatus(401);
        self::assertNotNull($published['reviewId']);
    }
}
