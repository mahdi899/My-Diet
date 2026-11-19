<?php

namespace Tests\Feature;

use App\Modules\Coach\Application\CoachGateway;
use App\Modules\Coach\Infrastructure\CoachContextBuilder;
use App\Modules\Coach\Infrastructure\CoachQuotaService;
use App\Modules\Coach\Infrastructure\CoachThreads;
use App\Shared\Domain\LegacyCrypto as Crypto;
use Illuminate\Database\Events\QueryExecuted;
use Tests\MySqlTestCase;

final class CoachThreadsTest extends MySqlTestCase
{
    public function test_existing_conversation_is_listed_and_empty_threads_are_reused(): void
    {
        ['id' => $user] = $this->actor();
        $threads = app(CoachThreads::class);
        $id = $threads->create($user)['id'];
        self::assertSame($id, $threads->create($user)['id']);
        $this->getJson('/v1/me/coach/threads')->assertOk()->assertJsonCount(0, 'threads');
        $this->seedMessage($user, $id, 'شام سبک چی بخورم؟');
        $this->getJson('/v1/me/coach/threads')->assertOk()->assertJsonPath('limit', 50)
            ->assertJsonPath('threads.0.id', $id)->assertJsonPath('threads.0.title', 'شام سبک چی بخورم؟');
        $this->getJson('/v1/me/coach/thread?threadId='.$id)->assertOk()->assertJsonCount(1, 'messages');
    }

    public function test_fifty_first_conversation_replaces_only_the_least_recently_active_chat(): void
    {
        ['id' => $other] = $this->actor();
        $threads = app(CoachThreads::class);
        $otherId = $threads->create($other)['id'];
        $this->seedMessage($other, $otherId, 'گفتگوی کاربر دیگر');
        ['id' => $user] = $this->actor();
        $ids = $this->seedFullHistory($user);
        $this->seedMessage($user, $ids[0], 'ادامه گفتگوی قدیمی');
        $message = $this->seedMessage($user, $ids[1], 'غذا');
        $reply = $this->seedMessage($user, $ids[1], 'ثبت شد', 'assistant', $message);
        $this->db->table('coach_threads')->where('id', $ids[1])->update(['last_message_at' => '2026-01-01 01:00:00']);
        $entry = Crypto::uuid();
        $this->db->table('coach_food_entries')->insert(['id' => $entry, 'user_id' => $user, 'thread_id' => $ids[1], 'message_id' => $reply,
            'civil_date' => '2026-11-19', 'meal_type' => 'lunch', 'title' => 'عدسی', 'source' => 'manual', 'items' => '[]', 'totals' => '{"kcal":300}', 'status' => 'logged']);
        $this->db->table('coach_water')->insert(['user_id' => $user, 'civil_date' => '2026-11-19', 'ml' => 500]);
        $new = Crypto::uuid();
        $this->postJson('/v1/me/coach/threads', ['id' => $new])->assertOk()->assertJsonPath('thread.id', $new);
        self::assertSame(50, $this->db->table('coach_threads')->where('user_id', $user)->count());
        self::assertFalse($this->db->table('coach_threads')->where('id', $ids[1])->exists());
        self::assertSame(0, $this->db->table('coach_messages')->where('thread_id', $ids[1])->count());
        self::assertSame(49, $this->db->table('coach_threads')->whereIn('id', $ids)->count());
        self::assertTrue($this->db->table('coach_threads')->where('id', $ids[0])->exists());
        self::assertTrue($this->db->table('coach_threads')->where('id', $otherId)->exists());
        $food = $this->db->table('coach_food_entries')->where('id', $entry)->first();
        self::assertSame('logged', $food->status);
        self::assertNull($food->thread_id);
        self::assertNull($food->message_id);
        self::assertSame(500, $this->db->table('coach_water')->where('user_id', $user)->value('ml'));

        $this->postJson('/v1/me/coach/threads', ['id' => $new])->assertOk()->assertJsonPath('thread.id', $new);
        $this->postJson('/v1/me/coach/threads', ['id' => Crypto::uuid()])->assertOk()->assertJsonPath('thread.id', $new);
        self::assertSame(49, $this->db->table('coach_threads')->whereIn('id', $ids)->count());
        $this->seedMessage($user, $new, 'گفتگوی تازه');
        $this->postJson('/v1/me/coach/threads', ['id' => $new])->assertOk()->assertJsonPath('thread.id', $new);
        self::assertSame(50, $this->db->table('coach_threads')->where('user_id', $user)->count());
        $this->postJson('/v1/me/coach/threads', ['id' => Crypto::uuid()])->assertOk();
        self::assertFalse($this->db->table('coach_threads')->where('id', $ids[2])->exists());
        self::assertSame(50, $this->db->table('coach_threads')->where('user_id', $user)->count());
    }

