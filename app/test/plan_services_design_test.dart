import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sabzine_flutter/core/theme/theme.dart';
import 'package:sabzine_flutter/data/demo_store.dart';
import 'package:sabzine_flutter/domain/commerce/commerce.dart';
import 'package:sabzine_flutter/presentation/screens/wallet_flow.dart';

Widget planDesignHost(DemoStore store, {double scale = 1}) => DemoScope(
  store: store,
  child: MaterialApp(
    theme: appTheme(),
    builder: (context, child) => MediaQuery(
      data: MediaQuery.of(
        context,
      ).copyWith(disableAnimations: true, textScaler: TextScaler.linear(scale)),
      child: Directionality(textDirection: TextDirection.rtl, child: child!),
    ),
    home: const PlanServicesScreen(),
  ),
);

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));
  testWidgets(
    'plan details and checkout summary use the selected catalogue offer',
    (tester) async {
      tester.view.physicalSize = const Size(390, 844);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      final store = DemoStore()
        ..login(AppRole.user)
        ..questionnaireComplete = true;
      await tester.pumpWidget(planDesignHost(store));
      await tester.pumpAndSettle();
      final monthly = find.byKey(const ValueKey('plan-monthly'));
      await tester.ensureVisible(monthly);
      await tester.tap(monthly);
      await tester.pumpAndSettle();
      expect(
        tester.widget<Text>(find.byKey(const ValueKey('payable-amount'))).data,
        '۱٬۹۹۰٬۰۰۰ تومان',
      );
      expect(
        tester
            .widget<Text>(find.byKey(const ValueKey('checkout-selection')))
            .data,
        'پلن همراه · ۳۰ روزه',
      );
      await tester.tap(
        find.descendant(of: monthly, matching: find.text('امکانات پلن')),
      );
      await tester.pumpAndSettle();
      expect(find.text('امکانات پلن همراه'), findsOneWidget);
      for (final feature
          in store.subscriptionOffers
              .firstWhere((plan) => plan.id == 'monthly')
              .features) {
        expect(find.text(feature), findsOneWidget);
      }
      expect(store.selectedSubscriptionPlanId, 'monthly');
      await tester.tap(find.text('بستن'));
      await tester.pumpAndSettle();
      final quarterly = find.byKey(const ValueKey('plan-quarterly'));
      await tester.ensureVisible(quarterly);
      await tester.tap(quarterly);
      await tester.pumpAndSettle();
      expect(
        tester.widget<Text>(find.byKey(const ValueKey('payable-amount'))).data,
        '۸٬۹۹۰٬۰۰۰ تومان',
      );
      expect(
        tester
            .widget<Text>(find.byKey(const ValueKey('checkout-selection')))
            .data,
        'پلن VIP · ۹۰ روزه',
      );
      expect(store.planPurchases, isEmpty);
      expect(store.planSubscription, isNull);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
      store.dispose();
    },
  );

  testWidgets(
    'expired membership and selected plan fit narrow large-text screens',
    (tester) async {
      tester.view.physicalSize = const Size(320, 740);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      final store = DemoStore()
        ..login(AppRole.user)
        ..questionnaireComplete = true
        ..selectedPlanServiceId = 'new-plan'
        ..selectedSubscriptionPlanId = 'monthly'
        ..planSubscription = const PlanSubscription(
          title: 'پلن همراه',
          status: 'expired',
        );
      await tester.pumpWidget(planDesignHost(store, scale: 1.8));
      await tester.pumpAndSettle();
      expect(find.text('پایان یافته'), findsOneWidget);
      expect(find.text('فعال'), findsNothing);
      expect(find.byKey(const ValueKey('payable-amount')), findsOneWidget);
      expect(tester.takeException(), isNull);
      await tester.ensureVisible(find.byKey(const ValueKey('plan-quarterly')));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
      store.dispose();
    },
  );

  for (final currentId in ['weekly', 'monthly']) {
    testWidgets('active $currentId confirms renewal before any payment', (
      tester,
    ) async {
      tester.view.physicalSize = currentId == 'weekly'
          ? const Size(320, 740)
          : const Size(390, 844);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      final store = DemoStore()
        ..login(AppRole.user)
        ..questionnaireComplete = true
        ..selectedPlanServiceId = 'new-plan'
        ..selectedSubscriptionPlanId = 'monthly';
      final current = store.subscriptionById(currentId)!;
      final originalEnd = store.today.add(const Duration(days: 10));
      store.planSubscription = PlanSubscription(
        planId: currentId,
        title: current.title,
        status: 'active',
        endsAt: originalEnd,
      );
      final action = currentId == 'weekly'
          ? 'تمدید و ارتقا به پلن همراه'
          : 'تمدید پلن همراه';
      await tester.pumpWidget(
        planDesignHost(store, scale: currentId == 'weekly' ? 1.8 : 1),
      );
      await tester.pumpAndSettle();
      expect(
        find.byKey(const ValueKey('subscription-renewal-notice')),
        findsOneWidget,
      );
      expect(find.text('پرداخت و $action'), findsOneWidget);
      await tester.tap(find.text('پرداخت و $action'));
      await tester.pumpAndSettle();
      expect(find.text(action), findsOneWidget);
      expect(
        find.textContaining('مبلغ کامل پلن: ۱٬۹۹۰٬۰۰۰ تومان'),
        findsOneWidget,
      );
      expect(store.planPurchases, isEmpty);
      expect(store.planSubscription!.endsAt, originalEnd);
      await tester.tap(find.text('انصراف'));
      await tester.pumpAndSettle();
      expect(find.byType(PlanPaymentScreen), findsNothing);
      expect(store.planPurchases, isEmpty);
      await tester.tap(find.text('پرداخت و $action'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('تأیید و ادامهٔ پرداخت'));
      await tester.pumpAndSettle();
      expect(find.byType(PlanPaymentScreen), findsOneWidget);
      await tester.tap(find.text('پرداخت موفق'));
      await tester.pumpAndSettle();
      expect(store.planSubscription!.planId, 'monthly');
      expect(
        store.planSubscription!.endsAt,
        originalEnd.add(const Duration(days: 30)),
      );
      expect(store.planPurchases, hasLength(1));
      expect(find.text('اشتراک با موفقیت تمدید شد'), findsOneWidget);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
      store.dispose();
    });
  }
}
