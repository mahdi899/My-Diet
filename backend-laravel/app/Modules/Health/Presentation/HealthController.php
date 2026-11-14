<?php

namespace App\Modules\Health\Presentation;

use App\Shared\Domain\Problem;
use Illuminate\Database\ConnectionInterface;
use Throwable;

final class HealthController
{
    public function live(): array
    {
        return ['status' => 'ok'];
    }

    public function ready(ConnectionInterface $db): array
    {
        try {
            $db->select('select 1');

            return ['status' => 'ok', 'database' => 'up'];
        } catch (Throwable) {
            throw new Problem(503, 'dependency_outage', 'پایگاه داده در دسترس نیست');
        }
    }
}
