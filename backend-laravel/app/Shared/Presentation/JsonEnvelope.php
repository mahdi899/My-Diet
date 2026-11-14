<?php

namespace App\Shared\Presentation;

use App\Shared\Domain\Problem;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\HttpException;

final class JsonEnvelope
{
    /**
     * Handle an incoming request.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        if (strtolower(trim(explode(';', $request->header('Content-Type', ''))[0])) !== 'application/json') {
            return $next($request);
        }
        $raw = $request->getContent();
        if (strlen($raw) > 3 * 1024 * 1024) {
            throw new HttpException(413);
        }
        if ($raw !== '') {
            try {
                $body = json_decode($raw, false, 512, JSON_THROW_ON_ERROR);
                if (! $body instanceof \stdClass && ! is_array($body)) {
                    throw new \JsonException;
                }
            } catch (\JsonException) {
                throw new Problem(400, 'validation', 'اطلاعات واردشده ناقص یا نادرست است');
            }
        }

        return $next($request);
    }
}
