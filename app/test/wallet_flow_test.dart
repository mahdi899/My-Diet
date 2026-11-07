import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sabzine_flutter/app.dart';
import 'package:sabzine_flutter/data/demo_store.dart';
import 'package:sabzine_flutter/screens/wallet_flow.dart';
import 'package:sabzine_flutter/widgets/ui.dart';
import 'widget_test.dart' show mobile;

Future<void> tapWallet(WidgetTester t, Finder f) async {
  await t.ensureVisible(f);
  await t.pumpAndSettle();
  await t.tap(f);
  await t.pumpAndSettle();
}

Future<void> startWallet(WidgetTester t, DemoStore s) async {
  mobile(t);
  s.questionnaireComplete = true;
  s.login(AppRole.user);
  await t.pumpWidget(SabzineApp(store: s, splashDuration: Duration.zero));
  await t.pumpAndSettle();
  await tapWallet(t, find.byKey(const ValueKey('get-food-plan')));
}

PrimaryButton primary(WidgetTester t, String label) =>
    t.widget<PrimaryButton>(find.widgetWithText(PrimaryButton, label));
Future<void> cleanupWallet(WidgetTester t, DemoStore s) async {
  await t.pumpWidget(const SizedBox());
  await t.pump();
  s.dispose();
}

void main() {
  test(
    'Money debit and charge are idempotent, face value with no intermediary conversion',
    () {
      final s = DemoStore()..login(AppRole.user), count = s.requests.length;
      expect(s.walletBalance, 0);
      expect(s.tryPurchasePlanService('new-plan'), false);
      expect(s.completeMockPayment('p200', 'payment-1'), true);
      expect(s.completeMockPayment('p200', 'payment-1'), false);
      expect(s.walletBalance, 500000);
      expect(
        s.tryPurchasePlanService('new-plan', operationId: 'order-1'),
        true,
      );
      expect(
        s.tryPurchasePlanService('new-plan', operationId: 'order-1'),
        false,
      );
      expect(s.walletBalance, 0);
      expect(s.requests.length, count + 1);
      s.dispose();
    },
  );
  testWidgets('Insufficient money shows amount then charge then balance', (
    t,
  ) async {
    final s = DemoStore();
    await startWallet(t, s);
    expect(primary(t, 'برداشت از کیف پول').onPressed, isNull);
    await tapWallet(t, find.byKey(const ValueKey('service-new-plan')));
    expect(find.text('مبلغ قابل پرداخت: ۵۰۰,۰۰۰ تومان'), findsOneWidget);
    expect(find.text('موجودی ناکافی'), findsOneWidget);
    expect(
      t.getCenter(find.byKey(const ValueKey('payable-amount'))).dy,
      lessThan(
        t.getCenter(find.widgetWithText(PrimaryButton, 'شارژ کیف پول')).dy,
      ),
    );
    expect(
      t.getCenter(find.widgetWithText(PrimaryButton, 'شارژ کیف پول')).dy,
      lessThan(
        t.getCenter(find.byKey(const ValueKey('wallet-balance-line'))).dy,
      ),
    );
    expect(t.takeException(), isNull);
    await cleanupWallet(t, s);
  });
  testWidgets(
    'Charge at face value returns to selected service; double taps debit once',
    (t) async {
      final s = DemoStore();
      await startWallet(t, s);
      await tapWallet(t, find.byKey(const ValueKey('service-new-plan')));
      await tapWallet(t, find.widgetWithText(PrimaryButton, 'شارژ کیف پول'));
      expect(primary(t, 'شارژ کیف پول').onPressed, isNull);
      await tapWallet(t, find.byKey(const ValueKey('package-p200')));
      await tapWallet(t, find.widgetWithText(PrimaryButton, 'شارژ کیف پول'));
      final pay = primary(t, 'پرداخت موفق').onPressed!;
      pay();
      pay();
      await t.pumpAndSettle();
      expect(s.walletBalance, 500000);
      await tapWallet(t, find.widgetWithText(FilledButton, 'باشه'));
      expect(s.selectedPlanServiceId, 'new-plan');
      expect(find.text('موجودی کافی'), findsOneWidget);
      final debit = primary(t, 'برداشت از کیف پول').onPressed!;
      debit();
      debit();
      await t.pumpAndSettle();
      expect(s.walletBalance, 0);
      expect(s.walletTransactions.length, 2);
      await tapWallet(t, find.widgetWithText(TextButton, 'باشه'));
      expect(find.byType(PlanServicesScreen), findsNothing);
      expect(s.hasUserRequest, true);
      expect(t.takeException(), isNull);
      await cleanupWallet(t, s);
    },
  );
  testWidgets(
    'Custom money amount credits exactly and failed payment preserves balance',
    (t) async {
      final s = DemoStore();
      await startWallet(t, s);
      await tapWallet(t, find.byKey(const ValueKey('service-new-plan')));
      await tapWallet(t, find.widgetWithText(PrimaryButton, 'شارژ کیف پول'));
      await t.enterText(find.byKey(const ValueKey('custom-charge')), '۶۵۰۰۰۰');
      await t.pumpAndSettle();
      await tapWallet(t, find.widgetWithText(PrimaryButton, 'شارژ کیف پول'));
      await tapWallet(t, find.text('پرداخت ناموفق / انصراف'));
      expect(s.walletBalance, 0);
      expect(find.byKey(const ValueKey('mock-payment-error')), findsOneWidget);
      await tapWallet(t, find.widgetWithText(PrimaryButton, 'شارژ کیف پول'));
      await tapWallet(t, find.widgetWithText(PrimaryButton, 'پرداخت موفق'));
      expect(s.walletBalance, 650000);
      expect(s.walletTransactions.single.amountToman, 650000);
      await tapWallet(t, find.widgetWithText(FilledButton, 'باشه'));
      expect(t.takeException(), isNull);
      await cleanupWallet(t, s);
    },
  );
  testWidgets(
    'Exact monetary balance can buy without opening payment gateway',
    (t) async {
      final s = DemoStore()..setDebugWalletBalance(500000);
      await startWallet(t, s);
      await tapWallet(t, find.byKey(const ValueKey('service-new-plan')));
      expect(find.text('موجودی کافی'), findsOneWidget);
      await tapWallet(
        t,
        find.widgetWithText(PrimaryButton, 'برداشت از کیف پول'),
      );
      expect(s.walletBalance, 0);
      expect(find.byType(MockPaymentScreen), findsNothing);
      await tapWallet(t, find.widgetWithText(TextButton, 'باشه'));
      await cleanupWallet(t, s);
    },
  );
  testWidgets('Repeated insufficient-wallet taps open one charge screen', (
    t,
  ) async {
    final s = DemoStore();
    await startWallet(t, s);
    await tapWallet(t, find.byKey(const ValueKey('service-new-plan')));
    final charge = primary(t, 'شارژ کیف پول').onPressed!;
    charge();
    charge();
    await t.pumpAndSettle();
    expect(find.byType(WalletChargeScreen), findsOneWidget);
    Navigator.of(t.element(find.byType(WalletChargeScreen))).pop();
    await t.pumpAndSettle();
    expect(find.byType(PlanServicesScreen), findsOneWidget);
    expect(t.takeException(), isNull);
    await cleanupWallet(t, s);
  });
}
