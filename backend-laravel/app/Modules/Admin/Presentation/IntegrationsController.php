<?php

namespace App\Modules\Admin\Presentation;

use App\Modules\Admin\Infrastructure\MySqlIntegrations;
use App\Shared\Domain\Problem;
use App\Shared\Presentation\StrictInput as Input;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class IntegrationsController
{
    public function __construct(private MySqlIntegrations $integrations) {}

    public function connections(): array
    {
        return $this->integrations->connections();
    }

    public function add(Request $request): JsonResponse
    {
        $body = $this->object($request);
        $url = is_string($body['baseUrl'] ?? null) ? $body['baseUrl'] : '';
        $parts = parse_url($url);
        $host = is_array($parts) ? ($parts['host'] ?? '') : '';
        if (! is_array($parts) || ($parts['scheme'] ?? '') !== 'https' || isset($parts['user']) || isset($parts['query']) || $host === '' || $host === 'localhost' || str_ends_with($host, '.local') || filter_var($host, FILTER_VALIDATE_IP)) {
            throw new Problem(400, 'validation', 'نشانی HTTPS عمومی سرویس را وارد کنید');
        }
        $key = is_string($body['apiKey'] ?? null) ? $body['apiKey'] : '';
        if (strlen($key) < 8 || strlen($key) > 4096 || preg_match('/[\r\n]/', $key)) {
            throw new Problem(400, 'validation', 'تنظیمات درست نیست');
        }
        $cost = $body['costPer1kTokens'] ?? 0;
        if (! is_int($cost) || $cost < 0) {
            throw new Problem(400, 'validation', 'تنظیمات درست نیست');
        }

        return response()->json($this->integrations->addConnection($this->actor($request), ['name' => Input::string($body, 'name', 80), 'apiKey' => $key, 'baseUrl' => $url, 'model' => Input::string($body, 'model', 120), 'cost' => $cost]), 201);
    }

    public function activate(Request $request, string $id): array
    {
        $body = $this->object($request);
        if (! is_bool($body['active'] ?? null)) {
            throw new Problem(400, 'validation', 'وضعیت معتبر نیست');
        }

        return $this->integrations->activate($this->actor($request), Input::uuid($id), $body['active']);
    }

    public function remove(Request $request, string $id): array
    {
        return $this->integrations->remove($this->actor($request), Input::uuid($id));
    }

    public function firebase(Request $request): array
    {
        return $this->integrations->configureFirebase($this->actor($request), $this->object($request));
    }

    public function status(): array
    {
        return $this->integrations->pushStatus();
    }

    public function devices(): array
    {
        return $this->integrations->devices();
    }

    public function campaigns(): array
    {
        return $this->integrations->campaigns();
    }

    public function create(Request $request): JsonResponse
    {
        $body = Input::body($request, ['title', 'body', 'audience', 'deviceId', 'scheduledAt']);
        $audience = Input::string($body, 'audience', 20);
        if (! in_array($audience, ['all', 'device'], true)) {
            throw new Problem(400, 'validation', 'اطلاعات اعلان درست نیست');
        }
        $device = isset($body['deviceId']) ? Input::uuid(is_string($body['deviceId']) ? $body['deviceId'] : '') : null;
        if ($audience === 'device' && $device === null) {
            throw new Problem(400, 'validation', 'برای ارسال آزمایشی دستگاه را انتخاب کنید');
        }
        $when = Input::optional($body, 'scheduledAt', 40);
        if ($when !== null && strtotime($when) === false) {
            throw new Problem(400, 'validation', 'زمان ارسال باید در آینده باشد');
        }

        return response()->json($this->integrations->createCampaign($this->actor($request), ['title' => Input::string($body, 'title', 120), 'body' => Input::string($body, 'body', 1000), 'audience' => $audience, 'deviceId' => $device, 'scheduledAt' => $when]), 201);
    }

    public function send(Request $request, string $id): JsonResponse
    {
        return response()->json($this->integrations->sendCampaign($this->actor($request), Input::uuid($id)), 201);
    }

    public function delete(Request $request, string $id): array
    {
        return $this->integrations->deleteCampaign($this->actor($request), Input::uuid($id));
    }

    private function actor(Request $request): string
    {
        return $request->attributes->get('actor')['id'];
    }

    private function object(Request $request): array
    {
        $decoded = json_decode($request->getContent(), true, 512, JSON_THROW_ON_ERROR);

        return is_array($decoded) && ! array_is_list($decoded) ? $decoded : throw new Problem(400, 'validation', 'تنظیمات درست نیست');
    }
}
