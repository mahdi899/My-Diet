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

String resolveApiBase() {
  const fromEnv = String.fromEnvironment('API_BASE_URL', defaultValue: 'unset');
  if (fromEnv != 'unset') return fromEnv;
  if (kReleaseMode) return 'https://my-diet.ir';
  if (kIsWeb) return 'http://127.0.0.1:3000';
  // 10.0.2.2 does not reach the host on this machine. adb reverse maps 127.0.0.1:3000.
  if (defaultTargetPlatform == TargetPlatform.android) return 'http://127.0.0.1:3000';
  return 'http://127.0.0.1:3000';
}

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  final apiBase = resolveApiBase();
  if (kDebugMode) debugPrint('API $apiBase');
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
      ),
    ),
  );
}
