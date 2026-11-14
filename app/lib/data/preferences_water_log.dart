import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import '../domain/common/day.dart';
import '../domain/plan/water_repository.dart';

/// Glasses of water for a calendar day, kept on device.
class PreferencesWaterLog implements WaterRepository {
  PreferencesWaterLog({SharedPreferencesAsync? preferences})
    : _preferences = preferences ?? SharedPreferencesAsync();

  final SharedPreferencesAsync _preferences;
  static const key = 'sabzine.water.v1';

  @override
  Future<int> read(DateTime date) async {
    final raw = await _preferences.getString(key);
    if (raw == null || raw.isEmpty) return 0;
    final decoded = jsonDecode(raw);
    if (decoded is! Map) return 0;
    final value = decoded[dateKey(date)];
    if (value is num) return value.round().clamp(0, 20);
    return 0;
  }

  @override
  Future<void> write(DateTime date, int glasses) async {
    final data = <String, Object>{};
    final raw = await _preferences.getString(key);
    if (raw != null && raw.isNotEmpty) {
      final decoded = jsonDecode(raw);
      if (decoded is Map) {
        for (final entry in decoded.entries) {
          if (entry.value is num) {
            data[entry.key.toString()] = (entry.value as num).round();
          }
        }
      }
    }
    data[dateKey(date)] = glasses.clamp(0, 20);
    if (data.length > 21) {
      final keys = data.keys.toList()..sort();
      for (final day in keys.take(data.length - 14)) {
        data.remove(day);
      }
    }
    await _preferences.setString(key, jsonEncode(data));
  }
}
