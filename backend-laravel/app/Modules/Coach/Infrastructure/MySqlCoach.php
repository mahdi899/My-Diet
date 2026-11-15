<?php

namespace App\Modules\Coach\Infrastructure;

use App\Modules\Coach\Application\CoachContextBuilder;
use App\Modules\Coach\Application\CoachGateway;
use App\Modules\Coach\Application\CoachIntentParser;
use App\Modules\Coach\Application\CoachModel;
use App\Modules\Coach\Domain\CoachSafety;
use App\Modules\Messaging\Domain\MediaSignature;
use App\Modules\Plans\Domain\CivilDates;
use App\Modules\Tracking\Application\TrackingService;
use App\Shared\Domain\LegacyCrypto as Crypto;
use App\Shared\Domain\Problem;
use Illuminate\Database\ConnectionInterface;

final class MySqlCoach implements CoachGateway
{
    public function __construct(
        private ConnectionInterface $db,
        private CoachModel $model,
        private CoachIntentParser $intents,
        private CoachContextBuilder $context,
        private TrackingService $tracking,
    ) {}

    public function thread(string $user, ?int $before, int $limit): array
    {
        $thread = $this->ensure($user);
        $query = $this->db->table('coach_messages')->where('thread_id', $thread->id)->orderByDesc('seq');
        if ($before !== null) {
            $query->where('seq', '<', $before);
        }
        $rows = $query->limit($limit + 1)->get();
        $page = $rows->take($limit)->reverse()->values();

        return ['thread' => ['id' => $thread->id, 'dayBriefDate' => $thread->day_brief_date], 'messages' => $page->map(fn ($row) => $this->message($row))->all(), 'nextCursor' => $rows->count() > $limit ? (int) $page->first()->seq : null];
    }

    public function accept(string $user, string $client, string $text): array
    {
        return $this->serial($user, function () use ($user, $client, $text) {
            $thread = $this->ensure($user);
            $prior = $this->db->table('coach_messages')->where(['thread_id' => $thread->id, 'client_message_id' => $client])->first();
            if ($prior !== null) {
                return ['replay' => true, 'userMessage' => $this->message($prior), 'replies' => $this->replies($prior->id), 'blocked' => null];
            }
            $blocked = $this->blocked();
            $id = Crypto::uuid();
            $this->db->table('coach_messages')->insert(['id' => $id, 'thread_id' => $thread->id, 'user_id' => $user, 'role' => 'user', 'type' => 'text', 'fallback_text' => $text, 'client_message_id' => $client, 'payload' => '{}']);
            $local = $blocked === null ? (CoachSafety::localReply($text) ?? $this->factual($user, $text)) : null;
            if ($blocked !== null || $local !== null) {
                $replies = [];
                if ($local !== null) {
                    $assistant = Crypto::uuid();
                    $this->db->table('coach_messages')->insert(['id' => $assistant, 'thread_id' => $thread->id, 'user_id' => $user, 'role' => 'assistant', 'type' => 'safety', 'fallback_text' => $local, 'reply_to' => $id, 'payload' => '{}']);
                    $replies[] = $this->message($this->db->table('coach_messages')->where('id', $assistant)->first());
                }

                return ['replay' => false, 'userMessage' => $this->message($this->db->table('coach_messages')->where('id', $id)->first()), 'replies' => $replies, 'blocked' => $blocked];
            }
            $reply = $this->model->reply($user, $text);
            $assistant = Crypto::uuid();
            $this->db->transaction(function () use ($assistant, $thread, $user, $reply, $id): void {
                $this->db->table('coach_messages')->insert(['id' => $assistant, 'thread_id' => $thread->id, 'user_id' => $user, 'role' => 'assistant', 'type' => 'text', 'fallback_text' => $reply['text'], 'reply_to' => $id, 'model' => $reply['model'] ?? 'unreported', 'tokens_in' => $reply['tokensIn'] ?? 0, 'tokens_out' => $reply['tokensOut'] ?? 0, 'payload' => '{}']);
                $this->usage($user, $reply['costMicros'], 1, 0);
                $this->db->table('coach_threads')->where('id', $thread->id)->update(['last_message_at' => $this->db->raw('current_timestamp(6)')]);
            });

            return ['replay' => false, 'userMessage' => $this->message($this->db->table('coach_messages')->where('id', $id)->first()), 'replies' => [$this->message($this->db->table('coach_messages')->where('id', $assistant)->first())], 'blocked' => null];
        });
    }

