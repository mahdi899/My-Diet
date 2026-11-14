<?php

namespace App\Modules\Admin\Presentation;

use App\Modules\Admin\Domain\AdminRules;
use App\Modules\Admin\Infrastructure\MySqlCampaigns;
use App\Shared\Domain\Problem;
use App\Shared\Presentation\StrictInput as Input;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final class CampaignController
{
    public function __construct(private MySqlCampaigns $campaigns) {}

    public function list(): array
    {
        return $this->campaigns->list();
    }

    public function create(Request $request): JsonResponse
    {
        $body = Input::body($request, ['name', 'slug', 'source']);

        return response()->json($this->campaigns->create($request->attributes->get('actor')['id'], ['name' => Input::string($body, 'name', 120), 'slug' => Input::string($body, 'slug', 64), 'source' => Input::string($body, 'source', 80)]), 201);
    }

    public function toggle(Request $request, string $id): array
    {
        $body = Input::body($request, ['active']);
        if (! is_bool($body['active'] ?? null)) {
            throw new Problem(400, 'validation', 'وضعیت معتبر نیست');
        }

        return $this->campaigns->toggle($request->attributes->get('actor')['id'], Input::uuid($id), $body['active']);
    }

    public function open(string $slug): Response
    {
        return $this->redirect($slug, true);
    }

    public function head(string $slug): Response
    {
        return $this->redirect($slug, false);
    }

    private function redirect(string $slug, bool $count): Response
    {
        $headers = ['Cache-Control' => 'private, no-store, no-cache, max-age=0', 'CDN-Cache-Control' => 'no-store', 'Surrogate-Control' => 'no-store', 'Pragma' => 'no-cache', 'Expires' => '0', 'X-Robots-Tag' => 'noindex, nofollow'];
        $row = $this->campaigns->resolve($slug, $count);
        if ($row === null) {
            return response('<!doctype html><html lang="fa" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>لینک در دسترس نیست</title><body><h1>این لینک فعال نیست یا وجود ندارد.</h1><p>برای دریافت لینک معتبر با منتشرکننده تماس بگیرید.</p></body></html>', 410, $headers)->header('Content-Type', 'text/html; charset=UTF-8');
        }

        return redirect(AdminRules::destination($row['source'], $row['slug']), 302)->withHeaders($headers);
    }
}
