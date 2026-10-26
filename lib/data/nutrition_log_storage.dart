import 'package:shared_preferences/shared_preferences.dart';

abstract interface class NutritionLogStorage {
  Future<String?> read();
  Future<void> write(String value);
}

class PreferencesNutritionLogStorage implements NutritionLogStorage {
  final SharedPreferencesAsync preferences = SharedPreferencesAsync();
  static const key = 'sabzine.meal-log.v1';
  @override
  Future<String?> read() => preferences.getString(key);
  @override
  Future<void> write(String value) => preferences.setString(key, value);
}
