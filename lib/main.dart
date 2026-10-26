import 'package:flutter/material.dart';
import 'app.dart';
import 'data/demo_store.dart';
import 'data/questionnaire_storage.dart';
import 'data/nutrition_log_storage.dart';
import 'data/workspace_settings_storage.dart';
import 'dev_preview.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  final store = DemoStore(
    storage: PreferencesQuestionnaireStorage(),
    nutritionStorage: PreferencesNutritionLogStorage(),
    settingsStorage: PreferencesWorkspaceSettingsStorage(),
  );
  runApp(DevPreview(child: SabzineApp(store: store, restoreOnStart: true)));
}
