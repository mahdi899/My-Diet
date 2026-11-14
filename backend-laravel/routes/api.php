<?php

use App\Modules\Health\Presentation\HealthController;
use App\Modules\Identity\Presentation\IdentityController;
use Illuminate\Support\Facades\Route;

Route::get('health/live', [HealthController::class, 'live']);
Route::get('health/ready', [HealthController::class, 'ready']);

Route::prefix('v1/auth')->controller(IdentityController::class)->group(function (): void {
    Route::post('admin/login', 'adminLogin');
    Route::post('specialist/login', 'specialistLogin');
    Route::post('otp/request', 'requestOtp');
    Route::post('otp/verify', 'verifyOtp');
    Route::post('totp', 'totp');
    Route::post('refresh', 'refresh');
    Route::get('otp/latest', 'latest');
    Route::middleware('session')->group(function (): void {
        Route::post('logout', 'logout');
        Route::get('sessions', 'sessions');
        Route::delete('sessions/{id}', 'revoke');
    });
});

Route::prefix('v1/me')->controller(IdentityController::class)->group(function (): void {
    Route::middleware('session:user,specialist,admin')->group(function (): void {
        Route::get('', 'profile');
        Route::patch('', 'rename');
    });
    Route::middleware('session:user')->group(function (): void {
        Route::get('personal-details', 'personalDetails');
        Route::patch('personal-details', 'savePersonalDetails');
    });
    Route::middleware('session:specialist,admin')->group(function (): void {
        Route::get('totp', 'totpStatus');
        Route::post('totp/setup', 'setupTotp');
        Route::post('totp/confirm', 'confirmTotp');
    });
});
