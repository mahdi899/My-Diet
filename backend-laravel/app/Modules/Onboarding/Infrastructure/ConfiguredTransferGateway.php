<?php

namespace App\Modules\Onboarding\Infrastructure;

use App\Modules\Onboarding\Application\TransferGateway;
use App\Shared\Domain\Problem;
use Illuminate\Support\Facades\Http;

final class ConfiguredTransferGateway implements TransferGateway
{
    private function request(string $operation, array $payload): array
    {
        try {
            $merchant = trim((string) config('payments.zibal_merchant'));
            if ($merchant === '') {
                $path = '/run/secrets/zibal_merchant';
                $merchant = is_readable($path) ? trim(file_get_contents($path)) : '';
            }
            if ($merchant === '') {
                throw new \RuntimeException('Missing merchant');
            }
            $response = Http::timeout(12)->withoutRedirecting()->post('https://gateway.zibal.ir/v1/'.$operation, [...$payload, 'merchant' => $merchant]);
            if (! $response->successful() || ! is_array($response->json())) {
                throw new \RuntimeException('Gateway unavailable');
            }

            return $response->json();
        } catch (\Throwable) {
            throw new Problem(503, 'unavailable', 'ارتباط با درگاه زیبال برقرار نشد');
        }
    }

    public function start(int $rial, string $order): string
    {
        $payment = $this->request('request', ['amount' => $rial, 'orderId' => $order, 'callbackUrl' => 'https://my-diet.ir/v1/me/onboarding-transfers/zibal/return']);
        $track = (string) ($payment['trackId'] ?? '');
        if (($payment['result'] ?? null) !== 100 || ! preg_match('/^[0-9]{1,20}$/D', $track)) {
            throw new Problem(502, 'gateway_rejected', 'درگاه زیبال درخواست پرداخت را نپذیرفت');
        }

        return $track;
    }

    public function verify(string $track, int $rial): bool
    {
        $payment = $this->request('verify', ['trackId' => (float) $track]);

        return in_array($payment['result'] ?? null, [100, 201], true) && ($payment['status'] ?? null) === 1 && (float) ($payment['amount'] ?? 0) === (float) $rial;
    }

    public function redirectUrl(string $track): string
    {
        return 'https://gateway.zibal.ir/start/'.$track;
    }
}
