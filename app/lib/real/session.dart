import 'package:flutter/foundation.dart';
import '../data/customer_auth.dart';
import 'commerce/commerce.dart';
import 'core/api.dart';
import 'onboarding/repository.dart';
import 'plan/plan.dart';

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

/// Sign-in state. The server decides everything else; this only knows "who is signed in".
class SessionController extends ChangeNotifier {
  SessionController(this.auth);
  final CustomerAuth auth;

  bool restoring = true;
  bool signedIn = false;
  String? error;

  Future<void> restore() async {
    try {
      final s = await auth.restore();
      signedIn = s != null;
    } catch (_) {
      signedIn = false;
    }
    restoring = false;
    notifyListeners();
  }

  Future<void> requestCode(String phone) => auth.requestCode(phone);

  Future<void> verify(String phone, String code) async {
    await auth.verify(phone, code);
    signedIn = true;
    error = null;
    notifyListeners();
  }

  Future<void> signOut() async {
    try {
      await auth.logout();
    } catch (_) {
      // The local session is dropped either way.
    }
    signedIn = false;
    notifyListeners();
  }

  /// Called when any request reports the session is gone.
  void expired() {
    if (!signedIn) return;
    signedIn = false;
    error = 'نشست پایان یافت؛ دوباره وارد شو.';
    notifyListeners();
  }
}