    public function photo(string $user, string $client, string $bytes, string $mime): array
    {
        try {
            $detected = MediaSignature::inspect('image', $mime, $bytes);
        } catch (\InvalidArgumentException) {
            throw new Problem(400, 'invalid_media', 'محتوای فایل با نوع مجاز یکی نیست');
        }
        $thread = $this->ensure($user);
        $media = Crypto::uuid();
        $this->db->table('coach_media')->insert(['id' => $media, 'user_id' => $user, 'mime' => $detected, 'byte_size' => strlen($bytes), 'content' => $bytes]);
        $message = Crypto::uuid();
        $this->db->table('coach_messages')->insert(['id' => $message, 'thread_id' => $thread->id, 'user_id' => $user, 'role' => 'user', 'type' => 'photo', 'fallback_text' => '', 'client_message_id' => $client, 'payload' => json_encode(['mediaId' => $media])]);
        $analysis = $this->model->analyzePhoto($user, base64_encode($bytes));
        $assistant = Crypto::uuid();
        $foods = $analysis['foods'] ?? [];
        $kcal = (int) array_sum(array_map(fn ($food) => (int) ($food['kcal'] ?? 0), $foods));
        $title = $foods[0]['name'] ?? 'غذای عکس';
        $text = $analysis['needsConfirmation']
            ? 'این تشخیص قطعی نیست. اگر درست است تأیید کن تا در مصرف امروز ثبت شود.'
            : 'اگر این غذا همان چیزی است که خوردی، تأیید کن تا ثبت شود.';
        if ($analysis['text'] !== '') {
            $text = $analysis['text']."\n".$text;
        }
        $entry = Crypto::uuid();
        $this->db->table('coach_food_entries')->insert([
            'id' => $entry, 'user_id' => $user, 'thread_id' => $thread->id, 'message_id' => $assistant, 'media_id' => $media,
            'civil_date' => CivilDates::today(), 'meal_type' => 'lunch', 'title' => $title, 'source' => 'photo',
            'items' => json_encode($foods, JSON_UNESCAPED_UNICODE), 'totals' => json_encode(['kcal' => $kcal]),
            'confidence' => max(0, min(1, (float) $analysis['confidence'])), 'status' => 'suggested',
        ]);
        $this->db->table('coach_messages')->insert(['id' => $assistant, 'thread_id' => $thread->id, 'user_id' => $user, 'role' => 'assistant', 'type' => 'text', 'fallback_text' => $text, 'reply_to' => $message, 'tokens_in' => $analysis['tokensIn'], 'tokens_out' => $analysis['tokensOut'], 'payload' => json_encode(['entryId' => $entry, 'foods' => $foods, 'confidence' => $analysis['confidence'], 'needsConfirmation' => true], JSON_UNESCAPED_UNICODE)]);
        $this->usage($user, $analysis['costMicros'], 0, 1);

        return ['mediaId' => $media, 'messageId' => $message, 'entryId' => $entry, 'status' => 'suggested', 'analysis' => $analysis];
    }

    public function followUps(string $user): array
    {
        return app(\App\Modules\Coach\Application\FollowUpQuestions::class)->forUser($user);
    }

    public function confirmPhoto(string $user, string $entryId): array
    {
        $entry = $this->db->table('coach_food_entries')->where(['id' => $entryId, 'user_id' => $user])->first();
        if ($entry === null) {
            throw new Problem(404, 'not_found', 'غذای پیشنهادی پیدا نشد');
        }
        if ($entry->status === 'logged') {
            return ['entryId' => $entryId, 'status' => 'logged', 'replay' => true];
        }
        $this->db->table('coach_food_entries')->where('id', $entryId)->update([
            'status' => 'logged', 'logged_at' => $this->db->raw('current_timestamp(6)'),
        ]);

        return ['entryId' => $entryId, 'status' => 'logged', 'replay' => false, 'kcal' => json_decode($entry->totals, true)['kcal'] ?? 0];
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
        $meals = $this->db->table('coach_food_entries')->where(['user_id' => $user, 'civil_date' => $day, 'status' => 'logged'])->count();

        return ['date' => $day, 'waterMl' => $water, 'meals' => $meals, 'notADiagnosis' => true];
    }

