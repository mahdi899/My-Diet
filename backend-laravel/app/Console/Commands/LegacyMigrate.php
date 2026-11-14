<?php

namespace App\Console\Commands;

use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use App\Shared\Infrastructure\LegacySchema;

#[Signature('legacy:migrate {--plan : Show pending SQL without changing the database} {--force : Allow a production schema migration}')]
#[Description('Apply or adopt the existing PostgreSQL SQL migrations without rebuilding tables')]
class LegacyMigrate extends Command
{
    /**
     * Execute the console command.
     */
    public function handle(LegacySchema $schema): int
    {
        if (config('identity.environment') === 'production' && !$this->option('plan') && !$this->option('force')) {
            $this->error('Production schema changes require --force. Inspect --plan first.');
            return self::FAILURE;
        }
        $pending = $schema->migrate(database_path('legacy'), (bool) $this->option('plan'));
        foreach ($pending as $name) {
            $this->line($name);
        }
        $this->info(count($pending).' SQL migrations '.($this->option('plan') ? 'pending' : 'applied').'.');
        return self::SUCCESS;
    }
}
