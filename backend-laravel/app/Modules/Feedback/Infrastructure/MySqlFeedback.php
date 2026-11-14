<?php

namespace App\Modules\Feedback\Infrastructure;

use App\Modules\Feedback\Domain\FeedbackRules;
use App\Modules\Plans\Domain\CivilDates;
use App\Shared\Domain\LegacyCrypto as Crypto;
use App\Shared\Domain\Problem;
use Illuminate\Database\ConnectionInterface;

final class MySqlFeedback
{
    public function __construct(private ConnectionInterface $db) {}

    public function save(string $user, array $input): array
    {
        $week = FeedbackRules::week($input['weekStart']);
        if (array_intersect($input['favorites'], $input['dislikes']) !== []) {
            throw new Problem(400, 'validation', 'یک گزینه نمی‌تواند هم محبوب و هم نامطلوب باشد');
        }

        return $this->db->transaction(function () use ($user, $week, $input) {
            $current = $this->db->table('weekly_feedback')->where(['user_id' => $user, 'week_start' => $week])->first();
            $sameRating = $current !== null && (($current->service_rating === null && $input['serviceRating'] === null) || ($current->service_rating !== null && (int) $current->service_rating === $input['serviceRating']));
            $changed = $current === null || $this->json($current->favorites) !== $input['favorites'] || $this->json($current->dislikes) !== $input['dislikes']
                || $current->preparation_difficulty !== $input['preparationDifficulty'] || $current->ingredient_availability !== $input['ingredientAvailability']
                || $current->affordability !== $input['affordability'] || $current->portion_satisfaction !== $input['portionSatisfaction']
                || ! $sameRating || $current->comment !== $input['comment'] || (bool) $current->publish_permission !== $input['publishPermission'];
            $revision = $current === null ? 1 : (int) $current->revision + ($changed ? 1 : 0);
            $row = ['user_id' => $user, 'week_start' => $week, 'revision' => $revision, 'favorites' => json_encode($input['favorites']), 'dislikes' => json_encode($input['dislikes']), 'preparation_difficulty' => $input['preparationDifficulty'], 'ingredient_availability' => $input['ingredientAvailability'], 'affordability' => $input['affordability'], 'portion_satisfaction' => $input['portionSatisfaction'], 'service_rating' => $input['serviceRating'], 'comment' => $input['comment'], 'publish_permission' => $input['publishPermission'], 'updated_at' => $this->db->raw('current_timestamp(6)')];
            if ($current === null) {
                $this->db->table('weekly_feedback')->insert($row);
            } else {
                $this->db->table('weekly_feedback')->where(['user_id' => $user, 'week_start' => $week])->update($row);
            }

            return $this->present($user, $week);
        });
    }

    public function get(string $user, string $week): array
    {
        return $this->present($user, FeedbackRules::week($week)) ?? throw new Problem(404, 'not_found', 'بازخورد این هفته ثبت نشده است');
    }

