import 'package:flutter_test/flutter_test.dart';
import 'package:sabzine_flutter/data/demo_store.dart';
import 'package:sabzine_flutter/data/wallet_catalog.dart';

void main() {
  test('Wallet purchase deducts tokens and blocks double spend flag', () {
    final s = DemoStore()..login(AppRole.user);
    s.setDebugTokenBalance(200);
    s.selectedPlanServiceId = 'new-plan';
    expect(s.tryPurchasePlanService('new-plan'), isTrue);
    expect(s.tokenBalance, 0);
    expect(s.walletPurchaseBusy, isFalse);
    s.dispose();
  });

  test('Exact balance counts as sufficient', () {
    final s = DemoStore();
    s.setDebugTokenBalance(50);
    expect(s.canAffordTokens(50), isTrue);
    s.dispose();
  });

  test('Token packages add balance on mock purchase', () {
    final s = DemoStore();
    s.setDebugTokenBalance(100);
    s.addPurchasedTokens(200);
    expect(s.tokenBalance, 300);
    s.dispose();
  });

  test('formatToman uses Persian digits and separators', () {
    expect(formatToman(1000000), '۱,۰۰۰,۰۰۰ تومان');
  });
}
