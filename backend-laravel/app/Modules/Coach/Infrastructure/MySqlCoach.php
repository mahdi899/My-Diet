<?php

namespace App\Modules\Coach\Infrastructure;

use App\Modules\Coach\Application\CoachGateway;
use App\Modules\Coach\Application\CoachIntentParser;
use App\Modules\Coach\Application\CoachModel;
use App\Modules\Coach\Domain\CoachSafety;
use App\Modules\Messaging\Domain\MediaSignature;
use App\Modules\Plans\Domain\CivilDates;
use App\Modules\Plans\Infrastructure\MealSwapService;
use App\Modules\Tracking\Application\TrackingService;
use App\Shared\Domain\LegacyCrypto as Crypto;
use App\Shared\Domain\Problem;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;

final class MySqlCoach implements CoachGateway
{
    public function __construct(
        private ConnectionInterface $db,
        private CoachModel $model,
        private CoachIntentParser $intents,
        private TrackingService $tracking,
        private CoachChatActions $actions,
    ) {}

    public function thread(string $user, ?int $before, int $limit, ?string $threadId = null): array
    {
        $thread = $this->ensure($user, $threadId);
        $query = $this->db->table('coach_messages')->where('thread_id', $thread->id)->orderByDesc('seq');
        if ($before !== null) {
            $query->where('seq', '<', $before);
        }
        $rows = $query->limit($limit + 1)->get();
        $page = $rows->take($limit)->reverse()->values();

        return ['thread' => ['id' => $thread->id, 'dayBriefDate' => $thread->day_brief_date], 'messages' => $page->map(fn ($row) => $this->message($row))->all(), 'nextCursor' => $rows->count() > $limit ? (int) $page->first()->seq : null];
    }

    public function accept(string $user, string $client, string $text, ?callable $emit = null, ?string $threadId = null, ?string $replyToMessageId = null): array
    {
        return $this->serial($user, function () use ($user, $client, $text, $emit, $threadId, $replyToMessageId) {
            $thread = $this->ensure($user, $threadId);
            $prior = $this->db->table('coach_messages')->where(['thread_id' => $thread->id, 'client_message_id' => $client])->first();
            if ($prior !== null) {
                return ['replay' => true, 'metered' => false, 'userMessage' => $this->message($prior), 'replies' => $this->replies($prior->id), 'blocked' => null];
            }
            $quote = null;
            if ($replyToMessageId !== null) {
                $source = $this->db->table('coach_messages')->where(['id' => $replyToMessageId, 'thread_id' => $thread->id, 'user_id' => $user])->first();
                if ($source === null) {
                    throw new Problem(404, 'not_found', 'پیام مورد پاسخ پیدا نشد');
                }
                $quote = ['id' => $source->id, 'text' => mb_substr($source->fallback_text, 0, 500), 'role' => $source->role];
            }
            $blocked = $this->blocked();
            $id = Crypto::uuid();
            $this->db->table('coach_messages')->insert(['id' => $id, 'thread_id' => $thread->id, 'user_id' => $user, 'role' => 'user', 'type' => 'text', 'fallback_text' => $text, 'client_message_id' => $client, 'payload' => json_encode($quote === null ? new \stdClass : ['replyTo' => $quote], JSON_UNESCAPED_UNICODE)]);
            app(CoachThreads::class)->touch($thread->id, $text);
            $local = $blocked === null ? (CoachSafety::localReply($text) ?? $this->photoReply($user, $thread->id, $text, $replyToMessageId) ?? $this->factual($user, $text)) : null;
            if (is_string($local) && preg_match('/اختلال خوردن|گرسنگی شدید|هیچ.?چیز نخورم/u', $text) === 1) {
                $this->alertSpecialist($user, 'eating_risk');
            }
            if ($blocked !== null || $local !== null) {
                $replies = [];
                if ($local !== null) {
                    $shaped = $this->shapeLocal($local);
                    $assistant = Crypto::uuid();
                    $this->db->table('coach_messages')->insert(['id' => $assistant, 'thread_id' => $thread->id, 'user_id' => $user, 'role' => 'assistant', 'type' => $shaped['type'], 'fallback_text' => $shaped['text'], 'reply_to' => $id, 'payload' => json_encode($shaped['payload'], JSON_UNESCAPED_UNICODE)]);
                    $replies[] = $this->message($this->db->table('coach_messages')->where('id', $assistant)->first());
                }

                return ['replay' => false, 'metered' => false, 'userMessage' => $this->message($this->db->table('coach_messages')->where('id', $id)->first()), 'replies' => $replies, 'blocked' => $blocked];
            }
            try {
                app(CoachQuotaService::class)->requireChat($user);
            } catch (Problem $error) {
                $assistant = Crypto::uuid();
                $this->db->table('coach_messages')->insert(['id' => $assistant, 'thread_id' => $thread->id, 'user_id' => $user, 'role' => 'assistant', 'type' => 'text', 'fallback_text' => $error->messageFa, 'reply_to' => $id, 'payload' => json_encode(['text' => $error->messageFa], JSON_UNESCAPED_UNICODE)]);

                return ['replay' => false, 'metered' => false, 'userMessage' => $this->message($this->db->table('coach_messages')->where('id', $id)->first()), 'replies' => [$this->message($this->db->table('coach_messages')->where('id', $assistant)->first())], 'blocked' => null];
            }
            $userMessage = $this->message($this->db->table('coach_messages')->where('id', $id)->first());
            if ($emit !== null) {
                $emit('message', ['message' => $userMessage]);
            }
            $answered = true;
            try {
                $reply = $this->model->reply($user, $text, $emit === null ? null : function (string $piece) use ($emit): void {
                    if ($piece !== '') {
                        $emit('delta', ['text' => $piece, 'segment' => 0]);
                    }
                }, $thread->id);
            } catch (\Throwable $error) {
                $answered = false;
                Log::error('Coach reply failed', ['type' => $error::class, 'message' => $error->getMessage(), 'file' => $error->getFile(), 'line' => $error->getLine()]);
                $reply = ['text' => $error instanceof Problem ? $error->messageFa : 'الان نتوانستم جواب بدهم. یک بار دیگر بفرست.', 'tokensIn' => 0, 'tokensOut' => 0, 'costMicros' => 0, 'model' => 'unavailable'];
            }
            $assistant = Crypto::uuid();
            $this->db->transaction(function () use ($assistant, $thread, $user, $reply, $id): void {
                $this->db->table('coach_messages')->insert(['id' => $assistant, 'thread_id' => $thread->id, 'user_id' => $user, 'role' => 'assistant', 'type' => 'text', 'fallback_text' => $reply['text'], 'reply_to' => $id, 'model' => $reply['model'] ?? 'unreported', 'tokens_in' => $reply['tokensIn'] ?? 0, 'tokens_out' => $reply['tokensOut'] ?? 0, 'payload' => '{}']);
                $this->usage($user, $reply['costMicros'], 1, 0);
                $this->db->table('coach_threads')->where('id', $thread->id)->update(['last_message_at' => $this->db->raw('current_timestamp(6)')]);
            });

            return ['replay' => false, 'metered' => $answered, 'streamed' => $emit !== null, 'userMessage' => $userMessage, 'replies' => [$this->message($this->db->table('coach_messages')->where('id', $assistant)->first())], 'blocked' => null];
        });
    }

