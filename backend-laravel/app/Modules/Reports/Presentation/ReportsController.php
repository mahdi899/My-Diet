<?php

namespace App\Modules\Reports\Presentation;

use App\Modules\Reports\Infrastructure\MySqlReports;
use App\Shared\Domain\Problem;
use Illuminate\Http\Request;

final class ReportsController
{
    public function __construct(private MySqlReports $reports) {}

    public function mine(Request $request): array
    {
        return $this->reports->sla($request->attributes->get('actor')['id']);
    }

    public function admin(): array
    {
        return $this->reports->adminSla();
    }

    public function retention(Request $request): array
    {
        return $this->reports->retention((string) $request->query('from', ''), (string) $request->query('to', ''), (string) $request->query('event', 'activity'));
    }

    public function foods(Request $request): array
    {
        return $this->reports->foods((string) $request->query('from', ''), (string) $request->query('to', ''), (string) $request->query('kind', 'selected'));
    }

    public function feedback(Request $request): array
    {
        return $this->reports->feedback((string) $request->query('from', ''), (string) $request->query('to', ''));
    }

    public function specialists(Request $request): array
    {
        return $this->reports->specialists((string) $request->query('sort', 'rating'));
    }

    public function journey(Request $request): array
    {
        try {
            $body = json_decode($request->getContent(), true, 512, JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            throw new Problem(400, 'validation', 'دستهٔ رویداد نامعتبر است');
        }
        $user = null;
        $header = $request->header('authorization', '');
        if (preg_match('/^Bearer\\s+(\\S+)$/iD', $header)) {
            $user = $request->attributes->get('actor')['id'] ?? null;
        }

        return $this->reports->journey(is_array($body) ? $body : [], $user);
    }

    public function journeys(Request $request): array
    {
        return $this->reports->journeyReport((string) $request->query('from', ''), (string) $request->query('to', ''));
    }
}
