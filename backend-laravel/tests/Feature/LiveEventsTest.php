<?php

namespace Tests\Feature;

use App\Modules\Realtime\Application\EventStream;
use App\Shared\Domain\LegacyCrypto as Crypto;
use Tests\MySqlTestCase;

final class LiveEventsTest extends MySqlTestCase
{
    public function test_open_stream_delivers_later_events_without_duplicates_and_resumes_at_microseconds(): void
    {
        $user = $this->actor();
        $other = $this->actor();
        $this->db->table('notifications')->insert(['id' => Crypto::uuid(), 'user_id' => $other['id'], 'kind' => 'private', 'payload' => '{}', 'created_at' => '2026-11-14 00:00:00.123456']);
        $initial = Crypto::uuid();
        $later = Crypto::uuid();
        $this->db->table('notifications')->insert(['id' => $initial, 'user_id' => $user['id'], 'kind' => 'first', 'payload' => '{}', 'created_at' => '2026-11-14 00:00:00.123456']);
        $content = '';
        $paused = 0;
        $this->app->make(EventStream::class)->pump($user['id'], '2026-11-14T00:00:00.123455Z', false,
            function ($chunk) use (&$content): void {
                $content .= $chunk;
            },
            function () use (&$paused, $later, $user): void {
                if ($paused++ === 0) {
                    $this->db->table('notifications')->insert(['id' => $later, 'user_id' => $user['id'], 'kind' => 'later', 'payload' => '{}', 'created_at' => '2026-11-14 00:00:00.123456']);
                }
            },
            fn () => true, 3);
        self::assertSame(1, substr_count($content, $initial));
        self::assertSame(1, substr_count($content, $later));
        self::assertStringNotContainsString('private', $content);
        self::assertSame(3, $paused);
        $this->withToken($user['token']);
        $body = $this->get('/v1/events?once=1', ['Last-Event-ID' => '2026-11-14T00:00:00.123457Z'])->assertOk()->streamedContent();
        self::assertStringNotContainsString($initial, $body);
        self::assertStringNotContainsString($later, $body);
    }
}
