<?php

namespace App\Modules\Messaging\Application;

use App\Modules\Messaging\Domain\MediaSignature;
use App\Shared\Domain\LegacyCrypto as Crypto;
use App\Shared\Domain\Problem;

final class MessagingService
{
    public function __construct(private MessagingStore $store) {}

    public function list(string $user): array
    {
        return $this->store->conversations($user);
    }

    public function messages(string $user, string $conversation): array
    {
        $this->mustJoin($user, $conversation);

        return $this->store->messages($conversation, null, 500);
    }

    public function timeline(string $user, string $conversation, ?int $after, int $limit): array
    {
        $this->mustJoin($user, $conversation);
        $rows = $this->store->messages($conversation, $after, $limit + 1);
        $page = array_slice($rows, 0, $limit);

        return ['messages' => $page, 'nextCursor' => count($rows) > $limit ? ($page[array_key_last($page)]['position'] ?? null) : null];
    }

    public function post(string $user, string $conversation, array $input): array
    {
        $text = trim((string) ($input['body'] ?? ''));
        if ($text === '' && ! isset($input['mediaId'])) {
            throw new Problem(400, 'validation', 'متن یا رسانه لازم است');
        }

        return $this->store->transaction(function () use ($user, $conversation, $input, $text) {
            $this->mustJoin($user, $conversation);
            if (isset($input['clientRequestId'])) {
                $prior = $this->store->priorMessage($conversation, $user, $input['clientRequestId']);
                if ($prior !== null) {
                    return ['id' => $prior, 'duplicate' => true];
                }
            }
            $kind = 'text';
            if (isset($input['mediaId'])) {
                $purpose = $this->store->mediaReady($input['mediaId'], $user, $conversation);
                if ($purpose === null) {
                    throw new Problem(404, 'not_found', 'رسانه آماده نیست');
                }
                $kind = $purpose;
            }
            $id = Crypto::uuid();
            $this->store->insertMessage($id, $conversation, $user, $text, $kind, $input['clientRequestId'] ?? null, $input['mediaId'] ?? null);
            $this->store->receiptsForOthers($id, $conversation, $user);
            foreach ($this->store->others($conversation, $user) as $person) {
                $this->store->notify($person, 'message', ['conversationId' => $conversation]);
            }

            return ['id' => $id, 'duplicate' => false, 'persisted' => true];
        });
    }

    public function markRead(string $user, string $conversation): array
    {
        $this->mustJoin($user, $conversation);
        if ($this->store->markRead($user, $conversation) === 0) {
            throw new Problem(404, 'not_found', 'گفتگو پیدا نشد');
        }

        return ['ok' => true];
    }

    public function receipt(string $user, string $conversation, string $message, string $state): array
    {
        $this->mustJoin($user, $conversation);
        $author = $this->store->messageAuthor($message, $conversation);
        if ($author === null) {
            throw new Problem(404, 'not_found', 'پیام پیدا نشد');
        }
        if ($author === $user) {
            throw new Problem(409, 'not_recipient', 'فرستنده رسید خودش را ثبت نمی‌کند');
        }
        if ($this->store->stampReceipt($message, $user, $state) === 0) {
            throw new Problem(404, 'not_found', 'رسید پیدا نشد');
        }
        if ($state === 'read') {
            $this->store->markRead($user, $conversation);
        }

        return ['messageId' => $message, 'state' => $state, 'persisted' => true];
    }

    public function support(string $user): array
    {
        return ['id' => $this->store->support($user) ?? $this->createdSupport($user)];
    }

    public function care(string $user): array
    {
        $request = $this->store->careRequest($user);
        if ($request === null) {
            throw new Problem(409, 'no_specialist', 'متخصص فعالی برای گفتگو تعیین نشده است');
        }

        return $this->store->transaction(function () use ($user, $request) {
            $id = $this->store->careConversation($request['id']);
            if ($id === null) {
                $id = Crypto::uuid();
                $this->store->openCare($id, $user, $request['id'], $request['specialistId']);
            } else {
                $this->store->ensureParticipants($id, [$user, $request['specialistId']]);
            }
            if (! $this->store->hasSystem($id)) {
                $this->store->insertMessage(Crypto::uuid(), $id, $user, 'گفتگوی مراقبت باز شد', 'system', null, null);
            }

            return ['id' => $id, 'specialistId' => $request['specialistId']];
        });
    }

