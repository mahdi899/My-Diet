import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sabzine_flutter/app.dart';
import 'package:sabzine_flutter/data/demo_store.dart';
import 'package:sabzine_flutter/domain/commerce/commerce.dart';
import 'package:sabzine_flutter/presentation/screens/wallet_flow.dart';
import 'package:sabzine_flutter/presentation/widgets/ui.dart';
import 'widget_test.dart' show mobile;

Future<void> tapPlan(WidgetTester tester, Finder finder) async {
  await tester.ensureVisible(finder);
  await tester.pumpAndSettle();
  await tester.tap(finder);
  await tester.pumpAndSettle();
}

Future<void> openProfilePlans(WidgetTester tester) async {
  if (find.byKey(const ValueKey('tab-coach')).evaluate().isNotEmpty) {
    await tester.tap(find.byKey(const ValueKey('tab-coach')));
    await tester.pumpAndSettle();
  }
  await tester.tap(find.byKey(const ValueKey('coach-avatar')));
  await tester.pumpAndSettle();
  expect(find.text('کیف پول و تعرفه‌ها'), findsNothing);
  expect(find.text('برنامه‌های قبلی'), findsNothing);
  await tapPlan(tester, find.text('پلن‌ها و اشتراک من'));
}

Future<void> startPlans(
  WidgetTester tester,
  DemoStore store, {
  bool questionnaireComplete = true,
}) async {
  mobile(tester);
  tester.binding.platformDispatcher.accessibilityFeaturesTestValue =
      const FakeAccessibilityFeatures(disableAnimations: true);
  addTearDown(
    tester.binding.platformDispatcher.clearAccessibilityFeaturesTestValue,
  );
  store.questionnaireComplete = questionnaireComplete;
  store.login(AppRole.user);
  await tester.pumpWidget(
    SabzineApp(store: store, splashDuration: Duration.zero),
  );
  await tester.pumpAndSettle();
  await openProfilePlans(tester);
}

PrimaryButton primary(WidgetTester tester, String label) =>
    tester.widget<PrimaryButton>(find.widgetWithText(PrimaryButton, label));

Future<void> cleanup(WidgetTester tester, DemoStore store) async {
  await tester.pumpWidget(const SizedBox());
  await tester.pump();
  store.dispose();
}

