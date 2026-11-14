<?php

namespace App\Console\Commands;

use FilesystemIterator;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;

#[Signature('sabzine:import-media {source : Directory of media files} {--manifest= : File that receives path and sha256 lines}')]
#[Description('Write a path and checksum manifest. Source files are not deleted or moved.')]
class ImportMedia extends Command
{
    public function handle(): int
    {
        $source = (string) $this->argument('source');
        if (! is_dir($source)) {
            $this->error('The source directory does not exist. Nothing was deleted.');

            return 1;
        }
        $lines = [];
        foreach (new RecursiveIteratorIterator(new RecursiveDirectoryIterator($source, FilesystemIterator::SKIP_DOTS)) as $file) {
            if (! $file->isFile()) {
                continue;
            }
            $lines[] = hash_file('sha256', $file->getPathname()).'  '.$file->getPathname();
        }
        $manifest = (string) $this->option('manifest');
        if ($manifest !== '') {
            file_put_contents($manifest, implode("\n", $lines).($lines === [] ? '' : "\n"));
        }
        $this->line(json_encode(['files' => count($lines), 'deleted' => 0]));

        return 0;
    }
}
