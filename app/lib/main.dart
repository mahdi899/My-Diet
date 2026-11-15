import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'app.dart';
import 'core/photos/food_photo_resolver.dart';
import 'domain/common/failure.dart';
import 'data/customer_auth.dart';
import 'data/secure_auth_storage.dart';
import 'data/demo_store.dart';
import 'data/connection.dart';
import 'data/questionnaire_storage.dart';
import 'data/nutrition_log_storage.dart';
import 'data/workspace_settings_storage.dart';
import 'dev_preview.dart';
import 'data/wallet_state_storage.dart';
import 'data/session_storage.dart';

String resolveApiBase() {
  const fromEnv = String.fromEnvironment('API_BASE_URL', defaultValue: 'unset');
  if (fromEnv != 'unset') return fromEnv;
  if (kReleaseMode) return 'https://my-diet.ir';
  // Chrome/debug web: demo data only unless API_BASE_URL is set (see frontend-phase-0-1).
  if (kIsWeb) return '';
  // The debug build runs adb reverse so this address is the host Laravel server.
  // Pass --dart-define=API_BASE_URL=http://127.0.0.1:3000 to use the Nest process instead.
  return 'http://127.0.0.1:8000';
}

/// Fixture data is only for tests and an explicit `--dart-define=USE_DEMO=true`.
/// The shipped app is always the original shell, talking to the API.
const _forceDemo = bool.fromEnvironment('USE_DEMO');

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  // Warm the bundled photo index so FoodImage resolves instantly.
  FoodPhotoResolver.load().ignore();
  final apiBase = resolveApiBase();
  if (kDebugMode) debugPrint('API $apiBase');
  final fixtures = _forceDemo || (!kReleaseMode && apiBase.isEmpty);
  final store = DemoStore(
    openPaymentUrl: (uri) async {
      if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
        throw const CommerceException('درگاه پرداخت باز نشد.');
      }
    },
    customerAuth: fixtures || apiBase.isEmpty
        ? null
        : CustomerAuth(baseUrl: apiBase, storage: const SecureAuthStorage()),
    storage: PreferencesQuestionnaireStorage(),
    walletStorage: PreferencesWalletStateStorage(),
    sessionStorage: PreferencesSessionStorage(),
    nutritionStorage: PreferencesNutritionLogStorage(),
    feedbackRepository: PreferencesWeeklyFeedbackRepository(),
    settingsStorage: PreferencesWorkspaceSettingsStorage(),
  );
  runApp(
    DevPreview(
      child: SabzineApp(
        store: store,
        link: fixtures || apiBase.isEmpty
            ? null
            : LinkMonitor(probe: () => probeHealth(apiBase)),
        restoreOnStart: true,
        // Local Chrome refresh reloads the whole app; skip the extra logo hold in debug.
        splashDuration: kIsWeb && kDebugMode
            ? Duration.zero
            : const Duration(milliseconds: 1300),
      ),
    ),
  );
}
