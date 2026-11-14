<?php

namespace Tests\Feature;

use App\Shared\Presentation\StrictInput;
use Tests\TestCase;

final class HttpFoundationTest extends TestCase
{
    public function test_health_and_unknown_route_use_the_existing_http_contract(): void
    {
        $this->getJson('/health/live')->assertOk()->assertExactJson(['status' => 'ok']);
        $this->getJson('/unknown')->assertNotFound()->assertExactJson([
            'status' => 404, 'code' => 'not_found', 'messageFa' => 'یافت نشد', 'retryable' => false,
        ]);
    }

    public function test_strict_validation_and_missing_auth_do_not_use_laravel_default_errors(): void
    {
        $this->postJson('/v1/auth/otp/request', ['phone' => '09120000001', 'extra' => true])
            ->assertStatus(400)->assertJsonPath('code', 'validation')->assertJsonPath('messageFa', 'فیلد اضافی پذیرفته نیست');
        $this->postJson('/v1/auth/otp/request', ['phone' => '123'])->assertStatus(400)->assertJsonPath('code', 'invalid_phone');
        $this->postJson('/v1/auth/otp/request', [])->assertStatus(400)->assertJsonPath('code', 'validation');
        $this->getJson('/v1/me')->assertUnauthorized()->assertJsonPath('code', 'unauthorized');
        $this->postJson('/v1/auth/refresh', ['refreshToken' => ''])->assertUnauthorized();
        $this->postJson('/v1/auth/specialist/login', ['username' => 'test', 'password' => 2])->assertUnauthorized();
    }

    public function test_iranian_numbers_and_utf16_string_limits_are_preserved(): void
    {
        self::assertSame('+989120000001', StrictInput::phone('۰۹۱۲ ۰۰۰ ۰۰۰۱'));
        self::assertSame('+989120000001', StrictInput::phone('0098(912)-000-0001'));
        self::assertSame(2, StrictInput::length('🙂'));
        self::assertSame('آزمایش', StrictInput::string(['name' => '  آزمایش  '], 'name', 6));
    }

    public function test_replacement_gate_fails_while_routes_are_missing(): void
    {
        $this->artisan('migration:status', ['--require-ready' => true])->assertFailed();
    }

    public function test_json_parser_enforces_the_original_object_array_and_three_megabyte_envelope(): void
    {
        foreach (['null', 'true', '123', '"text"', '{"broken":'] as $raw) {
            $this->call('POST', '/v1/auth/otp/request', [], [], [], ['CONTENT_TYPE' => 'application/json'], $raw)->assertStatus(400)->assertJsonPath('code', 'validation');
        }
        $this->call('POST', '/v1/auth/otp/request', [], [], [], ['CONTENT_TYPE' => 'application/json'], json_encode(['large' => str_repeat('a', 3 * 1024 * 1024)]))->assertStatus(413)->assertJsonPath('code', 'internal');
    }
}
