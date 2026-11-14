<?php

namespace App\Modules\Coach\Infrastructure;

use App\Modules\Coach\Application\CoachGateway;
use App\Modules\Coach\Application\CoachModel;
use App\Modules\Coach\Domain\CoachSafety;
use App\Modules\Messaging\Domain\MediaSignature;
use App\Modules\Plans\Domain\CivilDates;
use App\Shared\Domain\LegacyCrypto as Crypto;
use App\Shared\Domain\Problem;
use Illuminate\Database\ConnectionInterface;

final class MySqlCoach implements CoachGateway
{
    public function __construct(private ConnectionInterface $db, private CoachModel $model) {}

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
            $local = $blocked === null ? CoachSafety::localReply($text) : null;
            if ($blocked !== null || $local !== null) {
                $replies = [];
                if ($local !== null) {
                    $assistant = Crypto::uuid();
                    $this->db->table('coach_messages')->insert(['id' => $assistant, 'thread_id' => $thread->id, 'user_id' => $user, 'role' => 'assistant', 'type' => 'safety', 'fallback_text' => $local, 'reply_to' => $id, 'payload' => '{}']);
                    $replies[] = $this->message($this->db->table('coach_messages')->where('id', $assistant)->first());
                }

                return ['replay' => false, 'userMessage' => $this->message($this->db->table('coach_messages')->where('id', $id)->first()), 'replies' => $replies, 'blocked' => $blocked];
            }
            $reply = $this->model->reply($text);
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

        return ['mediaId' => $media, 'messageId' => $message];
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
        $meals = $this->db->table('coach_food_entries')->where(['user_id' => $user, 'civil_date' => $day])->count();

        return ['date' => $day, 'waterMl' => $water, 'meals' => $meals, 'notADiagnosis' => true];
    }

    public function dayBrief(string $user): array
    {
        $thread = $this->ensure($user);
        $today = CivilDates::today();
        if ($thread->day_brief_date === $today) {
            return ['date' => $today, 'created' => false];
        }
        $this->db->table('coach_messages')->insert(['id' => Crypto::uuid(), 'thread_id' => $thread->id, 'user_id' => $user, 'role' => 'assistant', 'type' => 'day_brief', 'fallback_text' => 'خلاصهٔ امروز آماده است', 'payload' => '{}']);
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
        $day = CivilDates::today();
        foreach ($this->db->table('coach_threads')->get() as $thread) {
            $key = 'proactive:'.$thread->user_id.':'.$day;
            if ($this->db->table('coach_engagement')->where('dedupe_key', $key)->exists()) {
                continue;
            }
            $this->db->table('coach_messages')->insert(['id' => Crypto::uuid(), 'thread_id' => $thread->id, 'user_id' => $thread->user_id, 'role' => 'assistant', 'type' => 'proactive', 'fallback_text' => 'یادآوری وعده', 'payload' => '{}']);
            $this->db->table('coach_engagement')->insert(['id' => Crypto::uuid(), 'user_id' => $thread->user_id, 'kind' => 'proactive', 'day' => $day, 'dedupe_key' => $key]);
            $sent++;
        }

        return $sent;
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
