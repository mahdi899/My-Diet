<?php

namespace App\Modules\Realtime\Presentation;

use App\Modules\Realtime\Application\RealtimeGateway;
use App\Shared\Domain\Problem;
use App\Shared\Presentation\StrictInput;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

final class RealtimeController
{
    public function __construct(private RealtimeGateway $realtime) {}

    public function register(Request $request): array
    {
        $body = json_decode($request->getContent(), true);
        if (! is_array($body) || array_is_list($body) || array_diff(array_keys($body), ['platform', 'pushToken', 'provider'])) {
            throw new Problem(400, 'validation', 'دستگاه درست معرفی نشده است');
        }
        $actor = $request->attributes->get('actor');

        return $this->realtime->register($actor['id'], $actor['sessionId'], (string) ($body['platform'] ?? ''), (string) ($body['pushToken'] ?? ''), (string) ($body['provider'] ?? ''));
    }

    public function remove(Request $request, string $id): array
    {
        return $this->realtime->remove($request->attributes->get('actor')['id'], StrictInput::uuid($id));
    }

    public function events(Request $request): StreamedResponse
    {
        $user = $request->attributes->get('actor')['id'];
        $since = $request->query('since');
        $cursor = is_string($since) && strtotime($since) !== false ? gmdate('Y-m-d H:i:s.u', strtotime($since)) : '1970-01-01 00:00:00.000000';
        $once = $request->query('once') === '1';
        $events = $this->realtime->since($user, $cursor);

        return response()->stream(function () use ($events, $once): void {
            foreach ($events as $event) {
                echo 'id: '.$event['at']."\n".'event: '.$event['type']."\n".'data: '.json_encode($event['data'], JSON_UNESCAPED_UNICODE)."\n\n";
            }
            if ($once) {
                return;
            }
        }, 200, ['Content-Type' => 'text/event-stream; charset=utf-8', 'Cache-Control' => 'no-cache', 'X-Accel-Buffering' => 'no']);
    }
}
