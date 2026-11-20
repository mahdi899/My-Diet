<?php

namespace Tests\Feature;

use App\Modules\Coach\Application\CoachGateway;
use App\Modules\Coach\Application\CoachModel;
use App\Modules\Coach\Infrastructure\CoachContextBuilder;
use App\Modules\Coach\Infrastructure\CoachThreads;
use App\Modules\Coach\Infrastructure\PreferenceService;
use App\Shared\Domain\LegacyCrypto as Crypto;
use App\Shared\Domain\Problem;
use Tests\MySqlTestCase;

final class CoachWorkspaceTest extends MySqlTestCase
{
    public function test_message_times_are_explicit_utc_in_history_search_and_acknowledgments(): void
    {
        ['id' => $user] = $this->actor();
        $thread = $this->conversation($user, ['ساعت پیام آزمایشی']);
        $this->db->table('coach_messages')->where('thread_id', $thread)->update(['created_at' => '2026-11-21 20:45:32.123456']);
        $expected = '2026-11-21T20:45:32.123456Z';
        $this->getJson('/v1/me/coach/thread?threadId='.$thread)->assertOk()->assertJsonPath('messages.0.created_at', $expected);
        $this->getJson('/v1/me/coach/search?q='.urlencode('آزمایشی'))->assertOk()->assertJsonPath('items.0.createdAt', $expected);

        $client = Crypto::uuid();
        $coach = app(CoachGateway::class);
        $sent = $coach->action($user, $client, 'log_water', ['ml' => 250], null, $thread);
        foreach ([$sent['userMessage'], ...$sent['messages']] as $message) {
            self::assertMatchesRegularExpression('/T\d{2}:\d{2}:\d{2}\.\d{6}Z$/', $message['created_at']);
        }
        $history = collect($coach->thread($user, null, 50, $thread)['messages'])->keyBy('id');
        self::assertSame($sent['userMessage']['created_at'], $history[$sent['userMessage']['id']]['created_at']);
        $retried = $coach->action($user, $client, 'log_water', ['ml' => 250], null, $thread);
        self::assertSame($sent['userMessage']['created_at'], $retried['userMessage']['created_at']);
    }

    public function test_search_covers_old_messages_and_titles_and_is_owner_scoped(): void
    {
        ['id' => $other] = $this->actor();
        $this->conversation($other, ['عدسی مخفی']);
        ['id' => $user] = $this->actor();
        $id = $this->conversation($user, ['عدسی قدیمی', ...array_fill(0, 60, 'پیام تازه')]);
        $this->getJson('/v1/me/coach/search?q='.urlencode('عدسی'))->assertOk()->assertJsonCount(1, 'items')->assertJsonPath('items.0.threadId', $id);
        $this->db->table('coach_threads')->where('id', $id)->update(['title' => 'ناهار من']);
        $this->getJson('/v1/me/coach/search?q='.urlencode('ناهار'))->assertOk()->assertJsonCount(1, 'items');
        $page = $this->getJson('/v1/me/coach/search?q='.urlencode('پیام تازه'))->assertOk()->assertJsonCount(50, 'items');
        $this->getJson('/v1/me/coach/search?q='.urlencode('پیام تازه').'&before='.$page->json('nextCursor'))->assertOk()->assertJsonCount(10, 'items');
        $this->getJson('/v1/me/coach/search?q=%25')->assertOk()->assertJsonCount(0, 'items');
    }

    public function test_old_dialogue_is_compacted_and_retained_in_the_model_context(): void
    {
        ['id' => $user] = $this->actor();
        $id = $this->conversation($user, ['من برای شام غذای سریع می‌خواهم', ...array_fill(0, 12, 'ادامه گفتگو')]);
        $context = app(CoachContextBuilder::class)->recentDialogue($user, '', $id);
        self::assertSame('system', $context[0]['role']);
        self::assertStringContainsString('غذای سریع', $context[0]['content']);
        $this->getJson('/v1/me/coach/memory?threadId='.$id)->assertOk()->assertJsonPath('summary', app(CoachThreads::class)->owned($user, $id)->summary);
        $summary = app(CoachThreads::class)->owned($user, $id)->summary;
        app(CoachContextBuilder::class)->recentDialogue($user, '', $id);
        self::assertSame($summary, app(CoachThreads::class)->owned($user, $id)->summary);
        ['id' => $other] = $this->actor();
        $this->getJson('/v1/me/coach/memory?threadId='.$id)->assertNotFound();
    }

