<?php

use App\Modules\Admin\Presentation\AdminQueryController;
use App\Modules\Food\Presentation\FoodController;
use App\Modules\Health\Presentation\HealthController;
use App\Modules\Identity\Presentation\IdentityController;
use App\Modules\Money\Presentation\MoneyController;
use App\Modules\Onboarding\Presentation\OnboardingAdminController;
use App\Modules\Onboarding\Presentation\OnboardingController;
use App\Modules\Onboarding\Presentation\OnboardingWebController;
use App\Modules\Onboarding\Presentation\TransferController;

Route::get('v1/me/onboarding-transfers/zibal/return', [TransferController::class, 'callback']);
Route::prefix('v1/me/onboarding-transfers')->middleware('session:user')->controller(TransferController::class)->group(function (): void {
    Route::post('', 'create');
    Route::get('{id}', 'status');
    Route::post('{id}/zibal', 'start');
});
Route::get('v1/admin/onboarding-transfers', [TransferController::class, 'all'])->middleware('session:admin');
Route::post('v1/admin/onboarding-transfers/{id}/confirm', [TransferController::class, 'confirm'])->middleware('session:admin');
use App\Modules\Plans\Presentation\PlanQueryController;
use App\Modules\Plans\Presentation\PlanQuestionController;
use App\Modules\Publishing\Presentation\PublishingController;
use App\Modules\Questionnaire\Presentation\QuestionnaireController;

Route::get('v1/public/onboarding-questionnaire', [OnboardingWebController::class, 'questionnaires']);
Route::post('v1/public/onboarding/community-join', [OnboardingWebController::class, 'join']);
Route::put('v1/admin/onboarding-questionnaire/{goal}', [OnboardingWebController::class, 'configure'])->middleware('session:admin');
Route::post('v1/onboarding/submissions', [OnboardingWebController::class, 'save']);
Route::post('v1/onboarding/submissions/{id}/verify', [OnboardingWebController::class, 'verify'])->middleware('session:user');
Route::prefix('v1/admin/onboarding')->middleware('session:admin')->controller(OnboardingAdminController::class)->group(function (): void {
    Route::get('profiles', 'profiles');
    Route::get('profiles/{userId}', 'profile');
    Route::get('funnel', 'funnel');
    Route::post('funnel/refresh', 'refresh');
    Route::get('onboarding-leads', 'leads');
});

Route::get('v1/public/onboarding-spec', [OnboardingController::class, 'spec']);
Route::prefix('v1/me/onboarding')->middleware('session:user')->controller(OnboardingController::class)->group(function (): void {
    Route::get('', 'state');
    Route::put('draft', 'draft');
    Route::post('submit', 'submit');
    Route::post('consent', 'consent');
});

Route::post('v1/me/info-questions/{id}/answers', [PlanQuestionController::class, 'answer'])->middleware('session:user');
Route::middleware('session:specialist,admin')->controller(PlanQuestionController::class)->group(function (): void {
    Route::post('v1/specialist/requests/{id}/questions', 'ask');
    Route::post('v1/specialist/info-questions/{id}/acknowledge', 'acknowledge');
    Route::post('v1/specialist/info-questions/{id}/withdraw', 'withdraw');
});

Route::prefix('v1/me')->middleware('session:user')->controller(PlanQueryController::class)->group(function (): void {
    Route::get('request', 'latest');
    Route::get('requests', 'requests');
    Route::get('requests/{id}', 'timeline');
    Route::get('plan', 'published');
    Route::get('plan/week', 'week');
    Route::get('plan/day/{date}', 'day');
    Route::get('info-questions', 'questions');
});
Route::middleware('session:specialist,admin')->controller(PlanQueryController::class)->group(function (): void {
    Route::get('v1/specialist/requests', 'queue');
    Route::get('v1/specialist/queue', 'queue');
});

