<?php

namespace App\Shared\Presentation;

use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\Response;

/** Serves the admin and doctor panels from this repository, without the Nest process. */
final class StaffAssets
{
    public function admin(?string $path = null): Response
    {
        return $this->file(dirname(base_path()).DIRECTORY_SEPARATOR.'admin', $path);
    }

    public function doctor(?string $path = null): Response
    {
        return $this->file(dirname(base_path()).DIRECTORY_SEPARATOR.'doctor', $path);
    }

    private function file(string $root, ?string $path): Response
    {
        $base = realpath($root);
        if ($base === false) {
            return response('missing', 404);
        }
        $relative = $path === null || $path === '' ? 'index.html' : str_replace('\\', '/', $path);
        if (str_contains($relative, '..')) {
            return response('missing', 404);
        }
        $candidate = $base.DIRECTORY_SEPARATOR.str_replace('/', DIRECTORY_SEPARATOR, $relative);
        if (is_dir($candidate)) {
            $candidate = rtrim($candidate, DIRECTORY_SEPARATOR).DIRECTORY_SEPARATOR.'index.html';
        }
        $file = realpath($candidate);
        if ($file === false || ! str_starts_with($file, $base) || ! is_file($file)) {
            return response('missing', 404);
        }
        $response = new BinaryFileResponse($file);
        $response->headers->set('X-Content-Type-Options', 'nosniff');
        $response->headers->set('Cache-Control', 'no-store');

        return $response;
    }
}
