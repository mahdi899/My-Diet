<?php

namespace App\Modules\Privacy\Presentation;

use App\Modules\Privacy\Infrastructure\MySqlPrivacy;
use App\Shared\Domain\Problem;
use Illuminate\Http\Request;

final class PrivacyController
{
    public function __construct(private MySqlPrivacy $privacy) {}

    public function export(Request $request): array
    {
        return $this->privacy->export($request->attributes->get('actor')['id']);
    }

    public function delete(Request $request): array
    {
        $body = json_decode($request->getContent(), true);
        if (! is_array($body) || array_is_list($body) || array_keys($body) !== ['confirmation'] || ($body['confirmation'] ?? null) !== 'حذف حساب') {
            throw new Problem(400, 'validation', 'برای حذف حساب عبارت تأیید را بنویس');
        }

        return $this->privacy->delete($request->attributes->get('actor')['id']);
    }
}
