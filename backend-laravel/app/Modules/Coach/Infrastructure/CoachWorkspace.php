<?php

namespace App\Modules\Coach\Infrastructure;

use App\Shared\Domain\Problem;
use Illuminate\Database\ConnectionInterface;

class CoachWorkspace
{
    public function __construct(private ConnectionInterface $db, private CoachThreads $threads, private PreferenceService $preferences) {}

    public function search(string $user, string $query, ?int $before = null): array
    {
        $query = trim($query);
        if ($query === '') {
            return ['items' => [], 'nextCursor' => null];
        }
        $pattern = '%'.str_replace(['!', '%', '_'], ['!!', '!%', '!_'], $query).'%';
        $rows = $this->db->table('coach_messages as m')->join('coach_threads as t', 't.id', '=', 'm.thread_id')
            ->where('t.user_id', $user)->where('m.user_id', $user)
            ->where(fn ($q) => $q->whereRaw("m.fallback_text like ? escape '!'", [$pattern])
                ->orWhere(fn ($q) => $q->whereRaw("t.title like ? escape '!'", [$pattern])
                    ->whereRaw('m.seq = (select min(s.seq) from coach_messages s where s.thread_id = t.id)')))
            ->when($before !== null, fn ($q) => $q->where('m.seq', '<', $before))
            ->orderByDesc('m.seq')->limit(51)->get(['m.id', 'm.seq', 'm.thread_id', 'm.fallback_text', 'm.created_at', 't.title']);

        return ['items' => $rows->take(50)->map(fn ($m) => ['messageId' => $m->id, 'threadId' => $m->thread_id,
            'title' => $m->title ?? 'گفتگو', 'text' => $m->fallback_text, 'createdAt' => $m->created_at])->all(),
            'nextCursor' => $rows->count() > 50 ? (int) $rows[49]->seq : null];
    }

    public function memory(string $user, ?string $threadId): array
    {
        $summary = '';
        if ($threadId !== null) {
            $this->threads->owned($user, $threadId);
            app(CoachContextBuilder::class)->recentDialogue($user, '', $threadId);
            $summary = $this->threads->owned($user, $threadId)->summary;
        }

        return ['summary' => $summary, 'preferences' => $this->db->table('coach_preferences')->where('user_id', $user)
            ->where('active', true)->whereIn('pref_key', ['food_like', 'food_dislike', 'pattern', 'specialist_note'])
            ->orderByDesc('updated_at')->get(['id', 'pref_key as key', 'value', 'source'])->map(fn ($p) => (array) $p)->all()];
    }

    public function editPreference(string $user, string $id, ?string $value): void
    {
        $this->db->transaction(function () use ($user, $id, $value): void {
            $row = $this->db->table('coach_preferences')->where(['id' => $id, 'user_id' => $user, 'active' => true])->lockForUpdate()->first();
            if ($row === null) {
                throw new Problem(404, 'not_found', 'یادداشت پیدا نشد');
            }
            if (! in_array($row->pref_key, ['food_like', 'food_dislike', 'pattern'], true) || $row->source === 'specialist') {
                throw new Problem(403, 'forbidden', 'یادداشت متخصص از اینجا قابل تغییر نیست');
            }
            $this->preferences->deactivate($user, $row->pref_key, $row->value);
            if ($value !== null) {
                $this->preferences->recordUserStatement($user, $row->pref_key, $value);
            }
        });
    }
}
