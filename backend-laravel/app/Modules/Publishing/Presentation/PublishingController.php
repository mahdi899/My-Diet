<?php

namespace App\Modules\Publishing\Presentation;

use App\Modules\Publishing\Application\PublishingService;
use App\Shared\Presentation\StrictInput;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class PublishingController
{
    public function __construct(private PublishingService $service) {}

    private function actor(Request $request): string
    {
        return $request->attributes->get('actor')['id'];
    }

    public function articles(Request $request): array
    {
        return $this->service->articles(null, $request->query('page'), $request->query('pageSize'));
    }

    public function adminArticles(Request $request): array
    {
        return $this->service->articles($request->query('status'), $request->query('page'), $request->query('pageSize'), true);
    }

    public function article(string $slug): array
    {
        return $this->service->article($slug);
    }

    public function create(Request $request): JsonResponse
    {
        return response()->json($this->service->saveArticle($this->actor($request), StrictInput::body($request, ['slug', 'title', 'category', 'image', 'readingMinutes', 'intro', 'sections'])), 201);
    }

    public function update(Request $request, string $slug): array
    {
        return $this->service->saveArticle($this->actor($request), StrictInput::body($request, ['title', 'category', 'image', 'readingMinutes', 'intro', 'sections']), $slug);
    }

    public function publish(Request $request, string $slug): JsonResponse
    {
        return response()->json($this->service->articleStatus($this->actor($request), $slug, 'published'), 201);
    }

    public function unpublish(Request $request, string $slug): JsonResponse
    {
        return response()->json($this->service->articleStatus($this->actor($request), $slug, 'draft'), 201);
    }

    public function documents(): array
    {
        return $this->service->documents();
    }

    public function publishConsent(Request $request): JsonResponse
    {
        return response()->json($this->service->publishConsent($this->actor($request), StrictInput::body($request, ['purpose', 'summary', 'status'])), 201);
    }

    public function consents(Request $request): array
    {
        return $this->service->consents($this->actor($request));
    }

    public function recordConsent(Request $request): JsonResponse
    {
        return response()->json($this->service->recordConsent($this->actor($request), StrictInput::body($request, ['purpose', 'version'])), 201);
    }

    public function config(): array
    {
        return $this->service->config();
    }

    public function saveConfig(Request $request): array
    {
        return $this->service->saveConfig($this->actor($request), StrictInput::body($request, ['minAppVersion', 'downloadStatus', 'downloadUrl']));
    }
}
