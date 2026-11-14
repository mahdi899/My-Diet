<?php

namespace App\Providers;

use App\Modules\Admin\Application\AdminQueries;
use App\Modules\Admin\Infrastructure\MySqlAdminQueries;
use App\Modules\Ai\Application\AiCatalog;
use App\Modules\Ai\Infrastructure\FixedAiCatalog;
use App\Modules\Coach\Application\CoachGateway;
use App\Modules\Coach\Application\CoachModel;
use App\Modules\Coach\Infrastructure\FixedCoachModel;
use App\Modules\Coach\Infrastructure\MySqlCoach;
use App\Modules\Food\Application\FoodStore;
use App\Modules\Food\Domain\FoodRules;
use App\Modules\Food\Infrastructure\MySqlFoods;
use App\Modules\Identity\Application\IdentitySettings;
use App\Modules\Identity\Application\IdentityStore;
use App\Modules\Identity\Application\OtpSender;
use App\Modules\Identity\Infrastructure\ConfiguredOtpSender;
use App\Modules\Identity\Infrastructure\MySqlIdentityStore;
use App\Modules\Messaging\Application\MessagingStore;
use App\Modules\Messaging\Infrastructure\MySqlMessaging;
use App\Modules\Money\Application\MoneySettings;
use App\Modules\Money\Application\MoneyStore;
use App\Modules\Money\Application\PaymentGateways;
use App\Modules\Money\Infrastructure\ConfiguredGateways;
use App\Modules\Money\Infrastructure\MySqlMoney;
use App\Modules\Onboarding\Application\OnboardingAdminQueries;
use App\Modules\Onboarding\Application\OnboardingStore;
use App\Modules\Onboarding\Application\PurchaseConfirmation;
use App\Modules\Onboarding\Application\TransferGateway;
use App\Modules\Onboarding\Application\TransferStore;
use App\Modules\Onboarding\Application\WebIntakeStore;
use App\Modules\Onboarding\Domain\OnboardingRules;
use App\Modules\Onboarding\Infrastructure\ConfiguredTransferGateway;
use App\Modules\Onboarding\Infrastructure\MySqlOnboarding;
use App\Modules\Onboarding\Infrastructure\MySqlOnboardingAdmin;
use App\Modules\Onboarding\Infrastructure\MySqlTransfers;
use App\Modules\Onboarding\Infrastructure\MySqlWebIntakes;
use App\Modules\Onboarding\Infrastructure\PurchaseConfirmationSms;
use App\Modules\Plans\Application\DraftProvider;
use App\Modules\Plans\Application\PlanChangeStore;
use App\Modules\Plans\Application\PlanEditorStore;
use App\Modules\Plans\Application\PlanGenerationStore;
use App\Modules\Plans\Application\PlanQueryStore;
use App\Modules\Plans\Application\PlanQuestionStore;
use App\Modules\Plans\Domain\PlanDraftRules;
use App\Modules\Plans\Infrastructure\LocalDraftProvider;
use App\Modules\Plans\Infrastructure\MySqlPlanChanges;
use App\Modules\Plans\Infrastructure\MySqlPlanEditor;
use App\Modules\Plans\Infrastructure\MySqlPlanGeneration;
use App\Modules\Plans\Infrastructure\MySqlPlanQueries;
use App\Modules\Plans\Infrastructure\MySqlPlanQuestions;
use App\Modules\Publishing\Application\PublishingStore;
use App\Modules\Publishing\Infrastructure\MySqlPublishing;
use App\Modules\Questionnaire\Application\QuestionnaireStore;
use App\Modules\Questionnaire\Domain\QuestionnaireRules;
use App\Modules\Questionnaire\Infrastructure\MySqlQuestionnaires;
use App\Modules\Realtime\Application\PushSender;
use App\Modules\Realtime\Application\RealtimeGateway;
use App\Modules\Realtime\Infrastructure\MySqlRealtime;
use App\Modules\Realtime\Infrastructure\RecordingPush;
use App\Modules\Rewards\Application\StreakStore;
use App\Modules\Rewards\Infrastructure\MySqlStreak;
use App\Modules\Shopping\Application\ShoppingStore;
use App\Modules\Shopping\Infrastructure\MySqlShopping;
use App\Modules\Tracking\Application\TrackingStore;
use App\Modules\Tracking\Infrastructure\MySqlTracking;
use App\Modules\Worker\Application\WorkerStore;
use App\Modules\Worker\Infrastructure\MySqlWorker;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\ServiceProvider;
use LogicException;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->bind(ConnectionInterface::class, fn ($app) => $app['db']->connection());
        $this->app->bind(IdentityStore::class, MySqlIdentityStore::class);
        $this->app->bind(PlanEditorStore::class, MySqlPlanEditor::class);
        $this->app->bind(PlanChangeStore::class, MySqlPlanChanges::class);
        $this->app->bind(PlanGenerationStore::class, MySqlPlanGeneration::class);
        $this->app->bind(DraftProvider::class, LocalDraftProvider::class);
        $this->app->bind(WorkerStore::class, MySqlWorker::class);
        $this->app->bind(MessagingStore::class, MySqlMessaging::class);
        $this->app->bind(RealtimeGateway::class, MySqlRealtime::class);
        $this->app->singleton(PushSender::class, RecordingPush::class);
        $this->app->singleton(PlanDraftRules::class, fn () => new PlanDraftRules(json_decode(file_get_contents(app_path('Modules/Plans/Infrastructure/resources/option-schema.json')), true, 512, JSON_THROW_ON_ERROR)));
        $this->app->bind(TransferStore::class, MySqlTransfers::class);
        $this->app->bind(TransferGateway::class, ConfiguredTransferGateway::class);
        $this->app->bind(PurchaseConfirmation::class, PurchaseConfirmationSms::class);
        $this->app->bind(WebIntakeStore::class, MySqlWebIntakes::class);
        $this->app->bind(OnboardingAdminQueries::class, MySqlOnboardingAdmin::class);
        $this->app->bind(OnboardingStore::class, MySqlOnboarding::class);
        $this->app->singleton(OnboardingRules::class, fn () => new OnboardingRules(
            json_decode(file_get_contents(app_path('Modules/Onboarding/Infrastructure/resources/spec.json')), true, 512, JSON_THROW_ON_ERROR)));
        $this->app->bind(PlanQuestionStore::class, MySqlPlanQuestions::class);
        $this->app->bind(PlanQueryStore::class, MySqlPlanQueries::class);
        $this->app->bind(MoneyStore::class, MySqlMoney::class);
        $this->app->singleton(PaymentGateways::class, fn () => new ConfiguredGateways(config('payments'), config('identity.environment')));
        $this->app->singleton(MoneySettings::class, fn () => new MoneySettings(config('payments.default'), config('payments.public_api_url')));
        $this->app->bind(AdminQueries::class, MySqlAdminQueries::class);
        $this->app->bind(PublishingStore::class, MySqlPublishing::class);
        $this->app->bind(FoodStore::class, MySqlFoods::class);
        $this->app->singleton(FoodRules::class, fn () => new FoodRules(
            json_decode(file_get_contents(app_path('Modules/Food/Infrastructure/resources/input-schema.json')), true, 512, JSON_THROW_ON_ERROR)));
        $this->app->bind(QuestionnaireStore::class, MySqlQuestionnaires::class);
        $this->app->bind(TrackingStore::class, MySqlTracking::class);
        $this->app->bind(ShoppingStore::class, MySqlShopping::class);
        $this->app->bind(StreakStore::class, MySqlStreak::class);
        $this->app->bind(CoachModel::class, FixedCoachModel::class);
        $this->app->bind(CoachGateway::class, MySqlCoach::class);
        $this->app->singleton(AiCatalog::class, FixedAiCatalog::class);
        $this->app->singleton(QuestionnaireRules::class, fn () => new QuestionnaireRules(
            json_decode(file_get_contents(app_path('Modules/Questionnaire/Infrastructure/resources/schema.json')), true, 512, JSON_THROW_ON_ERROR)));
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
        if (config('database.default') !== 'mysql') {
            throw new LogicException('The Laravel API requires DB_CONNECTION=mysql. PostgreSQL is a read-only migration source.');
        }
        if (! in_array(config('runtime.role'), ['api', 'worker'], true)) {
            throw new LogicException('APP_ROLE must be api or worker. HTTP stays on the api role.');
        }
        $config = config('identity');
        if (! in_array($config['environment'], ['development', 'test', 'staging', 'production'], true)) {
            throw new LogicException('Unsupported NODE_ENV');
        }
        if ($config['fixed_otp'] !== null && ! preg_match('/^[0-9]{6}$/D', $config['fixed_otp'])) {
            throw new LogicException('OTP_FIXED_CODE must contain six digits');
        }
        if ($config['environment'] === 'production') {
            foreach (['jwt_secret', 'otp_pepper', 'field_key'] as $key) {
                if (strlen($config[$key]) < 32 || str_starts_with($config[$key], 'dev-only-')) {
                    throw new LogicException('Production identity secrets must be configured');
                }
            }
            if ($config['sms_provider'] !== 'melipayamak' || ! $config['sms_username'] || ! $config['sms_key'] || (! $config['sms_from'] && ! $config['sms_pattern'])) {
                throw new LogicException('Production SMS adapter must be configured');
            }
        }
    }
}