    public function test_listing_fifty_chats_loads_titles_and_previews_in_one_query(): void
    {
        ['id' => $user] = $this->actor();
        $ids = $this->seedFullHistory($user);
        $this->seedMessage($user, $ids[49], 'پاسخ آخر', 'assistant');
        $this->db->table('coach_threads')->where('id', $ids[49])->update(['title' => 'نام دلخواه']);
        $this->seedMessage($user, $ids[49], 'خلاصه امروز', 'assistant');
        $this->db->table('coach_messages')->where('thread_id', $ids[49])->where('fallback_text', 'خلاصه امروز')->update(['type' => 'day_brief']);
        $this->db->table('coach_threads')->where('id', $ids[48])->update(['title' => null]);
        $this->db->flushQueryLog();
        $this->db->enableQueryLog();
        try {
            $listing = app(CoachThreads::class)->listing($user);
            self::assertCount(1, $this->db->getQueryLog());
        } finally {
            $this->db->disableQueryLog();
        }
        self::assertSame(50, $listing['limit']);
        self::assertCount(50, $listing['threads']);
        self::assertSame('نام دلخواه', $listing['threads'][0]['title']);
        self::assertSame('پاسخ آخر', $listing['threads'][0]['preview']);
        self::assertSame('گفتگو 48', $listing['threads'][1]['title']);
        self::assertSame('گفتگو 48', $listing['threads'][1]['preview']);
    }

    public function test_failed_replacement_restores_the_old_chat_and_releases_the_lock(): void
    {
        ['id' => $user] = $this->actor();
        $ids = $this->seedFullHistory($user);
        $new = Crypto::uuid();
        $this->db->listen(function (QueryExecuted $query) use ($new): void {
            if (str_starts_with($query->sql, 'insert into `coach_threads`') && in_array($new, $query->bindings, true)) {
                throw new \RuntimeException('Simulated thread creation failure');
            }
        });
        try {
            app(CoachThreads::class)->create($user, $new);
            self::fail('Thread creation should have failed.');
        } catch (\RuntimeException $error) {
            self::assertSame('Simulated thread creation failure', $error->getMessage());
        }
        self::assertSame(50, $this->db->table('coach_threads')->whereIn('id', $ids)->count());
        self::assertSame('گفتگو 0', $this->db->table('coach_messages')->where('thread_id', $ids[0])->value('fallback_text'));
        self::assertFalse($this->db->table('coach_threads')->where('id', $new)->exists());
        $this->postJson('/v1/me/coach/threads', ['id' => Crypto::uuid()])->assertOk();
        self::assertSame(49, $this->db->table('coach_threads')->whereIn('id', $ids)->count());
    }

    public function test_every_thread_operation_checks_ownership(): void
    {
        ['id' => $other] = $this->actor();
        $id = app(CoachThreads::class)->create($other)['id'];
        $this->actor();
        $this->getJson('/v1/me/coach/thread?threadId='.$id)->assertNotFound();
        $this->patchJson('/v1/me/coach/threads/'.$id, ['title' => 'تغییر'])->assertNotFound();
        $this->deleteJson('/v1/me/coach/threads/'.$id)->assertNotFound();
        $this->postJson('/v1/me/coach/threads', ['id' => $id])->assertNotFound();
        $this->postJson('/v1/me/coach/messages', ['threadId' => $id, 'clientMessageId' => Crypto::uuid(), 'kind' => 'text', 'text' => 'سلام'])->assertNotFound();
        $this->postJson('/v1/me/coach/actions', ['threadId' => $id, 'clientMessageId' => Crypto::uuid(), 'action' => 'dismiss'])->assertNotFound();
        $this->postJson('/v1/me/coach/day-brief', ['threadId' => $id])->assertNotFound();
        self::assertSame([], app(CoachContextBuilder::class)->recentDialogue($this->actor()['id'], '', $id));
    }

