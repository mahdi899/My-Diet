import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'app.dart';
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
import 'package:url_launcher/url_launcher.dart';
import 'real/home/topup_sheet.dart' show openExternalUrl;
import 'real/real_app.dart';

String resolveApiBase() {
  const fromEnv = String.fromEnvironment('API_BASE_URL', defaultValue: 'unset');
  if (fromEnv != 'unset') return fromEnv;
  if (kReleaseMode) return 'https://my-diet.ir';
  // Chrome/debug web: demo data only unless API_BASE_URL is set (see frontend-phase-0-1).
  if (kIsWeb) return '';
  // 10.0.2.2 does not reach the host on this machine. adb reverse maps 127.0.0.1:3000.
  if (defaultTargetPlatform == TargetPlatform.android) return 'http://127.0.0.1:3000';
  return 'http://127.0.0.1:3000';
}

/// Release builds always run the real app. Demo data is a debug-only convenience
/// (`--dart-define=USE_DEMO=true`, or a web debug run with no API_BASE_URL).
const _forceDemo = bool.fromEnvironment('USE_DEMO');

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  final apiBase = resolveApiBase();
  if (kDebugMode) debugPrint('API $apiBase');
  final demo = !kReleaseMode && (_forceDemo || apiBase.isEmpty);
  if (!demo) {
    openExternalUrl = (url) async {
      final ok = await launchUrl(url, mode: LaunchMode.externalApplication);
      if (!ok) throw StateError('cannot open $url');
    };
    runApp(
      RealApp(
        auth: CustomerAuth(
          baseUrl: apiBase,
          storage: const SecureAuthStorage(),
        ),
      ),
    );
    return;
  }
  final store = DemoStore(
    customerAuth: apiBase.isEmpty
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
        link: apiBase.isEmpty ? null : LinkMonitor(probe: () => probeHealth(apiBase)),
        restoreOnStart: true,
        // Local Chrome refresh reloads the whole app; skip the extra logo hold in debug.
        splashDuration: kIsWeb && kDebugMode
            ? Duration.zero
            : const Duration(milliseconds: 1300),
      ),
    ),
  );
}
