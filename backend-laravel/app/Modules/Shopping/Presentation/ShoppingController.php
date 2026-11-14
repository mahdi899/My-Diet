<?php

namespace App\Modules\Shopping\Presentation;

use App\Modules\Shopping\Application\ShoppingService;
use App\Shared\Domain\Problem;
use Illuminate\Http\Request;

final class ShoppingController
{
    public function __construct(private ShoppingService $shopping) {}

    public function list(Request $request): array
    {
        return $this->shopping->get($this->actor($request), $this->scope($request));
    }

    public function share(Request $request): array
    {
        return $this->shopping->share($this->actor($request), $this->scope($request));
    }

    public function flag(Request $request, string $key): array
    {
        $body = json_decode($request->getContent(), true, 512, JSON_THROW_ON_ERROR);
        if (! is_array($body) || array_is_list($body)) {
            throw new Problem(400, 'validation', 'تغییر لیست خرید معتبر نیست');
        }

        return $this->shopping->flag($this->actor($request), $body, $key);
    }

    private function actor(Request $request): string
    {
        return $request->attributes->get('actor')['id'];
    }

    private function scope(Request $request): array
    {
        $days = $request->query('days');
        if ($days !== null && ! is_string($days)) {
            throw new Problem(400, 'validation', 'محدوده لیست خرید معتبر نیست');
        }

        return $this->shopping->scope($request->query('weekStart'), $days === null ? null : explode(',', $days));
    }
}
