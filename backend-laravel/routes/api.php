<?php

use App\Modules\Admin\Presentation\AdminDeskController;
use App\Modules\Admin\Presentation\AdminQueryController;
use App\Modules\Admin\Presentation\AnalyticsController;
use App\Modules\Admin\Presentation\CampaignController;
use App\Modules\Admin\Presentation\IntegrationsController;
use App\Modules\Ai\Presentation\AiAdminController;
use App\Modules\Coach\Presentation\CoachController;
use App\Modules\Food\Presentation\FoodController;
use App\Modules\Food\Presentation\IngredientController;
use App\Modules\Health\Presentation\HealthController;
use App\Modules\Identity\Presentation\IdentityController;
use App\Modules\Metrics\Presentation\MetricsController;
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
use App\Modules\Feedback\Presentation\FeedbackController;
use App\Modules\Messaging\Presentation\MessagingController;
use App\Modules\Plans\Presentation\PlanChangeController;
use App\Modules\Plans\Presentation\PlanEditorController;
use App\Modules\Plans\Presentation\PlanQueryController;
use App\Modules\Plans\Presentation\PlanQuestionController;
use App\Modules\Privacy\Presentation\PrivacyController;
use App\Modules\Realtime\Presentation\RealtimeController;
use App\Modules\Reports\Presentation\ReportsController;
use App\Modules\Rewards\Presentation\StreakController;
use App\Modules\Shopping\Presentation\ShoppingController;
use App\Modules\Tracking\Presentation\TrackingController;

