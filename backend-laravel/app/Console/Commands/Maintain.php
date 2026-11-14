<?php

namespace App\Console\Commands;

use App\Modules\Worker\Application\WorkerStore;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('sabzine:maintain')]
#[Description('Run one maintenance pass')]
class Maintain extends Command
{
    public function handle(WorkerStore $store): int
    {
        $summary = $store->maintenance();
        $this->line(json_encode($summary, JSON_UNESCAPED_UNICODE));

        return 0;
    }
}
