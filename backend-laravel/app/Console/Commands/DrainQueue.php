<?php

namespace App\Console\Commands;

use App\Modules\Worker\Application\WorkerStore;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('migration:drain-queue {snapshot : JSON snapshot of undelivered source jobs}')]
#[Description('Insert Laravel jobs from a queue snapshot without truncating the destination')]
class DrainQueue extends Command
{
    public function handle(WorkerStore $store): int
    {
        $path = (string) $this->argument('snapshot');
        if (! is_file($path)) {
            $this->error('A source snapshot file is required. Nothing was changed.');

            return 1;
        }
        $decoded = json_decode((string) file_get_contents($path), true);
        $jobs = is_array($decoded['jobs'] ?? null) ? $decoded['jobs'] : null;
        if (! is_array($jobs)) {
            $this->error('The snapshot must contain a jobs array. Nothing was changed.');

            return 1;
        }
        $result = $store->drainSnapshot($jobs);
        $this->line(json_encode($result));

        return 0;
    }
}
