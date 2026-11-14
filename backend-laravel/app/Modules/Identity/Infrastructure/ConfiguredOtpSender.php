<?php

namespace App\Modules\Identity\Infrastructure;

use App\Modules\Identity\Application\OtpSender;
use Illuminate\Contracts\Cache\Repository;
use Illuminate\Support\Facades\Http;
use RuntimeException;

final class ConfiguredOtpSender implements OtpSender
{
    public function __construct(private array $settings, private Repository $cache) {}

    public function send(string $phone, string $code): void
    {
        if ($this->settings['sms_provider'] === 'console') {
            if (! in_array($this->settings['environment'], ['development', 'test'], true)) {
                throw new RuntimeException('Development SMS is disabled');
            }
            $this->cache->put('dev-otp:'.hash('sha256', $phone), $code, 120);

            return;
        }
        if ($this->settings['sms_provider'] !== 'melipayamak') {
            throw new RuntimeException('SMS adapter unavailable');
        }
        $pattern = $this->settings['sms_pattern'];
        $body = ['username' => $this->settings['sms_username'], 'password' => $this->settings['sms_key'], 'to' => $phone];
        $body += $pattern ? ['bodyId' => $pattern, 'text' => $code] :
            ['from' => $this->settings['sms_from'], 'text' => "کد تأیید رژیم من: $code\nاعتبار: ۲ دقیقه", 'isFlash' => 'false'];
        $response = Http::asForm()->timeout(12)->withoutRedirecting()->post(
            'https://rest.payamak-panel.com/api/SendSMS/'.($pattern ? 'BaseServiceNumber' : 'SendSMS'), $body);
        if (! $response->successful() || (int) $response->json('RetStatus') !== 1 || ! preg_match('/^[0-9]{10,}$/D', (string) $response->json('Value'))) {
            throw new RuntimeException('SMS dispatch unavailable');
        }
    }

    public function latest(string $phone): ?string
    {
        if (! in_array($this->settings['environment'], ['development', 'test'], true)) {
            return null;
        }

        return $this->cache->get('dev-otp:'.hash('sha256', $phone));
    }
}
