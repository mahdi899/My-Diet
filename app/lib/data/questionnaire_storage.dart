import 'package:shared_preferences/shared_preferences.dart';

/// Local-only profile storage; injected so UI tests do not need a platform.
abstract interface class QuestionnaireStorage {
  Future<String?> read();
  Future<void> write(String value);
}

class PreferencesQuestionnaireStorage implements QuestionnaireStorage {
  PreferencesQuestionnaireStorage({SharedPreferencesAsync? preferences})
    : _preferences = preferences ?? SharedPreferencesAsync();

  static const key = 'sabzine.questionnaire.v1';
  final SharedPreferencesAsync _preferences;

  @override
  Future<String?> read() => _preferences.getString(key);

  @override
  Future<void> write(String value) => _preferences.setString(key, value);
}
