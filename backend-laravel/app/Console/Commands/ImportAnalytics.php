<?php

namespace App\Console\Commands;

use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

#[Signature('sabzine:import-analytics {--url= : Destination URL whose database name contains _test or _rehearsal} {--source= : JSON snapshot; omitted means nothing is imported}')]
#[Description('Import an analytics snapshot into an empty disposable database. Never truncates.')]
class ImportAnalytics extends Command
{
    public function handle(): int
    {
        $name = ltrim((string) parse_url((string) $this->option('url'), PHP_URL_PATH), '/');
        $configured = ltrim((string) parse_url((string) config('database.connections.mysql.url'), PHP_URL_PATH), '/');
        if ($name === '' || $name !== $configured || (! str_contains($name, '_test') && ! str_contains($name, '_rehearsal'))) {
            $this->error('Refusing to import analytics unless the connected database is the named disposable database.');

            return 1;
        }
        $source = (string) $this->option('source');
        if ($source === '') {
            $this->line(json_encode(['imported' => 0, 'reason' => 'no source snapshot']));

            return 0;
        }
        if (DB::table('website_event')->count() > 0) {
            $this->error('Refusing to import into a destination that already has analytics events. The table was not truncated.');

            return 1;
        }
        $decoded = json_decode((string) file_get_contents($source), true);
        $events = is_array($decoded['events'] ?? null) ? $decoded['events'] : null;
        if (! is_array($events)) {
            $this->error('The snapshot must contain an events array. Nothing was changed.');

            return 1;
        }
        foreach ($events as $event) {
            DB::table('website_event')->insert($event);
        }
        $this->line(json_encode(['imported' => count($events), 'truncated' => false]));

        return 0;
    }
}
