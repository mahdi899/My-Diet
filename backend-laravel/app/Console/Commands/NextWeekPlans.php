<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Modules\Plans\Application\NextWeekPlanner;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('sabzine:next-week')]
#[Description('Queue next-week diet drafts for published weeks that have ended')]
class NextWeekPlans extends Command
{
    public function handle(NextWeekPlanner $planner): int
    {
        $this->line((string) $planner->queueDue());

        return 0;
    }
}
