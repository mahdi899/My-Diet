<?php

namespace App\Modules\Plans\Application;

use App\Modules\Onboarding\Application\OnboardingStore;
use App\Modules\Onboarding\Domain\EnergyEngine;
use App\Modules\Plans\Domain\CivilDates as Dates;
use App\Modules\Plans\Domain\PlanDraftRules;
use App\Shared\Domain\Amount;
use App\Shared\Domain\LegacyCrypto as Crypto;
use App\Shared\Domain\Problem;

final class PlanEditor
{
    public function __construct(private PlanEditorStore $store, private PlanDraftRules $rules, private PlanQueryStore $read, private PlanQueries $queries, private OnboardingStore $profiles) {}

    private function request(string $actor, string $role, string $id, bool $lock = true): array
    {
        $request = $this->store->request($id, $lock);
        if (! $request || ($role === 'specialist' && $request['assigned_specialist_id'] !== $actor)) {
            throw new Problem(404, 'not_found', 'درخواست پیدا نشد');
        }

        return $request;
    }

    public function replace(string $actor, string $role, string $id, int $lock, mixed $body): array
    {
        $days = $this->rules->parse($body);
        if ($role !== 'specialist' && array_any($days, fn ($meals) => array_any($meals, fn ($meal) => array_any($meal['options'] ?? [], fn ($option) => $option['approved'])))) {
            throw new Problem(403, 'forbidden', 'تأیید گزینه فقط با متخصص است');
        }

        return $this->store->transaction(function () use ($actor, $role, $id, $lock, $days): array {
            $request = $this->request($actor, $role, $id);
            if (in_array($request['status'], ['cancelled', 'queued', 'generating'], true)) {
                throw new Problem(409, 'not_ready', 'پیش‌نویس هنوز آمادهٔ ویرایش نیست');
            }
            $versions = $this->store->versions($id);
            $draft = array_values(array_filter($versions, fn ($v) => $v['status'] === 'draft'))[0] ?? null;
            $published = array_values(array_filter($versions, fn ($v) => $v['status'] === 'published'))[0] ?? null;
            $base = $draft ?? $published;
            if (! $base) {
                throw new Problem(409, 'not_ready', 'پیش‌نویس هنوز آمادهٔ ویرایش نیست');
            }
            if ($base['lock_version'] !== $lock) {
                throw new Problem(409, 'lock_conflict', 'نسخهٔ برنامه تغییر کرده است');
            }
            if ($draft) {
                $next = $this->store->replaceContents($draft['id'], $lock, $days, $role === 'specialist' ? $actor : null);
            } else {
                /** A version created by an admin keeps all options unapproved. */
                $version = $this->store->createVersion($id, $published['version_number'] + 1, $actor, $days);
                $next = $this->store->version($version)['lock_version'];
                $this->store->inReview($id);
            }
            $this->store->event($id, $actor, 'draft_edited');

            return ['lockVersion' => $next];
        });
    }

    public function publish(string $actor, string $role, string $id, int $lock): array
    {
        if ($role !== 'specialist') {
            throw new Problem(403, 'forbidden', 'انتشار برنامه فقط با متخصص است');
        }

        return $this->store->transaction(function () use ($actor, $role, $id, $lock): array {
            $specialist = $this->store->specialist($actor);
            if (! $specialist || ! $specialist['active'] || $specialist['verification_status'] !== 'verified') {
                throw new Problem(403, 'not_verified', 'فقط متخصص تأییدشده و فعال می‌تواند برنامه را منتشر کند');
            }
            $request = $this->request($actor, $role, $id);
            $this->store->lockOwner($request['user_id']);
            if ($request['status'] !== 'in_review' || $this->store->blocked($id)) {
                throw new Problem(409, 'info_required', 'تا بسته شدن سؤال‌ها نمی‌توان برنامه را تأیید کرد');
            }
            $draft = array_values(array_filter($this->store->versions($id), fn ($v) => $v['status'] === 'draft'))[0] ?? null;
            if (! $draft) {
                throw new Problem(409, 'plan_incomplete', 'پیش‌نویسی برای تأیید نیست');
            }
            if ($draft['lock_version'] !== $lock) {
                throw new Problem(409, 'lock_conflict', 'نسخهٔ برنامه تغییر کرده است');
            }
            if (! $this->store->baseUnchanged($draft['id'], $request['user_id'])) {
                throw new Problem(409, 'lock_conflict', 'برنامه فعال تغییر کرده است؛ پیش‌نویس باید بازبینی شود');
            }
            PlanDraftRules::publishable($this->read->days($draft['id']));
            $today = Dates::today();
            $week = $request['week_start'] ?? Dates::saturday($today);
            if ($today > Dates::add($week, 6)) {
                throw new Problem(409, 'week_closed', 'هفته این برنامه پایان یافته است');
            }
            $this->store->publish($id, $draft['id'], $request['user_id'], $actor, $week, $request['effective_from'] ?? $today);
            $this->store->event($id, $actor, 'published');
            $this->store->notify($request['user_id'], 'plan_published', ['requestId' => $id]);

            return ['status' => 'published', 'versionId' => $draft['id']];
        });
    }

