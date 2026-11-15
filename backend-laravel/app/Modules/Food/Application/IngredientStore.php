<?php

namespace App\Modules\Food\Application;

interface IngredientStore
{
    /**
     * @return list<array{code: string, nameFa: string, category: string, nutritionReference: ?string, recipeCount: int}>
     */
    public function all(): array;
}