    public function photo(string $user, string $client, string $bytes, string $mime, ?string $threadId = null, string $caption = '', string $mealType = 'lunch'): array
    {
        return $this->serial($user, fn () => $this->photoInThread($user, $client, $bytes, $mime, $threadId, $caption, $mealType));
    }

    private function photoInThread(string $user, string $client, string $bytes, string $mime, ?string $threadId, string $caption, string $mealType): array
    {
        try {
            $detected = MediaSignature::inspect('image', $mime, $bytes);
        } catch (\InvalidArgumentException) {
            throw new Problem(400, 'invalid_media', 'محتوای فایل با نوع مجاز یکی نیست');
        }
        $thread = $this->ensure($user, $threadId);
        $prior = $this->db->table('coach_messages')->where(['thread_id' => $thread->id, 'client_message_id' => $client])->first();
        $replies = $prior === null ? [] : $this->replies($prior->id);
        if ($replies !== []) {
            return ['replay' => true, 'userMessage' => $this->message($prior), 'messages' => $replies];
        }
        app(CoachQuotaService::class)->requireVision($user);
        if ($prior === null) {
            $media = Crypto::uuid();
            $message = Crypto::uuid();
            $this->db->transaction(function () use ($media, $message, $user, $detected, $bytes, $thread, $client, $caption, $mealType): void {
                $this->db->table('coach_media')->insert(['id' => $media, 'user_id' => $user, 'mime' => $detected, 'byte_size' => strlen($bytes), 'content' => $bytes]);
                $this->db->table('coach_messages')->insert(['id' => $message, 'thread_id' => $thread->id, 'user_id' => $user, 'role' => 'user', 'type' => 'photo', 'fallback_text' => $caption, 'client_message_id' => $client, 'payload' => json_encode(['mediaId' => $media, 'mealType' => $mealType, 'caption' => $caption], JSON_UNESCAPED_UNICODE)]);
            });
        } else {
            $message = $prior->id;
            $media = json_decode($prior->payload, true)['mediaId'];
            $stored = json_decode($prior->payload, true);
            $caption = $stored['caption'] ?? $prior->fallback_text;
            $mealType = $stored['mealType'] ?? 'lunch';
            $savedMedia = $this->db->table('coach_media')->where(['id' => $media, 'user_id' => $user])->first(['content', 'mime']);
            $bytes = $savedMedia->content;
            $detected = $savedMedia->mime;
        }
        app(CoachThreads::class)->touch($thread->id, 'عکس غذا');
        try {
            $analysis = $this->model->analyzePhoto($user, base64_encode($bytes), 'وعده: '.$mealType."\n".$caption, $detected);
        } catch (\Throwable $error) {
            Log::error('Coach photo failed', ['type' => $error::class, 'message' => $error->getMessage(), 'file' => $error->getFile(), 'line' => $error->getLine()]);
            throw $error instanceof Problem ? $error : new Problem(503, 'outcome_unknown', 'الان نتوانستم عکس را بخوانم. یک بار دیگر بفرست.');
        }
        $assistant = Crypto::uuid();
        $foods = $analysis['foods'] ?? [];
        $kcal = (int) array_sum(array_map(fn ($food) => (int) ($food['kcal'] ?? 0), $foods));
        $entry = $foods === [] ? null : Crypto::uuid();
        $text = $entry === null
            ? 'غذا را با اطمینان تشخیص ندادم. اسم غذا و مقدار تقریبی‌اش را بنویس یا یک عکس واضح‌تر بفرست.'
            : 'در عکس '.implode(' و ', array_column($foods, 'name')).' می‌بینم.'."\n".
                implode("\n", array_map(fn ($food) => $food['name'].'؛ '.($food['servingLabel'] ?? 'سهم تقریبی').'، حدود '.$this->faDigits((int) ($food['kcal'] ?? 0)).' کالری', $foods)).
                "\nمقدار و کالری از روی عکس تخمینی‌اند.";
        $questions = array_values(array_filter($analysis['questions'] ?? [], 'is_string'));
        if ($questions !== []) {
            $text .= "\n".mb_substr($questions[0], 0, 180);
        }
        $title = implode(' و ', array_column(array_slice($foods, 0, 2), 'name'));
        $title = mb_substr($title, 0, 120);
        $items = array_map(fn ($food, $index) => [...$food, 'servings' => 1, 'lineIndex' => $index], $foods, array_keys($foods));
        $totals = ['kcal' => $kcal];
        $proposal = null;
        if ($entry !== null && (float) $analysis['confidence'] >= .6) {
            try {
                $proposal = app(CoachPhotoPlan::class)->preview($user, $items, $mealType);
                $text .= "\n\n".$this->photoPlanQuestion($proposal);
            } catch (Problem $error) {
                $text .= "\n\n".$error->messageFa;
            }
        } elseif ($entry !== null) {
            $text .= "\nبرای اضافه‌کردن به برنامه، اول نام غذا را تأیید کن یا عکس واضح‌تری بفرست.";
        }
        $payload = ['entryId' => $entry, 'mediaId' => $media, 'title' => $title, 'mealType' => $mealType, 'items' => $items, 'totals' => $totals, 'status' => 'suggested', 'confidence' => $analysis['confidence'], 'needsConfirmation' => $proposal !== null, 'questions' => $questions, 'estimated' => true,
            'prompt' => $text, 'planProposal' => $proposal, 'planDecision' => $proposal === null ? 'unavailable' : 'pending',
            'options' => $proposal === null ? [] : $this->photoPlanOptions($entry)];
        $this->db->transaction(function () use ($assistant, $thread, $user, $entry, $message, $media, $analysis, $text, $payload, $mealType, $title, $items, $totals): void {
            $this->db->table('coach_messages')->insert(['id' => $assistant, 'thread_id' => $thread->id, 'user_id' => $user, 'role' => 'assistant', 'type' => $payload['planProposal'] === null ? 'text' : 'quick_replies', 'fallback_text' => $text, 'reply_to' => $message, 'tokens_in' => $analysis['tokensIn'], 'tokens_out' => $analysis['tokensOut'], 'payload' => json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR)]);
            if ($entry !== null) {
                $this->db->table('coach_food_entries')->insert([
                    'id' => $entry, 'user_id' => $user, 'thread_id' => $thread->id, 'message_id' => $assistant, 'media_id' => $media,
                    'civil_date' => CivilDates::today(), 'meal_type' => $mealType, 'title' => $title, 'source' => 'photo',
                    'items' => json_encode($items, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR), 'totals' => json_encode($totals),
                    'confidence' => max(0, min(1, (float) $analysis['confidence'])), 'status' => 'suggested',
                ]);
            }
            $this->usage($user, $analysis['costMicros'], 0, 1);
        });

