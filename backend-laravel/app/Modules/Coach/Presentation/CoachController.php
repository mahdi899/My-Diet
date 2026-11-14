<?php

namespace App\Modules\Coach\Presentation;

use App\Modules\Coach\Application\CoachGateway;
use App\Shared\Domain\Problem;
use App\Shared\Presentation\StrictInput as Input;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

final class CoachController
{
    private const ACTIONS = ['confirm_meal', 'dismiss', 'confirm_swap', 'log_as_planned', 'log_water', 'log_weight', 'show_ring'];

    public function __construct(private CoachGateway $coach) {}

    public function thread(Request $request): array
    {
        $before = $request->query('before');
        $cursor = null;
        if (is_string($before) && $before !== '') {
            if (! ctype_digit($before)) {
                throw new Problem(400, 'validation', 'اطلاعات واردشده ناقص یا نادرست است');
            }
            $cursor = (int) $before;
        }
        $limit = $request->query('limit');
        $size = $limit === null || $limit === '' ? 30 : (is_string($limit) ? (int) $limit : 0);
        if (! is_int($size) || $size < 1 || $size > 50 || (is_string($limit) && $limit !== '' && (string) $size !== $limit)) {
            throw new Problem(400, 'validation', 'اطلاعات واردشده ناقص یا نادرست است');
        }

        return $this->coach->thread($this->actor($request), $cursor, $size);
    }

    public function messages(Request $request): StreamedResponse
    {
        $body = Input::body($request, ['clientMessageId', 'kind', 'text', 'value', 'label', 'action', 'args', 'sourceMessageId', 'mediaId', 'caption', 'mealType']);
        $kind = Input::string($body, 'kind', 20);
        if (! in_array($kind, ['text', 'quick_reply', 'card_action', 'photo'], true)) {
            throw new Problem(400, 'validation', 'اطلاعات واردشده ناقص یا نادرست است');
        }
        $text = $kind === 'quick_reply'
            ? (Input::optional($body, 'label', 80) ?? Input::optional($body, 'value', 200) ?? Input::optional($body, 'text', 8000) ?? '')
            : (Input::optional($body, 'text', 8000) ?? Input::optional($body, 'caption', 300) ?? '');
        $accepted = $this->coach->accept($this->actor($request), Input::uuid(is_string($body['clientMessageId'] ?? null) ? $body['clientMessageId'] : ''), $text);

        return $this->stream($accepted);
    }

    public function photo(Request $request): array
    {
        $body = Input::body($request, ['clientMessageId', 'image', 'mime', 'caption', 'mealType']);
        $image = Input::string($body, 'image', 2_800_000);
        $bytes = base64_decode($image, true);
        if ($bytes === false) {
            throw new Problem(400, 'invalid_media', 'محتوای فایل با نوع مجاز یکی نیست');
        }
        $mime = Input::optional($body, 'mime', 80) ?? 'image/jpeg';

        return $this->coach->photo($this->actor($request), Input::uuid(is_string($body['clientMessageId'] ?? null) ? $body['clientMessageId'] : ''), $bytes, $mime);
    }

    public function patch(Request $request, string $id): array
    {
        $body = Input::body($request, ['title', 'mealType', 'items', 'planMealUid']);

        return $this->coach->patch($this->actor($request), Input::uuid($id), Input::string($body, 'title', 120));
    }

    public function today(Request $request): array
    {
        return $this->coach->today($this->actor($request));
    }

    public function dayBrief(Request $request): array
    {
        return $this->coach->dayBrief($this->actor($request));
    }

    public function action(Request $request): array
    {
        $body = Input::body($request, ['clientMessageId', 'action', 'args', 'label', 'sourceMessageId']);
        $action = Input::string($body, 'action', 40);
        if (! in_array($action, self::ACTIONS, true)) {
            throw new Problem(400, 'validation', 'اطلاعات واردشده ناقص یا نادرست است');
        }

        return $this->coach->action($this->actor($request), Input::uuid(is_string($body['clientMessageId'] ?? null) ? $body['clientMessageId'] : ''), $action);
    }

    public function media(Request $request, string $id): Response
    {
        $row = $this->coach->media($this->actor($request), Input::uuid($id));
        if ($row === null) {
            throw new Problem(404, 'not_found', 'عکس پیدا نشد');
        }

        return response($row['content'], 200, ['Content-Type' => $row['mime'], 'Content-Length' => (string) strlen($row['content']), 'Cache-Control' => 'private, max-age=86400', 'X-Content-Type-Options' => 'nosniff']);
    }

    private function stream(array $accepted): StreamedResponse
    {
        return response()->stream(function () use ($accepted): void {
            $write = function (string $event, array $data): void {
                echo 'event: '.$event."\n".'data: '.json_encode($data, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR)."\n\n";
            };
            $write('message', ['message' => $accepted['userMessage']]);
            if ($accepted['blocked'] !== null) {
                $write('error', ['code' => 'ai_budget_exceeded', 'messageFa' => $accepted['blocked'] === 'kill_switch' ? 'مربی موقتاً خاموش است.' : 'سقف استفاده از هوش مصنوعی پر شده است.', 'retryable' => false]);
            }
            foreach ($accepted['replies'] as $reply) {
                $write('message', ['message' => $reply]);
            }
            $write('done', ['replay' => $accepted['replay']]);
        }, 200, ['Content-Type' => 'text/event-stream; charset=utf-8', 'Cache-Control' => 'no-cache, no-transform', 'X-Accel-Buffering' => 'no']);
    }

    private function actor(Request $request): string
    {
        return $request->attributes->get('actor')['id'];
    }
}
