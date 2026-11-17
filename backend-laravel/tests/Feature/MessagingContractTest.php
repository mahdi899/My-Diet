<?php

namespace Tests\Feature;

use App\Modules\Worker\Application\JobWorker;
use App\Modules\Worker\Application\WorkerStore;
use App\Shared\Domain\LegacyCrypto as Crypto;
use Tests\MySqlTestCase;

final class MessagingContractTest extends MySqlTestCase
{
    public function test_support_reaches_existing_and_new_admins_and_replies_reach_only_the_owner(): void
    {
        $user = $this->actor();
        $admin = $this->actor('admin');
        $this->withToken($user['token']);
        $id = $this->postJson('/v1/me/support-conversation')->assertOk()->json('id');
        $client = Crypto::uuid();
        $message = $this->postJson('/v1/conversations/'.$id.'/messages', ['body' => 'کمک می‌خواهم', 'clientRequestId' => $client])->assertOk()->json('id');
        self::assertTrue($this->db->table('notifications')->where(['user_id' => $admin['id'], 'kind' => 'message'])->exists());
        $this->withToken($admin['token']);
        $this->getJson('/v1/conversations')->assertOk()->assertJsonFragment(['id' => $id, 'unreadCount' => 1]);
        $this->getJson('/v1/conversations/'.$id.'/messages')->assertOk()->assertJsonFragment(['id' => $message, 'clientRequestId' => $client]);
        $this->postJson('/v1/conversations/'.$id.'/read')->assertOk();
        $this->postJson('/v1/conversations/'.$id.'/messages', ['body' => 'پاسخ پشتیبانی'])->assertOk();
        $this->actor('admin');
        $this->getJson('/v1/conversations')->assertOk()->assertJsonFragment(['id' => $id]);
        $this->getJson('/v1/conversations/'.$id.'/messages')->assertOk();
        $this->withToken($user['token']);
        $this->getJson('/v1/conversations/'.$id.'/messages')->assertOk()->assertJsonFragment(['body' => 'پاسخ پشتیبانی']);
        $this->actor();
        $this->getJson('/v1/conversations/'.$id.'/messages')->assertNotFound();
        $this->actor('specialist');
        $this->postJson('/v1/conversations/'.$id.'/messages', ['body' => 'نباید ثبت شود'])->assertForbidden();
    }

    public function test_messages_media_assignment_and_events_stay_with_their_owner(): void
    {
        $user = $this->actor();
        $other = $this->actor();
        $doctor = $this->actor('specialist');
        $this->db->table('specialist_profiles')->insert(['user_id' => $doctor['id'], 'display_name' => 'متخصص گفتگو', 'active' => true]);
        $plan = $this->planFixture($user['id']);
        $this->db->table('plan_requests')->where('id', $plan['request'])->update(['assigned_specialist_id' => $doctor['id']]);
        $this->withToken($user['token']);
        $support = $this->postJson('/v1/me/support-conversation')->assertOk()->json('id');
        $this->postJson('/v1/me/support-conversation')->assertOk()->assertJsonPath('id', $support);
        $client = Crypto::uuid();
        $posted = $this->postJson('/v1/conversations/'.$support.'/messages', ['body' => 'سلام', 'clientRequestId' => $client])->assertOk()->assertJsonPath('duplicate', false)->json('id');
        $this->postJson('/v1/conversations/'.$support.'/messages', ['body' => 'سلام', 'clientRequestId' => $client])->assertOk()->assertJsonPath('duplicate', true)->assertJsonPath('id', $posted);
        $this->postJson('/v1/conversations/'.$support.'/receipts', ['messageId' => $posted, 'state' => 'read'])->assertStatus(409)->assertJsonPath('code', 'not_recipient');
        $this->withToken($other['token']);
        $this->getJson('/v1/conversations/'.$support.'/messages')->assertNotFound();
        $this->withToken($user['token']);
        $care = $this->postJson('/v1/me/care-conversation')->assertOk()->assertJsonPath('specialistId', $doctor['id'])->json('id');
        $this->withToken($doctor['token']);
        $this->getJson('/v1/conversations')->assertOk()->assertJsonFragment(['id' => $care]);
        $this->db->table('plan_requests')->where('id', $plan['request'])->update(['assigned_specialist_id' => $other['id']]);
        $this->getJson('/v1/conversations/'.$care.'/messages')->assertNotFound();
        $this->withToken($user['token']);
        $media = $this->postJson('/v1/conversations/'.$support.'/media', ['purpose' => 'image', 'declaredType' => 'image/jpeg'])->assertOk()->json('id');
        $png = base64_encode("\x89PNG\r\n\x1A\n".'sabzine');
        $this->putJson('/v1/media/'.$media, ['declaredType' => 'image/jpeg', 'contentBase64' => $png])->assertStatus(400)->assertJsonPath('code', 'invalid_media');
        $again = $this->postJson('/v1/conversations/'.$support.'/media', ['purpose' => 'image', 'declaredType' => 'image/png'])->assertOk()->json('id');
        $this->putJson('/v1/media/'.$again, ['declaredType' => 'image/png', 'contentBase64' => $png])->assertOk()->assertJsonPath('detectedType', 'image/png');
        $grant = $this->postJson('/v1/media/'.$again.'/access')->assertOk()->assertJsonPath('expiresInSeconds', 60)->json('grant');
        $this->postJson('/v1/media/'.$again.'/content', ['grant' => $grant])->assertOk()->assertJsonPath('contentBase64', $png);
        $this->withToken($other['token']);
        $this->postJson('/v1/media/'.$again.'/content', ['grant' => $grant])->assertNotFound();
        $this->withToken($user['token']);
        $device = $this->postJson('/v1/me/devices', ['platform' => 'android', 'pushToken' => 'token-12345678', 'provider' => 'console'])->assertOk()->json('id');
        $this->db->table('notifications')->insert(['id' => Crypto::uuid(), 'user_id' => $other['id'], 'kind' => 'secret', 'payload' => '{}']);
        $own = Crypto::uuid();
        $this->db->table('notifications')->insert(['id' => $own, 'user_id' => $user['id'], 'kind' => 'plan_change', 'payload' => '{}']);
        $store = $this->app->make(WorkerStore::class);
        $this->db->table('outbox_events')->insert(['id' => Crypto::uuid(), 'topic' => 'push.send', 'aggregate_id' => $own, 'payload' => json_encode(['userId' => $user['id'], 'kind' => 'plan_change'])]);
        $store->relay();
        $this->app->make(JobWorker::class)->drain();
        self::assertSame(1, $this->db->table('push_deliveries')->where('device_id', $device)->count());
        $stream = $this->get('/v1/events?once=1')->assertOk();
        $body = $stream->streamedContent();
        self::assertStringContainsString($own, $body);
        self::assertStringNotContainsString('secret', $body);
        $this->deleteJson('/v1/me/devices/'.$device)->assertOk();
        $this->getJson('/v1/conversations/'.$support.'/timeline?limit=1')->assertOk()->assertJsonCount(1, 'messages')->assertJsonPath('nextCursor', null);
    }
}
