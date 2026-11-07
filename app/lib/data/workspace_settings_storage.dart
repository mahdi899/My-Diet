import 'package:shared_preferences/shared_preferences.dart';

abstract interface class WorkspaceSettingsStorage {
  Future<String?> read();
  Future<void> write(String value);
}

class PreferencesWorkspaceSettingsStorage implements WorkspaceSettingsStorage {
  final preferences = SharedPreferencesAsync();
  static const key = 'sabzine.workspace-settings.v1';
  @override
  Future<String?> read() => preferences.getString(key);
  @override
  Future<void> write(String value) => preferences.setString(key, value);
}