void main() {
  testWidgets('Profile shows rates and subscription without wallet controls', (
    tester,
  ) async {
    final store = DemoStore();
    await startPlans(tester, store);
    expect(primary(tester, 'پرداخت و فعال‌سازی پلن').onPressed, isNull);
    expect(find.byKey(const ValueKey('subscription-summary')), findsOneWidget);
    expect(find.textContaining('هنوز اشتراک فعالی نداری'), findsOneWidget);
    await tapPlan(tester, find.byKey(const ValueKey('plan-monthly')));
    expect(
      tester.widget<Text>(find.byKey(const ValueKey('payable-amount'))).data,
      '۱٬۹۹۰٬۰۰۰ تومان',
    );
    expect(find.textContaining('کیف پول'), findsNothing);
    expect(find.textContaining('موجودی'), findsNothing);
    expect(primary(tester, 'پرداخت و فعال‌سازی پلن').onPressed, isNotNull);
    expect(tester.takeException(), isNull);
    await cleanup(tester, store);
  });

  testWidgets(
    'Direct payment activates once and subscription appears in profile',
    (tester) async {
      final store = DemoStore();
      await startPlans(tester, store);
      await tapPlan(tester, find.byKey(const ValueKey('plan-monthly')));
      final purchase = primary(tester, 'پرداخت و فعال‌سازی پلن').onPressed!;
      purchase();
      purchase();
      await tester.pumpAndSettle();
      expect(find.byType(PlanPaymentScreen), findsOneWidget);
      expect(store.planSubscription, isNull);
      expect(store.hasUserRequest, isFalse);
      final complete = primary(tester, 'پرداخت موفق').onPressed!;
      complete();
      complete();
      await tester.pumpAndSettle();
      expect(store.walletBalance, 0);
      expect(store.walletTransactions, isEmpty);
      expect(store.planPurchases, hasLength(1));
      expect(store.planSubscription!.activeAt(store.today), isTrue);
      expect(store.planSubscription!.title, 'پلن همراه');
      expect(
        store.planSubscription!.endsAt!.difference(store.today).inDays,
        29,
      );
      expect(store.hasUserRequest, isTrue);
      await tapPlan(tester, find.text('ورود به برنامه'));
      expect(find.byType(PlanServicesScreen), findsNothing);
      expect(store.userSignedIn, isTrue);
      expect(store.entryStage, EntryStage.home);
      expect(find.byType(PanelShell), findsOneWidget);
      await openProfilePlans(tester);
      expect(find.text('فعال'), findsOneWidget);
      expect(find.textContaining('کیف پول'), findsNothing);
      expect(tester.takeException(), isNull);
      await cleanup(tester, store);
    },
  );

  testWidgets('Failed payment preserves selection and never grants access', (
    tester,
  ) async {
    final store = DemoStore();
    await startPlans(tester, store);
    await tapPlan(tester, find.byKey(const ValueKey('plan-monthly')));
    await tapPlan(
      tester,
      find.widgetWithText(PrimaryButton, 'پرداخت و فعال‌سازی پلن'),
    );
    await tapPlan(tester, find.text('پرداخت ناموفق / انصراف'));
    expect(store.hasUserRequest, isFalse);
    expect(store.planSubscription, isNull);
    expect(store.planPurchases, isEmpty);
    expect(store.selectedPlanServiceId, 'new-plan');
    expect(find.text('پرداخت لغو شد؛ پلنی فعال نشد.'), findsOneWidget);
    await tapPlan(
      tester,
      find.widgetWithText(PrimaryButton, 'تلاش دوباره برای پرداخت'),
    );
    expect(find.byType(PlanPaymentScreen), findsOneWidget);
    expect(tester.takeException(), isNull);
    await cleanup(tester, store);
  });

  testWidgets('Legacy balance never bypasses direct payment', (tester) async {
    final store = DemoStore()..setDebugWalletBalance(500000);
    await startPlans(tester, store);
    await tapPlan(tester, find.byKey(const ValueKey('plan-monthly')));
    await tapPlan(
      tester,
      find.widgetWithText(PrimaryButton, 'پرداخت و فعال‌سازی پلن'),
    );
    expect(find.byType(PlanPaymentScreen), findsOneWidget);
    await tapPlan(tester, find.widgetWithText(PrimaryButton, 'پرداخت موفق'));
    expect(store.walletBalance, 500000);
    expect(store.planPurchases.single.priceToman, 1990000);
    await tapPlan(tester, find.text('ورود به برنامه'));
    await cleanup(tester, store);
  });

  testWidgets(
    'Profile rates remain available before questionnaire completion',
    (tester) async {
      final store = DemoStore();
      await startPlans(tester, store, questionnaireComplete: false);
      expect(find.byType(PlanServicesScreen), findsOneWidget);
      expect(find.byKey(const ValueKey('plan-monthly')), findsOneWidget);
      expect(tester.takeException(), isNull);
      await cleanup(tester, store);
    },
  );

  testWidgets(
    'Expired subscription is displayed without claiming active access',
    (tester) async {
      final store = DemoStore()
        ..planSubscription = PlanSubscription(
          title: 'پلن تغذیه',
          status: 'active',
          endsAt: DateTime(2020),
        );
      await startPlans(tester, store);
      expect(find.text('پایان یافته'), findsOneWidget);
      expect(find.text('فعال'), findsNothing);
      expect(find.textContaining('اعتبار تا'), findsOneWidget);
      await cleanup(tester, store);
    },
  );
}
