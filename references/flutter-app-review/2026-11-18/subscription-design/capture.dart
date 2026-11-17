// From app: flutter test --no-pub ../references/flutter-app-review/2026-11-18/subscription-design/capture.dart
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sabzine_flutter/core/theme/theme.dart';
import 'package:sabzine_flutter/data/demo_store.dart';
import 'package:sabzine_flutter/domain/commerce/commerce.dart';
import 'package:sabzine_flutter/presentation/screens/wallet_flow.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUpAll(() async {
    SharedPreferences.setMockInitialValues({});
    await (FontLoader('Vazirmatn')
          ..addFont(rootBundle.load('assets/fonts/Vazirmatn-Regular.ttf'))
          ..addFont(rootBundle.load('assets/fonts/Vazirmatn-Bold.ttf')))
        .load();
    await (FontLoader(
      'MaterialIcons',
    )..addFont(rootBundle.load('fonts/MaterialIcons-Regular.otf'))).load();
  });
  testWidgets('capture real subscription page and checkout choices', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(780, 1800);
    tester.view.devicePixelRatio = 2;
    addTearDown(tester.view.reset);
    final store = DemoStore(clock: () => DateTime(2026, 11, 18, 12))
      ..loginDemoUser();
    store.approveActiveUserRequest();
    store.planSubscription = PlanSubscription(
      title: 'پلن شروع',
      status: 'active',
      endsAt: DateTime.utc(2026, 12, 2),
    );
    store.selectedPlanServiceId = 'new-plan';
    store.selectedSubscriptionPlanId = 'monthly';
    addTearDown(store.dispose);
    const capture = ValueKey('subscription-capture');
    Future<void> mount({double scale = 1}) async {
      await tester.pumpWidget(const SizedBox());
      await tester.pumpWidget(
        DemoScope(
          store: store,
          child: MaterialApp(
            debugShowCheckedModeBanner: false,
            theme: appTheme(),
            builder: (context, child) => MediaQuery(
              data: MediaQuery.of(context).copyWith(
                disableAnimations: true,
                textScaler: TextScaler.linear(scale),
              ),
              child: Directionality(
                textDirection: TextDirection.rtl,
                child: child!,
              ),
            ),
            home: RepaintBoundary(
              key: capture,
              child: Navigator(
                onGenerateRoute: (_) => MaterialPageRoute<void>(
                  builder: (_) => Scaffold(
                    body: Center(
                      child: TextButton(
                        onPressed: () {},
                        child: const Text('پروفایل'),
                      ),
                    ),
                  ),
                ),
                initialRoute: '/plans',
                onGenerateInitialRoutes: (_, __) => [
                  MaterialPageRoute<void>(builder: (_) => const Scaffold()),
                  MaterialPageRoute<void>(
                    builder: (_) => const PlanServicesScreen(),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      final context = tester.element(find.byType(PlanServicesScreen));
      await tester.runAsync(() async {
        for (final widget in tester.widgetList<Image>(find.byType(Image))) {
          await precacheImage(widget.image, context);
        }
      });
      await tester.pumpAndSettle();
    }

    Future<void> shot(String name) async {
      expect(tester.takeException(), isNull);
      await tester.runAsync(() async {
        final boundary = tester.renderObject<RenderRepaintBoundary>(
          find.byKey(capture),
        );
        final picture = await boundary.toImage(pixelRatio: 2);
        final bytes = await picture.toByteData(format: ui.ImageByteFormat.png);
        await File(
          '../references/flutter-app-review/2026-11-18/subscription-design/$name.png',
        ).writeAsBytes(bytes!.buffer.asUint8List());
        picture.dispose();
      });
    }

    await mount();
    await shot('active-selected');
    store.selectedPlanServiceId = null;
    store.selectedSubscriptionPlanId = null;
    store.planSubscription = null;
    store.update();
    await tester.pumpAndSettle();
    await shot('no-selection');
    tester.view.physicalSize = const Size(640, 1480);
    await mount(scale: 1.8);
    await shot('narrow-large-text');
    await tester.pumpWidget(const SizedBox());
  });
}