    public function publish(string $user, string $week): array
    {
        $week = FeedbackRules::week($week);

        return $this->db->transaction(function () use ($user, $week) {
            $feedback = $this->present($user, $week);
            if ($feedback === null) {
                throw new Problem(404, 'not_found', 'بازخورد این هفته ثبت نشده است');
            }
            if (! $feedback['publishPermission']) {
                throw new Problem(409, 'permission_required', 'انتشار نظر نیاز به اجازهٔ صریح دارد');
            }
            if ($feedback['serviceRating'] === null) {
                throw new Problem(409, 'rating_required', 'امتیاز خدمت برای نظر عمومی لازم است');
            }
            $request = $this->db->selectOne("select id,status from plan_requests where user_id=? and status<>'cancelled' and (week_start=? or week_start is null) order by case when week_start=? then 0 else 1 end, created_at desc limit 1", [$user, $week, $week]);
            if ($request === null) {
                throw new Problem(409, 'no_plan', 'برنامهٔ این هفته برای نظر عمومی پیدا نشد');
            }
            $existing = $this->db->table('program_reviews')->where(['user_id' => $user, 'request_id' => $request->id, 'week_start' => $week])->first();
            if ($existing === null) {
                $reviewId = Crypto::uuid();
                $status = 'pending';
                $this->db->table('program_reviews')->insert(['id' => $reviewId, 'user_id' => $user, 'request_id' => $request->id, 'week_start' => $week, 'rating' => $feedback['serviceRating'], 'body' => $feedback['comment'], 'status' => 'pending']);
            } else {
                $reviewId = $existing->id;
                $status = $existing->status === 'approved' ? 'approved' : 'pending';
                if ($existing->status !== 'approved') {
                    $this->db->table('program_reviews')->where('id', $reviewId)->update(['rating' => $feedback['serviceRating'], 'body' => $feedback['comment'], 'status' => 'pending']);
                }
            }
            $this->db->statement('insert into feedback_publications (user_id,week_start,review_id) values (?,?,?) as incoming on duplicate key update review_id=incoming.review_id', [$user, $week, $reviewId]);

            return ['reviewId' => $reviewId, 'status' => $status, 'privatePreserved' => true, 'approvesNewPlan' => false, 'planStatus' => $request->status];
        });
    }

    public function preferences(string $user): array
    {
        $revision = (int) ($this->db->table('preference_confirmations')->where('user_id', $user)->value('revision') ?? 0);

        return [...$this->sources($user), 'revision' => $revision, 'notADiagnosis' => true];
    }

    public function confirm(string $user, int $expected, array $favorites, array $disliked, string $note): array
    {
        return $this->db->transaction(function () use ($user, $expected, $favorites, $disliked, $note) {
            $revision = (int) ($this->db->table('preference_confirmations')->where('user_id', $user)->value('revision') ?? 0);
            if ($revision !== $expected) {
                throw new Problem(409, 'lock_conflict', 'پیشنهاد ترجیح تغییر کرده است');
            }
            $next = $revision + 1;
            $this->db->statement('insert into preference_confirmations (user_id,revision,favorite_options,disliked_options,note) values (?,?,?,?,?) as incoming on duplicate key update revision=incoming.revision, favorite_options=incoming.favorite_options, disliked_options=incoming.disliked_options, note=incoming.note, updated_at=current_timestamp(6)', [$user, $next, json_encode($favorites, JSON_UNESCAPED_UNICODE), json_encode($disliked, JSON_UNESCAPED_UNICODE), $note]);

            return [...$this->sources($user), 'revision' => $next, 'notADiagnosis' => true];
        });
    }

    public function generate(string $user, string $week, string $command): array
    {
        $week = FeedbackRules::week($week);

        return $this->db->transaction(function () use ($user, $week, $command) {
            $prior = $this->db->table('patient_week_reports')->where(['user_id' => $user, 'command_id' => $command])->first();
            if ($prior !== null) {
                return ['version' => (int) $prior->version, 'document' => $this->json($prior->document), 'retried' => true];
            }
            $end = CivilDates::add($week, 6);
            $planned = (int) $this->db->table('meal_logs')->where('user_id', $user)->whereBetween('scheduled_date', [$week, $end])->count();
            $document = ['weekStart' => $week, 'weekEnd' => $end, 'recordedMeals' => $planned, 'notADiagnosis' => true];
            $hash = hash('sha256', json_encode($document));
            $same = $this->db->table('patient_week_reports')->where(['user_id' => $user, 'week_start' => $week, 'source_hash' => $hash])->orderByDesc('version')->first();
            if ($same !== null) {
                return ['version' => (int) $same->version, 'document' => $this->json($same->document), 'retried' => false];
            }
            $version = (int) ($this->db->table('patient_week_reports')->where(['user_id' => $user, 'week_start' => $week])->max('version') ?? 0) + 1;
            $status = $this->db->table('plan_requests')->where('user_id', $user)->where('status', '<>', 'cancelled')->orderByDesc('created_at')->value('status');
            $this->db->table('patient_week_reports')->insert(['user_id' => $user, 'week_start' => $week, 'version' => $version, 'command_id' => $command, 'source_hash' => $hash, 'cutoff_at' => $this->db->raw('current_timestamp(6)'), 'document' => json_encode($document), 'generator' => 'deterministic-facts', 'prompt_version' => 'phase6-facts-v1', 'source_refs' => '{}']);

            return ['version' => $version, 'document' => $document, 'retried' => false, 'planStatusUnchanged' => $status];
        });
    }

