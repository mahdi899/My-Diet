<?php

namespace App\Modules\Onboarding\Infrastructure;

use App\Modules\Onboarding\Application\PurchaseConfirmation;
use Illuminate\Support\Facades\Http;

final class PurchaseConfirmationSms implements PurchaseConfirmation
{
    public function send(string $phone): void
    {
        $settings = config('identity');
        if (! $settings['sms_username'] || ! $settings['sms_key'] || ! $settings['sms_from']) {
            throw new \RuntimeException('SMS sender missing');
        }
        $response = Http::asForm()->timeout(12)->withoutRedirecting()->post('https://rest.payamak-panel.com/api/SendSMS/SendSMS', [
            'username' => $settings['sms_username'], 'password' => $settings['sms_key'], 'to' => $phone, 'from' => $settings['sms_from'],
            'text' => 'خرید شما با موفقیت انجام شد. کارشناسان رژیم من با شما تماس خواهند گرفت.', 'isFlash' => 'false']);
        if (! $response->successful() || (int) $response->json('RetStatus') !== 1 || ! preg_match('/^[0-9]{10,}$/D', (string) $response->json('Value'))) {
            throw new \RuntimeException('SMS dispatch unavailable');
        }
    }
}