    public function dayBrief(string $user): array
    {
        $thread = $this->ensure($user);
        $today = CivilDates::today();
        if ($thread->day_brief_date === $today) {
            return ['date' => $today, 'created' => false];
        }
        $follow = app(\App\Modules\Coach\Application\FollowUpQuestions::class)->forUser($user);
        $brief = 'خلاصهٔ امروز آماده است';
        if ($follow !== []) {
            $brief .= "\n".$follow[0]['text'];
        }
        $this->db->table('coach_messages')->insert(['id' => Crypto::uuid(), 'thread_id' => $thread->id, 'user_id' => $user, 'role' => 'assistant', 'type' => 'day_brief', 'fallback_text' => $brief, 'payload' => json_encode(['followUps' => $follow], JSON_UNESCAPED_UNICODE)]);
        $this->db->table('coach_threads')->where('id', $thread->id)->update(['day_brief_date' => $today]);

        return ['date' => $today, 'created' => true];
    }

    public function action(string $user, string $client, string $action): array
    {
        return $this->serial($user, function () use ($user, $client, $action): array {
            $thread = $this->ensure($user);
            $prior = $this->db->table('coach_messages')->where(['thread_id' => $thread->id, 'client_message_id' => $client])->first();
            if ($prior !== null) {
                return ['userMessage' => $this->message($prior), 'messages' => $this->replies($prior->id), 'today' => $this->today($user)];
            }
            if ($action === 'log_water') {
                $day = CivilDates::today();
                $this->db->statement('insert into coach_water (user_id,civil_date,ml) values (?,?,250) as incoming on duplicate key update ml=coach_water.ml+250, updated_at=current_timestamp(6)', [$user, $day]);
            }
            $accepted = $this->accept($user, $client, $action);

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

    public function patch(string $user, string $entry, string $title): array
    {
        if (! $this->db->table('nutrition_profiles')->where('user_id', $user)->exists()) {
            throw new Problem(409, 'no_profile', 'اول پرسش‌نامهٔ تغذیه را کامل کن.');
        }
        $updated = $this->db->table('coach_food_entries')->where(['id' => $entry, 'user_id' => $user])->update(['title' => $title]);
        if ($updated === 0) {
            throw new Problem(404, 'not_found', 'وعده پیدا نشد');
        }

        return ['entry' => ['id' => $entry, 'title' => $title], 'today' => $this->today($user)];
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
                'id'           => Crypto::uuid(),
                'thread_id'    => $thread->id,
                'user_id'      => $user,
                'role'         => 'assistant',
                'type'         => 'proactive',
                'fallback_text'=> $message['text'],
                'payload'      => json_encode(['proactive_kind' => $message['kind']]),
            ]);
            $this->db->table('coach_engagement')->insert([
                'id'         => Crypto::uuid(),
                'user_id'    => $user,
                'kind'       => $message['kind'],
                'day'        => $today,
                'dedupe_key' => $dedupeKey,
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
            if (!$lunchLogged) {
                return ['kind' => 'lunch_reminder', 'text' => 'هنوز ناهارت رو ثبت نکردی 🍽️ فرصت کردی غذا بخوری؟'];
            }
        }

        // 2. Evening weight reminder — if no weight entry this week (Sunday 21:00)
        if ($tehranHour === 21) {
            $dayOfWeek = (int)(new \DateTimeImmutable($today))->format('w'); // 0=Sunday
            if ($dayOfWeek === 0) {
                $hasWeight = $this->db->table('weight_entries')
                    ->where('user_id', $user)
                    ->where('civil_date', '>=', CivilDates::add($today, -7))
                    ->exists();
                if (!$hasWeight) {
                    return ['kind' => 'weight_reminder', 'text' => 'این هفته وزنت رو ثبت نکردی ⚖️ می‌خوای روندت رو بررسی کنیم؟'];
                }
            }
        }

        // 3. Inactivity message — no interaction for 3+ days
        if ($lastMessageAt !== null) {
            $daysSinceLastMessage = (int)((new \DateTimeImmutable($today))->diff(new \DateTimeImmutable(substr($lastMessageAt, 0, 10))))->days;
            if ($daysSinceLastMessage >= 3 && $tehranHour === 10) {
                return ['kind' => 'inactivity', 'text' => 'دلتنگت شدم! 😊 همه چیز خوبه؟ بیا ببینیم این هفته چطور پیش رفتی.'];
            }
        }

        // 4. Week summary on Saturday morning
        if ($tehranHour === 9) {
            $dayOfWeek = (int)(new \DateTimeImmutable($today))->format('w');
            if ($dayOfWeek === 6) { // Saturday = start of Persian week
                $hasPlan = $this->db->table('active_plan_versions')->where('user_id', $user)->exists();
                if ($hasPlan) {
                    return ['kind' => 'week_start', 'text' => 'هفته جدید شروع شد 🌱 بیا برنامه این هفته‌ت رو مرور کنیم!'];
                }
            }
        }

        return null;
    }

    private function factual(string $user, string $text): ?string
    {
        $intent = $this->intents->parse($text);
        if ($intent['confidence'] < 0.8) {
            return null;
        }

        return match ($intent['intent']) {
            'show_plan' => $this->planText($user),
            'log_weight' => $this->saveWeight($user, $intent['params']['weight'] ?? null),
            'log_water' => $this->saveWater($user),
            default => null,
        };
    }

    private function planText(string $user): string
    {
        $plan = $this->context->buildForChat($user, 'برنامه امروز')['todayPlan'] ?? null;
        if (! is_array($plan) || ($plan['meals'] ?? []) === []) {
            return 'برای امروز هنوز وعدهٔ فعالی در برنامه نیست. اگر پرونده در انتظار متخصص است، بعد از تأیید اینجا دیده می‌شود.';
        }
        $lines = array_map(fn (array $meal) => $meal['type'].': '.$meal['title'].' ('.$meal['kcal'].' کالری)', $plan['meals']);

        return "برنامه امروز:\n".implode("\n", $lines);
    }

    private function saveWeight(string $user, mixed $weight): ?string
    {
        if (! is_numeric($weight)) {
            return null;
        }
        $saved = $this->tracking->setWeight($user, (float) $weight);

        return 'وزن '.$saved['kilograms'].' کیلو برای '.$saved['date'].' ثبت شد.';
    }

    private function saveWater(string $user): string
    {
        $day = CivilDates::today();
        $this->db->statement('insert into coach_water (user_id,civil_date,ml) values (?,?,250) as incoming on duplicate key update ml=coach_water.ml+250, updated_at=current_timestamp(6)', [$user, $day]);
        $ml = (int) $this->db->table('coach_water')->where(['user_id' => $user, 'civil_date' => $day])->value('ml');

        return '۲۵۰ میلی‌لیتر آب ثبت شد. مجموع امروز '.$ml.' میلی‌لیتر است.';
    }

    private function ensure(string $user): object
    {
        $existing = $this->db->table('coach_threads')->where('user_id', $user)->first();
        if ($existing !== null) {
            return $existing;
        }
        $id = Crypto::uuid();
        $this->db->table('coach_threads')->insert(['id' => $id, 'user_id' => $user]);

        return $this->db->table('coach_threads')->where('id', $id)->first();
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
        $this->db->statement('insert into coach_usage (user_id,day,chat_turns,vision_calls,cost_micros) values (?,?,?,?,?) as incoming on duplicate key update chat_turns=coach_usage.chat_turns+incoming.chat_turns, vision_calls=coach_usage.vision_calls+incoming.vision_calls, cost_micros=coach_usage.cost_micros+incoming.cost_micros', [$user, CivilDates::today(), $turns, $vision, $cost]);
    }

    private function message(object $row): array
    {
        return ['id' => $row->id, 'seq' => (int) $row->seq, 'role' => $row->role, 'type' => $row->type, 'text' => $row->fallback_text, 'createdAt' => $row->created_at];
    }
}
