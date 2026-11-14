<?php

namespace App\Modules\Identity\Presentation;

use App\Modules\Identity\Application\IdentityService;
use App\Shared\Domain\Problem;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final class SessionMiddleware
{
    public function __construct(private IdentityService $identity) {}

    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        if (!preg_match('/^Bearer\\s+(\\S+)$/iD', $request->header('authorization', ''), $matches)) {
            throw new Problem(401, 'unauthorized', 'نشست معتبر نیست');
        }
        $actor = $this->identity->authenticate($matches[1]);
        if ($roles && !in_array($actor['role'], $roles, true)) {
            throw new Problem(403, 'forbidden', 'اجازهٔ این کار را ندارید');
        }
        $request->attributes->set('actor', $actor);
        return $next($request);
    }
}
