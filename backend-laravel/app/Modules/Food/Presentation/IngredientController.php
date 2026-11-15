<?php

namespace App\Modules\Food\Presentation;

use App\Modules\Food\Application\IngredientService;
use Illuminate\Http\Request;

final class IngredientController
{
    public function __construct(private IngredientService $service) {}

    public function listing(Request $request): array
    {
        return $this->service->listing($request->only(['q', 'category', 'cursor', 'limit']));
    }
}
