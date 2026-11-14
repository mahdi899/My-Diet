<?php

namespace App\Modules\Plans\Application;

use App\Modules\Identity\Application\IdentitySettings;
use App\Shared\Domain\LegacyCrypto as Crypto;
use App\Shared\Domain\Problem;

final class PlanQuestionService
{
    public function __construct(private PlanQuestionStore $store, private IdentitySettings $settings) {}

    private function authorize(?array $row, string $actor, string $role): array
    {
        if (! $row || ($role === 'specialist' && $row['assigned_specialist_id'] !== $actor)) {
            throw new Problem(404, 'not_found', 'درخواست پیدا نشد');
        }

        return $row;
    }

    public function ask(string $actor, string $role, string $request, string $prompt, bool $required): array
    {
        return $this->store->transaction(function () use ($actor, $role, $request, $prompt, $required): array {
            $row = $this->authorize($this->store->request($request), $actor, $role);
            if (in_array($row['status'], ['cancelled', 'queued', 'generating'], true)) {
                throw new Problem(409, 'not_ready', 'هنوز نمی‌توان سؤال پرسید');
            }
            $id = Crypto::uuid();
            $this->store->create($id, $request, $actor, Crypto::encrypt($prompt, $this->settings->fieldKey), $required);
            if ($required) {
                $this->store->requestStatus($request, 'awaiting_user');
            }
            $this->store->event($request, $actor, 'info_question');
            $this->store->notify($row['user_id'], 'info_requested', ['requestId' => $request, 'questionId' => $id]);

            return ['id' => $id, 'status' => $required ? 'awaiting_user' : $row['status']];
        });
    }

    public function answer(string $user, string $id, string $body): array
    {
        return $this->store->transaction(function () use ($user, $id, $body): array {
            $row = $this->store->question($id);
            if (! $row || $row['user_id'] !== $user) {
                throw new Problem(404, 'not_found', 'سؤال پیدا نشد');
            }
            if (! in_array($row['status'], ['open', 'answered'], true)) {
                throw new Problem(409, 'already_answered', 'به این سؤال قبلاً پاسخ داده شده است');
            }
            $this->store->answer($id, $user, Crypto::encrypt($body, $this->settings->fieldKey));
            if ($row['status'] === 'open') {
                $this->store->questionStatus($id, 'answered');
                if (! $this->store->hasRequired($row['request_id'], ['open'])) {
                    $this->store->requestStatus($row['request_id'], 'response_received');
                }
            }
            if ($row['assigned_specialist_id']) {
                $this->store->notify($row['assigned_specialist_id'], 'info_answered', ['requestId' => $row['request_id'], 'questionId' => $id]);
            }

            return ['status' => 'answered'];
        });
    }

    public function acknowledge(string $actor, string $role, string $id): array
    {
        return $this->store->transaction(function () use ($actor, $role, $id): array {
            $row = $this->store->question($id);
            if (! $row || ($role === 'specialist' && $row['assigned_specialist_id'] !== $actor)) {
                throw new Problem(404, 'not_found', 'سؤال پیدا نشد');
            }
            if ($row['status'] !== 'answered') {
                throw new Problem(409, 'not_answered', 'هنوز پاسخی برای تأیید نیست');
            }
            $this->store->questionStatus($id, 'acknowledged');
            if (! $this->store->hasRequired($row['request_id'], ['open', 'answered'])) {
                $this->store->requestStatus($row['request_id'], 'in_review');
            }

            return ['status' => 'acknowledged'];
        });
    }

    public function withdraw(string $actor, string $role, string $id, string $reason): array
    {
        return $this->store->transaction(function () use ($actor, $role, $id, $reason): array {
            $row = $this->store->question($id);
            if (! $row || ($role === 'specialist' && $row['assigned_specialist_id'] !== $actor)) {
                throw new Problem(404, 'not_found', 'سؤال پیدا نشد');
            }
            if (! in_array($row['status'], ['open', 'answered'], true)) {
                throw new Problem(409, 'not_open', 'این سؤال دیگر قابل پس‌گرفتن نیست');
            }
            $this->store->questionStatus($id, 'withdrawn');
            if (! $this->store->hasRequired($row['request_id'], ['open', 'answered'])) {
                $this->store->requestStatus($row['request_id'],'in_review',['awaiting_user', 'response_received']);
            }
            $this->store->event($row['request_id'],$actor,'info_withdrawn',['reason' => $reason]);

            return ['status' => 'withdrawn'];
        });
    }
}