    public function correct(string $actor, string $id): array
    {
        return $this->store->transaction(function () use ($actor, $id): array {
            $request = $this->request($actor, 'specialist', $id);
            if ($request['status'] !== 'published' || ! $request['week_start']) {
                throw new Problem(409, 'not_published', 'فقط برنامهٔ منتشرشدهٔ این هفته اصلاح می‌شود');
            }
            if (Dates::today() > Dates::add($request['week_start'], 6)) {
                throw new Problem(409, 'week_closed', 'هفتهٔ این برنامه تمام شده است');
            }
            $versions = $this->store->versions($id);
            if (array_any($versions, fn ($v) => $v['status'] === 'draft')) {
                throw new Problem(409, 'correction_open', 'یک اصلاح باز وجود دارد');
            }
            $base = array_values(array_filter($versions, fn ($v) => $v['status'] === 'published'))[0] ?? null;
            if (! $base) {
                throw new Problem(409, 'not_published', 'برنامهٔ منتشرشده‌ای نیست');
            }
            $days = array_map(fn ($day) => array_map(function ($meal): array {
                $meal['options'] = array_map(fn ($option) => [...$option, 'approved' => false], $meal['options'] ?? []);

                return $meal;
            }, $day['meals']), $this->read->days($base['id']));
            $this->store->createVersion($id, $base['version_number'] + 1, $actor, $days);
            $this->store->inReview($id);
            $this->store->event($id, $actor, 'correction');

            return ['status' => 'in_review'];
        });
    }

    public function staff(string $actor, string $role, string $id, ?string $reason): array
    {
        if ($role === 'admin' && ($reason === null || mb_strlen(PlanDraftRules::trim($reason)) < 3)) {
            throw new Problem(400, 'reason_required', 'دلیل مشاهده را بنویسید');
        }
        $request = $this->request($actor, $role, $id, false);
        $this->store->healthAccess($actor, $id, $reason);
        $view = $this->queries->summary($request);
        $versions = $this->store->versions($id);
        $draft = array_values(array_filter($versions, fn ($v) => $v['status'] === 'draft'))[0] ?? array_values(array_filter($versions, fn ($v) => $v['status'] === 'published'))[0] ?? null;
        if ($draft) {
            $view['version'] = ['id' => $draft['id'], 'versionNumber' => $draft['version_number'], 'status' => $draft['status'], 'lockVersion' => $draft['lock_version'],
                'days' => array_map(fn ($day) => ['meals' => $day['meals']], $this->read->days($draft['id']))];
        }
        $generation = $this->store->generation($id);

        return [...$view, 'warnings' => is_array($generation['warnings'] ?? null) ? $generation['warnings'] : [], 'profile' => $this->modelProfile($request['user_id']),
            'aiReview' => $generation ? $this->aiReview($generation) : null, 'riskFlags' => $this->store->flags($id)];
    }

