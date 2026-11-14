<?php

return [
    'default' => env('PAYMENT_GATEWAY', 'sandbox'),
    'enabled' => env('PAYMENT_GATEWAYS', ''),
    'public_api_url' => env('PUBLIC_API_URL'),
    'zarinpal_merchant' => env('ZARINPAL_MERCHANT_ID'),
    'zarinpal_sandbox' => env('ZARINPAL_SANDBOX', false),
    'zarinpal_base_url' => env('ZARINPAL_BASE_URL'),
];
