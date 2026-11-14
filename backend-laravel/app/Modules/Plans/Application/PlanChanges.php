<?php

namespace App\Modules\Plans\Application;

use App\Modules\Plans\Domain\CivilDates;
use App\Shared\Domain\LegacyCrypto as Crypto;
use App\Shared\Domain\Problem;

final class PlanChanges
{
    public function __construct(private PlanChangeStore $store, private PlanEditor $editor) {}

    public function reasons(bool $activeOnly): array
    {
        return $this->store->reasons($activeOnly);
    }

    public function updateReason(string $id, array $body): array
    {
        if (array_diff(array_keys($body), ['label', 'active']) || ! is_string($body['label'] ?? null) || ! is_bool($body['active'] ?? null)) {
            throw new Problem(400, 'validation', 'اطلاعات درخواست کامل نیست');
        }
        $label = $this->text($body['label'], 200);
        if ($label === '') {
            throw new Problem(400, 'validation', 'اطلاعات درخواست کامل نیست');
        }

        return $this->store->updateReason($id, $label, $body['active']);
    }

    public function submit(string $user, array $body): array
    {
        $input = $this->submission($body);

        try {
            return $this->store->transaction(fn () => $this->create($user, $input));
        } catch (\Throwable $error) {
            if (! $this->store->duplicateKey($error)) {
                throw $error;
            }
            $again = $this->store->byCommand($user, $input['commandId']);
            if ($again && $this->same($again, $input)) {
                return [...$this->store->present($again['id'], false), 'duplicate' => true];
            }
            if (str_contains($error->getMessage(), 'command_id_key')) {
                throw new Problem(409, 'idempotency_conflict', 'این شناسه برای درخواست دیگری استفاده شده است');
            }
            throw new Problem(409, 'open_request', 'یک درخواست تغییر باز وجود دارد');
        }
    }

    public function mine(string $user): array
    {
        return array_map(fn (string $id) => $this->store->present($id, false), $this->store->idsForUser($user));
    }

    public function customer(string $user, string $id): array
    {
        $row = $this->store->row($id);
        if ($row === null || $row['user_id'] !== $user) {
            throw new Problem(404, 'not_found', 'درخواست تغییر پیدا نشد');
        }

        return $this->store->present($id, false);
    }

    public function reply(string $user, string $id, array $body): array
    {
        $text = $this->requiredText($body, 'body', 2000);

        return $this->store->transaction(function () use ($user, $id, $text): array {
            $row = $this->store->lock($id);
            if ($row['user_id'] !== $user) {
                throw new Problem(404, 'not_found', 'درخواست تغییر پیدا نشد');
            }
            if ($row['substate'] !== 'awaiting_clarification' || ! $this->store->answer($id, $text)) {
                throw new Problem(409, 'not_waiting', 'سؤالی در انتظار پاسخ نیست');
            }
            $this->store->save($id, ['status' => 'awaiting_review', 'substate' => 'none']);
            $specialist = $this->store->specialist($row['plan_request_id']);
            $this->store->systemMessage($user, $specialist, $row['plan_request_id'], $id, 'پاسخ سؤال تغییر برنامه ثبت شد');
            $this->store->notify($specialist, $id);

            return $this->store->present($id, false);
        });
    }

    public function queue(string $specialist): array
    {
        return array_map(fn (string $id) => $this->store->present($id, true), $this->store->queueIds($specialist));
    }

    public function staff(string $specialist, string $id): array
    {
        $row = $this->store->row($id) ?? throw new Problem(404, 'not_found', 'درخواست تغییر پیدا نشد');
        $this->store->assertAssigned($specialist, $row['plan_request_id']);

        return $this->store->present($id, true);
    }

    public function review(string $specialist, string $id): array
    {
        return $this->transition($specialist, $id, function (array $row) use ($id): void {
            if ($row['status'] !== 'awaiting_review' || $row['substate'] !== 'none') {
                throw new Problem(409, 'not_actionable', 'این درخواست الان در صف بررسی نیست');
            }
            $this->store->save($id, ['status' => 'under_review'], true);
        });
    }

    public function reject(string $specialist, string $id, array $body): array
    {
        $text = $this->requiredText($body, 'explanation', 2000);

        return $this->transition($specialist, $id, function (array $row) use ($id, $text, $specialist): void {
            $this->open($row);
            $before = $this->store->activeVersion($row['user_id']);
            $this->store->save($id, ['status' => 'rejected', 'substate' => 'none', 'rejection_explanation' => $text], true);
            if ($before !== $this->store->activeVersion($row['user_id'])) {
                throw new Problem(409, 'plan_changed', 'برنامهٔ فعال هنگام رد درخواست عوض شد');
            }
            $this->store->systemMessage($row['user_id'], $specialist, $row['plan_request_id'], $id, 'درخواست تغییر برنامه رد شد');
            $this->store->notify($row['user_id'], $id);
        });
    }