    public function test_preferences_can_be_corrected_and_forgotten_without_editing_specialist_notes(): void
    {
        ['id' => $user] = $this->actor();
        app(PreferenceService::class)->recordUserStatement($user, 'food_like', 'عدسی');
        app(PreferenceService::class)->recordSpecialistNote($user, 'یادداشت متخصص');
        $rows = $this->getJson('/v1/me/coach/memory')->assertOk()->json('preferences');
        $like = collect($rows)->firstWhere('key', 'food_like')['id'];
        $note = collect($rows)->firstWhere('key', 'specialist_note')['id'];
        $this->patchJson('/v1/me/coach/memory/'.$like, ['value' => 'خوراک لوبیا'])->assertOk();
        $current = $this->db->table('coach_preferences')->where(['user_id' => $user, 'value' => 'خوراک لوبیا', 'active' => true])->first();
        self::assertNotNull($current);
        $this->deleteJson('/v1/me/coach/memory/'.$note)->assertForbidden();
        $this->deleteJson('/v1/me/coach/memory/'.$current->id)->assertOk();
        self::assertCount(1, $this->getJson('/v1/me/coach/memory')->json('preferences'));
        $this->actor();
        $this->patchJson('/v1/me/coach/memory/'.$note, ['value' => 'غیرمجاز'])->assertNotFound();
    }

    public function test_reply_context_is_stored_and_cannot_reference_another_thread(): void
    {
        ['id' => $user] = $this->actor();
        $id = $this->conversation($user, ['اول']);
        $source = $this->db->table('coach_messages')->where('thread_id', $id)->value('id');
        $result = app(CoachGateway::class)->accept($user, Crypto::uuid(), 'توضیح بیشتری بده', null, $id, $source);
        self::assertSame($source, $result['userMessage']['payload']['replyTo']['id']);
        $other = $this->conversation($user, ['گفتگوی دیگر']);
        try {
            app(CoachGateway::class)->accept($user, Crypto::uuid(), 'پاسخ', null, $other, $source);
            self::fail('Cross-thread reply accepted');
        } catch (Problem $error) {
            self::assertSame(404, $error->status);
        }
    }

    public function test_photo_caption_and_meal_reach_the_model_and_survive_retry(): void
    {
        ['id' => $user] = $this->actor();
        $captions = [];
        $model = \Mockery::mock(CoachModel::class);
        $model->shouldReceive('analyzePhoto')->once()->withArgs(function ($id, $image, $caption) use (&$captions) {
            $captions[] = $caption;

            return true;
        })->andReturn(['foods' => [['name' => 'عدسی', 'kcal' => 150]], 'confidence' => 0.8, 'needsConfirmation' => true, 'text' => '', 'tokensIn' => 1, 'tokensOut' => 1, 'costMicros' => 0]);
        $this->app->instance(CoachModel::class, $model);
        $body = ['clientMessageId' => Crypto::uuid(), 'mime' => 'image/png', 'caption' => 'نصف بشقاب خوردم', 'mealType' => 'dinner', 'image' => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='];
        $result = $this->postJson('/v1/me/coach/food-photos', $body)->assertOk()->assertJsonPath('userMessage.payload.mealType', 'dinner');
        $this->postJson('/v1/me/coach/food-photos', $body)->assertOk()->assertJsonPath('replay', true);
        self::assertStringContainsString('نصف بشقاب', $captions[0]);
        self::assertSame('dinner', $this->db->table('coach_food_entries')->where('id', $result->json('entryId'))->value('meal_type'));
    }

    private function conversation(string $user, array $texts): string
    {
        $id = app(CoachThreads::class)->create($user)['id'];
        foreach ($texts as $text) {
            $this->db->table('coach_messages')->insert(['id' => Crypto::uuid(), 'thread_id' => $id, 'user_id' => $user, 'role' => 'user', 'type' => 'text', 'fallback_text' => $text, 'payload' => '{}']);
        }
        app(CoachThreads::class)->touch($id, $texts[0]);

        return $id;
    }
}
