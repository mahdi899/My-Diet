import 'package:shared_preferences/shared_preferences.dart';

abstract interface class WalletStateStorage {
  Future<String?> read();
  Future<void> write(String value);
}

class PreferencesWalletStateStorage implements WalletStateStorage {
  final SharedPreferencesAsync preferences = SharedPreferencesAsync();
  static const key = 'sabzine.money-wallet.v1';
  @override
  Future<String?> read() => preferences.getString(key);
  @override
  Future<void> write(String value) => preferences.setString(key, value);
}
