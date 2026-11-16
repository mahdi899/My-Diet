import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sabzine_flutter/core/theme/theme.dart';
import 'package:sabzine_flutter/presentation/screens/payment_recovery_view.dart';
import 'package:sabzine_flutter/presentation/widgets/brand_scene.dart';

void main() {
  testWidgets(
    'pending and failed payment keep distinct art and working recovery at large text',
    (t) async {
      t.view.physicalSize = const Size(320, 720);
      t.view.devicePixelRatio = 1;
      addTearDown(t.view.reset);
      for (final pending in [true, false]) {
        var retries = 0;
        await t.pumpWidget(const SizedBox());
        await t.pumpWidget(
          MaterialApp(
            theme: appTheme(),
            builder: (context, child) => MediaQuery(
              data: MediaQuery.of(
                context,
              ).copyWith(textScaler: TextScaler.linear(1.5)),
              child: Directionality(
                textDirection: TextDirection.rtl,
                child: child!,
              ),
            ),
            home: Scaffold(
              body: PaymentRecoveryView(
                planTitle: 'برنامهٔ غذایی شخصی',
                amount: '۲۹۹٬۰۰۰ تومان',
                message: pending
                    ? 'در انتظار پاسخ درگاه'
                    : 'پرداخت لغو شده است',
                pending: pending,
                onRetry: () => retries++,
                onBack: () {},
                onSupport: () {},
              ),
            ),
          ),
        );
        await t.pumpAndSettle();
        expect(
          t.widget<BrandScene>(find.byType(BrandScene)).kind,
          pending ? BrandSceneKind.paymentPending : BrandSceneKind.paymentIssue,
        );
        final retry = find.text(
          pending ? 'بررسی نتیجهٔ پرداخت' : 'تلاش دوباره برای پرداخت',
        );
        await t.scrollUntilVisible(retry, 180);
        await t.tap(retry);
        expect(retries, 1);
        expect(t.takeException(), isNull);
      }
    },
  );
}