    private function modelProfile(string $user): ?array
    {
        $row = $this->profiles->profile($user);
        if (! $row) {
            return null;
        }
        $result = [];
        foreach (['track' => 'track', 'age' => 'age', 'dietStyle' => 'diet_style', 'allergens' => 'allergens', 'conditions' => 'conditions', 'budget' => 'budget', 'region' => 'region', 'safetyTier' => 'safety_tier'] as $key => $column) {
            $result[$key] = $row[$column];
        }
        $result['sex'] = $row['sex'] === 'male' ? 'male' : 'female';
        foreach (['heightCm' => 'height_cm', 'weightKg' => 'weight_kg', 'targetWeightKg' => 'target_weight_kg', 'bmi' => 'bmi'] as $key => $column) {
            $result[$key] = $row[$column] === null ? null : (float) $row[$column];
        }
        $energy = [];
        foreach (['targetKcal' => 'target_kcal', 'bmrKcal' => 'bmr_kcal', 'tdeeKcal' => 'tdee_kcal', 'proteinG' => 'protein_g', 'carbsG' => 'carbs_g', 'fatG' => 'fat_g'] as $key => $column) {
            $energy[$key] = $row[$column];
        }
        $wake = $row['preferences']['sleep_wake'] ?? null;
        $wake = $wake instanceof \stdClass ? (array) $wake : $wake;

        return [...$result, 'energy' => $energy, 'slots' => EnergyEngine::slots($row['target_kcal'], $row['meals_per_day'], $wake['wake'] ?? null), 'preferences' => (object) $row['preferences']];
    }

    private function aiReview(array $g): array
    {
        $notes = $g['ai_notes'] ?? [];

        return ['generationId' => $g['id'], 'status' => $g['status'], 'skippedReason' => $g['skipped_reason'], 'provider' => $g['provider'], 'model' => $g['model'], 'poolCode' => $g['pool_code'],
            'promptVersion' => $g['prompt_version'], 'costMicros' => Amount::safe($g['cost_micros']), 'tokens' => $g['tokens'], 'attemptNo' => $g['attempt_no'], 'createdAt' => Crypto::iso($g['created_at']),
            'validatorWarnings' => is_array($notes['warnings'] ?? null) ? $notes['warnings'] : [], 'critic' => $notes['critic'] ?? null, 'dayTotals' => is_array($notes['dayTotals'] ?? null) ? $notes['dayTotals'] : [],
            'attempts' => array_map(fn ($a) => ['provider' => $a['provider'] ?? null, 'model' => $a['model'] ?? null, 'outcome' => $a['outcome'] ?? $a['status'] ?? null, 'errorCode' => $a['errorCode'] ?? $a['code'] ?? null], is_array($g['attempt_chain']) ? $g['attempt_chain'] : [])];
    }

    public function patientVersions(string $actor, string $patient): array
    {
        if (! $this->store->patientAssigned($actor, $patient)) {
            throw new Problem(404, 'not_found', 'بیمار پیدا نشد');
        }

        return array_map(fn ($v) => ['id' => $v['id'], 'requestId' => $v['request_id'], 'status' => $v['status'], 'versionNumber' => $v['version_number'],
            'publishedAt' => $v['published_at'] === null ? null : Crypto::iso($v['published_at']), 'weekStart' => $v['week_start']], $this->store->patientVersions($patient));
    }

    public function adminVersion(string $actor, string $id, ?string $reason): array
    {
        if ($reason === null || mb_strlen(PlanDraftRules::trim($reason)) < 3) {
            throw new Problem(400, 'reason_required', 'دلیل مشاهده را بنویسید');
        }
        $version = $this->store->version($id);
        if (! $version || $version['status'] === 'draft') {
            throw new Problem(404, 'not_found', 'نسخهٔ برنامه پیدا نشد');
        }
        $this->store->healthAccess($actor, $version['request_id'], PlanDraftRules::trim($reason));

        return ['id' => $id, 'requestId' => $version['request_id'], 'status' => $version['status'], 'days' => array_map(fn ($d) => ['dayIndex' => $d['dayIndex'], 'meals' => $d['meals']], $this->read->days($id))];
    }
}