    public function clarify(string $specialist, string $id, array $body): array
    {
        $text = $this->requiredText($body, 'prompt', 1000);

        return $this->transition($specialist, $id, function (array $row) use ($id, $text): void {
            $this->open($row);
            if ($row['substate'] === 'awaiting_clarification') {
                throw new Problem(409, 'clarification_open', 'یک سؤال باز وجود دارد');
            }
            $this->store->ask($id, $text);
            $this->store->save($id, ['status' => 'under_review', 'substate' => 'awaiting_clarification'], true);
            $this->store->notify($row['user_id'], $id);
        });
    }

    public function approve(string $specialist, string $id, int $lock): array
    {
        return $this->store->transaction(function () use ($specialist, $id, $lock): array {
            $peek = $this->store->row($id) ?? throw new Problem(404, 'not_found', 'درخواست تغییر پیدا نشد');
            $this->store->lockRequest($peek['plan_request_id']);
            $this->store->lockUser($peek['user_id']);
            $row = $this->store->lock($id);
            $this->store->assertAssigned($specialist, $row['plan_request_id']);
            $this->open($row);
            if ($row['substate'] === 'awaiting_clarification' || $this->store->hasOpenQuestion($id)) {
                throw new Problem(409, 'clarification_required', 'تا پاسخ سؤال نمی‌توان تغییر را منتشر کرد');
            }
            if ($this->store->activeVersion($row['user_id']) !== $row['version_id']) {
                throw new Problem(409, 'plan_changed', 'برنامهٔ فعال با نسخهٔ این درخواست یکی نیست');
            }
            $published = $this->editor->publish($specialist, 'specialist', $row['plan_request_id'], $lock);
            $this->store->save($id, ['status' => 'approved', 'substate' => 'none', 'published_version_id' => $published['versionId']], true);
            $this->store->systemMessage($row['user_id'], $specialist, $row['plan_request_id'], $id, 'برنامهٔ جدید آماده است');

            return $this->store->present($id, true);
        });
    }

    private function create(string $user, array $input): array
    {
        $this->store->lockUser($user);
        $prior = $this->store->byCommand($user, $input['commandId']);
        if ($prior) {
            if (! $this->same($prior, $input)) {
                throw new Problem(409, 'idempotency_conflict', 'این شناسه برای درخواست دیگری استفاده شده است');
            }

            return [...$this->store->present($prior['id'], false), 'duplicate' => true];
        }
        $plan = $this->store->activePlan($user);
        if ($plan === null || $plan['id'] !== $input['versionId'] || $plan['status'] === 'cancelled') {
            throw new Problem(409, 'plan_changed', 'این نسخه دیگر برنامهٔ فعال نیست');
        }
        if ($plan['specialist_id'] === null) {
            throw new Problem(409, 'no_specialist', 'متخصص فعالی برای این برنامه تعیین نشده است');
        }
        if ($plan['week_start'] && CivilDates::today() > CivilDates::add($plan['week_start'], 6)) {
            throw new Problem(409, 'week_closed', 'هفتهٔ این برنامه پایان یافته است');
        }
        $reasons = $this->store->activeReasons($input['reasonIds']);
        if (count($reasons) !== count($input['reasonIds'])) {
            throw new Problem(400, 'validation', 'دلیل تغییر فعال نیست');
        }
        foreach ($input['targets'] as $target) {
            if (! $this->store->targetExists($plan['id'], $target['dayIndex'], $target['mealUid'] ?? null)) {
                throw new Problem(400, 'validation', 'روز یا وعدهٔ انتخاب‌شده در این نسخه نیست');
            }
        }
        $id = Crypto::uuid();
        $this->store->insert($id, $user, $plan['request_id'], $plan['id'], $input['commandId'], $input['explanation']);
        foreach ($reasons as $reason) {
            $this->store->snapshotReason($id, $reason['id'], $reason['label']);
        }
        foreach ($input['targets'] as $target) {
            $this->store->target($id, $target['dayIndex'], $target['mealUid'] ?? null);
        }
        $this->store->systemMessage($user, $plan['specialist_id'], $plan['request_id'], $id, 'درخواست تغییر برنامه ثبت شد');
        $this->store->notify($plan['specialist_id'], $id);

        return [...$this->store->present($id, false), 'duplicate' => false];
    }

