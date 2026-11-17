// From app: flutter test --no-pub ../references/flutter-app-review/2026-11-18/botanical-footer/capture.dart
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sabzine_flutter/core/theme/theme.dart';
import 'package:sabzine_flutter/data/demo_store.dart';
import 'package:sabzine_flutter/features/home/home_journey_footer.dart';

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
  testWidgets('capture botanical footer at normal and large text sizes', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(780, 1800);
    tester.view.devicePixelRatio = 2;
    addTearDown(tester.view.reset);
    var now = DateTime(2026, 11, 18, 12);
    final store = DemoStore(clock: () => now)..loginDemoUser();
    store.approveActiveUserRequest();
    store.applyOnboardingWeight(74);
    addTearDown(store.dispose);
    const capture = ValueKey('botanical-capture');
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
            home: Scaffold(
              backgroundColor: const Color(0xFFFBF9F3),
              body: SingleChildScrollView(
                padding: const EdgeInsets.all(16),
                child: RepaintBoundary(
                  key: capture,
                  child: ColoredBox(
                    color: const Color(0xFFFBF9F3),
                    child: Padding(
                      padding: const EdgeInsets.all(4),
                      child: HomeJourneyFooter(onCoach: () {}),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      final context = tester.element(find.byType(HomeJourneyFooter));
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
          '../references/flutter-app-review/2026-11-18/botanical-footer/$name.png',
        ).writeAsBytes(bytes!.buffer.asUint8List());
        picture.dispose();
      });
    }

    await mount();
    await shot('single-weight');
    now = DateTime(2026, 11, 19, 12);
    store.addWeight(73.8);
    now = DateTime(2026, 11, 20, 12);
    store.addWeight(73.9);
    now = DateTime(2026, 11, 20, 18);
    store.addWeight(73.4);
    for (var i = 0; i < store.mealsOn(now).length; i++) {
      await store.setMealEaten(now, i, true);
    }
    await mount();
    await shot('weight-history');
    tester.view.physicalSize = const Size(640, 1480);
    await mount(scale: 1.5);
    await shot('narrow-large-text');
    await tester.pumpWidget(const SizedBox());
  });
}
