<?php

namespace App\Modules\Realtime\Presentation;

use App\Modules\Realtime\Application\EventStream;
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
        $since = $request->query('since', $request->header('Last-Event-ID'));
        $cursor = is_string($since) && strtotime($since) !== false
            ? (new \DateTimeImmutable($since))->setTimezone(new \DateTimeZone('UTC'))->format('Y-m-d\TH:i:s.u\Z') : '1970-01-01T00:00:00.000000Z';
        $once = $request->query('once') === '1';

        return response()->stream(function () use ($user, $cursor, $once): void {
            app(EventStream::class)->pump($user, $cursor, $once,
                function (string $chunk) use ($once): void {
                    echo $chunk;
                    if (! $once) {
                        if (ob_get_level() > 0) {
                            ob_flush();
                        } flush();
                    }
                },
                fn () => usleep(500000), fn () => ! connection_aborted());
        }, 200, ['Content-Type' => 'text/event-stream; charset=utf-8', 'Cache-Control' => 'no-cache', 'X-Accel-Buffering' => 'no']);
    }
}
