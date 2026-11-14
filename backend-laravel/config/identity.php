<?php

return [
    'environment' => env('NODE_ENV', match (env('APP_ENV', 'local')) {
        'production', 'staging' => env('APP_ENV'), 'testing' => 'test', default => 'development',
    }),
    'jwt_secret' => env('JWT_SECRET', 'dev-only-jwt-secret-not-for-production'),
    'otp_pepper' => env('OTP_PEPPER', 'dev-only-otp-pepper-not-for-production'),
    'field_key' => env('FIELD_KEY', 'dev-only-field-key-not-for-production'),
    'fixed_otp' => env('OTP_FIXED_CODE'),
    'sms_provider' => env('SMS_PROVIDER', 'console'),
    'sms_username' => env('MELIPAYAMAK_USERNAME'),
    'sms_key' => env('MELIPAYAMAK_API_KEY'),
    'sms_from' => env('MELIPAYAMAK_FROM'),
    'sms_pattern' => env('MELIPAYAMAK_PATTERN_ID'),
];
