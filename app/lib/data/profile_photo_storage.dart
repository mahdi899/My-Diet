import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Shares the existing personal-details cache without replacing other fields.
abstract final class ProfilePhotoStorage {
  static const _storage = FlutterSecureStorage();

  static Future<String?> read(String owner) async {
    final saved = await _storage.read(key: 'personal_details:$owner');
    if (saved == null) return null;
    return (jsonDecode(saved) as Map)['photo'] as String?;
  }

  static Future<void> save(String owner, String photo) async {
    final key = 'personal_details:$owner';
    final saved = await _storage.read(key: key);
    final data = saved == null
        ? <String, dynamic>{}
        : Map<String, dynamic>.from(jsonDecode(saved) as Map);
    data['photo'] = photo;
    await _storage.write(key: key, value: jsonEncode(data));
  }
}