    private function transition(string $specialist, string $id, \Closure $apply): array
    {
        return $this->store->transaction(function () use ($specialist, $id, $apply): array {
            $row = $this->store->lock($id);
            $this->store->assertAssigned($specialist, $row['plan_request_id']);
            $apply($row);

            return $this->store->present($id, true);
        });
    }

    private function open(array $row): void
    {
        if ($row['status'] === 'approved' || $row['status'] === 'rejected') {
            throw new Problem(409, 'already_resolved', 'این درخواست قبلاً بسته شده است');
        }
    }

    private function same(array $stored, array $input): bool
    {
        $storedTargets = array_map(fn (array $target): string => $target['dayIndex'].':'.($target['mealUid'] ?? ''), $stored['targets']);
        $nextTargets = array_map(fn (array $target): string => $target['dayIndex'].':'.($target['mealUid'] ?? ''), $input['targets']);
        sort($storedTargets);
        sort($nextTargets);
        $storedReasons = $stored['reasonIds'];
        $nextReasons = $input['reasonIds'];
        sort($storedReasons);
        sort($nextReasons);

        return $stored['version_id'] === $input['versionId'] && $stored['explanation'] === $input['explanation'] && $storedReasons === $nextReasons && $storedTargets === $nextTargets;
    }

    private function submission(array $body): array
    {
        if (array_diff(array_keys($body), ['commandId', 'versionId', 'reasonIds', 'explanation', 'targets'])) {
            throw new Problem(400, 'validation', 'اطلاعات درخواست کامل نیست');
        }
        $reasons = $body['reasonIds'] ?? null;
        if (! is_array($reasons) || ! array_is_list($reasons) || count($reasons) < 1 || count($reasons) > 8) {
            throw new Problem(400, 'validation', 'اطلاعات درخواست کامل نیست');
        }
        $ids = [];
        foreach ($reasons as $reason) {
            if (! is_string($reason) || ($trimmed = $this->text($reason, 40)) === '') {
                throw new Problem(400, 'validation', 'اطلاعات درخواست کامل نیست');
            }
            $ids[] = $trimmed;
        }
        if (count($ids) !== count(array_unique($ids))) {
            throw new Problem(400, 'validation', 'دلیل تکراری است');
        }
        $targets = [];
        foreach ($body['targets'] ?? [] as $target) {
            if (! is_array($target) || array_is_list($target) || array_diff(array_keys($target), ['dayIndex', 'mealUid']) || ! is_int($target['dayIndex'] ?? null) || $target['dayIndex'] < 0 || $target['dayIndex'] > 6) {
                throw new Problem(400, 'validation', 'اطلاعات درخواست کامل نیست');
            }
            $parsed = ['dayIndex' => $target['dayIndex']];
            if (array_key_exists('mealUid', $target)) {
                $parsed['mealUid'] = $this->uuid($target['mealUid']);
            }
            $targets[] = $parsed;
        }
        if (count($targets) > 28) {
            throw new Problem(400, 'validation', 'اطلاعات درخواست کامل نیست');
        }

        return ['commandId' => $this->uuid($body['commandId'] ?? null), 'versionId' => $this->uuid($body['versionId'] ?? null), 'reasonIds' => $ids, 'explanation' => isset($body['explanation']) ? $this->optionalText($body['explanation'], 2000) : '', 'targets' => $targets];
    }

    private function requiredText(array $body, string $key, int $max): string
    {
        if (array_diff(array_keys($body), [$key])) {
            throw new Problem(400, 'validation', 'اطلاعات درخواست کامل نیست');
        }
        $text = $this->text(is_string($body[$key] ?? null) ? $body[$key] : '', $max);
        if ($text === '') {
            throw new Problem(400, 'validation', 'اطلاعات درخواست کامل نیست');
        }

        return $text;
    }

    private function optionalText(mixed $value, int $max): string
    {
        if (! is_string($value) || $this->length($value) > $max) {
            throw new Problem(400, 'validation', 'اطلاعات درخواست کامل نیست');
        }

        return $this->text($value, $max);
    }

    private function text(string $value, int $max): string
    {
        $trimmed = preg_replace('/^[\s\p{Z}\x{FEFF}]+|[\s\p{Z}\x{FEFF}]+$/u', '', $value);
        if ($this->length($trimmed) > $max) {
            throw new Problem(400, 'validation', 'اطلاعات درخواست کامل نیست');
        }

        return $trimmed;
    }

    private function uuid(mixed $value): string
    {
        if (! is_string($value) || ! preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iD', $value)) {
            throw new Problem(400, 'validation', 'اطلاعات درخواست کامل نیست');
        }

        return strtolower($value);
    }

    private function length(string $value): int
    {
        return (int) (strlen(mb_convert_encoding($value, 'UTF-16LE', 'UTF-8')) / 2);
    }
}
