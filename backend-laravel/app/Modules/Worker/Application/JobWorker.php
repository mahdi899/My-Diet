<?php

namespace App\Modules\Worker\Application;

use App\Modules\Coach\Application\CoachGateway;
use App\Modules\Plans\Application\PlanGeneration;
use App\Modules\Realtime\Application\RealtimeGateway;
use Throwable;

final class JobWorker
{
    public function __construct(private WorkerStore $store, private PlanGeneration $plans, private RealtimeGateway $realtime, private CoachGateway $coach) {}

    public function drain(): int
    {
        $done = 0;
        do {
            $jobs = $this->store->claim();
            foreach ($jobs as $job) {
                try {
                    $this->handle($job);
                    $this->store->succeed($job->id);
                    $done++;
                } catch (Throwable $error) {
                    $limit = $job->topic === 'plan.generate' ? 3 : 5;
                    $this->store->fail($job->id, $error->getMessage(), (int) $job->attempts, $limit);
                }
            }
        } while ($jobs !== []);

        return $done;
    }

    private function handle(object $job): void
    {
        $payload = is_string($job->payload) ? json_decode($job->payload, true) : (array) $job->payload;
        if ($job->topic === 'plan.generate') {
            $requestId = $payload['payload']['requestId'] ?? $payload['requestId'] ?? $job->aggregate_id;
            $regenerate = (bool) ($payload['payload']['regenerate'] ?? $payload['regenerate'] ?? false);
            $this->plans->generate((string) $requestId, $regenerate);

            return;
        }
        if ($job->topic === 'push.send') {
            $userId = $payload['userId'] ?? $payload['payload']['userId'] ?? null;
            $kind = $payload['kind'] ?? $payload['payload']['kind'] ?? 'message';
            if (is_string($userId) && is_string($kind)) {
                $this->realtime->deliver($userId, $kind);
            }

            return;
        }
        if ($job->topic === 'shopping.invalidate') {
            return;
        }
        if ($job->topic === 'coach.proactive') {
            $this->coach->proactive();

            return;
        }
        throw new \RuntimeException('unknown topic '.$job->topic);
    }
}
