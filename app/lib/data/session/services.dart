import '../onboarding/http_onboarding_repository.dart';
import '../commerce/http_commerce_repository.dart';
import '../plan/http_plan_repository.dart';
import '../../core/network/api_client.dart';
import '../../domain/commerce/commerce.dart';
import '../../domain/onboarding/onboarding.dart';
import '../../domain/plan/plan.dart';

/// Everything a screen may depend on, built once. Tests replace these with fakes.
class Services {
  Services({
    required this.onboarding,
    required this.commerce,
    required this.plans,
  });
  factory Services.http(ApiClient api) => Services(
    onboarding: HttpOnboardingRepository(api),
    commerce: HttpCommerceRepository(api),
    plans: HttpPlanRepository(api),
  );
  final OnboardingRepository onboarding;
  final CommerceRepository commerce;
  final PlanRepository plans;
}
