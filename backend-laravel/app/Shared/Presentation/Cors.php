<?php

namespace App\Shared\Presentation;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** Same origin policy as the Nest API: an explicit list, or any origin outside production. */
final class Cors
{
    public function handle(Request $request, Closure $next): Response
    {
        $origin = $request->headers->get('Origin');
        $allowed = array_values(array_filter(array_map('trim', explode(',', (string) env('CORS_ORIGINS', '')))));
        $match = $origin !== null && ($allowed !== [] ? in_array($origin, $allowed, true) : config('identity.environment') !== 'production');
        if ($request->isMethod('OPTIONS') && $match) {
            return response('', 204)->withHeaders($this->headers($origin));
        }
        $response = $next($request);
        if ($match && is_string($origin)) {
            foreach ($this->headers($origin) as $name => $value) {
                $response->headers->set($name, $value);
            }
        }

        return $response;
    }

    private function headers(string $origin): array
    {
        return ['Access-Control-Allow-Origin' => $origin, 'Access-Control-Allow-Credentials' => 'true', 'Access-Control-Allow-Headers' => 'Authorization, Content-Type, X-Sabzine-Client', 'Access-Control-Allow-Methods' => 'GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS', 'Vary' => 'Origin'];
    }
}