    public function test_messages_actions_retries_and_model_context_stay_in_the_selected_chat(): void
    {
        ['id' => $user] = $this->actor();
        $threads = app(CoachThreads::class);
        $first = $threads->create($user)['id'];
        $this->seedMessage($user, $first, 'فقط گفتگوی اول');
        $second = $threads->create($user)['id'];
        $gateway = app(CoachGateway::class);
        $client = Crypto::uuid();
        $gateway->action($user, $client, 'dismiss', [], 'نه ممنون', $second);
        $gateway->action($user, $client, 'dismiss', [], 'نه ممنون', $second);
        self::assertSame(2, $this->db->table('coach_messages')->where('thread_id', $second)->count());
        self::assertSame(1, $this->db->table('coach_messages')->where('thread_id', $first)->count());
        $context = app(CoachContextBuilder::class)->recentDialogue($user, '', $second);
        self::assertStringNotContainsString('فقط گفتگوی اول', json_encode($context, JSON_UNESCAPED_UNICODE));
        self::assertSame('نه ممنون', $context[0]['content']);
        $this->patchJson('/v1/me/coach/threads/'.$second, ['title' => 'وعده‌های من'])->assertOk()->assertJsonPath('thread.title', 'وعده‌های من');
        $gateway->action($user, Crypto::uuid(), 'dismiss', [], 'پیام دوم', $second);
        self::assertSame('وعده‌های من', $threads->owned($user, $second)->title);
        self::assertSame($second, $threads->listing($user)['threads'][0]['id']);
    }

    public function test_delete_preserves_food_and_water_logs(): void
    {
        ['id' => $user] = $this->actor();
        $threads = app(CoachThreads::class);
        $id = $threads->create($user)['id'];
        $message = $this->seedMessage($user, $id, 'غذا');
        $reply = $this->seedMessage($user, $id, 'ثبت شد', 'assistant', $message);
        $entry = Crypto::uuid();
        $this->db->table('coach_food_entries')->insert(['id' => $entry, 'user_id' => $user, 'thread_id' => $id, 'message_id' => $reply,
            'civil_date' => '2026-11-19', 'meal_type' => 'lunch', 'title' => 'عدسی', 'source' => 'manual', 'items' => '[]', 'totals' => '{"kcal":300}', 'status' => 'logged']);
        $this->db->table('coach_water')->insert(['user_id' => $user, 'civil_date' => '2026-11-19', 'ml' => 500]);
        $threads->delete($user, $id);
        self::assertSame(0, $this->db->table('coach_messages')->where('thread_id', $id)->count());
        $food = $this->db->table('coach_food_entries')->where('id', $entry)->first();
        self::assertSame('logged', $food->status);
        self::assertNull($food->thread_id);
        self::assertNull($food->message_id);
        self::assertSame(500, $this->db->table('coach_water')->where('user_id', $user)->value('ml'));
    }

    public function test_retrying_create_returns_the_same_thread(): void
    {
        ['id' => $user] = $this->actor();
        $id = Crypto::uuid();
        $this->postJson('/v1/me/coach/threads', ['id' => $id])->assertOk()->assertJsonPath('thread.id', $id);
        $this->seedMessage($user, $id, 'پیام');
        $this->postJson('/v1/me/coach/threads', ['id' => $id])->assertOk()->assertJsonPath('thread.id', $id);
        self::assertSame(1, $this->db->table('coach_threads')->where('user_id', $user)->count());
        $this->patchJson('/v1/me/coach/threads/'.$id, ['title' => ' '])->assertStatus(400);
    }

