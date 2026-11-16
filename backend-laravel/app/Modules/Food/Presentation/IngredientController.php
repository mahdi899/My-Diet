<?php

namespace App\Modules\Food\Presentation;

use App\Modules\Food\Application\IngredientService;
use App\Shared\Domain\Problem;
use Illuminate\Http\Request;

final class IngredientController
{
    public function __construct(private IngredientService $service) {}

    public function listing(Request $request): array
    {
        return $this->service->listing($request->only(['q', 'category', 'cursor', 'limit']));
    }

    public function update(Request $request, string $code): array
    {
        return $this->service->update($code, $request->json()->all());
    }

    public function delete(Request $request, string $code): array
    {
        if ($request->input('confirmation') !== 'حذف ماده') {
            throw new Problem(400, 'validation', 'تأیید حذف الزامی است');
        }

        return $this->service->delete($code);
    }
}
