<?php

namespace App\Modules\Coach\Infrastructure;

use App\Shared\Domain\LegacyCrypto as Crypto;
use App\Shared\Domain\Problem;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Carbon;

final class CoachThreads
{
    public const LIMIT = 50;

    public function __construct(private ConnectionInterface $db) {}

    public function listing(string $user): array
    {
        $threads = $this->db->table('coach_threads as t')->where('t.user_id', $user)
            ->select('t.*')
            ->selectSub(fn ($q) => $q->from('coach_messages as m')->select('m.fallback_text')
                ->whereColumn('m.thread_id', 't.id')->where('m.role', 'user')->orderBy('m.seq')->limit(1), 'first_text')
            ->selectSub(fn ($q) => $q->from('coach_messages as m')->select('m.fallback_text')
                ->whereColumn('m.thread_id', 't.id')->where('m.type', '<>', 'day_brief')->orderByDesc('m.seq')->limit(1), 'last_text')
            ->whereExists(fn ($q) => $q->selectRaw('1')->from('coach_messages as m')->whereColumn('m.thread_id', 't.id')->where('m.role', 'user'))
            ->orderByRaw('coalesce(t.last_message_at, t.created_at) desc')->orderByDesc('t.created_at')->orderByDesc('t.id')->get();

        return ['threads' => $threads->map(fn ($t) => $this->description($t, $t->first_text, $t->last_text))->all(), 'limit' => self::LIMIT];
    }

    public function owned(string $user, string $id): object
    {
        $thread = $this->db->table('coach_threads')->where(['id' => $id, 'user_id' => $user])->first();
        if ($thread === null) {
            throw new Problem(404, 'not_found', 'گفتگو پیدا نشد');
        }

        return $thread;
    }

    /** Reserves at most one empty thread; opening the welcome screen does not call this. */
    public function create(string $user, ?string $id = null): array
    {
        return $this->locked($user, fn () => $this->db->transaction(function () use ($user, $id): array {
            $this->db->table('users')->where('id', $user)->lockForUpdate()->first();
            if ($id !== null && $this->db->table('coach_threads')->where('id', $id)->exists()) {
                return $this->describe($this->owned($user, $id));
            }
            $empty = $this->db->table('coach_threads as t')->where('t.user_id', $user)
                ->whereNotExists(fn ($q) => $q->selectRaw('1')->from('coach_messages as m')->whereColumn('m.thread_id', 't.id')->where('m.role', 'user'))->first();
            if ($empty !== null) {
                return $this->describe($empty);
            }
            $count = $this->db->table('coach_threads')->where('user_id', $user)->count();
            if ($count >= self::LIMIT) {
                $oldest = $this->db->table('coach_threads')->where('user_id', $user)
                    ->orderByRaw('coalesce(last_message_at, created_at)')->orderBy('created_at')->orderBy('id')
                    ->limit($count - self::LIMIT + 1)->pluck('id');
                foreach ($oldest as $oldId) {
                    $this->remove($oldId);
                }
            }
            $id ??= Crypto::uuid();
            $this->db->table('coach_threads')->insert(['id' => $id, 'user_id' => $user]);

            return $this->describe($this->owned($user, $id));
        }));
    }

    /** Older clients without a thread ID continue their most recent conversation. */
    public function resolve(string $user, ?string $id): object
    {
        if ($id !== null) {
            return $this->owned($user, $id);
        }
        $thread = $this->db->table('coach_threads')->where('user_id', $user)
            ->orderByDesc('last_message_at')->orderByDesc('created_at')->orderByDesc('id')->first();

        return $thread ?? $this->owned($user, $this->create($user)['id']);
    }

    public function rename(string $user, string $id, string $title): array
    {
        return $this->locked($user, function () use ($user, $id, $title): array {
            $this->owned($user, $id);
            $this->db->table('coach_threads')->where('id', $id)->update(['title' => $title, 'updated_at' => now()]);

            return $this->describe($this->owned($user, $id));
        });
    }

    public function delete(string $user, string $id): void
    {
        $this->locked($user, fn () => $this->db->transaction(function () use ($user, $id): void {
            $this->owned($user, $id);
            $this->remove($id);
        }));
    }

    private function remove(string $id): void
    {
        $this->db->table('coach_food_entries')->where('thread_id', $id)->update(['thread_id' => null, 'message_id' => null]);
        $this->db->table('coach_messages')->where('thread_id', $id)->update(['reply_to' => null]);
        $this->db->table('coach_messages')->where('thread_id', $id)->delete();
        $this->db->table('coach_threads')->where('id', $id)->delete();
    }

    public function touch(string $id, string $firstText = ''): void
    {
        $this->db->table('coach_threads')->where('id', $id)->update(['last_message_at' => $this->db->raw('current_timestamp(6)'), 'updated_at' => $this->db->raw('current_timestamp(6)')]);
        if (trim($firstText) !== '') {
            $this->db->table('coach_threads')->where('id', $id)->whereNull('title')
                ->update(['title' => mb_substr(preg_replace('/\s+/u', ' ', trim($firstText)), 0, 60)]);
        }
    }

    public function describe(object $thread): array
    {
        $first = $this->db->table('coach_messages')->where('thread_id', $thread->id)->where('role', 'user')->orderBy('seq')->value('fallback_text');
        $last = $this->db->table('coach_messages')->where('thread_id', $thread->id)->where('type', '<>', 'day_brief')->orderByDesc('seq')->value('fallback_text');

        return $this->description($thread, $first, $last);
    }

    private function description(object $thread, ?string $first, ?string $last): array
    {
        return ['id' => $thread->id, 'title' => $thread->title ?? (trim((string) $first) === '' ? 'گفتگوی جدید' : mb_substr((string) $first, 0, 60)),
            'preview' => mb_substr((string) $last, 0, 120), 'createdAt' => Carbon::parse($thread->created_at, 'UTC')->toISOString(), 'lastMessageAt' => $thread->last_message_at === null ? null : Carbon::parse($thread->last_message_at, 'UTC')->toISOString()];
    }

    private function locked(string $user, \Closure $work): mixed
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
}
