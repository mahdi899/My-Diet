<?php

namespace App\Modules\Realtime\Application;

final class EventStream
{
    public function __construct(private RealtimeGateway $gateway) {}

    /** The callbacks allow tests to deliver events after the initial poll without opening a real connection. */
    public function pump(string $user, string $cursor, bool $once, \Closure $write, \Closure $pause, \Closure $connected, int $polls = 110): void
    {
        $seen = [];
        for ($poll = 0; $poll < ($once ? 1 : $polls) && $connected(); $poll++) {
            $events = $this->gateway->since($user, $cursor);
            foreach ($events as $event) {
                $key = $event['type'].':'.json_encode($event['data'], JSON_THROW_ON_ERROR).':'.$event['at'];
                if (isset($seen[$key])) {
                    continue;
                }
                $write('id: '.$event['at']."\n".'event: '.$event['type']."\n".'data: '.json_encode($event['data'], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR)."\n\n");
                $seen[$key] = $event['at'];
                if ($event['at'] > $cursor) {
                    $cursor = $event['at'];
                }
            }
            $seen = array_filter($seen, fn ($at) => $at >= $cursor);
            if (! $once) {
                $write(": ping\n\n");
                $pause();
            }
        }
    }
}
