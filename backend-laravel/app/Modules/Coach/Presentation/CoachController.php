<?php

namespace App\Modules\Coach\Presentation;

use App\Modules\Coach\Application\CoachGateway;
use App\Modules\Coach\Infrastructure\CoachQuotaService;
use App\Modules\Coach\Infrastructure\CoachThreads;
use App\Modules\Plans\Infrastructure\MealSwapService;
use App\Shared\Domain\Problem;
use App\Shared\Presentation\StrictInput as Input;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

final class CoachController
{
    private const ACTIONS = ['confirm_meal', 'dismiss', 'confirm_swap', 'log_as_planned', 'log_water', 'log_weight', 'mood', 'undo_meal', 'show_ring'];

    public function __construct(
        private CoachGateway $coach,
        private CoachQuotaService $quota,
        private CoachThreads $threads,
    ) {}

    public function threads(Request $request): array
    {
        return $this->threads->listing($this->actor($request));
    }

    public function createThread(Request $request): array
    {
        $body = Input::body($request, ['id'], true);
        $id = Input::optional($body, 'id', 36);

        return ['thread' => $this->threads->create($this->actor($request), $id === null ? null : Input::uuid($id))];
    }

    public function renameThread(Request $request, string $id): array
    {
        $body = Input::body($request, ['title']);

        return ['thread' => $this->threads->rename($this->actor($request), Input::uuid($id), Input::string($body, 'title', 80))];
    }

    public function deleteThread(Request $request, string $id): array
    {
        $this->threads->delete($this->actor($request), Input::uuid($id));

        return ['deleted' => true];
    }

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

        $threadId = $request->query('threadId');
        if ($threadId !== null && ! is_string($threadId)) {
            throw new Problem(400, 'validation', 'شناسه معتبر نیست');
        }

