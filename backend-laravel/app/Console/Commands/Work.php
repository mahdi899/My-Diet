<?php

namespace App\Console\Commands;

use App\Modules\Admin\Infrastructure\MySqlIntegrations;
use App\Modules\Worker\Application\JobWorker;
use App\Modules\Worker\Application\WorkerStore;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('sabzine:work {--once : Relay and drain the queue once, then exit}')]
#[Description('Run the Sabzine worker loop')]
class Work extends Command
{
    public function handle(WorkerStore $store, JobWorker $worker, MySqlIntegrations $push): int
    {
        if (config('runtime.role') !== 'worker') {
            $this->error('sabzine:work only starts when APP_ROLE=worker. The HTTP process stays APP_ROLE=api.');

            return 1;
        }
        $once = function () use ($store, $worker, $push): void {
            $store->heartbeat();
            $store->relay();
            $worker->drain();
            $push->dispatchDue();
        };
        $once();
        if ($this->option('once')) {
            return 0;
        }
        while (true) {
            $once();
            $store->maintenance();
            sleep(1);
        }
    }
}
