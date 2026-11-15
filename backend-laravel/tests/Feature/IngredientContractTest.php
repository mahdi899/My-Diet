<?php

namespace Tests\Feature;

use Tests\MySqlTestCase;

final class IngredientContractTest extends MySqlTestCase
{
    public function test_admin_lists_shared_ingredients_by_search_and_category(): void
    {
        $this->actor('admin');
        $this->db->table('food_ingredients')->insert([
            ['code' => 'ING-9001', 'name_fa' => 'عدس آزمایشی', 'category' => 'pantry', 'nutrition_reference' => 'مرجع آزمایش'],
            ['code' => 'ING-9002', 'name_fa' => 'شیر آزمایشی', 'category' => 'dairy', 'nutrition_reference' => null],
        ]);
        $page = $this->getJson('/v1/admin/ingredients?limit=1&q=آزمایش')->assertOk()->assertJsonCount(1, 'items')->json();
        self::assertSame('ING-9001', $page['items'][0]['code']);
        self::assertSame(0, $page['items'][0]['recipeCount']);
        self::assertSame('ING-9001', $page['nextCursor']);
        $this->getJson('/v1/admin/ingredients?category=dairy&q=شیر')->assertOk()->assertJsonCount(1, 'items')->assertJsonPath('items.0.code', 'ING-9002');
        $this->getJson('/v1/admin/ingredients?category=invalid')->assertStatus(400)->assertJsonPath('code', 'validation');
        $this->actor();
        $this->getJson('/v1/admin/ingredients')->assertForbidden();
    }
}
