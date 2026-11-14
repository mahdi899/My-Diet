<?php

namespace App\Modules\Messaging\Presentation;

use App\Modules\Messaging\Application\MessagingService;
use App\Shared\Domain\Problem;
use App\Shared\Presentation\StrictInput;
use Illuminate\Http\Request;

final class MessagingController
{
    public function __construct(private MessagingService $messaging) {}

    public function list(Request $request): array
    {
        return $this->messaging->list($this->actor($request));
    }

    public function messages(Request $request, string $id): array
    {
        return $this->messaging->messages($this->actor($request), StrictInput::uuid($id));
    }

    public function timeline(Request $request, string $id): array
    {
        $after = $request->query('after');
        $limit = $request->query('limit', '50');
        $cursor = $after === null || $after === '' ? null : (is_string($after) && preg_match('/^[0-9]+$/D', $after) ? (int) $after : false);
        $size = is_string($limit) && preg_match('/^[0-9]+$/D', $limit) ? (int) $limit : 0;
        if ($cursor === false || $size < 1 || $size > 100) {
            throw new Problem(400, 'validation', 'صفحهٔ پیام معتبر نیست');
        }

        return $this->messaging->timeline($this->actor($request), StrictInput::uuid($id), $cursor, $size);
    }

    public function post(Request $request, string $id): array
    {
        $body = $this->object($request, 'پیام معتبر نیست');
        if (array_diff(array_keys($body), ['body', 'clientRequestId', 'mediaId'])) {
            throw new Problem(400, 'validation', 'پیام معتبر نیست');
        }
        if (isset($body['body']) && (! is_string($body['body']) || mb_strlen($body['body']) > 2000)) {
            throw new Problem(400, 'validation', 'پیام معتبر نیست');
        }
        foreach (['clientRequestId', 'mediaId'] as $key) {
            if (isset($body[$key])) {
                $body[$key] = StrictInput::uuid($body[$key]);
            }
        }

        return $this->messaging->post($this->actor($request), StrictInput::uuid($id), $body);
    }

    public function read(Request $request, string $id): array
    {
        return $this->messaging->markRead($this->actor($request), StrictInput::uuid($id));
    }

    public function receipt(Request $request, string $id): array
    {
        $body = $this->object($request, 'رسید معتبر نیست');
        if (array_keys($body) !== ['messageId', 'state'] && array_keys($body) !== ['state', 'messageId']) {
            if (array_diff(array_keys($body), ['messageId', 'state']) || ! isset($body['messageId'], $body['state'])) {
                throw new Problem(400, 'validation', 'رسید معتبر نیست');
            }
        }
        if (! in_array($body['state'] ?? null, ['delivered', 'read'], true)) {
            throw new Problem(400, 'validation', 'رسید معتبر نیست');
        }

        return $this->messaging->receipt($this->actor($request), StrictInput::uuid($id), StrictInput::uuid($body['messageId']), $body['state']);
    }

    public function beginMedia(Request $request, string $id): array
    {
        $body = $this->object($request, 'شروع بارگذاری معتبر نیست');
        if (array_diff(array_keys($body), ['purpose', 'declaredType', 'voiceDurationMs']) || ! in_array($body['purpose'] ?? null, ['image', 'voice'], true) || ! is_string($body['declaredType'] ?? null) || $body['declaredType'] === '' || strlen($body['declaredType']) > 80) {
            throw new Problem(400, 'validation', 'شروع بارگذاری معتبر نیست');
        }
        $duration = $body['voiceDurationMs'] ?? null;
        if ($duration !== null && (! is_int($duration) || $duration < 1 || $duration > 300_000)) {
            throw new Problem(400, 'validation', 'شروع بارگذاری معتبر نیست');
        }

        return $this->messaging->beginMedia($this->actor($request), StrictInput::uuid($id), $body['purpose'], $body['declaredType'], $duration);
    }

    public function support(Request $request): array
    {
        return $this->messaging->support($this->actor($request));
    }

    public function care(Request $request): array
    {
        return $this->messaging->care($this->actor($request));
    }

    public function sync(Request $request): array
    {
        $since = $request->query('since');
        if ($since !== null && $since !== '' && ! is_string($since)) {
            throw new Problem(400, 'validation', 'زمان درست نیست');
        }
        if (is_string($since) && $since !== '' && strtotime($since) === false) {
            throw new Problem(400, 'validation', 'زمان درست نیست');
        }

        return $this->messaging->sync($this->actor($request), $since === null || $since === '' ? null : gmdate('Y-m-d H:i:s.u', strtotime($since)));
    }

    public function notifications(Request $request): array
    {
        return $this->messaging->notifications($this->actor($request));
    }

    public function readNotification(Request $request, string $id): array
    {
        return $this->messaging->readNotification($this->actor($request), StrictInput::uuid($id));
    }

    public function finish(Request $request, string $id): array
    {
        $body = $this->object($request, 'فایل معتبر نیست');
        if (! is_string($body['declaredType'] ?? null) || $body['declaredType'] === '' || strlen($body['declaredType']) > 80 || ! is_string($body['contentBase64'] ?? null) || $body['contentBase64'] === '' || strlen($body['contentBase64']) > 2_100_000) {
            throw new Problem(400, 'validation', 'فایل معتبر نیست');
        }
        $bytes = base64_decode($body['contentBase64'], true);
        if ($bytes === false || rtrim(base64_encode($bytes), '=') !== rtrim($body['contentBase64'], '=')) {
            throw new Problem(400, 'validation', 'محتوای فایل معتبر نیست');
        }

        return $this->messaging->finishMedia($this->actor($request), StrictInput::uuid($id), $bytes, $body['declaredType']);
    }

    public function grant(Request $request, string $id): array
    {
        return $this->messaging->grant($this->actor($request), StrictInput::uuid($id));
    }

    public function content(Request $request, string $id): array
    {
        $body = $this->object($request, 'مجوز رسانه معتبر نیست');
        $grant = $body['grant'] ?? null;
        if (! is_string($grant) || strlen($grant) < 20 || strlen($grant) > 200) {
            throw new Problem(400, 'validation', 'مجوز رسانه معتبر نیست');
        }

        return $this->messaging->content($this->actor($request), StrictInput::uuid($id), $grant);
    }

    private function actor(Request $request): string
    {
        return $request->attributes->get('actor')['id'];
    }

    private function object(Request $request, string $message): array
    {
        try {
            $body = json_decode($request->getContent(), true, 512, JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            throw new Problem(400, 'validation', $message);
        }
        if (! is_array($body) || array_is_list($body)) {
            throw new Problem(400, 'validation', $message);
        }

        return $body;
    }
}
