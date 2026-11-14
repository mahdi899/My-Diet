<?php

namespace App\Console\Commands;

use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Route;

#[Signature('migration:status {--json} {--require-ready : Return failure until every route and operational gate is covered}')]
#[Description('Compare implemented Laravel routes with the current Nest API contract inventory')]
class MigrationStatus extends Command
{
    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $contracts = json_decode(file_get_contents(base_path('contracts/nest-routes.json')), true, 512, JSON_THROW_ON_ERROR)['routes'];
        $registered = [];
        foreach (Route::getRoutes() as $route) {
            foreach ($route->methods() as $method) {
                $registered[$method.' /'.$route->uri()] = true;
            }
        }
        $missing = [];
        $modules = [];
        foreach ($contracts as $contract) {
            $path = preg_replace('/:([A-Za-z_][A-Za-z0-9_]*)/', '{$1}', $contract['path']);
            $implemented = isset($registered[$contract['method'].' '.$path]);
            $modules[$contract['module']] ??= ['implemented' => 0, 'total' => 0];
            $modules[$contract['module']]['total']++;
            $modules[$contract['module']]['implemented'] += (int) $implemented;
            if (! $implemented) {
                $missing[] = $contract['method'].' '.$contract['path'];
            }
        }
        $gates = json_decode(file_get_contents(base_path('contracts/operational-gates.json')), true, 512, JSON_THROW_ON_ERROR);
        $ready = ! $missing && ! in_array(false, array_column($gates, 'verified'), true);
        $result = ['readyForReplacement' => $ready, 'implementedRoutes' => count($contracts) - count($missing),
            'totalRoutes' => count($contracts), 'modules' => $modules, 'missingRoutes' => $missing, 'operationalGates' => $gates];
        if ($this->option('json')) {
            $this->line(json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR));
        } else {
            $this->table(['Module', 'Registered', 'Required'], array_map(fn ($name, $counts) => [$name, $counts['implemented'], $counts['total']], array_keys($modules), array_values($modules)));
            $this->line('Registered routes do not imply verified behavioral parity.');
            $this->line($ready ? 'Ready for replacement.' : 'Not ready for replacement. See --json for outstanding routes and operational gates.');
        }

        return $this->option('require-ready') && ! $ready ? self::FAILURE : self::SUCCESS;
    }
}
