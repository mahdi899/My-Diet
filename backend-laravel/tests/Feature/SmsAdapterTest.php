<?php

namespace Tests\Feature;

use App\Modules\Identity\Infrastructure\ConfiguredOtpSender;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

final class SmsAdapterTest extends TestCase
{
    private function sender(array $overrides = []): ConfiguredOtpSender
    {
        return new ConfiguredOtpSender(array_replace([
            'environment' => 'test', 'sms_provider' => 'melipayamak', 'sms_username' => 'synthetic-user',
            'sms_key' => 'synthetic-key', 'sms_from' => '50001234', 'sms_pattern' => null,
        ], $overrides), app('cache')->store('array'));
    }

    public function test_pattern_sms_matches_the_existing_provider_form_contract(): void
    {
        Http::preventStrayRequests();
        Http::fake(['*' => Http::response(['RetStatus' => 1, 'Value' => '1234567890123'])]);
        $this->sender(['sms_pattern' => '42'])->send('+989120000001', '123456');
        Http::assertSent(fn (Request $request) => $request->url() === 'https://rest.payamak-panel.com/api/SendSMS/BaseServiceNumber'
            && $request['username'] === 'synthetic-user' && $request['password'] === 'synthetic-key'
            && $request['to'] === '+989120000001' && $request['bodyId'] === '42' && $request['text'] === '123456'
            && $request->hasHeader('Content-Type', 'application/x-www-form-urlencoded'));
    }

    public function test_plain_sms_uses_the_existing_persian_text_and_rejects_provider_failure(): void
    {
        Http::preventStrayRequests();
        Http::fake(['*' => Http::response(['RetStatus' => 0, 'Value' => '-1'])]);
        try {
            $this->sender()->send('+989120000001', '123456');
            self::fail('Rejected SMS should fail');
        } catch (\RuntimeException $error) {
            self::assertSame('SMS dispatch unavailable', $error->getMessage());
        }
        Http::assertSent(fn (Request $request) => $request->url() === 'https://rest.payamak-panel.com/api/SendSMS/SendSMS'
            && $request['from'] === '50001234' && $request['isFlash'] === 'false'
            && $request['text'] === "کد تأیید رژیم من: 123456\nاعتبار: ۲ دقیقه");
    }

    public function test_console_codes_remain_in_development_cache_and_are_unavailable_in_production(): void
    {
        $development = $this->sender(['sms_provider' => 'console', 'environment' => 'development']);
        $development->send('+989120000001', '123456');
        self::assertSame('123456', $development->latest('+989120000001'));
        $production = $this->sender(['sms_provider' => 'console', 'environment' => 'production']);
        self::assertNull($production->latest('+989120000001'));
        $this->expectException(\RuntimeException::class);
        $production->send('+989120000001', '123456');
    }
}