Route::middleware('session:specialist,admin')->controller(PlanEditorController::class)->group(function (): void {
    Route::get('v1/specialist/requests/{id}', 'staff');
    Route::put('v1/specialist/requests/{id}/draft', 'replace');
});
Route::middleware('session:specialist')->controller(PlanEditorController::class)->group(function (): void {
    Route::post('v1/specialist/requests/{id}/publish', 'publish');
    Route::post('v1/specialist/requests/{id}/regenerate', 'regenerate');
    Route::post('v1/specialist/requests/{id}/corrections', 'correct');
    Route::get('v1/specialist/patients/{userId}/plan-versions', 'patientVersions');
});
Route::get('v1/admin/plan-versions/{id}', [PlanEditorController::class, 'adminVersion'])->middleware('session:admin');
Route::get('v1/public/reviews', [TrackingController::class, 'publicReviews']);
Route::middleware('session:user,specialist,admin')->controller(MessagingController::class)->group(function (): void {
    Route::get('v1/conversations', 'list');
    Route::get('v1/conversations/{id}/messages', 'messages');
    Route::get('v1/conversations/{id}/timeline', 'timeline');
    Route::post('v1/conversations/{id}/messages', 'post');
    Route::post('v1/conversations/{id}/read', 'read');
    Route::post('v1/conversations/{id}/receipts', 'receipt');
    Route::post('v1/conversations/{id}/media', 'beginMedia');
    Route::put('v1/media/{id}', 'finish');
    Route::post('v1/media/{id}/access', 'grant');
    Route::post('v1/media/{id}/content', 'content');
    Route::get('v1/me/notifications', 'notifications');
    Route::post('v1/me/notifications/{id}/read', 'readNotification');
});
Route::middleware('session:user')->controller(MessagingController::class)->group(function (): void {
    Route::post('v1/me/support-conversation', 'support');
    Route::post('v1/me/care-conversation', 'care');
    Route::get('v1/me/sync', 'sync');
});
Route::middleware('session:user,specialist,admin')->controller(RealtimeController::class)->group(function (): void {
    Route::post('v1/me/devices', 'register');
    Route::delete('v1/me/devices/{id}', 'remove');
    Route::get('v1/events', 'events');
});
Route::middleware('session:user')->controller(FeedbackController::class)->group(function (): void {
    Route::put('v1/me/weekly-feedback', 'save');
    Route::get('v1/me/weekly-feedback', 'read');
    Route::post('v1/me/weekly-feedback/publish', 'publish');
    Route::get('v1/me/preferences', 'preferences');
    Route::put('v1/me/preferences', 'confirm');
    Route::post('v1/me/patient-reports', 'report');
    Route::get('v1/me/patient-reports', 'latest');
});
Route::get('v1/specialist/patients/{userId}/patient-reports', [FeedbackController::class, 'specialist'])->middleware('session:specialist');
Route::get('v1/admin/feedback-metrics', [FeedbackController::class, 'metrics'])->middleware('session:admin');
Route::middleware('session:admin')->controller(ReportsController::class)->group(function (): void {
    Route::get('v1/admin/reports/sla', 'admin');
    Route::get('v1/admin/reports/retention', 'retention');
    Route::get('v1/admin/reports/foods', 'foods');
    Route::get('v1/admin/reports/feedback', 'feedback');
    Route::get('v1/admin/reports/specialists', 'specialists');
    Route::get('v1/admin/reports/journeys', 'journeys');
});
Route::get('v1/specialist/sla', [ReportsController::class, 'mine'])->middleware('session:specialist');
Route::post('v1/journey/events', [ReportsController::class, 'journey']);
Route::middleware('session:user,specialist,admin')->controller(PrivacyController::class)->group(function (): void {
    Route::get('v1/me/export', 'export');
    Route::post('v1/me/account/delete', 'delete');
});
Route::prefix('v1/me')->middleware('session:user')->controller(PlanChangeController::class)->group(function (): void {
    Route::get('plan-change-reasons', 'reasons');
    Route::post('plan-changes', 'submit');
    Route::get('plan-changes', 'mine');
    Route::get('plan-changes/{id}', 'one');
    Route::post('plan-changes/{id}/replies', 'reply');
});
Route::prefix('v1/specialist')->middleware('session:specialist')->controller(PlanChangeController::class)->group(function (): void {
    Route::get('plan-changes', 'queue');
    Route::get('plan-changes/{id}', 'staff');
    Route::post('plan-changes/{id}/review', 'review');
    Route::post('plan-changes/{id}/reject', 'reject');
    Route::post('plan-changes/{id}/clarifications', 'clarify');
    Route::post('plan-changes/{id}/approve', 'approve');
});
Route::prefix('v1/admin')->middleware('session:admin')->controller(PlanChangeController::class)->group(function (): void {
    Route::get('plan-change-reasons', 'allReasons');
    Route::put('plan-change-reasons/{id}', 'updateReason');
});
Route::prefix('v1/me')->middleware('session:user')->controller(TrackingController::class)->group(function (): void {
    Route::get('dashboard', 'dashboard');
    Route::get('substitution-reasons', 'reasons');
    Route::get('meal-activity/{date}/history', 'history');
    Route::get('meal-activity/{date}', 'activity');
    Route::post('meal-consumption', 'record');
    Route::post('meal-selections', 'select');
    Route::post('meal-logs', 'meal');
    Route::get('weights', 'weights');
    Route::post('weights', 'weight');
    Route::get('specialist', 'specialist');
    Route::get('rewards/pending', 'pending');
    Route::post('rewards/{id}/acknowledge', 'acknowledge');
    Route::post('reviews', 'review');
});
Route::prefix('v1/me')->middleware('session:user')->controller(StreakController::class)->group(function (): void {
    Route::get('streak', 'snapshot');
    Route::post('streak/claim', 'claim');
});
Route::prefix('v1/admin/streak-campaigns')->middleware('session:admin')->controller(StreakController::class)->group(function (): void {
    Route::get('', 'list');
    Route::post('', 'publish');
});
Route::prefix('v1/me/shopping-list')->middleware('session:user')->controller(ShoppingController::class)->group(function (): void {
    Route::get('share', 'share');
    Route::get('', 'list');
    Route::patch('items/{key}', 'flag');
});
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
Route::get('v1/payments/checkout/callback/{gateway}', [MoneyController::class, 'checkoutCallback']);
Route::post('v1/payments/sandbox/complete', [MoneyController::class, 'sandbox']);
Route::post('v1/admin/orders/{id}/compensate', [MoneyController::class, 'compensate'])->middleware('session:admin');
Route::prefix('v1/me')->middleware('session:user')->controller(MoneyController::class)->group(function (): void {
    Route::get('subscription', 'subscription');
    Route::get('orders', 'orders');
    Route::post('checkouts', 'startCheckout');
    Route::get('checkouts/{id}', 'checkout');
    Route::post('checkouts/{id}/sandbox', 'checkoutSandbox');
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
Route::get('v1/admin/ingredients', [IngredientController::class, 'listing'])->middleware('session:admin');
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

Route::get('metrics', [MetricsController::class, 'metrics']);
Route::get('health/worker', [MetricsController::class, 'worker']);
Route::match(['HEAD'], 'go/{slug}', [CampaignController::class, 'head']);
Route::match(['GET'], 'go/{slug}', [CampaignController::class, 'open']);
Route::get('v1/public/config', [AdminDeskController::class, 'config']);
Route::get('v1/public/daily-message', [AdminDeskController::class, 'daily']);
Route::put('v1/specialist/profile', [AdminDeskController::class, 'saveProfile'])->middleware('session:specialist');
Route::middleware('session:user')->controller(CoachController::class)->group(function (): void {
    Route::get('v1/me/coach/thread', 'thread');
    Route::post('v1/me/coach/messages', 'messages');
    Route::post('v1/me/coach/food-photos', 'photo');
    Route::patch('v1/me/coach/meals/{id}', 'patch');
    Route::get('v1/me/coach/today', 'today');
    Route::post('v1/me/coach/day-brief', 'dayBrief');
    Route::post('v1/me/coach/actions', 'action');
    Route::get('v1/me/coach/media/{id}', 'media');
});
Route::prefix('v1/admin')->middleware('session:admin')->group(function (): void {
    Route::controller(AdminDeskController::class)->group(function (): void {
        Route::post('specialists', 'createSpecialist');
        Route::patch('specialists/{id}', 'updateSpecialist');
        Route::get('specialists/{id}/members', 'members');
        Route::post('specialists/{id}/members', 'addMember');
        Route::delete('specialists/{id}/members/{userId}', 'removeMember');
        Route::post('specialists/{id}/verification', 'verification');
        Route::post('requests/{id}/assignment', 'assign');
        Route::get('requests', 'requests');
        Route::put('prices', 'price');
        Route::put('reward', 'reward');
        Route::get('reviews', 'reviews');
        Route::post('reviews/{id}', 'moderate');
        Route::get('ledger', 'ledger');
        Route::get('users', 'users');
        Route::get('users/{id}', 'user');
        Route::post('users/{id}/status', 'status');
        Route::post('users/{id}/delete', 'deleteUser');
        Route::put('users/{id}/package', 'package');
        Route::get('support-conversations', 'support');
        Route::put('daily-messages', 'saveDaily');
        Route::post('maintenance', 'maintenance');
        Route::get('ai-generations', 'generations');
        Route::get('ai-executions', 'executions');
        Route::post('ai-executions/{id}/reconcile', 'reconcile');
        Route::get('ai-controls', 'controls');
        Route::put('ai-controls', 'setControls');
        Route::get('ai-cost', 'cost');
        Route::post('wallet-adjustments', 'adjust');
        Route::get('outbox/dead', 'dead');
        Route::post('outbox/{id}/retry', 'retry');
    });
    Route::controller(IntegrationsController::class)->group(function (): void {
        Route::get('ai-connections', 'connections');
        Route::post('ai-connections', 'add');
        Route::put('ai-connections/{id}/active', 'activate');
        Route::delete('ai-connections/{id}', 'remove');
        Route::put('push/firebase', 'firebase');
        Route::get('push/status', 'status');
        Route::get('push/devices', 'devices');
        Route::get('push/campaigns', 'campaigns');
        Route::post('push/campaigns', 'create');
        Route::post('push/campaigns/{id}/send', 'send');
        Route::delete('push/campaigns/{id}', 'delete');
    });
    Route::controller(AiAdminController::class)->prefix('ai')->group(function (): void {
        Route::get('providers', 'providers');
        Route::post('providers', 'createProvider');
        Route::put('providers/{id}', 'updateProvider');
        Route::delete('providers/{id}', 'deleteProvider');
        Route::post('providers/{id}/test', 'testProvider');
        Route::get('providers/{id}/models', 'models');
        Route::get('pools', 'pools');
        Route::put('pools/{code}', 'updatePool');
        Route::put('pools/{code}/members', 'members');
        Route::post('pools/{code}/test', 'testPool');
        Route::post('members/{id}/reset-health', 'resetHealth');
        Route::get('usage', 'usage');
        Route::get('ledger', 'ledger');
        Route::get('budget', 'budget');
        Route::put('budget', 'setBudget');
        Route::get('generations', 'generations');
        Route::get('prompts', 'prompts');
        Route::post('prompts/{key}', 'createPrompt');
        Route::post('prompts/{key}/{version}/activate', 'activatePrompt');
    });
    Route::controller(CampaignController::class)->prefix('campaign-links')->group(function (): void {
        Route::get('', 'list');
        Route::post('', 'create');
        Route::patch('{id}', 'toggle');
        Route::delete('{id}', 'delete');
    });
    Route::controller(AnalyticsController::class)->prefix('web-analytics')->group(function (): void {
        Route::get('', 'report');
        Route::get('live', 'live');
        Route::get('departures', 'departures');
        Route::post('reset', 'reset');
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
