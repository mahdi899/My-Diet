<?php

namespace App\Modules\Coach\Application;

use App\Shared\Domain\LegacyCrypto as Crypto;
use Illuminate\Database\ConnectionInterface;

/**
 * Manages user food preferences learned through interactions.
 * Auto-updates from meal swaps, skips, and repeat requests.
 */
final class PreferenceService
{
    private const MAX_PREFS_PER_KEY = 30;

    public function __construct(private ConnectionInterface $db) {}

    /**
     * Record a food dislike (from swap or explicit feedback).
     * Stronger signal when reason = dislike vs unavailable.
     */
    public function recordDislike(string $userId, string $foodNameOrSlug, string $reason = 'swap'): void
    {
        $strength = $reason === 'dislike' ? 3 : 1;
        $this->upsert($userId, 'food_dislike', $foodNameOrSlug, 'auto', $strength);
    }

    /**
     * Record a food preference (user asked for it or chose it repeatedly).
     */
    public function recordLike(string $userId, string $foodNameOrSlug): void
    {
        $this->upsert($userId, 'food_like', $foodNameOrSlug, 'auto', 2);
    }

    /**
     * Record a behavioral pattern.
     * e.g. 'quick_cook', 'night_hunger', 'skips_breakfast'
     */
    public function recordPattern(string $userId, string $pattern): void
    {
        $this->upsert($userId, 'pattern', $pattern, 'auto', 1);
    }

    /**
     * Store a specialist note (highest priority, source = specialist).
     */
    public function recordSpecialistNote(string $userId, string $note): void
    {
        $this->upsert($userId, 'specialist_note', $note, 'specialist', 3);
    }

    /**
     * User explicitly stated a preference via chat.
     */
    public function recordUserStatement(string $userId, string $key, string $value): void
    {
        $validKeys = ['food_dislike', 'food_like', 'pattern', 'followup_answered'];
        if (!in_array($key, $validKeys, true)) {
            return;
        }
        $this->upsert($userId, $key, $value, 'user', 3);
    }

    /**
     * Deactivate a preference (user corrected it or it became stale).
     */
    public function deactivate(string $userId, string $key, string $value): void
    {
        $this->db->table('coach_preferences')
            ->where('user_id', $userId)
            ->where('pref_key', $key)
            ->where('value', $value)
            ->update(['active' => false]);
    }

    /**
     * Hook: called after a meal swap is logged.
     * Auto-records dislike for original food and like signal for swap reason.
     */
    public function onMealSwapped(string $userId, string $oldTitle, string $newTitle, string $reason): void
    {
        if ($reason === 'dislike') {
            $this->recordDislike($userId, $oldTitle, 'dislike');
        } elseif ($reason === 'time') {
            $this->recordPattern($userId, 'prefers_quick_meals');
        } elseif ($reason === 'budget') {
            $this->recordPattern($userId, 'budget_conscious');
        } elseif ($reason === 'unavailable') {
            // Weak signal — ingredient not always unavailable
            $this->recordDislike($userId, $oldTitle, 'unavailable');
        }

        // Record the new food as mildly preferred
        $this->recordLike($userId, $newTitle);
    }

    /**
     * Hook: called when user skips a meal.
     * Records weak negative signal.
     */
    public function onMealSkipped(string $userId, string $mealTitle): void
    {
        // Only register after skipping the same meal twice
        $existingSkip = $this->db->table('coach_preferences')
            ->where('user_id', $userId)
            ->where('pref_key', 'food_dislike')
            ->where('value', $mealTitle)
            ->first();

        if ($existingSkip !== null) {
            // Strengthen the signal
            $this->db->table('coach_preferences')
                ->where('id', $existingSkip->id)
                ->update([
                    'strength'   => min(3, (int)$existingSkip->strength + 1),
                    'updated_at' => $this->db->raw('current_timestamp(6)'),
                ]);
        } else {
            $this->upsert($userId, 'food_dislike', $mealTitle, 'auto', 1);
        }
    }

    /**
     * Returns active preferences for context injection.
     * Returns compact summary to minimise tokens.
     *
     * @return array{dislikes: string[], likes: string[], patterns: string[], specialistNotes: string[]}
     */
    public function summary(string $userId): array
    {
        $rows = $this->db->table('coach_preferences')
            ->where('user_id', $userId)
            ->where('active', true)
            ->orderByDesc('strength')
            ->orderByDesc('updated_at')
            ->limit(40)
            ->get(['pref_key', 'value', 'strength']);

        $result = ['dislikes' => [], 'likes' => [], 'patterns' => [], 'specialistNotes' => []];

        foreach ($rows as $row) {
            switch ($row->pref_key) {
                case 'food_dislike':
                    $result['dislikes'][] = $row->value;
                    break;
                case 'food_like':
                    $result['likes'][] = $row->value;
                    break;
                case 'pattern':
                    $result['patterns'][] = $row->value;
                    break;
                case 'specialist_note':
                    $result['specialistNotes'][] = $row->value;
                    break;
            }
        }

        return $result;
    }

    // ── Private helpers ──────────────────────────────────────────────────────

    private function upsert(string $userId, string $key, string $value, string $source, int $strength): void
    {
        // Normalise value
        $value = mb_strtolower(trim($value), 'UTF-8');
        if (empty($value) || mb_strlen($value, 'UTF-8') > 200) {
            return;
        }

        $existing = $this->db->table('coach_preferences')
            ->where('user_id', $userId)
            ->where('pref_key', $key)
            ->where('value', $value)
            ->first();

        if ($existing !== null) {
            $this->db->table('coach_preferences')
                ->where('id', $existing->id)
                ->update([
                    'strength'   => min(3, max((int)$existing->strength, $strength)),
                    'active'     => true,
                    'updated_at' => $this->db->raw('current_timestamp(6)'),
                ]);
            return;
        }

        // Enforce per-key cap to prevent table bloat
        $count = $this->db->table('coach_preferences')
            ->where('user_id', $userId)
            ->where('pref_key', $key)
            ->where('active', true)
            ->count();

        if ($count >= self::MAX_PREFS_PER_KEY) {
            // Evict the weakest, oldest
            $evict = $this->db->table('coach_preferences')
                ->where('user_id', $userId)
                ->where('pref_key', $key)
                ->where('active', true)
                ->orderBy('strength')
                ->orderBy('updated_at')
                ->first(['id']);
            if ($evict) {
                $this->db->table('coach_preferences')->where('id', $evict->id)->update(['active' => false]);
            }
        }

        $this->db->table('coach_preferences')->insert([
            'id'       => Crypto::uuid(),
            'user_id'  => $userId,
            'pref_key' => $key,
            'value'    => $value,
            'source'   => $source,
            'strength' => $strength,
            'active'   => true,
        ]);
    }
}
