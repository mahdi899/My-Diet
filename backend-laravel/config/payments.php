<?php

return [
    'default' => env('PAYMENT_GATEWAY', 'sandbox'),
    'enabled' => env('PAYMENT_GATEWAYS', ''),
    'public_api_url' => env('PUBLIC_API_URL'),
    'zarinpal_merchant' => env('ZARINPAL_MERCHANT_ID'),
    'zibal_merchant' => env('ZIBAL_MERCHANT'),
    'zarinpal_sandbox' => env('ZARINPAL_SANDBOX', false),
    'zarinpal_base_url' => env('ZARINPAL_BASE_URL'),
    'preview_enabled' => filter_var(env('PREVIEW_PAYMENTS', false), FILTER_VALIDATE_BOOL),
    // Filled when the store payment API is available. A token alone does not mark a checkout paid.
    'bazaar_access_token' => env('BAZAAR_ACCESS_TOKEN'),
    'myket_access_token' => env('MYKET_ACCESS_TOKEN'),
    'store_skus' => [
        'bazaar' => [
            'weekly' => env('BAZAAR_SKU_WEEKLY'),
            'monthly' => env('BAZAAR_SKU_MONTHLY'),
            'quarterly' => env('BAZAAR_SKU_QUARTERLY'),
            'new_plan' => env('BAZAAR_SKU_NEW_PLAN'),
            'ai_revision' => env('BAZAAR_SKU_AI_REVISION'),
            'specialist_revision' => env('BAZAAR_SKU_SPECIALIST_REVISION'),
        ],
        'myket' => [
            'weekly' => env('MYKET_SKU_WEEKLY'),
            'monthly' => env('MYKET_SKU_MONTHLY'),
            'quarterly' => env('MYKET_SKU_QUARTERLY'),
            'new_plan' => env('MYKET_SKU_NEW_PLAN'),
            'ai_revision' => env('MYKET_SKU_AI_REVISION'),
            'specialist_revision' => env('MYKET_SKU_SPECIALIST_REVISION'),
        ],
    ],
];
