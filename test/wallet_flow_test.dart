import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sabzine_flutter/app.dart';
import 'package:sabzine_flutter/data/demo_store.dart';
import 'package:sabzine_flutter/data/wallet_catalog.dart';
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
  setUpAll(() async {
    final font = FontLoader('Vazirmatn')
      ..addFont(rootBundle.load('assets/fonts/Vazirmatn-Regular.ttf'))
      ..addFont(rootBundle.load('assets/fonts/Vazirmatn-Bold.ttf'));
    await font.load();
  });
  test(
    'Login does not create a paid program; mock debit and credit are idempotent',
    () {
      final s = DemoStore()..login(AppRole.user), count = s.requests.length;
      expect(s.tokenBalance, kInitialTokenBalance);
      expect(s.hasUserRequest, false);
      expect(s.tryPurchasePlanService('new-plan', operationId: 'short'), false);
      expect(s.requests.length, count);
      expect(s.tryPurchasePlanService('missing'), false);
      expect(s.completeMockTokenPayment('p200', 'payment-1'), true);
      expect(s.completeMockTokenPayment('p200', 'payment-1'), false);
      expect(s.tokenBalance, 300);
      expect(
        s.tryPurchasePlanService('new-plan', operationId: 'order-1'),
        true,
      );
      expect(
        s.tryPurchasePlanService('new-plan', operationId: 'order-1'),
        false,
      );
      expect(s.tokenBalance, 100);
      expect(s.requests.length, count + 1);
      expect(s.hasUserRequest, true);
      expect(s.userRequest.status, PlanStatus.queued);
      expect(s.walletTransactions.length, 2);
      expect(formatTokenNumber(1234567), '۱,۲۳۴,۵۶۷');
      s.dispose();
    },
  );
  testWidgets(
    'No selection disables withdrawal and insufficient footer follows required order',
    (t) async {
      final s = DemoStore();
      await startWallet(t, s);
      expect(primary(t, 'برداشت از کیف پول').onPressed, isNull);
      expect(s.selectedPlanServiceId, isNull);
      await tapWallet(t, find.byKey(const ValueKey('service-new-plan')));
      expect(find.text('موجودی ناکافی'), findsOneWidget);
      expect(find.text('توکن قابل پرداخت: ۲۰۰ توکن'), findsOneWidget);
      final pay = t.getCenter(find.byKey(const ValueKey('payable-tokens'))).dy,
          button = t
              .getCenter(find.widgetWithText(PrimaryButton, 'شارژ کیف پول'))
              .dy,
          balance = t
              .getCenter(find.byKey(const ValueKey('wallet-balance-line')))
              .dy;
      expect(pay, lessThan(button));
      expect(button, lessThan(balance));
      final content = find.text('موجودی توکن کیف پول شما: ۱۰۰ توکن');
      expect(content, findsOneWidget);
      expect(t.takeException(), isNull);
      await cleanupWallet(t, s);
    },
  );
  testWidgets(
    'Recharge returns to selected service; successful withdrawal returns to dashboard',
    (t) async {
      final s = DemoStore();
      await startWallet(t, s);
      await tapWallet(t, find.byKey(const ValueKey('service-new-plan')));
      await tapWallet(t, find.widgetWithText(PrimaryButton, 'شارژ کیف پول'));
      expect(find.byType(TokenPackagesScreen), findsOneWidget);
      expect(primary(t, 'خرید توکن').onPressed, isNull);
      await tapWallet(t, find.byKey(const ValueKey('package-p200')));
      await tapWallet(t, find.widgetWithText(PrimaryButton, 'خرید توکن'));
      expect(find.byType(MockPaymentScreen), findsOneWidget);
      expect(find.text('۵۰۰,۰۰۰ تومان'), findsOneWidget);
      expect(
        t
            .widgetList<TextField>(find.byType(TextField))
            .every((f) => f.readOnly),
        true,
      );
      final success = primary(t, 'پرداخت موفق').onPressed!;
      success();
      success();
      await t.pumpAndSettle();
      expect(s.tokenBalance, 300);
      expect(s.walletTransactions.length, 1);
      await tapWallet(t, find.widgetWithText(FilledButton, 'باشه'));
      expect(find.byType(PlanServicesScreen), findsOneWidget);
      expect(find.byType(TokenPackagesScreen), findsNothing);
      expect(s.selectedPlanServiceId, 'new-plan');
      expect(find.text('موجودی کافی'), findsOneWidget);
      final withdraw = primary(t, 'برداشت از کیف پول').onPressed!;
      withdraw();
      withdraw();
      await t.pumpAndSettle();
      expect(s.tokenBalance, 100);
      expect(s.walletTransactions.length, 2);
      expect(
        find.textContaining('درخواست شما برای دریافت برنامه غذایی ارسال شد.'),
        findsOneWidget,
      );
      await tapWallet(t, find.widgetWithText(TextButton, 'باشه'));
      expect(find.byType(PlanServicesScreen), findsNothing);
      expect(find.byType(NavigationBar), findsOneWidget);
      expect(s.hasUserRequest, true);
      expect(s.walletPricingOpen, false);
      expect(t.takeException(), isNull);
      await cleanupWallet(t, s);
    },
  );
  testWidgets(
    'Exact balance works and success-dialog recharge can return with a shortfall',
    (t) async {
      final s = DemoStore();
      await startWallet(t, s);
      await tapWallet(t, find.byKey(const ValueKey('service-expert-change')));
      expect(find.text('موجودی کافی'), findsOneWidget);
      await tapWallet(
        t,
        find.widgetWithText(PrimaryButton, 'برداشت از کیف پول'),
      );
      expect(s.tokenBalance, 0);
      expect(
        find.textContaining('درخواست تغییر برنامه با متخصص ارسال شد.'),
        findsOneWidget,
      );
      await tapWallet(
        t,
        find.widgetWithText(FilledButton, 'شارژ کیف پول').last,
      );
      await tapWallet(t, find.byKey(const ValueKey('package-p50')));
      await tapWallet(t, find.widgetWithText(PrimaryButton, 'خرید توکن'));
      await tapWallet(t, find.widgetWithText(PrimaryButton, 'پرداخت موفق'));
      await tapWallet(t, find.widgetWithText(FilledButton, 'باشه'));
      expect(s.tokenBalance, 50);
      expect(s.selectedPlanServiceId, 'expert-change');
      expect(find.text('موجودی ناکافی'), findsOneWidget);
      expect(s.walletTransactions.length, 2);
      expect(t.takeException(), isNull);
      await cleanupWallet(t, s);
    },
  );
  testWidgets('Failed gateway payment leaves balance intact and allows retry', (
    t,
  ) async {
    final s = DemoStore();
    await startWallet(t, s);
    await tapWallet(t, find.byKey(const ValueKey('service-new-plan')));
    await tapWallet(t, find.widgetWithText(PrimaryButton, 'شارژ کیف پول'));
    await tapWallet(t, find.byKey(const ValueKey('package-p500')));
    await tapWallet(t, find.widgetWithText(PrimaryButton, 'خرید توکن'));
    expect(find.text('۱,۰۰۰,۰۰۰ تومان'), findsOneWidget);
    await tapWallet(t, find.text('پرداخت ناموفق / انصراف'));
    expect(find.byType(TokenPackagesScreen), findsOneWidget);
    expect(find.byKey(const ValueKey('mock-payment-error')), findsOneWidget);
    expect(s.tokenBalance, 100);
    expect(s.walletTransactions, isEmpty);
    expect(s.selectedTokenPackageId, 'p500');
    expect(primary(t, 'خرید توکن').onPressed, isNotNull);
    expect(t.takeException(), isNull);
    await cleanupWallet(t, s);
  });
  testWidgets(
    'Repeated recharge tap creates only one route and back keeps selected service',
    (t) async {
      final s = DemoStore();
      await startWallet(t, s);
      await tapWallet(t, find.byKey(const ValueKey('service-new-plan')));
      final charge = primary(t, 'شارژ کیف پول').onPressed!;
      charge();
      charge();
      await t.pumpAndSettle();
      expect(find.byType(TokenPackagesScreen), findsOneWidget);
      t.state<NavigatorState>(find.byType(Navigator).first).pop();
      await t.pumpAndSettle();
      expect(find.byType(PlanServicesScreen), findsOneWidget);
      expect(s.selectedPlanServiceId, 'new-plan');
      expect(s.tokenBalance, 100);
      expect(t.takeException(), isNull);
      await cleanupWallet(t, s);
    },
  );
  testWidgets(
    'Debug balance validates input, formats Persian thousands and resets',
    (t) async {
      final s = DemoStore()..setDebugTokenBalance(1200);
      await startWallet(t, s);
      await tapWallet(t, find.text('ابزار تست کیف پول'));
      final field = find.byKey(const ValueKey('wallet-debug-balance'));
      await t.ensureVisible(field);
      await t.enterText(field, '-20');
      await tapWallet(t, find.text('اعمال موجودی'));
      expect(s.tokenBalance, 1200);
      expect(find.text('یک عدد صحیح صفر یا بیشتر وارد کن.'), findsOneWidget);
      await t.ensureVisible(field);
      await t.enterText(field, '۲,۵۰۰');
      await tapWallet(t, find.text('اعمال موجودی'));
      expect(s.tokenBalance, 2500);
      expect(find.text('موجودی توکن کیف پول شما: ۲,۵۰۰ توکن'), findsOneWidget);
      await tapWallet(t, find.text('ریست پیش‌فرض'));
      expect(s.tokenBalance, 100);
      expect(t.widget<TextFormField>(field).controller!.text, '۱۰۰');
      expect(t.takeException(), isNull);
      await cleanupWallet(t, s);
    },
  );
  testWidgets('Wallet, package list and gateway fit a narrow mobile viewport', (
    t,
  ) async {
    final s = DemoStore();
    await startWallet(t, s);
    t.view.physicalSize = const Size(320, 700);
    await t.pumpAndSettle();
    await tapWallet(t, find.byKey(const ValueKey('service-new-plan')));
    await tapWallet(t, find.widgetWithText(PrimaryButton, 'شارژ کیف پول'));
    await tapWallet(t, find.byKey(const ValueKey('package-p500')));
    await tapWallet(t, find.widgetWithText(PrimaryButton, 'خرید توکن'));
    expect(find.byType(MockPaymentScreen), findsOneWidget);
    expect(t.takeException(), isNull);
    await tapWallet(t, find.text('پرداخت ناموفق / انصراف'));
    expect(s.tokenBalance, 100);
    expect(t.takeException(), isNull);
    await cleanupWallet(t, s);
  });
}
