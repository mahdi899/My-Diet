<?php

namespace Tests\Feature;

use App\Modules\Coach\Application\CoachGateway;
use App\Modules\Coach\Infrastructure\CoachContextBuilder;
use App\Modules\Coach\Infrastructure\CoachQuotaService;
use App\Modules\Coach\Infrastructure\CoachThreads;
use App\Shared\Domain\LegacyCrypto as Crypto;
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
        $this->getJson('/v1/me/coach/threads')->assertOk()->assertJsonPath('limit', 10)
            ->assertJsonPath('threads.0.id', $id)->assertJsonPath('threads.0.title', 'شام سبک چی بخورم؟');
        $this->getJson('/v1/me/coach/thread?threadId='.$id)->assertOk()->assertJsonCount(1, 'messages');
    }

    public function test_limit_is_enforced_without_deleting_old_chats_and_delete_frees_a_slot(): void
    {
        ['id' => $user] = $this->actor();
        $threads = app(CoachThreads::class);
        $ids = [];
        for ($i = 0; $i < 10; $i++) {
            $ids[] = $id = $threads->create($user)['id'];
            $this->seedMessage($user, $id, 'گفتگو '.$i);
        }
        $this->postJson('/v1/me/coach/threads', ['id' => Crypto::uuid()])->assertStatus(409)->assertJsonPath('code', 'coach_thread_limit');
        self::assertSame(10, $this->db->table('coach_threads')->where('user_id', $user)->count());
        $this->deleteJson('/v1/me/coach/threads/'.$ids[0])->assertOk();
        $this->postJson('/v1/me/coach/threads', ['id' => Crypto::uuid()])->assertOk();
        self::assertSame(10, $this->db->table('coach_threads')->where('user_id', $user)->count());
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
        $config = $this->db->getConfig();
        $parallel = new \PDO('mysql:host='.$config['host'].';port='.$config['port'].';dbname='.$config['database'], $config['username'], $config['password']);
        $lock = hash('sha256', 'coach:'.$user);
        $statement = $parallel->prepare('select get_lock(?,0)');
        $statement->execute([$lock]);
        self::assertSame(1, (int) $statement->fetchColumn());
        try {
            $this->postJson('/v1/me/coach/threads', ['id' => Crypto::uuid()])->assertStatus(409)->assertJsonPath('code', 'coach_busy');
            self::assertSame(0, $this->db->table('coach_threads')->where('user_id', $user)->count());
        } finally {
            $statement = $parallel->prepare('select release_lock(?)');
            $statement->execute([$lock]);
        }
        $this->postJson('/v1/me/coach/threads', ['id' => Crypto::uuid()])->assertOk();
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

    private function seedMessage(string $user, string $thread, string $text, string $role = 'user', ?string $replyTo = null): string
    {
        $id = Crypto::uuid();
        $this->db->table('coach_messages')->insert(['id' => $id, 'thread_id' => $thread, 'user_id' => $user, 'role' => $role,
            'type' => 'text', 'fallback_text' => $text, 'payload' => '{}', 'reply_to' => $replyTo]);
        app(CoachThreads::class)->touch($thread, $role === 'user' ? $text : '');

        return $id;
    }
}
