import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'customer_auth.dart';

class SecureAuthStorage implements AuthTokenStorage {
  const SecureAuthStorage();
  static const _storage = FlutterSecureStorage();
  static const _key = 'sabzine.server-session.v1';
  @override
  Future<String?> read() => _storage.read(key: _key);
  @override
  Future<void> write(String token) => _storage.write(key: _key, value: token);
  @override
  Future<void> clear() => _storage.delete(key: _key);
}
