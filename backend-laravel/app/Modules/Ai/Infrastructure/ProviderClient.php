<?php

namespace App\Modules\Ai\Infrastructure;

use App\Modules\Identity\Application\IdentitySettings;
use App\Shared\Domain\LegacyCrypto as Crypto;
use App\Shared\Domain\Problem;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

final class ProviderClient
{
    public function __construct(private IdentitySettings $settings) {}

    /** @return array{token: string, headers: array<string, string>, resolve: list<string>} */
    private function wire(array $provider): array
    {
        if (! config('ai.http')) {
            throw new Problem(503, 'ai_disabled', 'اتصال هوش مصنوعی فعال نشده است');
        }
        $url = parse_url($provider['base_url']);
        $host = $url['host'] ?? '';
        $privateAllowed = config('ai.allow_private') && $this->settings->environment !== 'production';
        if ($host === '' || isset($url['user']) || isset($url['pass']) || isset($url['query']) || isset($url['fragment']) ||
            (! $privateAllowed && ($url['scheme'] ?? '') !== 'https')) {
            throw new Problem(400, 'endpoint_invalid', 'نشانی سرویس معتبر نیست');
        }
        $resolve = [];
        if (! $privateAllowed) {
            $records = filter_var($host, FILTER_VALIDATE_IP) ? [] : (dns_get_record($host, DNS_A | DNS_AAAA) ?: []);
            $addresses = filter_var($host, FILTER_VALIDATE_IP) ? [$host] :
                array_map(fn ($record) => $record['ip'] ?? $record['ipv6'] ?? null, $records);
            $addresses = array_values(array_filter($addresses));
            if ($addresses === [] || array_any($addresses, fn ($ip) => ! filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE))) {
                throw new Problem(400, 'endpoint_invalid', 'نشانی عمومی سرویس معتبر نیست');
            }
            if (! extension_loaded('curl')) {
                throw new Problem(503, 'dependency_outage', 'افزونهٔ curl برای اتصال امن سرویس لازم است');
            }
            $port = $url['port'] ?? 443;
            $address = str_contains($addresses[0], ':') ? '['.$addresses[0].']' : $addresses[0];
            $resolve = [$host.':'.$port.':'.$address];
        }
        $key = $provider['api_key_encrypted'] ?? null;
        if (! is_string($key) || $key === '') {
            throw new Problem(503, 'ai_key_missing', 'کلید سرویس هوش مصنوعی تنظیم نشده است');
        }
        $headers = [];
        if (($provider['kind'] ?? '') === 'openrouter') {
            if (! empty($provider['http_referer'])) {
                $headers['HTTP-Referer'] = $provider['http_referer'];
            }
            if (! empty($provider['app_title'])) {
                $headers['X-Title'] = rawurlencode($provider['app_title']);
            }
        }

