<?php

namespace App\Modules\Money\Infrastructure;

use App\Modules\Money\Application\PaymentGateways;
use Illuminate\Support\Facades\Http;

final class ConfiguredGateways implements PaymentGateways
{
    private array $names;

    private string $base;

    public function __construct(private array $config, string $environment)
    {
        $this->names = array_values(array_unique(array_filter(array_map('trim', explode(',', $config['enabled'])))));
        if (! $this->names) {
            $this->names = [$config['default']];
        }
        if (array_diff($this->names, ['sandbox', 'zarinpal', 'idpay']) || ! in_array($config['default'], $this->names, true)) {
            throw new \LogicException('PAYMENT_GATEWAYS must contain valid gateways and include PAYMENT_GATEWAY.');
        }
        if ($environment === 'production' && (in_array('sandbox', $this->names, true) || $config['zarinpal_base_url'] || $config['zarinpal_sandbox'])) {
            throw new \LogicException('Production payments cannot use the sandbox or test gateway overrides.');
        }
        if ($environment === 'production' && in_array('zarinpal', $this->names, true) && ! $config['zarinpal_merchant']) {
            throw new \LogicException('ZARINPAL_MERCHANT_ID must be configured.');
        }
        $this->base = rtrim($config['zarinpal_base_url'] ?: ($config['zarinpal_sandbox'] ? 'https://sandbox.zarinpal.com' : 'https://payment.zarinpal.com'), '/');
    }

    public function listing(): array
    {
        return array_map(fn ($name) => ['name' => $name, 'collectsCardData' => false], $this->names);
    }

    public function info(string $name): ?array
    {
        return in_array($name, $this->names, true) ? ['hosted' => $name === 'zarinpal' && (bool) $this->config['zarinpal_merchant'], 'network' => $name !== 'sandbox'] : null;
    }

    private function post(string $path, array $payload): array
    {
        $response = Http::timeout(15)->acceptJson()->asJson()->post($this->base.$path, $payload);
        $json = json_decode($response->body(), true, 512, JSON_THROW_ON_ERROR);
        if (! is_array($json)) {
            throw new \RuntimeException('Invalid gateway response');
        }

        return $json;
    }

    public function start(string $name, int $amountRial, string $callbackUrl): array
    {
        if ($name !== 'zarinpal' || ! ($this->info($name)['hosted'] ?? false)) {
            throw new \LogicException('Hosted gateway is unavailable');
        }
        $reply = $this->post('/pg/v4/payment/request.json', ['merchant_id' => $this->config['zarinpal_merchant'], 'amount' => $amountRial, 'callback_url' => $callbackUrl, 'description' => 'شارژ کیف پول سبزینه']);
        $authority = ($reply['data']['code'] ?? null) === 100 ? ($reply['data']['authority'] ?? null) : null;
        if (! is_string($authority) || ! preg_match('/^[A-Za-z0-9]{10,64}$/D', $authority)) {
            throw new \RuntimeException('Gateway request failed');
        }

        return ['authority' => $authority, 'redirectUrl' => $this->base.'/pg/StartPay/'.$authority];
    }

    public function verify(string $name, int $amountRial, string $authority): array
    {
        if ($name !== 'zarinpal' || ! ($this->info($name)['hosted'] ?? false)) {
            throw new \LogicException('Hosted gateway is unavailable');
        }
        $reply = $this->post('/pg/v4/payment/verify.json', ['merchant_id' => $this->config['zarinpal_merchant'], 'amount' => $amountRial, 'authority' => $authority]);
        $code = $reply['data']['code'] ?? $reply['errors']['code'] ?? -1;
        $code = is_int($code) || is_float($code) ? $code : -1;

        return ['ok' => in_array($code, [100, 101], true), 'alreadyVerified' => $code === 101, 'refId' => isset($reply['data']['ref_id']) ? (string) $reply['data']['ref_id'] : null, 'code' => $code];
    }
}
