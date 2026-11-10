import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sabzine_flutter/core/motion/motion_kit.dart';
import 'package:sabzine_flutter/core/theme/theme.dart';
import 'package:sabzine_flutter/presentation/widgets/kit/kit.dart';

Widget host(Widget child, {bool reduce = false}) => MaterialApp(
  theme: appTheme(),
  builder: (context, c) => MediaQuery(
    data: MediaQuery.of(context).copyWith(disableAnimations: reduce),
    child: Directionality(textDirection: TextDirection.rtl, child: c!),
  ),
  home: Scaffold(body: Center(child: child)),
);

void main() {
  testWidgets('Ticker counts up to a Persian-digit value', (tester) async {
    await tester.pumpWidget(
      host(const Ticker(value: 1850, grouped: true, suffix: ' کالری')),
    );
    await tester.pump(const Duration(milliseconds: 1100));
    expect(find.text('۱٬۸۵۰ کالری'), findsOneWidget);
  });

  testWidgets('Ticker formats fractions and honours reduce-motion', (
    tester,
  ) async {
    await tester.pumpWidget(
      host(const Ticker(value: 72.4, fractionDigits: 1), reduce: true),
    );
    await tester.pump();
    expect(find.text('۷۲٫۴'), findsOneWidget);
  });

  testWidgets('Ring, AppCard and PillButton build and tap', (tester) async {
    var taps = 0;
    await tester.pumpWidget(
      host(
        AppCard(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Ring(value: 0.5, size: 80, child: Text('x')),
              PillButton(label: 'شروع', onPressed: () => taps++),
              const SkeletonCard(height: 80),
            ],
          ),
        ),
      ),
    );
    await tester.pump(const Duration(milliseconds: 1200));
    await tester.tap(find.text('شروع'));
    expect(taps, 1);
    await tester.pumpWidget(const SizedBox());
  });

  testWidgets('rise() is a no-op under reduce-motion', (tester) async {
    await tester.pumpWidget(host(const Text('سلام').rise(), reduce: true));
    expect(find.text('سلام'), findsOneWidget);
  });
}
