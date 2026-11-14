<?php

namespace Tests\Feature;

use Tests\MySqlTestCase;

final class AdminQueryContractTest extends MySqlTestCase
{
    public function test_admin_dashboard_read_endpoints_and_authorization(): void
    {
        $this->actor('admin');
        $this->getJson('/v1/admin/dashboard')->assertOk()->assertJsonStructure(['users', 'newUsers', 'revenueToman', 'paidOrders', 'aiToday', 'unreadMessages']);
        foreach (['orders', 'payments', 'audit-logs', 'specialists'] as $path) {
            $this->getJson('/v1/admin/'.$path)->assertOk()->assertExactJson([]);
        }
        $this->actor();
        $this->getJson('/v1/admin/dashboard')->assertForbidden();
        $this->getJson('/v1/specialists')->assertOk()->assertExactJson([]);
    }
}