    public function latest(string $user, string $week): array
    {
        $week = FeedbackRules::week($week);
        $row = $this->db->table('patient_week_reports')->where(['user_id' => $user, 'week_start' => $week])->orderByDesc('version')->first();
        if ($row === null) {
            throw new Problem(404, 'not_found', 'گزارش این هفته هنوز ساخته نشده است');
        }

        return ['version' => (int) $row->version, 'document' => $this->json($row->document), 'generator' => $row->generator, 'promptVersion' => $row->prompt_version, 'cutoffAt' => $row->cutoff_at];
    }

    public function forSpecialist(string $specialist, string $patient, string $week): array
    {
        if (! $this->db->table('plan_requests')->where('user_id', $patient)->where('assigned_specialist_id', $specialist)->where('status', '<>', 'cancelled')->exists()) {
            throw new Problem(404, 'not_found', 'بیمار پیدا نشد');
        }

        return $this->latest($patient, $week);
    }

    public function metrics(): array
    {
        $privateCount = (int) $this->db->table('weekly_feedback')->whereNotNull('service_rating')->count();
        $privateAverage = $this->db->table('weekly_feedback')->whereNotNull('service_rating')->avg('service_rating');
        $publicCount = (int) $this->db->table('program_reviews')->where('status', 'approved')->count();
        $publicAverage = $this->db->table('program_reviews')->where('status', 'approved')->avg('rating');

        return ['privateFeedback' => ['count' => $privateCount, 'average' => $privateAverage === null ? null : round((float) $privateAverage, 2)], 'publicApprovedReviews' => ['count' => $publicCount, 'average' => $publicAverage === null ? null : round((float) $publicAverage, 2)]];
    }

    private function present(string $user, string $week): ?array
    {
        $row = $this->db->table('weekly_feedback')->where(['user_id' => $user, 'week_start' => $week])->first();
        if ($row === null) {
            return null;
        }

        return ['weekStart' => $week, 'revision' => (int) $row->revision, 'favorites' => $this->json($row->favorites), 'dislikes' => $this->json($row->dislikes), 'preparationDifficulty' => $row->preparation_difficulty, 'ingredientAvailability' => $row->ingredient_availability, 'affordability' => $row->affordability, 'portionSatisfaction' => $row->portion_satisfaction, 'serviceRating' => $row->service_rating === null ? null : (int) $row->service_rating, 'comment' => $row->comment, 'publishPermission' => (bool) $row->publish_permission];
    }

    private function sources(string $user): array
    {
        $confirmed = $this->db->table('preference_confirmations')->where('user_id', $user)->first();

        return ['statedPreference' => null, 'statedDislikes' => null, 'favoriteOptions' => [], 'dislikedOptions' => [], 'substitutionReasons' => [], 'inferred' => ['favoriteOptions' => [], 'dislikedOptions' => []], 'confirmed' => $confirmed === null ? null : ['favoriteOptions' => $this->json($confirmed->favorite_options), 'dislikedOptions' => $this->json($confirmed->disliked_options), 'note' => $confirmed->note], 'overriddenByCustomer' => $confirmed !== null];
    }

    private function json(mixed $value): array
    {
        if (is_array($value)) {
            return $value;
        }
        $decoded = json_decode((string) $value, true);

        return is_array($decoded) ? $decoded : [];
    }
}
