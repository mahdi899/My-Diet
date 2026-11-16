<?php

namespace App\Modules\Coach\Presentation;

use App\Modules\Coach\Infrastructure\CoachQuotaService;
use App\Shared\Domain\Problem;
use Illuminate\Http\Request;

final class CoachQuotaAdminController
{
    public function __construct(private CoachQuotaService $quota) {}

    public function index(): array
    {
        return ['plans' => $this->quota->planQuotas(), 'packs' => [
            ['code' => 'pack_30', 'credits' => 30, 'priceToman' => 50000, 'label' => '۳۰ پیام اضافی'],
            ['code' => 'pack_100', 'credits' => 100, 'priceToman' => 150000, 'label' => '۱۰۰ پیام اضافی'],
        ]];
    }

    public function update(Request $request, string $planCode): array
    {
        if (! preg_match('/^[a-z0-9_]{2,32}$/', $planCode)) {
            throw new Problem(400, 'validation', 'کد پلن معتبر نیست');
        }
        $body = json_decode($request->getContent(), true);
        if (! is_array($body)) {
            throw new Problem(400, 'validation', 'اطلاعات واردشده ناقص یا نادرست است');
        }
        foreach (['dailyLimit', 'periodLimit', 'periodDays', 'visionLimit'] as $key) {
            if (! isset($body[$key]) || ! is_int($body[$key]) || $body[$key] < 1) {
                throw new Problem(400, 'validation', 'سقف‌ها باید عدد درست باشند');
            }
        }
        $this->quota->updatePlanQuota($planCode, $body['dailyLimit'], $body['periodLimit'], $body['periodDays'], $body['visionLimit']);

        return ['plans' => $this->quota->planQuotas()];
    }
}