Route::get('v1/catalog', [MoneyController::class, 'catalog']);
Route::get('v1/payments/gateways', [MoneyController::class, 'gateways']);
Route::get('v1/payments/callback/{gateway}', [MoneyController::class, 'callback']);
Route::post('v1/payments/sandbox/complete', [MoneyController::class, 'sandbox']);
Route::post('v1/admin/orders/{id}/compensate', [MoneyController::class, 'compensate'])->middleware('session:admin');
Route::prefix('v1/me')->middleware('session:user')->controller(MoneyController::class)->group(function (): void {
    Route::get('wallet', 'wallet');
    Route::get('wallet/ledger', 'ledger');
    Route::get('orders/{id}', 'order');
    Route::get('topups/{id}', 'payment');
    Route::post('topups', 'topup');
    Route::post('orders', 'place');
    Route::post('orders/{id}/cancel', 'cancel');
    Route::post('requests/{id}/cancel', 'cancelRequest');
});

Route::get('v1/specialists', [AdminQueryController::class, 'publicSpecialists']);
Route::get('v1/specialist/profile', [AdminQueryController::class, 'ownProfile'])->middleware('session:specialist');
Route::prefix('v1/admin')->middleware('session:admin')->controller(AdminQueryController::class)->group(function (): void {
    Route::get('dashboard', 'dashboard');
    Route::get('orders', 'orders');
    Route::get('payments', 'payments');
    Route::get('audit-logs', 'auditLogs');
    Route::get('specialists', 'adminSpecialists');
});

Route::prefix('v1/public')->controller(PublishingController::class)->group(function (): void {
    Route::get('articles', 'articles');
    Route::get('articles/{slug}', 'article');
    Route::get('consents', 'documents');
    Route::get('app-download', 'config');
});
Route::prefix('v1/admin')->middleware('session:admin')->controller(PublishingController::class)->group(function (): void {
    Route::get('articles', 'adminArticles');
    Route::post('articles', 'create');
    Route::put('articles/{slug}', 'update');
    Route::post('articles/{slug}/publish', 'publish');
    Route::post('articles/{slug}/unpublish', 'unpublish');
    Route::post('consents', 'publishConsent');
    Route::put('public-config', 'saveConfig');
});
Route::prefix('v1/me/consents')->middleware('session')->controller(PublishingController::class)->group(function (): void {
    Route::get('', 'consents');
    Route::post('', 'recordConsent');
});
use Illuminate\Support\Facades\Route;

Route::get('v1/public/food-images/{file}', [FoodController::class, 'image']);
Route::prefix('v1/catalog')->middleware('session:specialist,admin')->controller(FoodController::class)->group(function (): void {
    Route::get('foods', 'catalog');
    Route::post('compose', 'compose');
});
Route::prefix('v1/admin/foods')->middleware('session:admin')->controller(FoodController::class)->group(function (): void {
    Route::get('', 'listing');
    Route::get('export.csv', 'exportCsv');
    Route::get('export', 'exportWrappedCsv');
    Route::get('export.json', 'export');
    Route::get('revision', 'revision');
    Route::post('import', 'import');
    Route::post('replace', 'replace');
    Route::get('backups/{id}', 'backup');
    Route::get('{slug}', 'get');
    Route::post('', 'create');
    Route::put('{slug}', 'update');
    Route::post('{slug}/active', 'activate');
});

Route::get('health/live', [HealthController::class, 'live']);
Route::get('health/ready', [HealthController::class, 'ready']);
Route::get('questionnaire-editor', [QuestionnaireController::class, 'editor']);
Route::get('v1/questionnaire/schema', [QuestionnaireController::class, 'schema']);
Route::middleware('session:user')->controller(QuestionnaireController::class)->group(function (): void {
    Route::get('v1/me/questionnaire', 'draft');
    Route::put('v1/me/questionnaire', 'saveDraft');
    Route::post('v1/me/questionnaire/submissions', 'submit');
    Route::get('v1/me/questionnaire/current', 'current');
    Route::get('v1/me/acquisition-state', 'acquisition');
});
Route::prefix('v1/admin/questionnaire')->middleware('session:admin')->controller(QuestionnaireController::class)->group(function (): void {
    Route::get('schemas', 'schemas');
    Route::post('compatibility', 'check');
    Route::post('schemas', 'saveSchema');
    Route::post('schemas/{version}/publish', 'publishSchema');
});

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
