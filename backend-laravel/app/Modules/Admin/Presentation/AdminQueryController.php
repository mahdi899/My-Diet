<?php

namespace App\Modules\Admin\Presentation;

use App\Modules\Admin\Application\AdminQueries;
use App\Modules\Onboarding\Application\WebPlanDelivery;
use App\Modules\Plans\Infrastructure\MySqlPlanDelivery;
use App\Shared\Presentation\StrictInput;
use Illuminate\Http\Request;

final class AdminQueryController
{
    public function __construct(private AdminQueries $queries, private MySqlPlanDelivery $delivery) {}

    public function deliveries(Request $request): array
    {
        $q = $request->query('q');

        return $this->delivery->report(is_string($q) ? mb_substr(trim($q), 0, 100) : '');
    }

    public function retryDelivery(WebPlanDelivery $delivery, string $id): array
    {
        return $delivery->retry(StrictInput::uuid($id));
    }

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
