<?php

namespace Tests\Feature;

use Tests\MySqlTestCase;

final class ShoppingContractTest extends MySqlTestCase
{
    public function test_shopping_routes_require_a_user_session(): void
    {
        $this->getJson('/v1/me/shopping-list?weekStart=2026-11-14')->assertUnauthorized();
    }
}