        return $this->coach->thread($this->actor($request), $cursor, $size, $threadId === null ? null : Input::uuid($threadId));
    }

    public function messages(Request $request): StreamedResponse
    {
        $userId = $this->actor($request);

        $body = Input::body($request, ['threadId', 'clientMessageId', 'kind', 'text', 'value', 'label', 'action', 'args', 'sourceMessageId', 'mediaId', 'caption', 'mealType']);
        $threadId = $this->threadId($body);
        if ($threadId !== null) {
            $this->threads->owned($userId, $threadId);
        }
        $kind = Input::string($body, 'kind', 20);
        if (! in_array($kind, ['text', 'quick_reply', 'card_action', 'photo'], true)) {
            throw new Problem(400, 'validation', 'اطلاعات واردشده ناقص یا نادرست است');
        }
        $text = $kind === 'quick_reply'
            ? (Input::optional($body, 'label', 80) ?? Input::optional($body, 'value', 200) ?? Input::optional($body, 'text', 8000) ?? '')
            : (Input::optional($body, 'text', 8000) ?? Input::optional($body, 'caption', 300) ?? '');
        $client = Input::uuid(is_string($body['clientMessageId'] ?? null) ? $body['clientMessageId'] : '');

        return response()->stream(function () use ($userId, $client, $text, $threadId): void {
            $write = function (string $event, array $data): void {
                echo 'event: '.$event."\n".'data: '.json_encode($data, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR)."\n\n";
                flush();
            };
            try {
                $accepted = $this->coach->accept($userId, $client, $text, $write, $threadId);
                if (empty($accepted['streamed'])) {
                    $write('message', ['message' => $accepted['userMessage']]);
                }
                if ($accepted['blocked'] !== null) {
                    $write('error', ['code' => 'ai_budget_exceeded', 'messageFa' => $accepted['blocked'] === 'kill_switch' ? 'مربی موقتاً خاموش است.' : 'سقف استفاده از هوش مصنوعی پر شده است.', 'retryable' => false]);
                }
                foreach ($accepted['replies'] as $reply) {
                    $write('message', ['message' => $reply]);
                }
                if (! $accepted['replay'] && ($accepted['metered'] ?? false) && $accepted['blocked'] === null && count($accepted['replies']) > 0) {
                    $this->quota->consumeChat($userId);
                }
                $write('done', ['replay' => $accepted['replay']]);
            } catch (Problem $error) {
                $write('error', ['code' => $error->problemCode, 'messageFa' => $error->messageFa, 'retryable' => $error->status >= 500 || $error->status === 429]);
                $write('done', ['replay' => false]);
            } catch (\Throwable $error) {
                Log::error('Coach request failed', ['type' => $error::class, 'message' => $error->getMessage(), 'file' => $error->getFile(), 'line' => $error->getLine()]);
                $write('error', ['code' => 'internal', 'messageFa' => 'الان نتوانستم جواب بدهم. یک بار دیگر بفرست.', 'retryable' => true]);
                $write('done', ['replay' => false]);
            }
        }, 200, ['Content-Type' => 'text/event-stream; charset=utf-8', 'Cache-Control' => 'no-cache, no-transform', 'X-Accel-Buffering' => 'no']);
    }

    public function photo(Request $request): array
    {
        $userId = $this->actor($request);

        $body = Input::body($request, ['threadId', 'clientMessageId', 'image', 'mime', 'caption', 'mealType']);
        $image = Input::string($body, 'image', 2_800_000);
        $bytes = base64_decode($image, true);
        if ($bytes === false) {
            throw new Problem(400, 'invalid_media', 'محتوای فایل با نوع مجاز یکی نیست');
        }
        $mime = Input::optional($body, 'mime', 80) ?? 'image/jpeg';

        $result = $this->coach->photo($userId, Input::uuid(is_string($body['clientMessageId'] ?? null) ? $body['clientMessageId'] : ''), $bytes, $mime, $this->threadId($body));

        // Consume vision quota after successful analysis
        if (! ($result['replay'] ?? false)) {
            $this->quota->consumeVision($userId);
        }

        return $result;
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
        $body = Input::body($request, ['threadId'], true);

        return $this->coach->dayBrief($this->actor($request), $this->threadId($body));
    }

    public function action(Request $request): array
    {
        $body = Input::body($request, ['threadId', 'clientMessageId', 'action', 'args', 'label', 'sourceMessageId']);
        $action = Input::string($body, 'action', 40);
        if (! in_array($action, self::ACTIONS, true)) {
            throw new Problem(400, 'validation', 'اطلاعات واردشده ناقص یا نادرست است');
        }
        $args = [];
        if (array_key_exists('args', $body) && $body['args'] !== null) {
            $raw = $body['args'] instanceof \stdClass ? (array) $body['args'] : $body['args'];
            if (! is_array($raw)) {
                throw new Problem(400, 'validation', 'اطلاعات واردشده ناقص یا نادرست است');
            }
            $args = $raw;
        }

        return $this->coach->action(
            $this->actor($request),
            Input::uuid(is_string($body['clientMessageId'] ?? null) ? $body['clientMessageId'] : ''),
            $action,
            $args,
            Input::optional($body, 'label', 80),
            $this->threadId($body),
        );
    }

    public function media(Request $request, string $id): Response
    {
        $row = $this->coach->media($this->actor($request), Input::uuid($id));
        if ($row === null) {
            throw new Problem(404, 'not_found', 'عکس پیدا نشد');
        }

        return response($row['content'], 200, ['Content-Type' => $row['mime'], 'Content-Length' => (string) strlen($row['content']), 'Cache-Control' => 'private, max-age=86400', 'X-Content-Type-Options' => 'nosniff']);
    }

    public function confirmPhoto(Request $request, string $id): array
    {
        return $this->coach->confirmPhoto($this->actor($request), Input::uuid($id));
    }

    public function followUps(Request $request): array
    {
        return ['questions' => $this->coach->followUps($this->actor($request))];
    }

    public function buyAddon(Request $request): array
    {
        $body = Input::body($request, ['packCode']);

        return $this->quota->purchaseAddon($this->actor($request), Input::string($body, 'packCode', 32));
    }

    public function quotaStatus(Request $request): array
    {
        return $this->quota->state($this->actor($request));
    }

    public function swapMeal(Request $request): array
    {
        $body = Input::body($request, ['mealId', 'reason', 'budgetOk', 'foodSlug']);
        $mealId = Input::uuid($body['mealId']);

        $swap = app(MealSwapService::class);

        // If foodSlug provided, apply the swap; otherwise return alternatives
        if (isset($body['foodSlug']) && is_string($body['foodSlug'])) {
            $reason = Input::optional($body, 'reason', 32) ?? 'variety';

            return $swap->apply($this->actor($request), $mealId, $body['foodSlug'], $reason);
        }

        $reason = Input::optional($body, 'reason', 32) ?? 'variety';
        $budgetOk = isset($body['budgetOk']) && $body['budgetOk'] === true;

        return $swap->alternatives($this->actor($request), $mealId, $reason, $budgetOk);
    }

    private function threadId(array $body): ?string
    {
        $id = Input::optional($body, 'threadId', 36);

        return $id === null ? null : Input::uuid($id);
    }

    private function actor(Request $request): string
    {
        return $request->attributes->get('actor')['id'];
    }
}
