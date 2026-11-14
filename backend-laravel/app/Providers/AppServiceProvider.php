<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use App\Modules\Identity\Application\IdentitySettings;
use App\Modules\Identity\Application\IdentityStore;
use App\Modules\Identity\Application\OtpSender;
use App\Modules\Identity\Infrastructure\ConfiguredOtpSender;
use App\Modules\Identity\Infrastructure\PostgresIdentityStore;
use Illuminate\Database\ConnectionInterface;
use LogicException;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->bind(ConnectionInterface::class, fn ($app) => $app['db']->connection());
        $this->app->bind(IdentityStore::class, PostgresIdentityStore::class);
        $this->app->singleton(IdentitySettings::class, function ($app): IdentitySettings {
            $config = $app['config']['identity'];
            return new IdentitySettings($config['environment'], $config['jwt_secret'], $config['otp_pepper'], $config['field_key'], $config['fixed_otp']);
        });
        $this->app->singleton(OtpSender::class, fn ($app) => new ConfiguredOtpSender($app['config']['identity'], $app['cache']->store()));
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $config = config('identity');
        if (!in_array($config['environment'], ['development', 'test', 'staging', 'production'], true)) {
            throw new LogicException('Unsupported NODE_ENV');
        }
        if ($config['fixed_otp'] !== null && !preg_match('/^[0-9]{6}$/D', $config['fixed_otp'])) {
            throw new LogicException('OTP_FIXED_CODE must contain six digits');
        }
        if ($config['environment'] === 'production') {
            foreach (['jwt_secret', 'otp_pepper', 'field_key'] as $key) {
                if (strlen($config[$key]) < 32 || str_starts_with($config[$key], 'dev-only-')) {
                    throw new LogicException('Production identity secrets must be configured');
                }
            }
            if ($config['sms_provider'] !== 'melipayamak' || !$config['sms_username'] || !$config['sms_key'] || (!$config['sms_from'] && !$config['sms_pattern'])) {
                throw new LogicException('Production SMS adapter must be configured');
            }
        }
    }
}
