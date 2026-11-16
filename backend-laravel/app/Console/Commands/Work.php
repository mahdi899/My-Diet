<?php

namespace App\Console\Commands;

use App\Modules\Admin\Infrastructure\MySqlIntegrations;
use App\Modules\Onboarding\Application\OnboardingAdminQueries;
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
        $localOnce = app()->environment('local') && $this->option('once');
        if (config('runtime.role') !== 'worker' && ! $localOnce) {
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
        $running = true;
        if (function_exists('pcntl_async_signals')) {
            pcntl_async_signals(true);
            $stop = function () use (&$running): void {
                $running = false;
            };
            pcntl_signal(SIGTERM, $stop);
            pcntl_signal(SIGINT, $stop);
        }
        $lastMaintenance = 0;
        $lastRefresh = 0;
        while ($running) {
            $once();
            if (time() - $lastMaintenance >= 60) {
                $store->maintenance();
                $lastMaintenance = time();
            }
            if (time() - $lastRefresh >= 3600) {
                app(OnboardingAdminQueries::class)->refresh();
                $lastRefresh = time();
            }
            sleep(1);
        }

        return 0;
    }
}
