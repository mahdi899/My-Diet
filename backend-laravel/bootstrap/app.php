<?php

use App\Modules\Identity\Presentation\SessionMiddleware;
use App\Shared\Domain\Problem;
use App\Shared\Presentation\Cors;
use App\Shared\Presentation\JsonEnvelope;
use App\Shared\Presentation\ProblemRenderer;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Foundation\Http\Middleware\ConvertEmptyStringsToNull;
use Illuminate\Foundation\Http\Middleware\TrimStrings;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        commands: __DIR__.'/../routes/console.php',
        then: function (): void {
            require __DIR__.'/../routes/api.php';
        },
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->append(JsonEnvelope::class);
        $middleware->append(Cors::class);
        $middleware->remove([
            TrimStrings::class,
            ConvertEmptyStringsToNull::class,
        ]);
        $middleware->alias(['session' => SessionMiddleware::class]);
        $middleware->trustProxies(at: ['REMOTE_ADDR'], headers: Request::HEADER_X_FORWARDED_FOR | Request::HEADER_X_FORWARDED_PROTO);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->dontReport([Problem::class]);
        $exceptions->report(function (Throwable $error): bool {
            Log::error('Request failed', ['exceptionType' => get_class($error)]);

            return false;
        });
        $exceptions->shouldRenderJsonWhen(fn () => true);
        $exceptions->render(fn (Throwable $error) => ProblemRenderer::render($error));
    })->create();
