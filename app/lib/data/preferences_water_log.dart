import 'dart:convert';
import 'dart:async';

import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter/foundation.dart';

import '../domain/common/day.dart';
import '../domain/plan/water_repository.dart';

/// Glasses of water for a calendar day, kept on device.
class PreferencesWaterLog implements WaterRepository {
  PreferencesWaterLog({SharedPreferencesAsync? preferences})
    : _preferences = preferences ?? SharedPreferencesAsync();

  final SharedPreferencesAsync _preferences;
  static const key = 'sabzine.water.v1';
  static final changes = ValueNotifier<int>(0);
  static Future<void>? _pending;

  @override
  Future<Map<String, int>> history() async {
    final raw = await _preferences.getString(key);
    if (raw == null || raw.isEmpty) return {};
    final decoded = jsonDecode(raw);
    if (decoded is! Map) return {};
    return {
      for (final entry in decoded.entries)
        if (entry.value is num)
          entry.key.toString(): (entry.value as num).round().clamp(0, 20),
    };
  }

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
    final previous = _pending;
    final finished = Completer<void>();
    _pending = finished.future;
    try {
      if (previous != null) await previous;
      await _write(date, glasses);
    } finally {
      finished.complete();
      if (identical(_pending, finished.future)) _pending = null;
    }
  }

  Future<void> _write(DateTime date, int glasses) async {
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
    changes.value++;
  }
}