    public function beginMedia(string $user, string $conversation, string $purpose, string $declared, ?int $duration): array
    {
        $this->mustJoin($user, $conversation);
        if ($purpose === 'voice' && ($duration === null || $duration < 1 || $duration > 300_000)) {
            throw new Problem(400, 'validation', 'مدت صوت معتبر نیست');
        }
        $id = Crypto::uuid();

        return ['id' => $id, 'expiresAt' => $this->store->beginMedia($id, $user, $conversation, $purpose, $declared, $duration)];
    }

    public function finishMedia(string $user, string $media, string $bytes, string $declared): array
    {
        $failure = null;
        $saved = $this->store->transaction(function () use ($user, $media, $bytes, $declared, &$failure) {
            $row = $this->store->lockMedia($media, $user);
            if ($row === null) {
                throw new Problem(404, 'not_found', 'رسانه پیدا نشد');
            }
            $this->mustJoin($user, $row['conversationId']);
            if ($row['status'] !== 'pending' || strtotime((string) $row['expiresAt']) <= time()) {
                $this->store->expireMedia($media);
                $failure = 'expired';

                return null;
            }
            if ($declared !== $row['declaredType']) {
                throw new Problem(400, 'validation', 'نوع رسانه با شروع بارگذاری یکی نیست');
            }
            try {
                $detected = MediaSignature::inspect($row['purpose'], $declared, $bytes);
            } catch (\InvalidArgumentException) {
                $this->store->quarantine($media);
                $failure = 'invalid';

                return null;
            }
            $this->store->storeMedia($media, $bytes, $detected);

            return ['id' => $media, 'status' => 'ready', 'detectedType' => $detected];
        });
        if ($failure === 'expired') {
            throw new Problem(409, 'upload_expired', 'مهلت بارگذاری تمام شده است');
        }
        if ($failure === 'invalid') {
            throw new Problem(400, 'invalid_media', 'محتوای فایل با نوع مجاز یکی نیست');
        }

        return $saved;
    }

    public function grant(string $user, string $media): array
    {
        $row = $this->store->mediaStatus($media);
        if ($row === null || $row['status'] !== 'ready') {
            throw new Problem(404, 'not_found', 'رسانه پیدا نشد');
        }
        $this->mustJoin($user, $row['conversationId']);
        $token = rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');
        $this->store->grant(Crypto::uuid(), $media, $user, hash('sha256', $token));

        return ['grant' => $token, 'expiresInSeconds' => 60];
    }

    public function content(string $user, string $media, string $grant): array
    {
        $row = $this->store->readGrant($media, $user, hash('sha256', $grant));
        if ($row === null) {
            throw new Problem(404, 'not_found', 'دسترسی رسانه معتبر نیست');
        }
        $this->mustJoin($user, $row['conversationId']);

        return ['detectedType' => $row['detectedType'], 'contentBase64' => base64_encode($row['content'])];
    }

    public function sync(string $user, ?string $since): array
    {
        return $this->store->sync($user, $since);
    }

    public function notifications(string $user): array
    {
        return $this->store->notifications($user);
    }

    public function readNotification(string $user, string $id): array
    {
        if ($this->store->readNotification($user, $id) === 0) {
            throw new Problem(404, 'not_found', 'اعلان پیدا نشد');
        }

        return ['ok' => true];
    }

    private function createdSupport(string $user): string
    {
        $id = Crypto::uuid();
        $this->store->openSupport($id, $user);

        return $id;
    }

    private function mustJoin(string $user, string $conversation): void
    {
        if (! $this->store->participant($user, $conversation)) {
            throw new Problem(404, 'not_found', 'گفتگو پیدا نشد');
        }
    }
}
