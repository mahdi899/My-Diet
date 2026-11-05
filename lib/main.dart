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

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  const apiBase = String.fromEnvironment('API_BASE_URL',defaultValue:'https://my-diet.ir');
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
