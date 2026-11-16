import 'package:flutter_test/flutter_test.dart';
import 'package:sabzine_flutter/data/demo_store.dart';
import 'package:sabzine_flutter/data/wallet_catalog.dart';

void main() {
  test('Wallet purchase deducts amountToman and blocks double spend flag', () {
    final s = DemoStore()..login(AppRole.user);
    s.setDebugWalletBalance(500000);
    s.selectedPlanServiceId = 'new-plan';
    expect(s.tryPurchasePlanService('new-plan'), isTrue);
    expect(s.walletBalance, 0);
    expect(s.walletPurchaseBusy, isFalse);
    s.dispose();
  });

  test('Exact balance counts as sufficient', () {
    final s = DemoStore();
    s.setDebugWalletBalance(50);
    expect(s.canAfford(50), isTrue);
    s.dispose();
  });

  test('Money charges add balance on mock purchase', () {
    final s = DemoStore();
    s.setDebugWalletBalance(100);
    s.addWalletCredit(200);
    expect(s.walletBalance, 300);
    s.dispose();
  });

  test('formatToman uses Persian digits and separators', () {
    expect(formatToman(1000000), '۱٬۰۰۰٬۰۰۰ تومان');
  });
}
