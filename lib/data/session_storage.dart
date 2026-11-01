import 'package:shared_preferences/shared_preferences.dart';

abstract interface class SessionStorage {
  Future<String?> read();
  Future<void> write(String value);
  Future<void> clear();
}

/// Local demo session; never used for server-issued authentication tokens.
class PreferencesSessionStorage implements SessionStorage {
  final SharedPreferencesAsync preferences = SharedPreferencesAsync();
  static const key = 'sabzine.demo-session.v1';
  @override
  Future<String?> read() => preferences.getString(key);
  @override
  Future<void> write(String value) => preferences.setString(key, value);
  @override
  Future<void> clear() => preferences.remove(key);
}
