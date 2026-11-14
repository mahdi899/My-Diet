<?php

namespace App\Modules\Admin\Presentation;

use App\Modules\Admin\Application\AdminQueries;
use Illuminate\Http\Request;

final class AdminQueryController
{
    public function __construct(private AdminQueries $queries) {}

    public function dashboard(Request $request): array
    {
        return $this->queries->dashboard($request->attributes->get('actor')['id']);
    }

    public function orders(): array
    {
        return $this->queries->orders();
    }

    public function payments(): array
    {
        return $this->queries->payments();
    }

    public function auditLogs(): array
    {
        return $this->queries->auditLogs();
    }

    public function publicSpecialists(): array
    {
        return $this->queries->specialists(true);
    }

    public function adminSpecialists(): array
    {
        return $this->queries->specialists(false);
    }

    public function ownProfile(Request $request): array
    {
        return $this->queries->ownProfile($request->attributes->get('actor')['id']);
    }
}