        return ['token' => Crypto::decrypt($key, $this->settings->fieldKey), 'headers' => $headers, 'resolve' => $resolve];
    }

    private function request(array $provider, int $timeout): PendingRequest
    {
        $wire = $this->wire($provider);
        $options = ['allow_redirects' => false, 'proxy' => ''];
        if ($wire['resolve'] !== []) {
            $options['curl'] = [CURLOPT_RESOLVE => $wire['resolve']];
        }

        return Http::withToken($wire['token'])->withHeaders($wire['headers'])
            ->acceptJson()->asJson()->connectTimeout(5)->timeout(max(1, min(300, $timeout / 1000)))->withOptions($options);
    }

    public function complete(array $provider, string $model, array $messages, int $tokens = 1500, int $timeout = 30000, float $temperature = 0.2, bool $json = false, ?callable $onDelta = null): array
    {
        $body = ['model' => $model, 'messages' => $messages, 'max_tokens' => $tokens, 'temperature' => $temperature];
        if ($json) {
            $body['response_format'] = ['type' => 'json_object'];
        }
        if (($provider['kind'] ?? '') === 'openrouter') {
            $body['provider'] = ['data_collection' => 'deny'];
            $body['usage'] = ['include' => true];
        }
        $response = $this->request($provider, $timeout)->post(rtrim($provider['base_url'], '/').'/chat/completions', $body);
        $this->guardStatus($response);
        if (strlen($response->body()) > 2_000_000) {
            throw new Problem(502, 'outcome_unknown', 'پاسخ سرویس بیش از حد بزرگ است');
        }
        return $this->completion($response->json(), $model);
    }

    private function guardStatus(Response $response): void
    {
        if ($response->successful()) {
            return;
        }
        $code = match ($response->status()) {
            401, 402, 403 => 'auth_failed', 429 => 'rate_limited', 408, 504 => 'outcome_unknown', default => 'provider_rejected',
        };
        throw new Problem(502, $code, 'سرویس هوش مصنوعی پاسخ معتبر نداد');
    }

    private function completion(mixed $value, string $model): array
    {
        if (! is_array($value)) {
            throw new Problem(502, 'outcome_unknown', 'پاسخ سرویس قابل پردازش نیست');
        }
        $text = $this->messageText($value['choices'][0]['message']['content'] ?? null);
        if ($text === null || trim($text) === '' || isset($value['error'])) {
            throw new Problem(502, 'outcome_unknown', 'پاسخ سرویس قابل پردازش نیست');
        }
        $usage = $value['usage'] ?? [];
        $input = $this->count($usage['prompt_tokens'] ?? null);
        $output = $this->count($usage['completion_tokens'] ?? null);
        $cost = $usage['cost'] ?? null;

        return ['text' => $text, 'tokensIn' => $input, 'tokensOut' => $output,
            'costMicros' => is_numeric($cost) && is_finite((float) $cost) && $cost >= 0 ? (int) ceil(round($cost * 1_000_000, 6)) : null,
            'costSource' => is_numeric($cost) && $cost >= 0 ? 'provider' : 'estimate',
            'usageKnown' => $input !== null && $output !== null, 'model' => $model];
    }

    private function messageText(mixed $content): ?string
    {
        if (is_string($content)) {
            return $content;
        }
        if (! is_array($content)) {
            return null;
        }
        $parts = [];
        foreach ($content as $part) {
            if (is_string($part)) {
                $parts[] = $part;
            } elseif (is_array($part) && is_string($part['text'] ?? null)) {
                $parts[] = $part['text'];
            }
        }

        return $parts === [] ? null : implode('', $parts);
    }

    private function count(mixed $value): ?int
    {
        return is_numeric($value) && is_finite((float) $value) && $value >= 0 && $value <= 2147483647 ? (int) $value : null;
    }

    public function models(array $provider): array
    {
        $id = $provider['id'] ?? null;
        if (is_string($id) && $id !== '') {
            return Cache::remember('ai_catalog:'.$id, 600, fn () => $this->fetchModels($provider));
        }

        return $this->fetchModels($provider);
    }

    private function fetchModels(array $provider): array
    {
        $catalog = ($provider['kind'] ?? '') === 'closerouter' ? '/providers' : '/models';
        $response = $this->request($provider, 90000)->get(rtrim($provider['base_url'], '/').$catalog);
        if (! $response->successful() || strlen($response->body()) > 4_000_000) {
            throw new Problem(502, 'provider_rejected', 'فهرست مدل‌ها در دسترس نیست');
        }
        $raw = $response->body();
        $decoded = json_decode($raw, true);
        $rows = is_array($decoded) ? ($decoded['data'] ?? null) : null;
        if (! is_array($rows)) {
            throw new Problem(502, 'provider_rejected', 'فهرست مدل‌ها در دسترس نیست');
        }

        return array_map(fn ($model) => $this->modelView($model), array_values(array_filter($rows, fn ($model) => is_string($model['id'] ?? null))));
    }

    private function modelView(array $model): array
    {
        $pricing = $this->pricing($model);

        return ['id' => $model['id'], 'name' => is_string($model['name'] ?? null) ? $model['name'] : $model['id'],
            'contextLength' => $pricing['context_length'] ?? $model['context_length'] ?? null,
            'priceInMicrosPerM' => $this->micros($pricing, 'prompt', 'input'),
            'priceOutMicrosPerM' => $this->micros($pricing, 'completion', 'output'),
            'free' => $this->micros($pricing, 'prompt', 'input') === 0 && $this->micros($pricing, 'completion', 'output') === 0];
    }

    private function pricing(array $model): array
    {
        if (is_array($model['pricing'] ?? null)) {
            return $model['pricing'];
        }
        $options = is_array($model['providers'] ?? null) ? $model['providers'] : [];
        $selected = $model['selected_provider'] ?? 'auto';
        foreach ($options as $option) {
            if (is_array($option) && ($option['name'] ?? null) === $selected && is_array($option['pricing'] ?? null)) {
                return $option['pricing'] + ['context_length' => $option['context_length'] ?? null];
            }
        }
        $first = is_array($options[0] ?? null) ? $options[0] : [];

        return is_array($first['pricing'] ?? null) ? $first['pricing'] + ['context_length' => $first['context_length'] ?? null] : [];
    }

    private function micros(array $pricing, string $perToken, string $perMillion): int
    {
        $raw = $pricing[$perToken] ?? $pricing[$perMillion] ?? 0;
        if (! is_numeric($raw)) {
            return 0;
        }
        $unit = $pricing['unit'] ?? '';
        $perMillionUnit = in_array($unit, ['usd_per_million_tokens', 'usd_per_image', 'usd_per_second', 'usd_per_request'], true);

        return (int) ceil(((float) $raw) * ($perMillionUnit ? 1_000_000 : 1_000_000_000_000));
    }
}