        return ['replay' => false, 'mediaId' => $media, 'messageId' => $message, 'entryId' => $entry, 'status' => $entry === null ? 'unrecognized' : 'suggested', 'analysis' => $analysis, 'userMessage' => $this->message($this->db->table('coach_messages')->where('id', $message)->first()), 'messages' => $this->replies($message)];
    }

    public function followUps(string $user): array
    {
        return app(FollowUpQuestions::class)->forUser($user);
    }

    public function confirmPhoto(string $user, string $entryId): array
    {
        return $this->savePhoto($user, $entryId);
    }

    public function media(string $user, string $id): ?array
    {
        $row = $this->db->table('coach_media')->where(['id' => $id, 'user_id' => $user])->first();

        return $row === null ? null : ['mime' => $row->mime, 'content' => $row->content];
    }

    public function today(string $user): array
    {
        $day = CivilDates::today();
        $water = (int) ($this->db->table('coach_water')->where(['user_id' => $user, 'civil_date' => $day])->value('ml') ?? 0);
        $entries = $this->db->table('coach_food_entries')->where(['user_id' => $user, 'civil_date' => $day, 'status' => 'logged'])->pluck('totals');
        $photoKcal = $entries->sum(fn ($row) => (int) (json_decode($row, true)['kcal'] ?? 0));
        $plannedKcal = $this->db->table('meal_logs as l')->join('plan_meals as m', 'm.id', '=', 'l.plan_meal_id')
            ->where(['l.user_id' => $user, 'l.scheduled_date' => $day, 'l.eaten' => true])
            ->get(['l.details', 'm.calories'])->sum(fn ($row) => (int) (json_decode($row->details, true)['consumedCalories'] ?? $row->calories));
        $target = $this->db->table('nutrition_profiles')->where('user_id', $user)->value('target_kcal');

        return ['date' => $day, 'waterMl' => $water, 'water' => ['ml' => $water], 'meals' => $entries->count(), 'calories' => ['consumed' => $photoKcal + $plannedKcal, 'target' => $target], 'notADiagnosis' => true];
    }

    public function dayBrief(string $user, ?string $threadId = null): array
    {
        $thread = $this->ensure($user, $threadId);
        $today = CivilDates::today();
        if ($this->db->table('coach_threads')->where('user_id', $user)->where('day_brief_date', $today)->exists()) {
            return ['date' => $today, 'created' => false];
        }
        $follow = app(FollowUpQuestions::class)->forUser($user);
        $brief = 'خلاصهٔ امروز آماده است';
        $options = [];
        if ($follow !== []) {
            $brief .= "\n".$follow[0]['text'];
            if (isset($follow[0]['options'])) {
                $options = $follow[0]['options'];
            } elseif (($follow[0]['key'] ?? '') === 'kitchen') {
                $options = [
                    ['label' => 'وقت آشپزی دارم', 'value' => 'وقت آشپزی دارم'],
                    ['label' => 'غذای سریع می‌خواهم', 'value' => 'غذای سریع می‌خواهم'],
                ];
            } elseif (($follow[0]['key'] ?? '') === 'weight') {
                $options = [['label' => 'ثبت وزن', 'value' => 'می‌خواهم وزن امروز را ثبت کنم']];
            }
        }
        $messageId = Crypto::uuid();
        $this->db->table('coach_messages')->insert(['id' => $messageId, 'thread_id' => $thread->id, 'user_id' => $user, 'role' => 'assistant', 'type' => 'day_brief', 'fallback_text' => $brief, 'payload' => json_encode(['note' => $brief, 'followUps' => $follow, 'options' => $options], JSON_UNESCAPED_UNICODE)]);
        $this->db->table('coach_threads')->where('id', $thread->id)->update(['day_brief_date' => $today]);

        return ['date' => $today, 'created' => true, 'message' => $this->message($this->db->table('coach_messages')->where('id', $messageId)->first())];
    }

    public function action(string $user, string $client, string $action, array $args = [], ?string $label = null, ?string $threadId = null): array
    {
        return $this->serial($user, function () use ($user, $client, $action, $args, $label, $threadId): array {
            $thread = $this->ensure($user, $threadId);
            $prior = $this->db->table('coach_messages')->where(['thread_id' => $thread->id, 'client_message_id' => $client])->first();
            if ($prior !== null) {
                return ['userMessage' => $this->message($prior), 'messages' => $this->replies($prior->id), 'today' => $this->today($user)];
            }
            $local = match ($action) {
                'confirm_photo_plan', 'dismiss_photo_plan' => $this->decidePhotoPlan($user, $thread->id, (string) ($args['entryId'] ?? ''), $action === 'confirm_photo_plan'),
                'log_weight' => $this->weightAction($user, $args),
                'log_water' => $this->waterAction($user, $args),
                'mood' => $this->moodAction($user, $args),
                'confirm_swap' => $this->swapConfirm($user, $args),
                'undo_meal' => ['text' => $this->actions->clearMeal($user, is_string($args['mealType'] ?? null) ? $args['mealType'] : null), 'userText' => 'اصلاح وعده'],
                'dismiss' => ['text' => 'باشه، دست نمی‌زنم.', 'userText' => 'نه'],
                default => null,
            };
            if ($local !== null) {
                $userText = is_string($label) && $label !== '' && $label !== $action ? $label : $local['userText'];
                $userMessage = Crypto::uuid();
                $assistant = Crypto::uuid();
                $this->db->table('coach_messages')->insert(['id' => $userMessage, 'thread_id' => $thread->id, 'user_id' => $user, 'role' => 'user', 'type' => 'text', 'fallback_text' => $userText, 'client_message_id' => $client, 'payload' => '{}']);
                $this->db->table('coach_messages')->insert(['id' => $assistant, 'thread_id' => $thread->id, 'user_id' => $user, 'role' => 'assistant', 'type' => $local['type'] ?? 'text', 'fallback_text' => $local['text'], 'reply_to' => $userMessage, 'payload' => json_encode($local['payload'] ?? new \stdClass, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR)]);

                app(CoachThreads::class)->touch($thread->id, $userText);

                return ['userMessage' => $this->message($this->db->table('coach_messages')->where('id', $userMessage)->first()), 'messages' => [$this->message($this->db->table('coach_messages')->where('id', $assistant)->first())], 'today' => $this->today($user)];
            }
            $accepted = $this->accept($user, $client, $action, null, $thread->id);

            return ['userMessage' => $accepted['userMessage'], 'messages' => $accepted['replies'], 'today' => $this->today($user)];
        });
    }

    /** A connection-scoped lock serializes a thread without rolling back paid model usage on provider failure. */
    private function serial(string $user, \Closure $work): mixed
    {
        $lock = hash('sha256', 'coach:'.$user);
        if ((int) $this->db->selectOne('select get_lock(?,0) as acquired', [$lock])->acquired !== 1) {
            throw new Problem(409, 'coach_busy', 'پاسخ قبلی هنوز در حال آماده شدن است');
        }
        try {
            return $work();
        } finally {
            $this->db->selectOne('select release_lock(?) as released', [$lock]);
        }
    }

    public function patch(string $user, string $entry, string $title, ?string $mealType = null, ?array $items = null): array
    {
        if (! $this->db->table('nutrition_profiles')->where('user_id', $user)->exists()) {
            throw new Problem(409, 'no_profile', 'اول پرسش‌نامهٔ تغذیه را کامل کن.');
        }
        if ($items !== null) {
            return $this->savePhoto($user, $entry, $title, $mealType, $items);
        }
        $updated = $this->db->table('coach_food_entries')->where(['id' => $entry, 'user_id' => $user])->update(['title' => $title]);
        if ($updated === 0) {
            throw new Problem(404, 'not_found', 'وعده پیدا نشد');
        }

        return ['entry' => ['id' => $entry, 'title' => $title], 'today' => $this->today($user)];
    }

    private function photoPlanOptions(string $entry): array
    {
        return [
            ['label' => 'بله، به برنامه اضافه کن', 'action' => 'confirm_photo_plan', 'args' => ['entryId' => $entry]],
            ['label' => 'نه، اضافه نکن', 'action' => 'dismiss_photo_plan', 'args' => ['entryId' => $entry]],
        ];
    }

    private function photoPlanQuestion(array $proposal): string
    {
        $meal = ['breakfast' => 'صبحانه', 'lunch' => 'ناهار', 'dinner' => 'شام', 'snack' => 'میان‌وعده'][$proposal['mealType']];

        return 'با برنامهٔ امروزت بررسی کردم. سهم پیشنهادی: '.$this->faDigits($proposal['snapshot']['servingDisplay']).'؛ '.$this->faDigits($proposal['kcal']).' کالری.'.
            "\nمی‌خوای این رو به برنامهٔ غذاییت اضافه کنم؟ با تأییدت، جای «".$proposal['oldTitle'].'» در '.$meal.' امروز قرار می‌گیرد و به‌عنوان غذای خورده‌شده ثبت نمی‌شود.';
    }

    private function photoReply(string $user, string $thread, string $text, ?string $replyTo): ?array
    {
        $answer = trim(preg_replace('/[،,.!؟?\s]+/u', ' ', str_replace("\u{200c}", ' ', $text)));
        $yes = in_array($answer, ['بله', 'آره', 'اره', 'باشه', 'بله اضافه کن', 'اضافه کن', 'بله به برنامه اضافه کن'], true);
        $no = in_array($answer, ['نه', 'خیر', 'نه ممنون', 'نه اضافه نکن', 'اضافه نکن'], true);
        if (! $yes && ! $no) {
            return null;
        }
        $message = $this->db->table('coach_messages')->where(['user_id' => $user, 'thread_id' => $thread, 'role' => 'assistant'])
            ->when($replyTo !== null, fn ($query) => $query->where('id', $replyTo))->orderByDesc('seq')->first();
        $payload = $message === null ? [] : (json_decode($message->payload, true) ?: []);
        if (($payload['planDecision'] ?? null) !== 'pending' || ! is_string($payload['entryId'] ?? null)) {
            return null;
        }

        return $this->decidePhotoPlan($user, $thread, $payload['entryId'], $yes);
    }

    private function decidePhotoPlan(string $user, string $thread, string $entryId, bool $accept): array
    {
        return $this->db->transaction(function () use ($user, $thread, $entryId, $accept): array {
            $entry = $this->db->table('coach_food_entries')->where(['id' => $entryId, 'user_id' => $user, 'thread_id' => $thread, 'source' => 'photo'])->lockForUpdate()->first();
            if ($entry === null) {
                throw new Problem(404, 'not_found', 'پیشنهاد عکس در این گفتگو پیدا نشد.');
            }
            $source = $this->db->table('coach_messages')->where('id', $entry->message_id)->lockForUpdate()->first();
            $payload = $source === null ? [] : (json_decode($source->payload, true) ?: []);
            $result = ['userText' => $accept ? 'بله، به برنامه اضافه کن' : 'نه، اضافه نکن'];
            if (($payload['planDecision'] ?? null) !== 'pending') {
                return [...$result, 'text' => ($payload['planDecision'] ?? null) === 'added' ? 'این غذا قبلاً به برنامه اضافه شده است.' : 'این پیشنهاد برای اضافه‌شدن فعال نیست.'];
            }
            $decision = 'declined';
            $text = 'باشه، چیزی به برنامه اضافه نکردم.';
            if ($accept) {
                if ($entry->civil_date !== CivilDates::today()) {
                    return [...$result, 'text' => 'این پیشنهاد برای روز قبل است؛ عکس را برای بررسی با برنامهٔ امروز دوباره بفرست.'];
                }
                try {
                    $proposal = app(CoachPhotoPlan::class)->preview($user, json_decode($entry->items, true), $entry->meal_type);
                } catch (Problem $error) {
                    return [...$result, 'text' => $error->messageFa];
                }
                if (($payload['planProposal']['checkKey'] ?? null) !== $proposal['checkKey']) {
                    $text = 'برنامه یا اطلاعات غذا تغییر کرده؛ دوباره بررسی کردم.'."\n".$this->photoPlanQuestion($proposal);
                    $payload = [...$payload, 'planProposal' => $proposal, 'prompt' => $text, 'options' => $this->photoPlanOptions($entryId)];
                    $this->db->table('coach_messages')->where('id', $source->id)->update(['payload' => json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR)]);

                    return [...$result, 'type' => 'quick_replies', 'text' => $text, 'payload' => $payload];
                }
                app(CoachPhotoPlan::class)->apply($user, $proposal);
                $decision = 'added';
                $text = '«'.$proposal['title'].'» با سهم بررسی‌شده به برنامهٔ امروزت اضافه شد و جای «'.$proposal['oldTitle'].'» قرار گرفت. در تب برنامه می‌بینی؛ مصرفش را بعد از خوردن ثبت کن.';
            }
            $payload = [...$payload, 'planDecision' => $decision, 'needsConfirmation' => false, 'options' => []];
            $this->db->table('coach_messages')->where('id', $source->id)->update(['payload' => json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR)]);

            return [...$result, 'text' => $text, 'payload' => ['text' => $text, 'planChanged' => $accept, 'photoEntryId' => $entryId]];
        });
    }

    private function savePhoto(string $user, string $entryId, ?string $title = null, ?string $mealType = null, ?array $edited = null): array
    {
        return $this->db->transaction(function () use ($user, $entryId, $title, $mealType, $edited): array {
            $entry = $this->db->table('coach_food_entries')->where(['id' => $entryId, 'user_id' => $user, 'source' => 'photo'])->lockForUpdate()->first();
            if ($entry === null) {
                throw new Problem(404, 'not_found', 'غذای پیشنهادی پیدا نشد');
            }
            $message = $this->db->table('coach_messages')->where('id', $entry->message_id)->first();
            $response = ['entryId' => $entryId, 'status' => 'logged', 'replay' => $entry->status === 'logged'];
            if ($entry->status === 'logged') {
                return [...$response, 'message' => $message ? $this->message($message) : null];
            }
            $items = json_decode($entry->items, true, 512, JSON_THROW_ON_ERROR);
            $originalCount = count($items);
            if ($items === [] || $edited === [] || ($edited !== null && count($edited) > count($items))) {
                throw new Problem(422, 'invalid_meal_items', 'ابتدا غذای تشخیص‌داده‌شده و مقدار آن را بررسی کن');
            }
            $selected = [];
            $edits = $edited ?? array_map(fn ($item) => ['name' => $item['name'], 'servings' => 1], $items);
            foreach ($edits as $index => $edit) {
                $edit = (array) $edit;
                $line = $edit['lineIndex'] ?? $index;
                $quantity = $edit['servings'] ?? null;
                if (! is_int($line) || ! isset($items[$line]) || isset($selected[$line]) || ! is_numeric($quantity) || $quantity < .25 || $quantity > 8 || ($edit['name'] ?? '') !== $items[$line]['name']) {
                    throw new Problem(422, 'invalid_portion', 'مقدار این سهم معتبر نیست');
                }
                $item = $items[$line];
                $selected[$line] = [...$item, 'servings' => (float) $quantity, 'kcal' => (int) round($item['kcal'] * $quantity)];
            }
            $items = array_values($selected);
            if (count($items) < $originalCount) {
                $title = mb_substr(implode(' و ', array_column(array_slice($items, 0, 2), 'name')), 0, 120);
            }
            $totals = ['kcal' => array_sum(array_column($items, 'kcal'))];
            $title ??= $entry->title;
            $mealType ??= $entry->meal_type;
            $this->db->table('coach_food_entries')->where('id', $entryId)->update([
                'title' => $title, 'meal_type' => $mealType, 'items' => json_encode($items, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR), 'totals' => json_encode($totals),
                'status' => 'logged', 'logged_at' => $this->db->raw('current_timestamp(6)'),
            ]);
            if ($message !== null) {
                $payload = json_decode($message->payload, true) ?: [];
                $message->payload = json_encode([...$payload, 'title' => $title, 'mealType' => $mealType, 'items' => $items, 'totals' => $totals, 'status' => 'logged', 'needsConfirmation' => false], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
                $message->fallback_text = 'وعده ثبت شد.';
                $this->db->table('coach_messages')->where('id', $message->id)->update(['payload' => $message->payload, 'fallback_text' => $message->fallback_text]);
            }

            return [...$response, 'message' => $message ? $this->message($message) : null, 'kcal' => $totals['kcal'], 'today' => $this->today($user)];
        });
    }

    public function proactive(): int
    {
        $sent = 0;
        $today = CivilDates::today();
        // Current hour in Tehran time (UTC+3:30)
        $tehranHour = (int) (new \DateTimeImmutable('now', new \DateTimeZone('Asia/Tehran')))->format('G');

        foreach ($this->db->table('coach_threads as t')
            ->join('users u', 'u.id', '=', 't.user_id')
            ->where('u.role', 'user')
            ->whereRaw('t.id = (select latest.id from coach_threads latest where latest.user_id = t.user_id order by latest.last_message_at desc, latest.created_at desc, latest.id desc limit 1)')
            ->select(['t.id', 't.user_id', 't.last_message_at'])
            ->get() as $thread) {

            $user = $thread->user_id;

            // Determine which proactive trigger is relevant right now
            $message = $this->pickProactiveMessage($user, $today, $tehranHour, $thread->last_message_at);
            if ($message === null) {
                continue;
            }

            $dedupeKey = 'proactive:'.$user.':'.$today.':'.$message['kind'];
            if ($this->db->table('coach_engagement')->where('dedupe_key', $dedupeKey)->exists()) {
                continue;
            }

            $this->db->table('coach_messages')->insert([
                'id' => Crypto::uuid(),
                'thread_id' => $thread->id,
                'user_id' => $user,
                'role' => 'assistant',
                'type' => 'proactive',
                'fallback_text' => $message['text'],
                'payload' => json_encode(['proactive_kind' => $message['kind']]),
            ]);
            $this->db->table('coach_engagement')->insert([
                'id' => Crypto::uuid(),
                'user_id' => $user,
                'kind' => $message['kind'],
                'day' => $today,
                'dedupe_key' => $dedupeKey,
            ]);
            $this->db->table('notifications')->insert([
                'id' => Crypto::uuid(),
                'user_id' => $user,
                'kind' => 'coach_proactive',
                'payload' => json_encode(['text' => $message['text'], 'proactiveKind' => $message['kind']], JSON_UNESCAPED_UNICODE),
            ]);
            $sent++;
        }

        return $sent;
    }

    /**
     * Decide which proactive message (if any) fits the user right now.
     * Returns null if none should be sent.
     */
    private function pickProactiveMessage(string $user, string $today, int $tehranHour, ?string $lastMessageAt): ?array
    {
        // 1. Lunch reminder — if no lunch logged by 13:00
        if ($tehranHour === 13) {
            $lunchLogged = $this->db->table('meal_logs as l')
                ->join('plan_meals as m', 'm.id', '=', 'l.plan_meal_id')
                ->where('l.user_id', $user)
                ->where('l.scheduled_date', $today)
                ->where('m.meal_type', 'lunch')
                ->where('l.eaten', 1)
                ->exists();
            if (! $lunchLogged) {
                return ['kind' => 'lunch_reminder', 'text' => 'هنوز ناهارت رو ثبت نکردی 🍽️ فرصت کردی غذا بخوری؟'];
            }
        }

        // 2. Evening weight reminder — if no weight entry this week (Sunday 21:00)
        if ($tehranHour === 21) {
            $dayOfWeek = (int) (new \DateTimeImmutable($today))->format('w'); // 0=Sunday
            if ($dayOfWeek === 0) {
                $hasWeight = $this->db->table('weight_entries')
                    ->where('user_id', $user)
                    ->where('civil_date', '>=', CivilDates::add($today, -7))
                    ->exists();
                if (! $hasWeight) {
                    return ['kind' => 'weight_reminder', 'text' => 'این هفته وزنت رو ثبت نکردی ⚖️ می‌خوای روندت رو بررسی کنیم؟'];
                }
            }
        }

        // 3. Inactivity message — no interaction for 3+ days
        if ($lastMessageAt !== null) {
            $daysSinceLastMessage = (int) ((new \DateTimeImmutable($today))->diff(new \DateTimeImmutable(substr($lastMessageAt, 0, 10))))->days;
            if ($daysSinceLastMessage >= 3 && $tehranHour === 10) {
                return ['kind' => 'inactivity', 'text' => 'دلتنگت شدم! 😊 همه چیز خوبه؟ بیا ببینیم این هفته چطور پیش رفتی.'];
            }
        }

        // 4. Week summary on Saturday morning
        if ($tehranHour === 9) {
            $dayOfWeek = (int) (new \DateTimeImmutable($today))->format('w');
            if ($dayOfWeek === 6) { // Saturday = start of Persian week
                $hasPlan = $this->db->table('active_plan_versions')->where('user_id', $user)->exists();
                if ($hasPlan) {
                    return ['kind' => 'week_start', 'text' => 'هفته جدید شروع شد 🌱 بیا برنامه این هفته‌ت رو مرور کنیم!'];
                }
            }
        }

        return null;
    }

    private function factual(string $user, string $text): string|array|null
    {
        $intent = $this->intents->parse($text);
        $memory = $this->actions->remember($user, $text);
        if ($intent['intent'] === 'check_progress') {
            return null;
        }
        if ($intent['intent'] === 'remember') {
            return $memory ?? ['type' => 'text', 'text' => 'کدام غذا را بگویم یادداشت کنم؟', 'payload' => ['text' => 'کدام غذا را بگویم یادداشت کنم؟']];
        }
        if ($intent['confidence'] < 0.8) {
            return $memory;
        }
        if ($intent['intent'] === 'log_mood' && is_string($intent['params']['mood'] ?? null)) {
            return $this->moodAction($user, ['mood' => $intent['params']['mood']])['text'];
        }

        return match ($intent['intent']) {
            'log_weight' => $this->saveWeight($user, $intent['params']['weight'] ?? null) ?? $memory,
            'log_water' => $this->saveWater($user, (int) ($intent['params']['ml'] ?? 250)),
            'swap_meal' => $this->actions->swap($user, $text) ?? $memory,
            'log_consumption' => $this->actions->logMeal($user, $text) ?? $memory,
            default => $this->actions->answer($user, $intent['intent'], $intent['params']) ?? $memory,
        };
    }

    private function alertSpecialist(string $user, string $kind): void
    {
        $specialist = $this->db->table('plan_requests')->where('user_id', $user)->whereNotNull('assigned_specialist_id')->orderByDesc('created_at')->value('assigned_specialist_id');
        if (! is_string($specialist) || $specialist === '') {
            return;
        }
        $this->db->table('notifications')->insert([
            'id' => Crypto::uuid(),
            'user_id' => $specialist,
            'kind' => $kind,
            'payload' => json_encode(['userId' => $user], JSON_THROW_ON_ERROR),
        ]);
    }

    /**
     * @param  array<string, mixed>  $args
     * @return array{text: string, userText: string}
     */
    /**
     * @return array{type: string, text: string, payload: array<string, mixed>}
     */
    private function shapeLocal(string|array $local): array
    {
        if (is_string($local)) {
            return ['type' => 'safety', 'text' => $local, 'payload' => ['text' => $local]];
        }
        $text = (string) ($local['text'] ?? '');
        $payload = is_array($local['payload'] ?? null) ? $local['payload'] : [];
        if (! isset($payload['text']) || ! is_string($payload['text']) || trim($payload['text']) === '') {
            $payload['text'] = $text;
        }

        return ['type' => (string) ($local['type'] ?? 'text'), 'text' => $text, 'payload' => $payload];
    }

    /**
     * @param  array<string, mixed>  $args
     * @return array{text: string, userText: string}
     */
    private function swapConfirm(string $user, array $args): array
    {
        $mealId = is_string($args['mealId'] ?? null) ? $args['mealId'] : '';
        $slug = is_string($args['foodSlug'] ?? null) ? $args['foodSlug'] : '';
        $reason = is_string($args['reason'] ?? null) ? $args['reason'] : 'variety';
        if (! in_array($reason, ['budget', 'dislike', 'time', 'unavailable', 'variety'], true)) {
            $reason = 'variety';
        }
        if ($mealId === '' || $slug === '') {
            return ['text' => 'این جایگزین دیگر در دسترس نیست.', 'userText' => 'تعویض وعده'];
        }
        try {
            $applied = app(MealSwapService::class)->apply($user, $mealId, $slug, $reason);
        } catch (Problem $error) {
            return ['text' => $error->messageFa, 'userText' => 'تعویض وعده'];
        }
        $title = (string) ($applied['newMeal']['title'] ?? 'وعده جدید');

        return ['text' => 'ثبت شد. حالا «'.$title.'» است.', 'userText' => $title];
    }

    private function weightAction(string $user, array $args): array
    {
        $weight = $args['kilograms'] ?? $args['value'] ?? null;
        $saved = $this->saveWeight($user, $weight);
        if ($saved === null) {
            return ['text' => 'وزن را به کیلوگرم بفرست؛ مثلاً ۷۵.', 'userText' => 'ثبت وزن'];
        }

        return ['text' => $saved, 'userText' => 'ثبت وزن'];
    }

    /**
     * @param  array<string, mixed>  $args
     * @return array{text: string, userText: string}
     */
    private function waterAction(string $user, array $args): array
    {
        $ml = $args['ml'] ?? 250;
        if (! is_numeric($ml)) {
            $ml = 250;
        }

        return ['text' => $this->saveWater($user, (int) $ml), 'userText' => 'ثبت آب'];
    }

    /**
     * @param  array<string, mixed>  $args
     * @return array{text: string, userText: string}
     */
    private function moodAction(string $user, array $args): array
    {
        $mood = is_string($args['mood'] ?? null) ? trim($args['mood']) : '';
        $allowed = ['عالی', 'خوب', 'معمولی', 'خسته'];
        if (! in_array($mood, $allowed, true)) {
            return ['text' => 'حال امروزت را از بین عالی، خوب، معمولی یا خسته بگو.', 'userText' => 'حال امروز'];
        }
        $this->db->table('coach_preferences')->where(['user_id' => $user, 'pref_key' => 'mood'])->update(['active' => false]);
        $this->db->table('coach_preferences')->insert([
            'id' => Crypto::uuid(),
            'user_id' => $user,
            'pref_key' => 'mood',
            'value' => CivilDates::today().' '.$mood,
            'source' => 'user',
            'strength' => 2,
            'active' => true,
        ]);

        return ['text' => 'حال «'.$mood.'» امروزت را یادداشت کردم.', 'userText' => 'حال امروز: '.$mood];
    }

    private function faDigits(int|float|string $value): string
    {
        return strtr((string) $value, ['0' => '۰', '1' => '۱', '2' => '۲', '3' => '۳', '4' => '۴', '5' => '۵', '6' => '۶', '7' => '۷', '8' => '۸', '9' => '۹', '.' => '٫']);
    }

    private function saveWeight(string $user, mixed $weight): ?string
    {
        if (! is_numeric($weight) || (float) $weight <= 0) {
            return null;
        }
        try {
            $saved = $this->tracking->setWeight($user, (float) $weight);
        } catch (Problem $error) {
            return $error->messageFa;
        }

        return 'وزن '.$this->faDigits($saved['kilograms']).' کیلوگرم برای امروز ثبت شد.';
    }

    private function saveWater(string $user, int $ml = 250): string
    {
        $ml = max(50, min(1500, $ml));
        $day = CivilDates::today();
        $this->db->statement('insert into coach_water (user_id,civil_date,ml) values (?,?,?) as incoming on duplicate key update ml=coach_water.ml+incoming.ml, updated_at=current_timestamp(6)', [$user, $day, $ml]);
        $total = (int) $this->db->table('coach_water')->where(['user_id' => $user, 'civil_date' => $day])->value('ml');

        return $this->faDigits($ml).' میلی‌لیتر آب ثبت شد. مجموع امروز '.$this->faDigits($total).' میلی‌لیتر است.';
    }

    private function ensure(string $user, ?string $threadId = null): object
    {
        return app(CoachThreads::class)->resolve($user, $threadId);
    }

    private function replies(string $userMessage): array
    {
        return array_map(fn ($row) => $this->message($row), $this->db->table('coach_messages')->where('reply_to', $userMessage)->orderBy('seq')->get()->all());
    }

    private function blocked(): ?string
    {
        $controls = $this->db->table('ai_controls')->where('id', 1)->first();
        if ($controls === null) {
            return null;
        }
        if ((int) $controls->kill_switch === 1) {
            return 'kill_switch';
        }
        if ($controls->daily_cost_cap_micros !== null) {
            $spent = (int) $this->db->table('coach_usage')->where('day', CivilDates::today())->sum('cost_micros');
            if ($spent >= (int) $controls->daily_cost_cap_micros) {
                return 'cost_cap';
            }
        }

        return null;
    }

    private function usage(string $user, int $cost, int $turns, int $vision): void
    {
        $this->db->statement('insert into coach_usage (user_id,day,chat_turns,vision_calls,cost_micros) values (?,?,?,?,?) on duplicate key update chat_turns=coach_usage.chat_turns+VALUES(chat_turns), vision_calls=coach_usage.vision_calls+VALUES(vision_calls), cost_micros=coach_usage.cost_micros+VALUES(cost_micros)', [$user, CivilDates::today(), $turns, $vision, $cost]);
    }

    private function message(object $row): array
    {
        $payload = json_decode((string) ($row->payload ?? '{}'), true);
        if (! is_array($payload)) {
            $payload = [];
        }
        $text = is_string($row->fallback_text) ? $row->fallback_text : '';
        if ($text !== '' && (! isset($payload['text']) || ! is_string($payload['text']) || trim($payload['text']) === '')) {
            $payload['text'] = $text;
        }
        if ($row->type === 'day_brief' && $text !== '' && (! isset($payload['note']) || ! is_string($payload['note']) || trim($payload['note']) === '')) {
            $payload['note'] = $text;
        }

        return [
            'id' => $row->id,
            'seq' => (int) $row->seq,
            'role' => $row->role,
            'type' => $row->type === 'safety' ? 'text' : $row->type,
            'payload' => $payload,
            'fallback_text' => $text,
            'client_message_id' => $row->client_message_id,
            'created_at' => Carbon::parse($row->created_at, 'UTC')->toISOString(),
        ];
    }
}