    public function test_parallel_connection_cannot_create_or_delete_during_an_active_turn(): void
    {
        ['id' => $user] = $this->actor();
        $ids = $this->seedFullHistory($user);
        $config = $this->db->getConfig();
        $parallel = new \PDO('mysql:host='.$config['host'].';port='.$config['port'].';dbname='.$config['database'], $config['username'], $config['password']);
        $lock = hash('sha256', 'coach:'.$user);
        $statement = $parallel->prepare('select get_lock(?,0)');
        $statement->execute([$lock]);
        self::assertSame(1, (int) $statement->fetchColumn());
        try {
            $this->postJson('/v1/me/coach/threads', ['id' => Crypto::uuid()])->assertStatus(409)->assertJsonPath('code', 'coach_busy');
            $this->deleteJson('/v1/me/coach/threads/'.$ids[0])->assertStatus(409)->assertJsonPath('code', 'coach_busy');
            self::assertSame(50, $this->db->table('coach_threads')->whereIn('id', $ids)->count());
        } finally {
            $statement = $parallel->prepare('select release_lock(?)');
            $statement->execute([$lock]);
        }
        $this->postJson('/v1/me/coach/threads', ['id' => Crypto::uuid()])->assertOk();
        self::assertSame(49, $this->db->table('coach_threads')->whereIn('id', $ids)->count());
    }

    public function test_photo_is_saved_in_its_thread_and_replay_does_not_consume_vision_twice(): void
    {
        ['id' => $user] = $this->actor();
        app(CoachQuotaService::class)->provision($user, 'weekly');
        $threads = app(CoachThreads::class);
        $first = $threads->create($user)['id'];
        $this->seedMessage($user, $first, 'متن قبلی');
        $second = $threads->create($user)['id'];
        $body = ['threadId' => $second, 'clientMessageId' => Crypto::uuid(), 'mime' => 'image/png',
            'image' => 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='];
        $this->postJson('/v1/me/coach/food-photos', $body)->assertOk()->assertJsonPath('replay', false)->assertJsonCount(1, 'messages');
        $this->postJson('/v1/me/coach/food-photos', $body)->assertOk()->assertJsonPath('replay', true)->assertJsonCount(1, 'messages');
        self::assertSame(1, $this->db->table('coach_quotas')->where('user_id', $user)->value('vision_used'));
        self::assertSame(2, $this->db->table('coach_messages')->where('thread_id', $second)->count());
        self::assertSame(1, $this->db->table('coach_messages')->where('thread_id', $first)->count());
    }

    public function test_pagination_only_returns_messages_from_the_requested_thread(): void
    {
        ['id' => $user] = $this->actor();
        $threads = app(CoachThreads::class);
        $first = $threads->create($user)['id'];
        for ($i = 0; $i < 5; $i++) {
            $this->seedMessage($user, $first, 'پیام '.$i);
        }
        $second = $threads->create($user)['id'];
        $this->seedMessage($user, $second, 'گفتگوی دیگر');
        $page = $this->getJson('/v1/me/coach/thread?threadId='.$first.'&limit=2')->assertOk()->assertJsonCount(2, 'messages');
        $older = $this->getJson('/v1/me/coach/thread?threadId='.$first.'&limit=2&before='.$page->json('nextCursor'));
        $older->assertOk()->assertJsonCount(2, 'messages');
        self::assertSame('پیام 1', $older->json('messages.0.fallback_text'));
    }

    private function seedFullHistory(string $user): array
    {
        $ids = [];
        for ($i = 0; $i < 50; $i++) {
            $ids[] = $id = app(CoachThreads::class)->create($user)['id'];
            $this->seedMessage($user, $id, 'گفتگو '.$i);
            $date = sprintf('2026-01-%02d %02d:00:00', 1 + intdiv($i, 24), $i % 24);
            $this->db->table('coach_threads')->where('id', $id)->update(['created_at' => $date, 'last_message_at' => $date]);
        }

        return $ids;
    }

    private function seedMessage(string $user, string $thread, string $text, string $role = 'user', ?string $replyTo = null): string
    {
        $id = Crypto::uuid();
        $this->db->table('coach_messages')->insert(['id' => $id, 'thread_id' => $thread, 'user_id' => $user, 'role' => $role,
            'type' => 'text', 'fallback_text' => $text, 'payload' => '{}', 'reply_to' => $replyTo]);
        app(CoachThreads::class)->touch($thread, $role === 'user' ? $text : '');

        return $id;
    }
}
