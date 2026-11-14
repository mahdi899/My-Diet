<?php

namespace App\Modules\Admin\Application;

interface AdminQueries
{
    public function dashboard(string $actor): array;

    public function orders(): array;

    public function payments(): array;

    public function auditLogs(): array;

    public function specialists(bool $public): array;

    public function ownProfile(string $actor): array;
}
