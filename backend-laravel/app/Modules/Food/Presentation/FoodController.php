<?php

namespace App\Modules\Food\Presentation;

use App\Modules\Food\Application\FoodService;
use App\Modules\Food\Infrastructure\NutritionReview;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final class FoodController
{
    public function __construct(private FoodService $service) {}

    private function actor(Request $request): string
    {
        return $request->attributes->get('actor')['id'];
    }

    private function body(Request $request): array
    {
        try {
            $value = json_decode($request->getContent(), false, 512, JSON_THROW_ON_ERROR);

            return $value instanceof \stdClass ? (array) $value : [];
        } catch (\JsonException) {
            return [];
        }
    }

    public function listing(Request $request): array
    {
        return $this->service->listing($request->only(['q', 'category', 'active', 'cursor', 'limit']));
    }

    public function catalog(Request $request): array
    {
        return $this->service->listing([...$request->only(['q', 'category', 'cursor', 'limit']), 'active' => 'true']);
    }

    public function compose(Request $request): JsonResponse
    {
        return response()->json($this->service->compose($this->body($request)), 201);
    }

    public function image(string $file): Response
    {
        return response($this->service->image($file), 200, ['Content-Type' => 'image/jpeg', 'Cache-Control' => 'public, max-age=86400']);
    }

    public function get(string $slug): array
    {
        return $this->service->get($slug);
    }

    public function create(Request $request): JsonResponse
    {
        return response()->json($this->service->save($this->actor($request), $this->body($request)), 201);
    }

    public function update(Request $request, string $slug): array
    {
        return $this->service->save($this->actor($request), $this->body($request), $slug);
    }

    public function nutritionStatus(Request $request, string $slug): array
    {
        return app(NutritionReview::class)->setStatus($slug, (string) ($this->body($request)['status'] ?? ''));
    }

    public function nutritionEstimate(string $slug): array
    {
        return app(NutritionReview::class)->estimate($slug);
    }

    public function activate(Request $request, string $slug): JsonResponse
    {
        return response()->json($this->service->activate($this->actor($request), $slug, $this->body($request)['active'] ?? null), 201);
    }

    public function exportCsv(): Response
    {
        return response($this->service->csv(), 200, ['Content-Type' => 'text/csv; charset=utf-8', 'Content-Disposition' => 'attachment; filename="sabzine-foods.csv"']);
    }

    public function exportWrappedCsv(): array
    {
        return ['csv' => $this->service->csv()];
    }

    public function export(): array
    {
        return $this->service->export();
    }

    public function revision(): array
    {
        return $this->service->revision();
    }

    public function import(Request $request): JsonResponse
    {
        return response()->json($this->service->import($this->actor($request), $this->body($request)['csv'] ?? null), 201);
    }

    public function replace(Request $request): JsonResponse
    {
        return response()->json($this->service->replace($this->actor($request), $this->body($request)), 201);
    }

    public function backup(string $id): array
    {
        return $this->service->backup($id);
    }
}
